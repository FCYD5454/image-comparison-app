import React, { useMemo } from "react";
import { useComparisonStore, MAX_LAYERS } from "../store/comparisonStore";
import clsx from "classnames";

export const LayerStackPanel: React.FC = () => {
  const images = useComparisonStore((s) => s.images);
  const compareOrder = useComparisonStore((s) => s.compareOrder);
  const setCompareOrder = useComparisonStore((s) => s.setCompareOrder);
  const layerSettings = useComparisonStore((s) => s.layerSettings);
  const setLayerSettings = useComparisonStore((s) => s.setLayerSettings);
  const magnifierLinks = useComparisonStore((s) => s.magnifierLinks);
  const setMagnifierLink = useComparisonStore((s) => s.setMagnifierLink);
  const sliderPositions = useComparisonStore((s) => s.sliderPositions);
  const setSliderPositions = useComparisonStore((s) => s.setSliderPositions);
          const autoArrangeStack = useComparisonStore((s) => s.autoArrangeStack);
          const toggleAllLayerVisibility = useComparisonStore((s) => s.toggleAllLayerVisibility);
          const hideAllBottomLayers = useComparisonStore((s) => s.hideAllBottomLayers);
          const resetAllSliderPositions = useComparisonStore((s) => s.resetAllSliderPositions);

          const stack = useMemo(
    () => compareOrder.map((id) => images.find((img) => img.id === id)).filter(Boolean),
    [compareOrder, images]
  );
  const available = useMemo(
    () => images.filter((img) => !compareOrder.includes(img.id!)),
    [images, compareOrder]
  );

  const move = (id: string, dir: -1 | 1) => {
    const idx = compareOrder.indexOf(id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= compareOrder.length) return;
    const next = [...compareOrder];
    [next[idx], next[target]] = [next[target], next[idx]];
    setCompareOrder(next);
  };

  const remove = (id: string) => {
    setCompareOrder(compareOrder.filter((x) => x !== id));
  };

  const add = (id: string) => {
    if (compareOrder.length >= MAX_LAYERS) return;
    setCompareOrder([...compareOrder, id]);
  };

  return (
    <div className="rounded-xl border border-slate-800/70 bg-slate-900/50 px-3 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
           <p className="text-xs font-semibold text-slate-200">圖層堆疊（底→頂）</p>
           <div className="flex gap-1">
                  <button
                    onClick={() => toggleAllLayerVisibility(true)}
                    className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-300 hover:bg-slate-700 hover:text-white"
                    title="全部顯示"
                  >
                    全顯
                  </button>
                  <button
                    onClick={() => toggleAllLayerVisibility(false)}
                    className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-300 hover:bg-slate-700 hover:text-white"
                    title="全部隱藏"
                  >
                    全隱
                  </button>
                  <button
                    onClick={hideAllBottomLayers}
                    className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-300 hover:bg-slate-700 hover:text-white"
                    title="隱藏所有群組的底層影像"
                  >
                    隱藏底層
                  </button>
                  <button
                    onClick={() => resetAllSliderPositions(100)}
               className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[9px] text-cyan-300 hover:bg-slate-700 hover:text-white"
               title="重置所有滑桿位置為 100%"
             >
               滑桿100%
             </button>
           </div>
        </div>
        <button
          onClick={autoArrangeStack}
          className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] text-indigo-300 hover:bg-slate-700 hover:text-white"
          title="依照關聯鏈重新排序堆疊"
        >
          自動排序
        </button>
      </div>
      <div className="mt-2 space-y-2 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-track-slate-900 scrollbar-thumb-slate-700">
        {stack.length === 0 ? <p className="text-xs text-slate-500">尚未加入任何層</p> : null}
        {stack.map((layer, idx) => {
          const isLinkedToNext = layer!.linkedId && stack[idx + 1]?.id === layer!.linkedId;
          const linkedButMissing = layer!.linkedId && !compareOrder.includes(layer!.linkedId);

          return (
            <div key={layer!.id} className="relative">
              {/* Link Indicator between layers */}
              {isLinkedToNext && (
                <div className="absolute left-6 -bottom-3 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
              )}
              
              <div
                className={clsx(
                  "space-y-1 rounded-lg border bg-slate-900/70 px-2 py-2 text-xs text-slate-100 transition-colors",
                  isLinkedToNext || (idx > 0 && stack[idx-1]?.linkedId === layer!.id) 
                    ? "border-indigo-500/30 ring-1 ring-indigo-500/10" 
                    : "border-slate-800/70"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-300">Layer {idx + 1}</span>
                    <span className="font-semibold max-w-[140px] truncate" title={layer!.filename}>{layer!.filename ?? layer!.id}</span>
                    {layer!.linkedId && (
                      <span className="text-[10px] text-indigo-400" title="此影像有關聯的下一張影像">
                        🔗
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      className="rounded border border-slate-700 px-2 py-1 hover:border-cyan-400/60"
                      onClick={() => move(layer!.id!, -1)}
                      disabled={idx === 0}
                    >
                      ↑
                    </button>
                    <button
                      className="rounded border border-slate-700 px-2 py-1 hover:border-cyan-400/60"
                      onClick={() => move(layer!.id!, 1)}
                      disabled={idx === stack.length - 1}
                    >
                      ↓
                    </button>
                    <button
                      className="rounded border border-slate-700 px-2 py-1 text-rose-200 hover:border-rose-400/60"
                      onClick={() => remove(layer!.id!)}
                    >
                      移除
                    </button>
                  </div>
                </div>
                
                {/* Quick Add Linked Button */}
                {linkedButMissing && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => add(layer!.linkedId!)}
                      className="flex items-center gap-1 text-[10px] text-indigo-300 hover:text-indigo-200"
                    >
                      <span>+ 加入關聯影像</span>
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={layerSettings[layer!.id!]?.visible ?? true}
                      onChange={(e) => setLayerSettings(layer!.id!, { visible: e.target.checked })}
                    />
                    可見
                  </label>
                  <div className="flex items-center gap-2">
                    <span>透明度</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={layerSettings[layer!.id!]?.opacity ?? 1}
                      onChange={(e) => setLayerSettings(layer!.id!, { opacity: Number(e.target.value) })}
                      className={idx === 0 ? "accent-slate-600 opacity-60" : "accent-cyan-400"}
                    />
                    <span className="text-slate-300">{((layerSettings[layer!.id!]?.opacity ?? 1) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>放大鏡連結</span>
                    <select
                      className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100"
                      value={magnifierLinks[layer!.id!] ?? ""}
                      onChange={(e) => setMagnifierLink(layer!.id!, e.target.value || null)}
                    >
                      <option value="">(自動)</option>
                      {compareOrder
                        .filter((id) => id !== layer!.id)
                        .map((id) => (
                          <option key={id} value={id}>
                            連到 Layer {compareOrder.indexOf(id) + 1}
                          </option>
                        ))}
                    </select>
                  </div>
                  {idx > 0 && idx - 1 < sliderPositions.length ? (
                    <div className="flex items-center gap-2">
                      <span>滑桿 {idx}</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={sliderPositions[idx - 1] ?? 50}
                        onChange={(e) => setSliderPositions(idx - 1, Number(e.target.value))}
                        className={idx === stack.length - 1 ? "accent-slate-600 opacity-60" : "accent-cyan-400"}
                      />
                      <span className="text-slate-300">{(sliderPositions[idx - 1] ?? 50).toFixed(0)}%</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {available.length > 0 ? (
        <div className="mt-3 space-y-1">
          <p className="text-[11px] text-slate-400">可加入的影像：</p>
          <div className="flex flex-wrap gap-2">
            {available.map((img) => (
              <button
                key={img.id}
                className="rounded-lg border border-slate-700/70 bg-slate-800/70 px-2 py-1 text-xs text-slate-100 hover:border-cyan-400/60 disabled:opacity-40"
                disabled={compareOrder.length >= MAX_LAYERS}
                onClick={() => add(img.id!)}
              >
                加入 {img.filename ?? img.id}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};
