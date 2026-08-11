import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { turso, isTursoConfigured } from '../../../../lib/tursoClient';

const JWT_SECRET = process.env.JWT_SECRET || 'n1-learning-app-secret-jwt-key-2026';

// Chặn payload quá lớn: ảnh memo là data URL nên một request có thể phình rất nhanh.
const MAX_PAYLOAD_BYTES = 6 * 1024 * 1024;

export async function POST(req: NextRequest) {
  if (!isTursoConfigured() || !turso) {
    return NextResponse.json(
      { error: 'Turso Database chưa được cấu hình trên server.' },
      { status: 500 }
    );
  }

  // 1. Xác thực người dùng qua JWT Cookie
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
    const rawBody = await req.text();
    if (rawBody.length > MAX_PAYLOAD_BYTES) {
      return NextResponse.json(
        { error: 'Dữ liệu đồng bộ quá lớn. Hãy bớt ảnh trong memo rồi thử lại.' },
        { status: 413 }
      );
    }

    const { memos = [], progress = [] } = JSON.parse(rawBody || '{}');

    const queries: any[] = [];

    // A. Upsert memo. So sánh updated_at để bản ghi mới hơn thắng (last-write-wins),
    // tránh việc một máy đang giữ dữ liệu cũ ghi đè lên bản vừa sửa ở máy khác.
    for (const memo of memos) {
      if (memo.user_id !== userId) continue;

      queries.push({
        sql: `INSERT INTO lesson_memos (
                id, user_id, lesson_id, content, images, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                content = excluded.content,
                images = excluded.images,
                updated_at = excluded.updated_at
              WHERE excluded.updated_at > lesson_memos.updated_at`,
        args: [
          memo.id,
          userId,
          memo.lesson_id,
          memo.content ?? '',
          JSON.stringify(memo.images ?? []),
          memo.created_at,
          memo.updated_at,
        ],
      });
    }

    // B. Upsert tiến độ hoàn thành
    for (const item of progress) {
      if (item.user_id !== userId) continue;

      queries.push({
        sql: `INSERT INTO lesson_progress (
                id, user_id, lesson_id, completed, completed_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                completed = excluded.completed,
                completed_at = excluded.completed_at,
                updated_at = excluded.updated_at
              WHERE excluded.updated_at > lesson_progress.updated_at`,
        args: [
          item.id,
          userId,
          item.lesson_id,
          item.completed ? 1 : 0,
          item.completed_at ?? null,
          item.updated_at,
        ],
      });
    }

    if (queries.length > 0) {
      await turso.batch(queries);
    }

    // C. Kéo toàn bộ dữ liệu mới nhất về cho client
    const memoResult = await turso.execute({
      sql: 'SELECT * FROM lesson_memos WHERE user_id = ?',
      args: [userId],
    });

    const progressResult = await turso.execute({
      sql: 'SELECT * FROM lesson_progress WHERE user_id = ?',
      args: [userId],
    });

    const memoList = memoResult.rows.map((row: any) => {
      let images: string[] = [];
      try {
        images = JSON.parse(row.images || '[]');
      } catch (e) {
        images = [];
      }

      return {
        id: row.id,
        user_id: row.user_id,
        lesson_id: row.lesson_id,
        content: row.content || '',
        images,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    });

    const progressList = progressResult.rows.map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      lesson_id: row.lesson_id,
      completed: Number(row.completed) === 1,
      completed_at: row.completed_at,
      updated_at: row.updated_at,
    }));

    return NextResponse.json({
      success: true,
      data: {
        memos: memoList,
        progress: progressList,
      },
    });
  } catch (err: any) {
    console.error('Lỗi API Lesson Sync:', err);
    return NextResponse.json(
      { error: err.message || 'Lỗi hệ thống khi đồng bộ bài học.' },
      { status: 500 }
    );
  }
}
