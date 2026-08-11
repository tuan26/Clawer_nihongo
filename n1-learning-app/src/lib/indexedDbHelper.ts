const DB_NAME = 'N1VocabularyDB';
// v2: thêm store 'memos' và 'progress' cho ghi chú và tiến độ từng bài học.
const DB_VERSION = 2;

// Khoá dùng chung cho memo và progress: mỗi user chỉ có một bản ghi cho một bài học.
export function lessonKey(userId: string, lessonId: string): string {
  return `${userId}::${lessonId}`;
}

export interface LocalVocabulary {
  id: string;
  user_id: string;
  word: string;
  reading?: string;
  meaning_vi: string;
  example_ja?: string;
  example_vi?: string;
  tags: string[];
  source?: string;
  status: 'new' | 'learning' | 'familiar' | 'strong';
  created_at: string;
  updated_at: string;
  next_review_at: string;
  interval_days: number;
  ease_factor: number;
  synced: boolean; // Flag dùng để đồng bộ
}

export interface LocalMemo {
  id: string; // lessonKey(user_id, lesson_id)
  user_id: string;
  lesson_id: string;
  content: string;
  images: string[]; // data URL của ảnh đã nén
  created_at: string;
  updated_at: string;
  synced: boolean;
}

export interface LocalProgress {
  id: string; // lessonKey(user_id, lesson_id)
  user_id: string;
  lesson_id: string;
  completed: boolean;
  completed_at: string | null;
  updated_at: string;
  synced: boolean;
}

export interface LocalReview {
  id: string;
  vocabulary_id: string;
  user_id: string;
  reviewed_at: string;
  rating: 'again' | 'hard' | 'good' | 'easy';
  interval_before: number;
  interval_after: number;
  synced: boolean; // Flag dùng để đồng bộ
}

export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('IndexedDB is only available in browser'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      
      // Store lưu trữ từ vựng
      if (!db.objectStoreNames.contains('vocabulary')) {
        const vocabStore = db.createObjectStore('vocabulary', { keyPath: 'id' });
        vocabStore.createIndex('user_id', 'user_id', { unique: false });
        vocabStore.createIndex('synced', 'synced', { unique: false });
        vocabStore.createIndex('next_review_at', 'next_review_at', { unique: false });
      }

      // Store lưu trữ lịch sử review
      if (!db.objectStoreNames.contains('reviews')) {
        const reviewStore = db.createObjectStore('reviews', { keyPath: 'id' });
        reviewStore.createIndex('vocabulary_id', 'vocabulary_id', { unique: false });
        reviewStore.createIndex('user_id', 'user_id', { unique: false });
        reviewStore.createIndex('synced', 'synced', { unique: false });
      }

      // Store ghi chú (memo) của từng bài học — thêm ở DB_VERSION 2
      if (!db.objectStoreNames.contains('memos')) {
        const memoStore = db.createObjectStore('memos', { keyPath: 'id' });
        memoStore.createIndex('user_id', 'user_id', { unique: false });
        memoStore.createIndex('lesson_id', 'lesson_id', { unique: false });
      }

      // Store tiến độ hoàn thành từng bài học — thêm ở DB_VERSION 2
      if (!db.objectStoreNames.contains('progress')) {
        const progressStore = db.createObjectStore('progress', { keyPath: 'id' });
        progressStore.createIndex('user_id', 'user_id', { unique: false });
        progressStore.createIndex('lesson_id', 'lesson_id', { unique: false });
      }
    };
  });
}

// === CRUD VOCABULARY ===

export async function saveVocabulary(item: LocalVocabulary): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['vocabulary'], 'readwrite');
    const store = transaction.objectStore('vocabulary');
    const request = store.put(item);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getVocabulary(id: string): Promise<LocalVocabulary | null> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['vocabulary'], 'readonly');
    const store = transaction.objectStore('vocabulary');
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllVocabulary(userId?: string): Promise<LocalVocabulary[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['vocabulary'], 'readonly');
    const store = transaction.objectStore('vocabulary');
    const request = store.getAll();

    request.onsuccess = () => {
      let results = request.result || [];
      if (userId) {
        results = results.filter((item: any) => item.user_id === userId);
      }
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteVocabulary(id: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['vocabulary', 'reviews'], 'readwrite');
    
    // Xóa từ vựng
    const vocabStore = transaction.objectStore('vocabulary');
    vocabStore.delete(id);

    // Xóa cả các review liên quan
    const reviewStore = transaction.objectStore('reviews');
    const index = reviewStore.index('vocabulary_id');
    const request = index.openCursor(IDBKeyRange.only(id));

    request.onsuccess = (event: any) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// === CRUD REVIEWS ===

export async function saveReview(review: LocalReview): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['reviews'], 'readwrite');
    const store = transaction.objectStore('reviews');
    const request = store.put(review);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getReviewsForVocab(vocabId: string): Promise<LocalReview[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['reviews'], 'readonly');
    const store = transaction.objectStore('reviews');
    const index = store.index('vocabulary_id');
    const request = index.getAll(IDBKeyRange.only(vocabId));

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllReviews(userId?: string): Promise<LocalReview[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['reviews'], 'readonly');
    const store = transaction.objectStore('reviews');
    const request = store.getAll();

    request.onsuccess = () => {
      let results = request.result || [];
      if (userId) {
        results = results.filter((item: any) => item.user_id === userId);
      }
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

// === SYNC HELPERS ===

export async function getUnsyncedVocabulary(): Promise<LocalVocabulary[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['vocabulary'], 'readonly');
    const store = transaction.objectStore('vocabulary');
    // Không dùng index 'synced': boolean không phải key hợp lệ của IndexedDB
    const request = store.getAll();

    request.onsuccess = () => {
      const results = (request.result || []).filter((item: any) => !item.synced);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getUnsyncedReviews(): Promise<LocalReview[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['reviews'], 'readonly');
    const store = transaction.objectStore('reviews');
    // Không dùng index 'synced': boolean không phải key hợp lệ của IndexedDB
    const request = store.getAll();

    request.onsuccess = () => {
      const results = (request.result || []).filter((item: any) => !item.synced);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function markVocabularySynced(id: string): Promise<void> {
  const db = await initDB();
  const item = await getVocabulary(id);
  if (!item) return;
  
  item.synced = true;
  return saveVocabulary(item);
}

export async function markReviewSynced(id: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['reviews'], 'readwrite');
    const store = transaction.objectStore('reviews');
    const request = store.get(id);

    request.onsuccess = () => {
      const review = request.result;
      if (review) {
        review.synced = true;
        store.put(review);
        resolve();
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// === MEMO GHI CHÚ BÀI HỌC ===

export async function getMemo(userId: string, lessonId: string): Promise<LocalMemo | null> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['memos'], 'readonly');
    const request = transaction.objectStore('memos').get(lessonKey(userId, lessonId));

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveMemo(memo: LocalMemo): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['memos'], 'readwrite');
    const request = transaction.objectStore('memos').put(memo);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteMemo(userId: string, lessonId: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['memos'], 'readwrite');
    const request = transaction.objectStore('memos').delete(lessonKey(userId, lessonId));

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getAllMemos(userId?: string): Promise<LocalMemo[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['memos'], 'readonly');
    const request = transaction.objectStore('memos').getAll();

    request.onsuccess = () => {
      let results: LocalMemo[] = request.result || [];
      if (userId) results = results.filter((m) => m.user_id === userId);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

// === TIẾN ĐỘ HOÀN THÀNH BÀI HỌC ===

export async function getProgress(userId: string, lessonId: string): Promise<LocalProgress | null> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['progress'], 'readonly');
    const request = transaction.objectStore('progress').get(lessonKey(userId, lessonId));

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveProgress(progress: LocalProgress): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['progress'], 'readwrite');
    const request = transaction.objectStore('progress').put(progress);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getAllProgress(userId?: string): Promise<LocalProgress[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['progress'], 'readonly');
    const request = transaction.objectStore('progress').getAll();

    request.onsuccess = () => {
      let results: LocalProgress[] = request.result || [];
      if (userId) results = results.filter((p) => p.user_id === userId);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

// Clean up dữ liệu khi đăng xuất
export async function clearAllData(): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['vocabulary', 'reviews', 'memos', 'progress'], 'readwrite');
    transaction.objectStore('vocabulary').clear();
    transaction.objectStore('reviews').clear();
    transaction.objectStore('memos').clear();
    transaction.objectStore('progress').clear();

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
