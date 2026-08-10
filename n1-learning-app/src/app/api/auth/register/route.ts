import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  return NextResponse.json(
    { error: 'Chức năng đăng ký tài khoản mới hiện đang bị khóa trên hệ thống.' },
    { status: 403 }
  );
}
