import { useState, useEffect, useRef, useCallback } from 'react';
import type { ComparisonMode, ImagePair, DiffWorkerResponse } from './types';
import { ControlBar } from './components/ControlBar';
import { Gallery } from './components/Gallery';
import { useFileImport } from './hooks/useFileImport';
import { useImagePairing } from './hooks/useImagePairing';
import { useFullscreen } from './hooks/useFullscreen';
import { loadImageBitmap } from './utils/imageUtils';
import { saveViewState, debounce } from './utils/storageUtils';
import { generateId, extractPairingInfo } from './utils/imageUtils';

function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<ComparisonMode>('slider');
  const [globalSliderValue, setGlobalSliderValue] = useState(50);
  const [globalOpacity, setGlobalOpacity] = useState(50);
  const [applyToSelected, setApplyToSelected] = useState(false);
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [imagePairs, setImagePairs] = useState<ImagePair[]>([]);
  
  const workerRef = useRef<Worker | null>(null);
  const { handleFileSelect, handleDirectorySelect } = useFileImport();
  const [selectedOrphans, setSelectedOrphans] = useState<Set<string>>(new Set());
  const [manualPairs, setManualPairs] = useState<Array<{ id: string; before: File; after: File }>>([]);
  const [excludedBases, setExcludedBases] = useState<Set<string>>(new Set());
  const { pairs, orphans } = useImagePairing(
    files,
    manualPairs.map(mp => ({ id: mp.id, before: mp.before, after: mp.after })),
    excludedBases
  );
  const { toggleFullscreen } = useFullscreen();
  
  // 初始化 Web Worker
  useEffect(() => {
    const worker = new Worker(
      new URL('./workers/diffWorker.ts', import.meta.url),
      { type: 'module' }
    );
    
    worker.onmessage = (event: MessageEvent<DiffWorkerResponse>) => {
      const { id, diffCount, error } = event.data;
      
      setImagePairs(prev => prev.map(pair => 
        pair.id === id
          ? { ...pair, diffCount, isCalculating: false }
          : pair
      ));
      
      if (error) {
        console.error(`Diff calculation error for ${id}:`, error);
      }
    };
    
    workerRef.current = worker;
    
    return () => {
      worker.terminate();
    };
  }, []);
  
  // 當配對更新時，計算像素差異
  useEffect(() => {
    setImagePairs(pairs.map(pair => ({ ...pair, isCalculating: true })));
    
    pairs.forEach(async (pair) => {
      try {
        const beforeBitmap = await loadImageBitmap(pair.beforeImage);
        const afterBitmap = await loadImageBitmap(pair.afterImage);
        
        workerRef.current?.postMessage(
          {
            type: 'calculate',
            id: pair.id,
            beforeImage: beforeBitmap,
            afterImage: afterBitmap
          },
          [beforeBitmap, afterBitmap]
        );
      } catch (error) {
        console.error('Failed to load images for diff calculation:', error);
        setImagePairs(prev => prev.map(p =>
          p.id === pair.id
            ? { ...p, isCalculating: false }
            : p
        ));
      }
    });
  }, [pairs]);
  
  // 儲存狀態到 IndexedDB (防抖)
  const debouncedSave = useCallback(
    debounce(() => {
      saveViewState({
        mode,
        globalSliderValue,
        globalOpacity,
        applyToSelected,
        selectedCards
      });
    }, 300),
    [mode, globalSliderValue, globalOpacity, applyToSelected, selectedCards]
  );
  
  useEffect(() => {
    debouncedSave();
  }, [debouncedSave]);
  
  // 檔案選擇處理
  const onFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = await handleFileSelect(event);
    setFiles(prev => [...prev, ...selectedFiles]);
  };
  
  const onDirectorySelect = async () => {
    const selectedFiles = await handleDirectorySelect();
    setFiles(prev => [...prev, ...selectedFiles]);
  };
  
  // 卡片選擇（配對卡）
  const handleSelectCard = (id: string) => {
    setSelectedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // 未配對圖片選擇（孤立圖片）
  const handleSelectOrphan = (id: string) => {
    setSelectedOrphans(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        // 最多允許選 2 張用於配對
        if (newSet.size >= 2) return prev;
        newSet.add(id);
      }
      return newSet;
    });
  };

  // 將已選的兩張孤立圖片配對成一張卡
  const handlePairSelected = () => {
    if (selectedOrphans.size !== 2) return;
    const [aId, bId] = Array.from(selectedOrphans);
    const a = orphans.find(o => o.id === aId);
    const b = orphans.find(o => o.id === bId);
    if (!a || !b) return;

    let beforeFile: File = a.file;
    let afterFile: File = b.file;

    // 根據類型判斷順序；否則使用選取順序
    if (a.type === 'after' && b.type !== 'after') {
      beforeFile = b.file;
      afterFile = a.file;
    } else if (b.type === 'before' && a.type !== 'before') {
      beforeFile = a.file;
      afterFile = b.file;
    }

    setManualPairs(prev => [...prev, { id: generateId(), before: beforeFile, after: afterFile }]);
    setSelectedOrphans(new Set());
  };
  // 拆解選取的配對卡（僅支援手動配對建立者）
  const handleUnpairSelected = () => {
    if (selectedCards.size !== 1) return;
    const id = Array.from(selectedCards)[0];

    // 若為手動配對，直接移除
    if (manualPairs.some(p => p.id === id)) {
      setManualPairs(prev => prev.filter(p => p.id !== id));
      setSelectedCards(new Set());
      return;
    }

    // 若為自動配對，將其 baseName 加入排除清單，讓其回到未配對清單
    const target = imagePairs.find(p => p.id === id);
    if (target) {
      const base = extractPairingInfo(target.beforeImage.name).baseName;
      setExcludedBases(prev => new Set([...prev, base]));
    }
    setSelectedCards(new Set());
  };
  
  // 全螢幕
  const handleFullscreenCard = (id: string) => {
    const element = document.querySelector(`[data-card-id="${id}"]`) as HTMLElement;
    if (element) {
      toggleFullscreen(element);
    }
  };
  
  // 鍵盤快捷鍵
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F = 全螢幕 (第一張選取的卡片)
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        const firstSelected = Array.from(selectedCards)[0];
        if (firstSelected) {
          handleFullscreenCard(firstSelected);
        }
      }
      
      // 左右箭頭 = 調整滑桿
      if (mode === 'slider' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        setGlobalSliderValue(prev => {
          const delta = e.key === 'ArrowLeft' ? -5 : 5;
          return Math.max(0, Math.min(100, prev + delta));
        });
      }
      
      // 上下箭頭 = 調整透明度
      if (mode === 'opacity' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        setGlobalOpacity(prev => {
          const delta = e.key === 'ArrowUp' ? 5 : -5;
          return Math.max(0, Math.min(100, prev + delta));
        });
      }
      
      // G = 切換全域套用
      if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        if (selectedCards.size > 0) {
          setApplyToSelected(prev => !prev);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, selectedCards, handleFullscreenCard]);
  
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9f9f9' }}>
      <ControlBar
        mode={mode}
        sliderValue={globalSliderValue}
        opacity={globalOpacity}
        applyToSelected={applyToSelected}
        hasSelectedCards={selectedCards.size > 0}
        selectedOrphansCount={selectedOrphans.size}
        canPairSelected={selectedOrphans.size === 2}
        canUnpairSelected={selectedCards.size === 1}
        onModeChange={setMode}
        onSliderChange={setGlobalSliderValue}
        onOpacityChange={setGlobalOpacity}
        onApplyToSelectedChange={setApplyToSelected}
        onFileSelect={onFileSelect}
        onDirectorySelect={onDirectorySelect}
        onPairSelected={handlePairSelected}
        onUnpairSelected={handleUnpairSelected}
      />
      
      <Gallery
        pairs={imagePairs}
        orphans={orphans}
        mode={mode}
        sliderValue={globalSliderValue}
        opacity={globalOpacity}
        applyToSelected={applyToSelected}
        selectedCards={selectedCards}
        selectedOrphans={selectedOrphans}
        onSelectCard={handleSelectCard}
        onSelectOrphan={handleSelectOrphan}
        onFullscreenCard={handleFullscreenCard}
      />
    </div>
  );
}

export default App;
