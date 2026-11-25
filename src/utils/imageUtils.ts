const fileUrlCache = new WeakMap<File, string>();

/**
 * 建立（或重用）Object URL 用於圖片預覽，避免重複建立導致畫面閃爍
 */
export function createImageUrl(file: File): string {
  const cached = fileUrlCache.get(file);
  if (cached) return cached;
  const url = URL.createObjectURL(file);
  fileUrlCache.set(file, url);
  return url;
}

/**
 * 釋放 Object URL（如需手動清理）
 */
export function revokeImageUrl(url: string): void {
  URL.revokeObjectURL(url);
}

/**
 * 載入圖片並轉換為 ImageBitmap
 */
export async function loadImageBitmap(file: File): Promise<ImageBitmap> {
  const blob = new Blob([file], { type: file.type });
  return await createImageBitmap(blob);
}

/**
 * 從檔名載入圖片元素
 */
export function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * 檢查檔案是否為圖片
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * 從檔名提取配對資訊
 * 支援格式: name-before.jpg, name-after.jpg 或 name_before.png, name_after.png
 */
export function extractPairingInfo(filename: string): {
  baseName: string;
  type: 'before' | 'after' | 'unknown';
} {
  const withoutExt = filename.replace(/\.[^/.]+$/, '');
  
  const beforeMatch = withoutExt.match(/^(.+?)[-_](before)$/i);
  if (beforeMatch) {
    return { baseName: beforeMatch[1], type: 'before' };
  }
  
  const afterMatch = withoutExt.match(/^(.+?)[-_](after)$/i);
  if (afterMatch) {
    return { baseName: afterMatch[1], type: 'after' };
  }
  
  return { baseName: withoutExt, type: 'unknown' };
}

/**
 * 產生唯一 ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
