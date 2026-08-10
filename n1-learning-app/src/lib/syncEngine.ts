import { 
  getUnsyncedVocabulary, 
  getUnsyncedReviews, 
  saveVocabulary, 
  saveReview,
  clearAllData
} from './indexedDbHelper';

let isSyncing = false;

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
