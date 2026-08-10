import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'n1-learning-app-secret-jwt-key-2026';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('auth_token')?.value;

  if (!token) {
    return NextResponse.json(
      { error: 'Chưa đăng nhập.' },
      { status: 401 }
    );
  }

  try {
    const secretKey = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secretKey);

    return NextResponse.json({
      success: true,
      user: {
        id: payload.userId,
        email: payload.email,
      },
    });
  } catch (err) {
    // Token không hợp lệ hoặc hết hạn
    const response = NextResponse.json(
      { error: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ.' },
      { status: 401 }
    );
    // Xóa cookie bẩn
    response.cookies.set({
      name: 'auth_token',
      value: '',
      httpOnly: true,
      path: '/',
      maxAge: 0,
    });
    return response;
  }
}
