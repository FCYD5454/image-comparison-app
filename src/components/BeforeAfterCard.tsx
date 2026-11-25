import { useState, useRef, useEffect, MouseEvent } from 'react';
import type { ComparisonMode, ImagePair } from '../types';

interface BeforeAfterCardProps {
  pair: ImagePair;
  mode: ComparisonMode;
  sliderValue: number;
  opacity: number;
  isSelected: boolean;
  isActive: boolean; // 當前全域控制是否套用到此卡
  onSelect: (id: string) => void;
  onFullscreen: (id: string) => void;
}

import { memo } from 'react';

function BeforeAfterCardBase({
  pair,
  mode,
  sliderValue,
  opacity,
  isSelected,
  isActive,
  onSelect,
  onFullscreen
}: BeforeAfterCardProps) {
  const [localSlider, setLocalSlider] = useState(sliderValue);
  const [localOpacity, setLocalOpacity] = useState(opacity);
  const [loupePosition, setLoupePosition] = useState({ x: 0, y: 0, visible: false });
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (isActive) setLocalSlider(sliderValue);
  }, [sliderValue, isActive]);

  useEffect(() => {
    if (isActive) setLocalOpacity(opacity);
  }, [opacity, isActive]);
  
  // Slider 模式 - 拖曳分割線
  const handleSliderDrag = (e: MouseEvent<HTMLDivElement>) => {
    if (mode !== 'slider') return;
    if (e.buttons !== 1) return;
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setLocalSlider(percentage);
  };
  
  // Loupe 模式 - 滑鼠移動
  const handleLoupeMove = (e: MouseEvent<HTMLDivElement>) => {
    if (mode !== 'loupe') return;
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    setLoupePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      visible: true
    });
  };
  
  const handleLoupeLeave = () => {
    setLoupePosition(prev => ({ ...prev, visible: false }));
  };
  
  // 渲染不同模式
  const renderComparison = () => {
    switch (mode) {
      case 'slider':
        return (
          <div
            ref={containerRef}
            className="comparison-container"
            onMouseMove={handleSliderDrag}
            style={{ position: 'relative', overflow: 'hidden', cursor: 'ew-resize' }}
          >
            <img
              src={pair.afterUrl}
              alt="After"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: `${localSlider}%`,
                height: '100%',
                overflow: 'hidden'
              }}
            >
              <img
                src={pair.beforeUrl}
                alt="Before"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <div
              style={{
                position: 'absolute',
                left: `${localSlider}%`,
                top: 0,
                width: '2px',
                height: '100%',
                backgroundColor: '#fff',
                boxShadow: '0 0 10px rgba(0,0,0,0.5)',
                transform: 'translateX(-50%)'
              }}
            />
          </div>
        );
      
      case 'opacity':
        return (
          <div className="comparison-container" style={{ position: 'relative' }}>
            <img
              src={pair.afterUrl}
              alt="After"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
              <img
                src={pair.beforeUrl}
                alt="Before"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  opacity: localOpacity / 100
                }}
              />
          </div>
        );
      
      case 'side-by-side':
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', height: '100%' }}>
            <div style={{ position: 'relative' }}>
              <img
                src={pair.beforeUrl}
                alt="Before"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              <span style={{
                position: 'absolute',
                top: '8px',
                left: '8px',
                background: 'rgba(0,0,0,0.7)',
                color: '#fff',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px'
              }}>
                Before
              </span>
            </div>
            <div style={{ position: 'relative' }}>
              <img
                src={pair.afterUrl}
                alt="After"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              <span style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                background: 'rgba(0,0,0,0.7)',
                color: '#fff',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px'
              }}>
                After
              </span>
            </div>
          </div>
        );
      
      case 'loupe':
        return (
          <div
            ref={containerRef}
            className="comparison-container"
            onMouseMove={handleLoupeMove}
            onMouseLeave={handleLoupeLeave}
            style={{ position: 'relative', cursor: 'none' }}
          >
            <img
              src={pair.afterUrl}
              alt="After"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            {loupePosition.visible && (
              <div
                style={{
                  position: 'absolute',
                  left: loupePosition.x,
                  top: loupePosition.y,
                  width: '150px',
                  height: '150px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: '3px solid #fff',
                  boxShadow: '0 0 20px rgba(0,0,0,0.5)',
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none',
                  backgroundImage: `url(${pair.beforeUrl})`,
                  backgroundSize: `${containerRef.current?.offsetWidth}px ${containerRef.current?.offsetHeight}px`,
                  backgroundPosition: `-${loupePosition.x - 75}px -${loupePosition.y - 75}px`,
                  backgroundRepeat: 'no-repeat'
                }}
              />
            )}
          </div>
        );
    }
  };
  
  return (
    <div
      className="before-after-card"
      data-card-id={pair.id}
      style={{
        border: isSelected ? '3px solid #0066cc' : '1px solid #ccc',
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: '#f5f5f5',
        height: '300px',
        display: 'flex',
        flexDirection: 'column'
      }}
      role="article"
      aria-label={`Image comparison: ${pair.beforeImage.name} and ${pair.afterImage.name}`}
    >
      <div style={{ flex: 1, position: 'relative' }}>
        {renderComparison()}
      </div>
      
      <div style={{ padding: '12px', backgroundColor: '#fff', borderTop: '1px solid #e0e0e0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pair.beforeImage.name.replace(/[-_](before|after)\.[^.]+$/i, '')}
            </div>
            {pair.diffCount !== undefined && (
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                差異像素: {pair.diffCount.toLocaleString()}
              </div>
            )}
            {pair.isCalculating && (
              <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                計算中...
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => onSelect(pair.id)}
              style={{
                padding: '6px 12px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                background: isSelected ? '#0066cc' : '#fff',
                color: isSelected ? '#fff' : '#333',
                cursor: 'pointer',
                fontSize: '12px'
              }}
              aria-pressed={isSelected}
              aria-label={isSelected ? '取消選擇' : '選擇'}
            >
              {isSelected ? '✓' : '選擇'}
            </button>
            
            <button
              onClick={() => onFullscreen(pair.id)}
              style={{
                padding: '6px 12px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                background: '#fff',
                cursor: 'pointer',
                fontSize: '12px'
              }}
              aria-label="全螢幕"
            >
              ⛶
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 避免不必要重渲染（改善閃爍）
export const BeforeAfterCard = memo(BeforeAfterCardBase, (prev, next) => {
  return (
    prev.pair.id === next.pair.id &&
    prev.mode === next.mode &&
    prev.sliderValue === next.sliderValue &&
    prev.opacity === next.opacity &&
    prev.isSelected === next.isSelected &&
    prev.isActive === next.isActive
  );
});
