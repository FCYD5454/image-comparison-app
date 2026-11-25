import React from "react";
import { useComparisonStore } from "../store/comparisonStore";

const formatSize = (size?: number) => {
  if (!size) return "—";
  const mb = size / 1024 / 1024;
  return `${mb.toFixed(1)} MB`;
};

export const InfoPanel: React.FC = () => {
  const { beforeImage, afterImage, heatmap, heatmapStats, blink, channel, gridRuler } = useComparisonStore();

  return (
    <div className="glass-panel mt-4 rounded-2xl border border-slate-800/60 px-4 py-3 text-xs text-slate-200">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Before</p>
          <p className="font-semibold">{beforeImage?.filename ?? "—"}</p>
          <p className="text-slate-500">{formatSize(beforeImage?.size)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">After</p>
          <p className="font-semibold">{afterImage?.filename ?? "—"}</p>
          <p className="text-slate-500">{formatSize(afterImage?.size)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">顯示模式</p>
          <p className="font-semibold">
            {heatmap.enabled ? "Heatmap on" : "Heatmap off"} / {blink.enabled ? `Blink ${blink.rateHz.toFixed(1)}Hz` : "Blink off"}
          </p>
          <p className="text-slate-500">
            Channel: {channel}
            {heatmapStats ? ` · ΔE mean ${heatmapStats.mean.toFixed(2)} / max ${heatmapStats.max.toFixed(2)}` : ""}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">輔助圖層</p>
          <p className="font-semibold">
            Grid {gridRuler.showGrid ? "on" : "off"} / Ruler {gridRuler.showRuler ? "on" : "off"}
          </p>
          <p className="text-slate-500">Grid size: {gridRuler.gridSize}px</p>
        </div>
      </div>
    </div>
  );
};

