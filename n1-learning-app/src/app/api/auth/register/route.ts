import { NextRequest, NextResponse } from 'next/server';
import { turso, isTursoConfigured } from '../../../../lib/tursoClient';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  if (!isTursoConfigured() || !turso) {
    return NextResponse.json(
      { error: 'Turso Database chưa được cấu hình biến môi trường trên server.' },
      { status: 500 }
    );
  }

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Vui lòng điền đầy đủ email và mật khẩu.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Mật khẩu phải chứa ít nhất 6 ký tự.' },
        { status: 400 }
      );
    }

    // 1. Kiểm tra email đã tồn tại chưa
    const checkUser = await turso.execute({
      sql: 'SELECT id FROM users WHERE email = ? LIMIT 1',
      args: [email.toLowerCase().trim()],
    });

    if (checkUser.rows.length > 0) {
      return NextResponse.json(
        { error: 'Email này đã được sử dụng.' },
        { status: 400 }
      );
    }

    // 2. Hash mật khẩu
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();
    const nowStr = new Date().toISOString();

    // 3. Thêm user mới vào SQLite
    await turso.execute({
      sql: 'INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)',
      args: [userId, email.toLowerCase().trim(), passwordHash, nowStr],
    });

    return NextResponse.json({
      success: true,
      message: 'Đăng ký tài khoản thành công.',
      data: {
        id: userId,
        email: email.toLowerCase().trim(),
      },
    });
  } catch (err: any) {
    console.error('Lỗi API Register:', err);
    return NextResponse.json(
      { error: err.message || 'Lỗi hệ thống khi đăng ký.' },
      { status: 500 }
    );
  }
}
