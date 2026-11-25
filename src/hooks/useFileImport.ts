import { useCallback } from 'react';
import { isImageFile } from '../utils/imageUtils';

export function useFileImport() {
  /**
   * 處理多檔案選擇
   */
  const handleFileSelect = useCallback(async (
    event: React.ChangeEvent<HTMLInputElement>
  ): Promise<File[]> => {
    const files = event.target.files;
    if (!files) return [];
    
    return Array.from(files).filter(isImageFile);
  }, []);
  
  /**
   * 處理資料夾選擇 (使用 File System Access API)
   */
  const handleDirectorySelect = useCallback(async (): Promise<File[]> => {
    // 檢查瀏覽器是否支援 File System Access API
    if (!('showDirectoryPicker' in window)) {
      alert('您的瀏覽器不支援資料夾選擇功能');
      return [];
    }
    
    try {
      // @ts-expect-error - File System Access API 尚未完全支援 TypeScript
      const dirHandle = await window.showDirectoryPicker();
      const files: File[] = [];
      
      // 遞迴讀取資料夾中的所有檔案
      async function readDirectory(
        directoryHandle: FileSystemDirectoryHandle
      ) {
        // File System Access API typings differ between TypeScript versions.
        const entries = (directoryHandle as any).values();
        for await (const entry of entries) {
          if (entry.kind === 'file') {
            const file = await entry.getFile();
            if (isImageFile(file)) {
              files.push(file);
            }
          } else if (entry.kind === 'directory') {
            await readDirectory(entry);
          }
        }
      }
      
      await readDirectory(dirHandle);
      return files;
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Failed to read directory:', error);
      }
      return [];
    }
  }, []);
  
  return {
    handleFileSelect,
    handleDirectorySelect
  };
}
