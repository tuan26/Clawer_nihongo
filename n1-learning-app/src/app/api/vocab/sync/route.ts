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
    const { unsyncedVocab = [], unsyncedReviews = [], deletedVocabIds = [] } = await req.json();

    const queries: any[] = [];

    // A. Đưa các câu lệnh DELETE vào batch
    for (const id of deletedVocabIds) {
      queries.push({
        sql: 'DELETE FROM vocabulary WHERE id = ? AND user_id = ?',
        args: [id, userId],
      });
    }

    // B. Đưa các câu lệnh UPSERT vocabulary vào batch
    for (const item of unsyncedVocab) {
      if (item.user_id !== userId) continue;

      queries.push({
        sql: `INSERT INTO vocabulary (
                id, user_id, word, reading, meaning_vi, example_ja, example_vi, 
                tags, source, status, created_at, updated_at, next_review_at, 
                interval_days, ease_factor
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                word = excluded.word,
                reading = excluded.reading,
                meaning_vi = excluded.meaning_vi,
                example_ja = excluded.example_ja,
                example_vi = excluded.example_vi,
                tags = excluded.tags,
                source = excluded.source,
                status = excluded.status,
                updated_at = excluded.updated_at,
                next_review_at = excluded.next_review_at,
                interval_days = excluded.interval_days,
                ease_factor = excluded.ease_factor`,
        args: [
          item.id,
          userId,
          item.word,
          item.reading || null,
          item.meaning_vi,
          item.example_ja || null,
          item.example_vi || null,
          JSON.stringify(item.tags || []),
          item.source || null,
          item.status,
          item.created_at,
          item.updated_at,
          item.next_review_at,
          item.interval_days,
          item.ease_factor,
        ],
      });
    }

    // C. Đưa các câu lệnh INSERT reviews vào batch
    for (const review of unsyncedReviews) {
      if (review.user_id !== userId) continue;

      queries.push({
        sql: `INSERT INTO vocabulary_reviews (
                id, vocabulary_id, user_id, reviewed_at, rating, interval_before, interval_after
              ) VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO NOTHING`,
        args: [
          review.id,
          review.vocabulary_id,
          userId,
          review.reviewed_at,
          review.rating,
          review.interval_before,
          review.interval_after,
        ],
      });
    }

    // Thực thi transaction batch nếu có thay đổi
    if (queries.length > 0) {
      await turso.batch(queries);
    }

    // 2. KÉO DỮ LIỆU MỚI NHẤT VỀ ĐỂ ĐỒNG BỘ CHO CLIENT
    const vocabResult = await turso.execute({
      sql: 'SELECT * FROM vocabulary WHERE user_id = ?',
      args: [userId],
    });

    const reviewsResult = await turso.execute({
      sql: 'SELECT * FROM vocabulary_reviews WHERE user_id = ?',
      args: [userId],
    });

    // Parse ngược trường tags từ SQLite string thành mảng JSON để trả về cho client
    const vocabularyList = vocabResult.rows.map((row: any) => {
      let tags: string[] = [];
      try {
        tags = JSON.parse(row.tags || '[]');
      } catch (e) {
        tags = [];
      }

      return {
        id: row.id,
        user_id: row.user_id,
        word: row.word,
        reading: row.reading,
        meaning_vi: row.meaning_vi,
        example_ja: row.example_ja,
        example_vi: row.example_vi,
        tags,
        source: row.source,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        next_review_at: row.next_review_at,
        interval_days: Number(row.interval_days),
        ease_factor: Number(row.ease_factor),
      };
    });

    const reviewsList = reviewsResult.rows.map((row: any) => ({
      id: row.id,
      vocabulary_id: row.vocabulary_id,
      user_id: row.user_id,
      reviewed_at: row.reviewed_at,
      rating: row.rating,
      interval_before: Number(row.interval_before),
      interval_after: Number(row.interval_after),
    }));

    return NextResponse.json({
      success: true,
      data: {
        vocabulary: vocabularyList,
        reviews: reviewsList,
      },
    });
  } catch (err: any) {
    console.error('Lỗi API Sync:', err);
    return NextResponse.json(
      { error: err.message || 'Lỗi xảy ra trong quá trình đồng bộ.' },
      { status: 500 }
    );
  }
}
