import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { turso, isTursoConfigured } from '../../../../lib/tursoClient';

const JWT_SECRET = process.env.JWT_SECRET || 'n1-learning-app-secret-jwt-key-2026';

export async function POST(req: NextRequest) {
  if (!isTursoConfigured() || !turso) {
    return NextResponse.json(
      { error: 'Turso Database chưa được cấu hình trên server.' },
      { status: 500 }
    );
  }

  // 1. Xác thực người dùng
  const token = req.cookies.get('auth_token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
  }

  let userId = '';
  try {
    const secretKey = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secretKey);
    userId = payload.userId as string;
  } catch (err) {
    return NextResponse.json({ error: 'Phiên đăng nhập đã hết hạn.' }, { status: 401 });
  }

  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Thiếu ID từ vựng cần xóa.' }, { status: 400 });
    }

    // 2. Xóa trên database Turso SQLite
    const result = await turso.execute({
      sql: 'DELETE FROM vocabulary WHERE id = ? AND user_id = ?',
      args: [id, userId],
    });

    if (result.rowsAffected === 0) {
      return NextResponse.json({ error: 'Từ vựng không tồn tại hoặc bạn không có quyền xóa.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Đã xóa từ vựng khỏi Cloud thành công.',
    });
  } catch (err: any) {
    console.error('Lỗi API Delete Vocab:', err);
    return NextResponse.json(
      { error: err.message || 'Lỗi xảy ra khi xóa từ vựng.' },
      { status: 500 }
    );
  }
}
