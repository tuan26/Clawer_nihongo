// Cấu hình model AI dùng chung cho các route trong src/app/api/vocab.
// Đặt ở một chỗ để đổi model không phải sửa rải rác nhiều file.
//
// Lưu ý: gemini-2.5-flash và gemini-2.5-flash-lite đã bị Google ngừng cấp cho
// tài khoản mới (trả về 404 NOT_FOUND), nên không dùng làm mặc định được nữa.
// Đổi model bằng biến môi trường GEMINI_MODEL mà không cần sửa code.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

// Đo thực tế trên 5 từ vựng: gemini-3.5-flash trả JSON cắt cụt 2/5 lần và tiêu
// quota free tier rất nhanh (HTTP 429); flash-lite với thinking tắt đạt 5/5 ở
// khoảng 1.1s mỗi từ. Tác vụ tra từ không cần chuỗi suy luận dài, mà khi bật
// thinking thì ngân sách token bị tiêu vào đó khiến JSON hay bị cắt giữa chừng.
export const GEMINI_JSON_CONFIG = {
  responseMimeType: 'application/json',
  thinkingConfig: { thinkingBudget: 0 },
};

export function geminiGenerateUrl(apiKey: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
}

// Gemini trả HTTP 200 kèm body lỗi trong nhiều trường hợp, và fetch() không tự
// ném lỗi khi status là 4xx/5xx. Hàm này bóc lấy text hoặc ném lỗi có thông tin
// thật sự đọc được, thay vì để code chết ở 'Cannot read properties of undefined'.
export function extractGeminiText(status: number, json: any): string {
  if (status !== 200) {
    const msg = json?.error?.message || `HTTP ${status}`;
    throw new Error(`Gemini API (${GEMINI_MODEL}) lỗi: ${msg}`);
  }

  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const reason = json?.candidates?.[0]?.finishReason || json?.promptFeedback?.blockReason || 'không rõ';
    throw new Error(`Gemini API (${GEMINI_MODEL}) không trả về nội dung. Lý do: ${reason}`);
  }

  return text;
}

// Model đôi khi bọc JSON trong ```json ... ``` hoặc kèm vài dòng dẫn nhập dù đã
// yêu cầu trả JSON thô, nên cắt lấy đúng phần JSON trước khi parse.
export function parseJsonLoose(text: string): any {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    const start = cleaned.search(/[[{]/);
    const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
    if (start === -1 || end <= start) throw err;
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}
