import { NextRequest, NextResponse } from 'next/server';
import { turso, isTursoConfigured } from '../../../../lib/tursoClient';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'n1-learning-app-secret-jwt-key-2026';

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
        { error: 'Vui lòng nhập đầy đủ email và mật khẩu.' },
        { status: 400 }
      );
    }

    // 1. Tìm user
    const checkUser = await turso.execute({
      sql: 'SELECT * FROM users WHERE email = ? LIMIT 1',
      args: [email.toLowerCase().trim()],
    });

    if (checkUser.rows.length === 0) {
      return NextResponse.json(
        { error: 'Thông tin đăng nhập không chính xác.' },
        { status: 400 }
      );
    }

    const dbUser = checkUser.rows[0];
    const passwordHash = dbUser.password_hash as string;

    // 2. So khớp mật khẩu
    const isMatch = await bcrypt.compare(password, passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { error: 'Thông tin đăng nhập không chính xác.' },
        { status: 400 }
      );
    }

    // 3. Tạo JWT
    const secretKey = new TextEncoder().encode(JWT_SECRET);
    const token = await new SignJWT({ userId: dbUser.id as string, email: dbUser.email as string })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('30d') // Hết hạn sau 30 ngày
      .sign(secretKey);

    // 4. Trả về response kèm Cookie
    const response = NextResponse.json({
      success: true,
      message: 'Đăng nhập thành công.',
      data: {
        id: dbUser.id,
        email: dbUser.email,
      },
    });

    response.cookies.set({
      name: 'auth_token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 ngày
    });

    return response;
  } catch (err: any) {
    console.error('Lỗi API Login:', err);
    return NextResponse.json(
      { error: err.message || 'Lỗi hệ thống khi đăng nhập.' },
      { status: 500 }
    );
  }
}
