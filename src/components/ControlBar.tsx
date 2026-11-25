import { useRef } from 'react';
import type { ComparisonMode } from '../types';

interface ControlBarProps {
  mode: ComparisonMode;
  sliderValue: number;
  opacity: number;
  applyToSelected: boolean;
  hasSelectedCards: boolean;
  selectedOrphansCount: number;
  canPairSelected: boolean;
  canUnpairSelected: boolean;
  onModeChange: (mode: ComparisonMode) => void;
  onSliderChange: (value: number) => void;
  onOpacityChange: (value: number) => void;
  onApplyToSelectedChange: (checked: boolean) => void;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDirectorySelect: () => void;
  onPairSelected: () => void;
  onUnpairSelected: () => void;
}

export function ControlBar({
  mode,
  sliderValue,
  opacity,
  applyToSelected,
  hasSelectedCards,
  selectedOrphansCount,
  canPairSelected,
  canUnpairSelected,
  onModeChange,
  onSliderChange,
  onOpacityChange,
  onApplyToSelectedChange,
  onFileSelect,
  onDirectorySelect,
  onPairSelected,
  onUnpairSelected
}: ControlBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };
  
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        backgroundColor: '#fff',
        borderBottom: '2px solid #e0e0e0',
        padding: '16px 20px',
        zIndex: 100,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}
      role="toolbar"
      aria-label="控制列"
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
        {/* 檔案選擇 */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={onFileSelect}
            style={{ display: 'none' }}
            aria-label="選擇檔案"
          />
          <button
            onClick={handleFileButtonClick}
            style={{
              padding: '8px 16px',
              border: '1px solid #0066cc',
              borderRadius: '6px',
              background: '#0066cc',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            選擇檔案
          </button>
          
          {'showDirectoryPicker' in window && (
            <button
              onClick={onDirectorySelect}
              style={{
                padding: '8px 16px',
                border: '1px solid #0066cc',
                borderRadius: '6px',
                background: '#fff',
                color: '#0066cc',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              選擇資料夾
            </button>
          )}
        </div>
        
        {/* 分隔線 */}
        <div style={{ width: '1px', height: '32px', backgroundColor: '#ccc' }} />

        {/* 配對工具 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={onPairSelected}
            disabled={!canPairSelected}
            style={{
              padding: '8px 12px',
              border: '1px solid ' + (canPairSelected ? '#0066cc' : '#ccc'),
              borderRadius: '6px',
              background: canPairSelected ? '#0066cc' : '#f0f0f0',
              color: canPairSelected ? '#fff' : '#999',
              cursor: canPairSelected ? 'pointer' : 'not-allowed',
              fontSize: '14px'
            }}
            aria-disabled={!canPairSelected}
            title={selectedOrphansCount === 2 ? '配對所選兩張圖片' : '請先選擇 2 張未配對圖片'}
          >
            配對所選 (Pair)
          </button>
          <button
            onClick={onUnpairSelected}
            disabled={!canUnpairSelected}
            style={{
              padding: '8px 12px',
              border: '1px solid ' + (canUnpairSelected ? '#cc0000' : '#ccc'),
              borderRadius: '6px',
              background: canUnpairSelected ? '#fff0f0' : '#f0f0f0',
              color: canUnpairSelected ? '#cc0000' : '#999',
              cursor: canUnpairSelected ? 'pointer' : 'not-allowed',
              fontSize: '14px'
            }}
            aria-disabled={!canUnpairSelected}
            title={canUnpairSelected ? '拆解所選配對' : '請選擇一張已配對卡片'}
          >
            拆解配對 (Unpair)
          </button>
          <div style={{ fontSize: '12px', color: '#666', marginLeft: 8 }}>
            已選未配對: {selectedOrphansCount}/2
          </div>
        </div>
        
        {/* 分隔線 */}
        <div style={{ width: '1px', height: '32px', backgroundColor: '#ccc' }} />
        
        {/* 比對模式 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label htmlFor="mode-select" style={{ fontSize: '14px', fontWeight: '500', color: '#333' }}>
            模式:
          </label>
          <select
            id="mode-select"
            value={mode}
            onChange={(e) => onModeChange(e.target.value as ComparisonMode)}
            style={{
              padding: '6px 12px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
            aria-label="比對模式"
          >
            <option value="slider">Slider (滑動分割)</option>
            <option value="opacity">Opacity (透明度)</option>
            <option value="side-by-side">Side-by-side (並排)</option>
            <option value="loupe">Loupe (放大鏡)</option>
          </select>
        </div>
        
        {/* 全域滑桿 (Slider 模式) */}
        {mode === 'slider' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1', minWidth: '200px' }}>
            <label htmlFor="global-slider" style={{ fontSize: '14px', fontWeight: '500', color: '#333' }}>
              位置:
            </label>
            <input
              id="global-slider"
              type="range"
              min="0"
              max="100"
              value={sliderValue}
              onChange={(e) => onSliderChange(Number(e.target.value))}
              style={{ flex: 1 }}
              aria-label="全域滑桿位置"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={sliderValue}
            />
            <span style={{ fontSize: '14px', color: '#666', minWidth: '45px' }}>
              {sliderValue}%
            </span>
          </div>
        )}
        
        {/* 全域透明度 (Opacity 模式) */}
        {mode === 'opacity' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1', minWidth: '200px' }}>
            <label htmlFor="global-opacity" style={{ fontSize: '14px', fontWeight: '500', color: '#333' }}>
              透明度:
            </label>
            <input
              id="global-opacity"
              type="range"
              min="0"
              max="100"
              value={opacity}
              onChange={(e) => onOpacityChange(Number(e.target.value))}
              style={{ flex: 1 }}
              aria-label="全域透明度"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={opacity}
            />
            <span style={{ fontSize: '14px', color: '#666', minWidth: '45px' }}>
              {opacity}%
            </span>
          </div>
        )}
        
        {/* 僅套用到選取的卡片 */}
        {(mode === 'slider' || mode === 'opacity') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              id="apply-to-selected"
              type="checkbox"
              checked={applyToSelected}
              onChange={(e) => onApplyToSelectedChange(e.target.checked)}
              disabled={!hasSelectedCards}
              style={{ cursor: hasSelectedCards ? 'pointer' : 'not-allowed' }}
              aria-label="僅套用到選取的卡片"
            />
            <label
              htmlFor="apply-to-selected"
              style={{
                fontSize: '14px',
                color: hasSelectedCards ? '#333' : '#999',
                cursor: hasSelectedCards ? 'pointer' : 'not-allowed'
              }}
            >
              僅套用到選取的卡片
            </label>
          </div>
        )}
      </div>
      
      {/* 鍵盤快捷鍵提示 */}
      <div style={{ marginTop: '12px', fontSize: '12px', color: '#666' }}>
        <span>快捷鍵: </span>
        <span style={{ marginRight: '12px' }}>F = 全螢幕</span>
        <span style={{ marginRight: '12px' }}>← / → = 調整滑桿</span>
        <span>G = 切換全域套用</span>
      </div>
    </div>
  );
}
