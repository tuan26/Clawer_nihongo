const fs = require('fs');
const path = require('path');
const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');

// 1. Hàm đọc file .env.local thủ công để lấy config Turso
function loadEnv() {
  const envPath = path.join(__dirname, '../.env.local');
  const env = {
    TURSO_DATABASE_URL: '',
    TURSO_AUTH_TOKEN: ''
  };

  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        // Loại bỏ dấu nháy đơn/kép xung quanh giá trị nếu có
        if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
          value = value.substring(1, value.length - 1);
        }
        if (value.length > 0 && value.charAt(0) === '\'' && value.charAt(value.length - 1) === '\'') {
          value = value.substring(1, value.length - 1);
        }
        env[key] = value.trim();
      }
    }
  }
  return env;
}

// Các câu lệnh SQL khởi tạo bảng nếu chưa có
const INIT_TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS vocabulary (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    word TEXT NOT NULL,
    reading TEXT,
    meaning_vi TEXT,
    example_ja TEXT,
    example_vi TEXT,
    tags TEXT,
    source TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    next_review_at TEXT NOT NULL,
    interval_days INTEGER NOT NULL DEFAULT 0,
    ease_factor REAL NOT NULL DEFAULT 2.5,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS vocabulary_reviews (
    id TEXT PRIMARY KEY,
    vocabulary_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    reviewed_at TEXT NOT NULL,
    rating TEXT NOT NULL,
    interval_before INTEGER NOT NULL,
    interval_after INTEGER NOT NULL,
    FOREIGN KEY (vocabulary_id) REFERENCES vocabulary(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_vocab_user ON vocabulary(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_vocab_next_review ON vocabulary(next_review_at)`,
  `CREATE INDEX IF NOT EXISTS idx_reviews_vocab ON vocabulary_reviews(vocabulary_id)`,
  `CREATE INDEX IF NOT EXISTS idx_reviews_user ON vocabulary_reviews(user_id)`
];

async function main() {
  // Lấy email và password từ đối số dòng lệnh (Command Line Arguments)
  const args = process.argv.slice(2);
  const emailInput = args[0];
  const passwordInput = args[1];

  if (!emailInput || !passwordInput) {
    console.error('\x1b[31m%s\x1b[0m', 'Lỗi: Thiếu tham số.');
    console.log('Cách sử dụng: node scripts/create-user.js <email> <mật_khẩu>');
    console.log('Ví dụ: node scripts/create-user.js admin@example.com MySecurePassword123');
    process.exit(1);
  }

  const env = loadEnv();
  const url = env.TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL;
  const authToken = env.TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    console.error('\x1b[31m%s\x1b[0m', 'Lỗi: Chưa tìm thấy biến môi trường TURSO_DATABASE_URL trong file .env.local');
    console.log('Vui lòng kiểm tra lại file .env.local trong thư mục n1-learning-app.');
    process.exit(1);
  }

  console.log(`Đang kết nối tới database Turso: ${url}...`);
  
  const client = createClient({
    url,
    authToken
  });

  try {
    // 1. Tự động kiểm tra và tạo bảng nếu chưa có (Khởi tạo Database)
    console.log('Đang kiểm tra và khởi tạo cấu trúc bảng trên Turso Database...');
    const batchQueries = INIT_TABLES_SQL.map(sql => ({ sql, args: [] }));
    await client.batch(batchQueries);
    console.log('Khởi tạo cấu trúc cơ sở dữ liệu thành công!');

    const email = emailInput.toLowerCase().trim();
    
    // 2. Kiểm tra xem user đã tồn tại chưa
    const checkUser = await client.execute({
      sql: 'SELECT id FROM users WHERE email = ? LIMIT 1',
      args: [email]
    });

    if (checkUser.rows.length > 0) {
      console.warn('\x1b[33m%s\x1b[0m', `Tài khoản với email ${email} đã tồn tại trên Turso DB.`);
      process.exit(0);
    }

    // 3. Hash mật khẩu
    console.log('Đang mã hóa mật khẩu bảo mật...');
    const passwordHash = await bcrypt.hash(passwordInput, 10);
    const userId = crypto.randomUUID ? crypto.randomUUID() : require('crypto').randomBytes(16).toString('hex');
    const nowStr = new Date().toISOString();

    // 4. Insert tài khoản vào bảng users
    console.log(`Đang tạo tài khoản ${email} trong SQLite...`);
    await client.execute({
      sql: 'INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)',
      args: [userId, email, passwordHash, nowStr]
    });

    console.log('\x1b[32m%s\x1b[0m', `🎉 TẠO TÀI KHOẢN THÀNH CÔNG!`);
    console.log(`- ID: ${userId}`);
    console.log(`- Email: ${email}`);
    console.log(`- Password: [ĐÃ MÃ HÓA BẢO MẬT]`);
    console.log(`Giờ đây bạn có thể dùng tài khoản này đăng nhập vào ứng dụng Nihongo Mastery!`);

  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', 'Đã xảy ra lỗi khi làm việc với Turso:', error);
  } finally {
    process.exit(0);
  }
}

main();
