import { useMemo } from 'react';
import type { ImagePair, OrphanImage } from '../types';
import { extractPairingInfo, createImageUrl, generateId } from '../utils/imageUtils';

export interface ForcedPair {
  before: File;
  after: File;
  id?: string;
}

/**
 * 自動配對圖片 (根據檔名中的 -before/-after 後綴) + 支援手動配對 (forcedPairs)
 */
export function useImagePairing(files: File[], forcedPairs: ForcedPair[] = [], excludedBases: Set<string> = new Set()) {
  return useMemo(() => {
    const used = new Set<File>();
    const pairs: ImagePair[] = [];

    // 先加入手動配對結果
    forcedPairs.forEach(fp => {
      if (!fp.before || !fp.after) return;
      pairs.push({
        id: fp.id ?? generateId(),
        beforeImage: fp.before,
        afterImage: fp.after,
        beforeUrl: createImageUrl(fp.before),
        afterUrl: createImageUrl(fp.after)
      });
      used.add(fp.before);
      used.add(fp.after);
    });

    const beforeMap = new Map<string, File>();
    const afterMap = new Map<string, File>();
    const unknownFiles: File[] = [];

    // 分類檔案 (排除已被手動配對使用的)
    files.forEach(file => {
      if (used.has(file)) return;
      const { baseName, type } = extractPairingInfo(file.name);

      if (type === 'before') {
        beforeMap.set(baseName, file);
      } else if (type === 'after') {
        afterMap.set(baseName, file);
      } else {
        unknownFiles.push(file);
      }
    });

    // 自動配對 (剩餘)
    const processedBases = new Set<string>();

    beforeMap.forEach((beforeFile, baseName) => {
      const afterFile = afterMap.get(baseName);
      if (afterFile && !excludedBases.has(baseName)) {
        const stableId = `auto-${baseName}`; // 以 baseName 產生穩定 ID，避免重建造成閃爍
        pairs.push({
          id: stableId,
          beforeImage: beforeFile,
          afterImage: afterFile,
          beforeUrl: createImageUrl(beforeFile),
          afterUrl: createImageUrl(afterFile)
        });
        processedBases.add(baseName);
      }
    });

    // 建立孤立圖片清單（未被使用的）
    const orphans: OrphanImage[] = [];

    beforeMap.forEach((file, baseName) => {
      if (!processedBases.has(baseName)) {
        orphans.push({
          id: generateId(),
          file,
          url: createImageUrl(file),
          type: 'before'
        });
      }
    });

    afterMap.forEach((file, baseName) => {
      if (!processedBases.has(baseName)) {
        orphans.push({
          id: generateId(),
          file,
          url: createImageUrl(file),
          type: 'after'
        });
      }
    });

    unknownFiles.forEach(file => {
      orphans.push({
        id: generateId(),
        file,
        url: createImageUrl(file),
        type: 'unknown'
      });
    });

    return { pairs, orphans };
  }, [files, forcedPairs]);
}
