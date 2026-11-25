import type { DiffWorkerMessage, DiffWorkerResponse } from '../types';

/**
 * 計算兩張圖片的像素差異數量
 */
function calculatePixelDiff(
  beforeBitmap: ImageBitmap,
  afterBitmap: ImageBitmap
): number {
  const width = Math.min(beforeBitmap.width, afterBitmap.width);
  const height = Math.min(beforeBitmap.height, afterBitmap.height);
  
  // 使用 OffscreenCanvas 進行像素操作
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }
  
  // 繪製 before 圖片並獲取像素資料
  ctx.drawImage(beforeBitmap, 0, 0, width, height);
  const beforeData = ctx.getImageData(0, 0, width, height);
  
  // 繪製 after 圖片並獲取像素資料
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(afterBitmap, 0, 0, width, height);
  const afterData = ctx.getImageData(0, 0, width, height);
  
  // 計算差異像素數量
  let diffCount = 0;
  const threshold = 10; // 容忍小差異
  
  for (let i = 0; i < beforeData.data.length; i += 4) {
    const rDiff = Math.abs(beforeData.data[i] - afterData.data[i]);
    const gDiff = Math.abs(beforeData.data[i + 1] - afterData.data[i + 1]);
    const bDiff = Math.abs(beforeData.data[i + 2] - afterData.data[i + 2]);
    
    if (rDiff > threshold || gDiff > threshold || bDiff > threshold) {
      diffCount++;
    }
  }
  
  return diffCount;
}

/**
 * Worker 訊息處理
 */
self.onmessage = async (event: MessageEvent<DiffWorkerMessage>) => {
  const { type, id, beforeImage, afterImage } = event.data;
  
  if (type !== 'calculate') {
    return;
  }
  
  try {
    const diffCount = calculatePixelDiff(beforeImage, afterImage);
    
    const response: DiffWorkerResponse = {
      type: 'result',
      id,
      diffCount
    };
    
    self.postMessage(response);
    
    // 釋放 ImageBitmap
    beforeImage.close();
    afterImage.close();
  } catch (error) {
    const response: DiffWorkerResponse = {
      type: 'result',
      id,
      diffCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    
    self.postMessage(response);
  }
};

export {};
