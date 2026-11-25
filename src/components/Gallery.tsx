import type { ImagePair, OrphanImage, ComparisonMode } from '../types';
import { BeforeAfterCard } from './BeforeAfterCard';

interface GalleryProps {
  pairs: ImagePair[];
  orphans: OrphanImage[];
  mode: ComparisonMode;
  sliderValue: number;
  opacity: number;
  applyToSelected: boolean;
  selectedCards: Set<string>;
  selectedOrphans: Set<string>;
  onSelectCard: (id: string) => void;
  onSelectOrphan: (id: string) => void;
  onFullscreenCard: (id: string) => void;
}

export function Gallery({
  pairs,
  orphans,
  mode,
  sliderValue,
  opacity,
  applyToSelected,
  selectedCards,
  selectedOrphans,
  onSelectCard,
  onSelectOrphan,
  onFullscreenCard
}: GalleryProps) {
  return (
    <div style={{ padding: '20px' }}>
      {/* 配對圖片 */}
      {pairs.length > 0 && (
        <section>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#333' }}>
            圖片比對 ({pairs.length})
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
              gap: '20px',
              marginBottom: '40px'
            }}
            role="region"
            aria-label="配對圖片清單"
          >
            {pairs.map(pair => {
              const isSelected = selectedCards.has(pair.id);
              const isActive = !applyToSelected || isSelected;
              return (
                <BeforeAfterCard
                  key={pair.id}
                  pair={pair}
                  mode={mode}
                  sliderValue={sliderValue}
                  opacity={opacity}
                  isSelected={isSelected}
                  isActive={isActive}
                  onSelect={onSelectCard}
                  onFullscreen={onFullscreenCard}
                />
              );
            })}
          </div>
        </section>
      )}
      
      {/* 孤立圖片 */}
      {orphans.length > 0 && (
        <section>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#333' }}>
            未配對圖片 ({orphans.length})
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '16px'
            }}
            role="region"
            aria-label="未配對圖片清單"
          >
            {orphans.map(orphan => {
              const isSelected = selectedOrphans.has(orphan.id);
              return (
                <div
                  key={orphan.id}
                  style={{
                    border: isSelected ? '3px solid #0066cc' : '1px solid #ccc',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    backgroundColor: '#f5f5f5',
                    position: 'relative'
                  }}
                >
                  {/* 勾選框 */}
                  <label style={{ position: 'absolute', top: 6, left: 6, zIndex: 2, background: 'rgba(255,255,255,0.85)', borderRadius: 4, padding: '2px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onSelectOrphan(orphan.id)}
                      aria-label={`選取 ${orphan.file.name}`}
                    />
                    <span style={{ fontSize: 11, color: '#333' }}>{isSelected ? '已選' : '選取'}</span>
                  </label>

                  {/* 可點擊區塊（圖片與資訊） */}
                  <button
                    onClick={() => onSelectOrphan(orphan.id)}
                    style={{
                      all: 'unset',
                      display: 'block',
                      cursor: 'pointer',
                      width: '100%'
                    }}
                    aria-pressed={isSelected}
                  >
                    <img
                      src={orphan.url}
                      alt={orphan.file.name}
                      style={{ width: '100%', height: '200px', objectFit: 'cover', display: 'block' }}
                    />
                    <div style={{ padding: '8px', backgroundColor: '#fff' }}>
                      <div style={{ fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {orphan.file.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                        類型: {orphan.type === 'before' ? 'Before' : orphan.type === 'after' ? 'After' : '未知'}
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
      
      {/* 空狀態 */}
      {pairs.length === 0 && orphans.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: '#999'
          }}
          role="status"
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📁</div>
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>尚未匯入圖片</div>
          <div style={{ fontSize: '14px' }}>
            請點選上方「選擇檔案」或「選擇資料夾」來匯入圖片
          </div>
        </div>
      )}
    </div>
  );
}
