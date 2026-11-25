import React from "react";
import clsx from "classnames";
import { useComparisonStore } from "../store/comparisonStore";
import type { Channel } from "../store/comparisonStore";

const channelOptions: { value: Channel; label: string }[] = [
  { value: "rgb", label: "RGB" },
  { value: "luma", label: "Luma" },
  { value: "r", label: "R" },
  { value: "g", label: "G" },
  { value: "b", label: "B" },
];

export const ViewerControlPanel: React.FC = () => {
  const {
    heatmap,
    setHeatmap,
    setHeatmapPair,
    blink,
    setBlink,
    magnifier,
    setMagnifier,
    channel,
    setChannel,
    edgeEmphasis,
    setEdgeEmphasis,
    gammaPreview,
    setGammaPreview,
    gridRuler,
    setGridRuler,
    compareOrder,
    images, // Add images
  } = useComparisonStore();

  const availableGroups = React.useMemo(() => {
    const groups = new Set<string>();
    compareOrder.forEach(id => {
      const img = images.find(i => i.id === id);
      if (img?.groupName) {
        groups.add(img.groupName);
      }
    });
    return Array.from(groups).sort();
  }, [compareOrder, images]);

  // Effect for Auto Group Switch
  React.useEffect(() => {
    if (!blink.enabled || !blink.autoGroupSwitch || availableGroups.length === 0) return;

    const timer = setInterval(() => {
        const currentGroup = useComparisonStore.getState().blink.targetGroup;
        const currentIndex = availableGroups.indexOf(currentGroup ?? "");
        const nextIndex = (currentIndex + 1) % availableGroups.length;
        
        setBlink({ targetGroup: availableGroups[nextIndex] });
    }, blink.groupSwitchInterval * 1000);
    
    return () => clearInterval(timer);
  }, [blink.enabled, blink.autoGroupSwitch, blink.groupSwitchInterval, availableGroups, setBlink]);

  return (
    <div className="glass-panel rounded-2xl border border-slate-800/70 px-4 py-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Heatmap & Blink */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-slate-200">熱度圖</span>
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={heatmap.enabled}
                  onChange={(e) => setHeatmap({ enabled: e.target.checked })}
                />
                DeltaE Heatmap
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-400">
              套用至
              <select
                className="rounded-md bg-slate-900/80 px-2 py-1 text-xs text-slate-100"
                value={heatmap.applyTo}
                onChange={(e) => setHeatmap({ applyTo: e.target.value as any })}
              >
                <option value="after">After</option>
                <option value="before">Before</option>
                <option value="both">Both</option>
              </select>
            </label>
          </div>

          <div className="space-y-2 rounded-lg bg-slate-900/50 p-3">
            <p className="text-xs text-slate-400">Heatmap 基層/目標</p>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              Base
              <select
                className="flex-1 rounded-md bg-slate-900/80 px-2 py-1 text-xs text-slate-100"
                value={heatmap.baseId ?? ""}
                onChange={(e) => setHeatmapPair(e.target.value || null, heatmap.targetId)}
                disabled={!compareOrder.length}
              >
                <option value="">(auto: 第1層)</option>
                {compareOrder.map((id, idx) => (
                  <option key={id} value={id}>
                    Layer {idx + 1}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              Target
              <select
                className="flex-1 rounded-md bg-slate-900/80 px-2 py-1 text-xs text-slate-100"
                value={heatmap.targetId ?? ""}
                onChange={(e) => setHeatmapPair(heatmap.baseId, e.target.value || null)}
                disabled={compareOrder.length < 2}
              >
                <option value="">(auto: 第2層)</option>
                {compareOrder.map((id, idx) => (
                  <option key={id} value={id}>
                    Layer {idx + 1}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-[11px] text-slate-500">若未選則自動用前兩層。</p>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <input type="checkbox" checked={blink.enabled} onChange={(e) => setBlink({ enabled: e.target.checked })} />
              交錯閃爍 Blinking
            </label>
            
            {blink.enabled && availableGroups.length > 0 && (
              <div className="flex flex-col gap-2 mt-2 pl-2 border-l border-slate-700">
                  <label className="flex items-center gap-2 text-xs text-slate-400">
                    目標群組
                    <select
                      className="rounded-md bg-slate-900/80 px-2 py-1 text-xs text-slate-100"
                      value={blink.targetGroup ?? ""}
                      onChange={(e) => setBlink({ targetGroup: e.target.value || null })}
                    >
                      <option value="">(全部關聯)</option>
                      {availableGroups.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-400">
                    <input 
                        type="checkbox" 
                        checked={blink.autoGroupSwitch} 
                        onChange={(e) => setBlink({ autoGroupSwitch: e.target.checked })} 
                    />
                    自動輪播群組
                  </label>
                  {blink.autoGroupSwitch && (
                      <label className="flex items-center gap-2 text-xs text-slate-400">
                        間隔 (秒)
                        <input 
                            type="number" 
                            min={1} 
                            max={60} 
                            value={blink.groupSwitchInterval} 
                            onChange={(e) => setBlink({ groupSwitchInterval: Math.max(1, Number(e.target.value)) })}
                            className="w-12 rounded bg-slate-900 border border-slate-700 px-1"
                        />
                      </label>
                  )}
              </div>
            )}
          </div>
        </div>

        {/* Loupe & side-by-side */}
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-200">放大鏡 Loupe</span>
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={magnifier.enabled}
                  onChange={(e) => setMagnifier({ enabled: e.target.checked })}
                />
                啟用
              </label>
            </div>
            <label className="flex items-center gap-3 text-xs text-slate-400">
              <span>半徑</span>
              <input
                type="range"
                min={80}
                max={240}
                step={10}
                value={magnifier.radius}
                onChange={(e) => setMagnifier({ radius: Number(e.target.value) })}
                className="w-full accent-cyan-400"
              />
              <span className="text-slate-300">{magnifier.radius}px</span>
            </label>
            <label className="flex items-center gap-3 text-xs text-slate-400">
              <span>目標層</span>
              <select
                className="rounded-md bg-slate-900/80 px-2 py-1 text-xs text-slate-100"
                value={magnifier.targetId ?? ""}
                onChange={(e) => setMagnifier({ targetId: e.target.value || null })}
                disabled={!compareOrder.length}
              >
                <option value="">(自動對向層)</option>
                {compareOrder.map((id, idx) => (
                  <option key={id} value={id}>
                    Layer {idx + 1}
                  </option>
                ))}
              </select>
            </label>
          </div>

        </div>

        {/* Channel, edge, gamma, grid */}
        <div className="space-y-3">
          <div className="space-y-2">
            <span className="text-slate-200">通道檢視</span>
            <div className="flex flex-wrap gap-2">
              {channelOptions.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setChannel(c.value)}
                  className={clsx(
                    "rounded-md px-2 py-1 text-xs font-semibold",
                    channel === c.value ? "bg-cyan-500/20 text-cyan-100" : "bg-slate-800/60 text-slate-200"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-200">邊緣強化</span>
              <input
                type="checkbox"
                checked={edgeEmphasis.enabled}
                onChange={(e) => setEdgeEmphasis({ enabled: e.target.checked })}
              />
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={edgeEmphasis.strength}
              onChange={(e) => setEdgeEmphasis({ strength: Number(e.target.value) })}
              className="w-full accent-cyan-400"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-200">Gamma/亮度</span>
              <input
                type="checkbox"
                checked={gammaPreview.enabled}
                onChange={(e) => setGammaPreview({ enabled: e.target.checked })}
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex flex-col text-[11px] text-slate-400">
                gamma
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.05}
                  value={gammaPreview.gamma}
                  onChange={(e) => setGammaPreview({ gamma: Number(e.target.value) })}
                  className="accent-cyan-400"
                />
              </label>
              <label className="flex flex-col text-[11px] text-slate-400">
                brightness
                <input
                  type="range"
                  min={0.5}
                  max={1.5}
                  step={0.05}
                  value={gammaPreview.brightness}
                  onChange={(e) => setGammaPreview({ brightness: Number(e.target.value) })}
                  className="accent-cyan-400"
                />
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-slate-200">網格/尺標</span>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={gridRuler.showGrid}
                  onChange={(e) => setGridRuler({ showGrid: e.target.checked })}
                />
                Grid
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={gridRuler.showRuler}
                  onChange={(e) => setGridRuler({ showRuler: e.target.checked })}
                />
                Ruler
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

