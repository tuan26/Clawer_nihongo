import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const response = NextResponse.json({
      success: true,
      message: 'Đăng xuất thành công.',
    });

    // Xóa cookie bằng cách thiết lập maxAge = 0
    response.cookies.set({
      name: 'auth_token',
      value: '',
      httpOnly: true,
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Lỗi hệ thống khi đăng xuất.' },
      { status: 500 }
    );
  }
}
