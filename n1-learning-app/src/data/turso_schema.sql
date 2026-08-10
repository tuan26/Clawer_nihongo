-- Bảng lưu thông tin tài khoản người dùng
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Bảng lưu thông tin từ vựng
CREATE TABLE IF NOT EXISTS vocabulary (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  word TEXT NOT NULL,
  reading TEXT,
  meaning_vi TEXT,
  example_ja TEXT,
  example_vi TEXT,
  tags TEXT, -- Lưu dưới dạng JSON string để tương thích SQLite: '["N1", "Công việc"]'
  source TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  next_review_at TEXT NOT NULL,
  interval_days INTEGER NOT NULL DEFAULT 0,
  ease_factor REAL NOT NULL DEFAULT 2.5,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Bảng lưu chi tiết lịch sử review từ vựng
CREATE TABLE IF NOT EXISTS vocabulary_reviews (
  id TEXT PRIMARY KEY,
  vocabulary_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  reviewed_at TEXT NOT NULL,
  rating TEXT NOT NULL,
  interval_before INTEGER NOT NULL,
  interval_after INTEGER NOT NULL,
  FOREIGN KEY (vocabulary_id) REFERENCES vocabulary(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tạo Index để truy vấn nhanh hơn
CREATE INDEX IF NOT EXISTS idx_vocab_user ON vocabulary(user_id);
CREATE INDEX IF NOT EXISTS idx_vocab_next_review ON vocabulary(next_review_at);
CREATE INDEX IF NOT EXISTS idx_reviews_vocab ON vocabulary_reviews(vocabulary_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON vocabulary_reviews(user_id);
