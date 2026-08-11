import {
  getUnsyncedVocabulary,
  getUnsyncedReviews,
  saveVocabulary,
  saveReview,
  clearAllData,
  getAllMemos,
  getAllProgress,
  saveMemo,
  saveProgress,
  getProgress,
  lessonKey,
  LocalProgress,
} from './indexedDbHelper';

let isSyncing = false;
let isSyncingLesson = false;

/**
 * Đồng bộ dữ liệu 2 chiều giữa IndexedDB và Turso Database qua API Next.js
 */
export async function syncData(userId: string): Promise<{ success: boolean; message: string }> {
  if (isSyncing) return { success: false, message: 'Đồng bộ đang chạy...' };
  
  isSyncing = true;
  console.log('Bắt đầu đồng bộ dữ liệu với Turso cho user:', userId);

  try {
    // 1. Thu thập dữ liệu thay đổi ở local chưa đồng bộ
    const unsyncedVocab = await getUnsyncedVocabulary();
    const unsyncedReviews = await getUnsyncedReviews();

    // Chỉ sync dữ liệu của user hiện tại
    const userUnsyncedVocab = unsyncedVocab.filter(v => v.user_id === userId);
    const userUnsyncedReviews = unsyncedReviews.filter(r => r.user_id === userId);

    // 2. Gửi request đồng bộ lên Server Next.js
    const response = await fetch('/api/vocab/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        unsyncedVocab: userUnsyncedVocab,
        unsyncedReviews: userUnsyncedReviews,
        deletedVocabIds: [], // Sẽ xóa trực tiếp trên Cloud qua API delete
      }),
    });

    const json = await response.json();

    if (!response.ok) {
      throw new Error(json.error || 'Lỗi từ server khi đồng bộ.');
    }

    const { vocabulary = [], reviews = [] } = json.data;

    // 3. Cập nhật lại dữ liệu local (IndexedDB) dựa trên dữ liệu chuẩn từ Turso
    // Ghi đè hoặc chèn mới dữ liệu từ Cloud về local và đánh dấu đã sync
    for (const item of vocabulary) {
      await saveVocabulary({
        ...item,
        synced: true,
      });
    }

    for (const review of reviews) {
      await saveReview({
        ...review,
        synced: true,
      });
    }

    console.log('Đồng bộ dữ liệu Turso thành công!');
    isSyncing = false;
    return { success: true, message: 'Đồng bộ hoàn tất thành công!' };

  } catch (err: any) {
    console.error('Lỗi trong quá trình đồng bộ:', err);
    isSyncing = false;
    return { success: false, message: `Lỗi đồng bộ: ${err.message || err}` };
  }
}

/**
 * Chuyển tiến độ cũ đang nằm trong localStorage['n1_completed'] sang IndexedDB.
 * Trước đây tiến độ chỉ lưu localStorage nên nếu không migrate, người dùng sẽ
 * thấy toàn bộ bài đã học bị mất dấu hoàn thành. Chỉ chạy đúng một lần.
 */
export async function migrateLegacyProgress(userId: string): Promise<number> {
  if (typeof window === 'undefined') return 0;

  const MIGRATION_FLAG = `n1_progress_migrated_${userId}`;
  if (localStorage.getItem(MIGRATION_FLAG)) return 0;

  const raw = localStorage.getItem('n1_completed');
  if (!raw) {
    localStorage.setItem(MIGRATION_FLAG, '1');
    return 0;
  }

  let parsed: Record<string, boolean> = {};
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    localStorage.setItem(MIGRATION_FLAG, '1');
    return 0;
  }

  const now = new Date().toISOString();
  let migrated = 0;

  for (const [lessonId, done] of Object.entries(parsed)) {
    if (!done) continue;

    // Không ghi đè nếu IndexedDB đã có bản ghi cho bài này.
    const existing = await getProgress(userId, lessonId);
    if (existing) continue;

    await saveProgress({
      id: lessonKey(userId, lessonId),
      user_id: userId,
      lesson_id: lessonId,
      completed: true,
      completed_at: now,
      updated_at: now,
      synced: false,
    });
    migrated++;
  }

  localStorage.setItem(MIGRATION_FLAG, '1');
  return migrated;
}

/**
 * Đồng bộ memo và tiến độ bài học giữa IndexedDB và Turso.
 */
export async function syncLessonData(
  userId: string
): Promise<{ success: boolean; message: string }> {
  if (isSyncingLesson) return { success: false, message: 'Đồng bộ bài học đang chạy...' };

  isSyncingLesson = true;

  try {
    // 1. Thu thập thay đổi chưa đồng bộ ở local
    const allMemos = await getAllMemos(userId);
    const allProgress = await getAllProgress(userId);
    const unsyncedMemos = allMemos.filter((m) => !m.synced);
    const unsyncedProgress = allProgress.filter((p) => !p.synced);

    const response = await fetch('/api/lesson/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memos: unsyncedMemos, progress: unsyncedProgress }),
    });

    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.error || 'Lỗi từ server khi đồng bộ bài học.');
    }

    const { memos = [], progress = [] } = json.data;

    // 2. Ghi dữ liệu chuẩn từ Turso về local.
    // Chỉ ghi đè khi bản trên server mới hơn hoặc bằng bản local, để không xoá mất
    // thay đổi mà người dùng vừa tạo trong lúc request đang bay.
    const memoByIdLocal = new Map(allMemos.map((m) => [m.id, m]));
    for (const memo of memos) {
      const local = memoByIdLocal.get(memo.id);
      if (local && !local.synced && local.updated_at > memo.updated_at) continue;
      await saveMemo({ ...memo, synced: true });
    }

    const progressByIdLocal = new Map(allProgress.map((p) => [p.id, p]));
    for (const item of progress) {
      const local = progressByIdLocal.get(item.id);
      if (local && !local.synced && local.updated_at > item.updated_at) continue;
      await saveProgress({ ...item, synced: true } as LocalProgress);
    }

    isSyncingLesson = false;
    return { success: true, message: 'Đã đồng bộ ghi chú và tiến độ.' };
  } catch (err: any) {
    console.error('Lỗi khi đồng bộ bài học:', err);
    isSyncingLesson = false;
    return { success: false, message: `Lỗi đồng bộ: ${err.message || err}` };
  }
}

/**
 * Lắng nghe sự kiện Online của trình duyệt để tự động đồng bộ
 */
export function setupAutoSync(userId: string, onSyncComplete?: () => void) {
  if (typeof window === 'undefined') return;

  const handleOnline = async () => {
    console.log('Kết nối Internet đã khôi phục. Đang tự động đồng bộ...');
    const res = await syncData(userId);
    if (res.success && onSyncComplete) {
      onSyncComplete();
    }
  };

  window.addEventListener('online', handleOnline);

  // Trả về hàm cleanup
  return () => {
    window.removeEventListener('online', handleOnline);
  };
}
