// Ảnh memo được lưu thẳng dưới dạng data URL trong SQLite (Turso) nên bắt buộc
// phải nén ở client. Ảnh chụp màn hình gốc thường 2-5MB, vượt xa mức mà một dòng
// dữ liệu nên mang, và sẽ làm request đồng bộ bị từ chối.

export const MAX_IMAGES_PER_MEMO = 6;
export const MAX_IMAGE_BYTES = 400 * 1024; // ~400KB mỗi ảnh sau khi nén
const MAX_DIMENSION = 1600; // cạnh dài nhất, đủ đọc chữ trong ảnh chụp sách/slide

/**
 * Ước lượng số byte thật của một data URL base64.
 */
export function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] || '';
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không đọc được file ảnh.'));
    };
    img.src = url;
  });
}

/**
 * Resize + nén ảnh về JPEG, hạ dần chất lượng cho tới khi đạt MAX_IMAGE_BYTES.
 * Trả về data URL để lưu vào IndexedDB và đồng bộ lên Turso.
 */
export async function compressImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error(`"${file.name}" không phải là file ảnh.`);
  }

  const img = await loadImage(file);

  let { width, height } = img;
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Trình duyệt không hỗ trợ xử lý ảnh.');

  // Ảnh PNG trong suốt khi chuyển sang JPEG sẽ ra nền đen nếu không tô nền trắng trước.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.82;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);

  while (dataUrlBytes(dataUrl) > MAX_IMAGE_BYTES && quality > 0.35) {
    quality -= 0.12;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }

  if (dataUrlBytes(dataUrl) > MAX_IMAGE_BYTES) {
    throw new Error(
      `Ảnh "${file.name}" vẫn quá nặng (${formatBytes(dataUrlBytes(dataUrl))}) sau khi nén. Hãy cắt bớt ảnh rồi thử lại.`
    );
  }

  return dataUrl;
}
