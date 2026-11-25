import React from "react";
import { useComparisonStore } from "../store/comparisonStore";
import type { ComparisonMode } from "../store/comparisonStore";
import clsx from "classnames";
import { LayerStackPanel } from "./LayerStackPanel";
import { exportComparisonImage } from "../utils/exportImage";

const modeOptions: { value: ComparisonMode; label: string }[] = [
  { value: "slider", label: "滑桿" },
  { value: "sideBySide", label: "並排" },
  { value: "multiSplit", label: "多分區" },
  { value: "sequence", label: "序列播放" },
];

export const ControlsBar: React.FC = () => {
  const { 
    mode, setMode, 
    splitDirection, splitCount, setSplit, 
    resetView,
    sideBySide, setSideBySide,
    compareOrder,
    sequence, setSequence,
    images
  } = useComparisonStore();

  const handleLeftChange = (id: string | null) => {
    // If id has a linked image, set right to it
    const img = images.find(i => i.id === id);
    let rightId = sideBySide.rightId;
    if (img?.linkedId) {
      // Check if linked image is in compareOrder (available for selection)
      // Even if not in compareOrder, we might want to auto-select it if possible?
      // But the select options are built from compareOrder. 
      // So only auto-select if it's in the list.
      if (compareOrder.includes(img.linkedId)) {
        rightId = img.linkedId;
      }
    }
    setSideBySide(id, rightId);
  };

  const renderModeButtons = () => (
    <div className="flex flex-wrap gap-2">
      {modeOptions.map((m) => (
        <button
          key={m.value}
          type="button"
          onClick={() => setMode(m.value)}
          className={clsx(
            "rounded-lg px-3 py-2 text-sm font-semibold transition",
            mode === m.value
              ? "bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/60"
              : "bg-slate-800/60 text-slate-200 hover:bg-slate-700/80"
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="glass-panel rounded-2xl px-4 py-4 text-sm">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">模式</p>
            {renderModeButtons()}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-700/70 bg-slate-800/70 px-3 py-2 text-xs font-semibold text-slate-100 hover:border-cyan-400/60"
              onClick={exportComparisonImage}
            >
              匯出圖片
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-700/70 bg-slate-800/70 px-3 py-2 text-xs font-semibold text-slate-100 hover:border-cyan-400/60"
              onClick={async () => {
                try {
                  // Check if Region Capture is supported (experimental)
                  // @ts-ignore
                  if (!window.CropTarget) {
                      alert("您的瀏覽器不支援區域錄影 (Region Capture)。將錄製所選畫面。請使用最新版 Chrome/Edge。");
                  }

                  const stream = await navigator.mediaDevices.getDisplayMedia({
                    video: { displaySurface: "browser" },
                    audio: false,
                    // @ts-ignore
                    preferCurrentTab: true // Hint to browser to show current tab first
                  });
                  
                  // Attempt to crop to the main image area
                  // @ts-ignore
                  if (window.CropTarget && stream.getVideoTracks().length > 0) {
                      const track = stream.getVideoTracks()[0];
                      // @ts-ignore
                      if (track.cropTo) {
                          const element = document.getElementById("comparison-container");
                          if (element) {
                              // @ts-ignore
                              const cropTarget = await window.CropTarget.fromElement(element);
                              // @ts-ignore
                              await track.cropTo(cropTarget);
                          }
                      }
                  }

                  const mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });
                  const chunks: Blob[] = [];
                  mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) chunks.push(e.data);
                  };
                  mediaRecorder.onstop = () => {
                    const blob = new Blob(chunks, { type: "video/webm" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `recording-${Date.now()}.webm`;
                    a.click();
                    URL.revokeObjectURL(url);
                    stream.getTracks().forEach(track => track.stop());
                  };
                  mediaRecorder.start();
                } catch (err) {
                  console.error("Recording failed", err);
                }
              }}
            >
              螢幕錄影
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-700/70 bg-slate-800/70 px-3 py-2 text-xs font-semibold text-slate-100 hover:border-cyan-400/60"
              onClick={resetView}
            >
              重置視圖
            </button>
          </div>
        </div>

        {mode === "sideBySide" && (
          <div className="rounded-lg border border-slate-800/70 bg-slate-900/60 p-3 text-xs text-slate-300">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-slate-200">並排顯示</span>
            </div>
            <div className="flex flex-col gap-2 text-xs text-slate-400">
              <label className="flex items-center gap-2">
                <span>左圖</span>
                <select
                  className="rounded-md bg-slate-900/80 px-2 py-1 text-xs text-slate-100"
                  value={sideBySide.leftId ?? ""}
                  onChange={(e) => handleLeftChange(e.target.value || null)}
                  disabled={compareOrder.length < 1}
                >
                  <option value="">(Layer 1)</option>
                  {compareOrder.map((id, idx) => (
                    <option key={id} value={id}>
                      Layer {idx + 1}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span>右圖</span>
                <select
                  className="rounded-md bg-slate-900/80 px-2 py-1 text-xs text-slate-100"
                  value={sideBySide.rightId ?? ""}
                  onChange={(e) => setSideBySide(sideBySide.leftId, e.target.value || null)}
                  disabled={compareOrder.length < 2}
                >
                  <option value="">(Layer 2)</option>
                  {compareOrder.map((id, idx) => (
                    <option key={id} value={id}>
                      Layer {idx + 1}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-[11px] text-slate-500">未選則預設前兩層</p>
            </div>
          </div>
        )}

        {mode === "sequence" && (
          <div className="rounded-lg border border-slate-800/70 bg-slate-900/60 p-3 text-xs text-slate-300">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-slate-200">序列播放設定</span>
              <button
                 className={clsx("rounded px-2 py-1 text-xs font-bold", sequence.playing ? "bg-rose-500 text-white" : "bg-cyan-500 text-white")}
                 onClick={() => setSequence({ playing: !sequence.playing })}
              >
                {sequence.playing ? "暫停" : "播放"}
              </button>
            </div>
            <div className="space-y-2">
               <label className="flex flex-col gap-1">
                 <div className="flex justify-between">
                   <span>播放速度 (FPS)</span>
                   <span>{sequence.speed}</span>
                 </div>
                 <input
                   type="range"
                   min={1}
                   max={30}
                   step={1}
                   value={sequence.speed}
                   onChange={(e) => setSequence({ speed: Number(e.target.value) })}
                   className="w-full accent-cyan-400"
                 />
               </label>
               <label className="flex items-center gap-2">
                 <span className="text-slate-300">播放方向</span>
                 <select
                   className="rounded-md bg-slate-900/80 px-2 py-1 text-xs text-slate-100"
                   value={sequence.direction}
                   onChange={(e) => setSequence({ direction: e.target.value as "forward" | "backward" })}
                 >
                   <option value="backward">倒序 (2&rarr;1&rarr;0)</option>
                   <option value="forward">正序 (0&rarr;1&rarr;2)</option>
                 </select>
               </label>
                       <div className="text-[11px] text-slate-500">
                         當前幀: Layer {sequence.index + 1}
                       </div>
                       <label className="flex items-center gap-2 mt-1">
                         <input
                           type="checkbox"
                           checked={sequence.crossfade}
                           onChange={(e) => setSequence({ crossfade: e.target.checked })}
                           className="rounded border-slate-700 bg-slate-900/80 text-cyan-500 focus:ring-offset-0"
                         />
                         <span>平滑切換 (Fade)</span>
                       </label>
                       
                       {sequence.crossfade && (
                         <div className="ml-4 flex flex-col gap-1 border-l border-slate-700/50 pl-2">
                           <label className="flex items-center gap-2 text-[11px] text-slate-400">
                             <input
                               type="checkbox"
                               checked={sequence.crossfadeOnlyLinked}
                               onChange={(e) => setSequence({ crossfadeOnlyLinked: e.target.checked })}
                               className="rounded border-slate-700 bg-slate-900/80 text-cyan-500 focus:ring-offset-0"
                             />
                             <span>僅關聯影像</span>
                           </label>
                           <label className="flex flex-col gap-0.5 text-[11px] text-slate-400">
                             <div className="flex justify-between">
                               <span>Fade 速度 (x{sequence.crossfadeSpeed})</span>
                             </div>
                             <input
                               type="range"
                               min={0.1}
                               max={3}
                               step={0.1}
                               value={sequence.crossfadeSpeed}
                               onChange={(e) => setSequence({ crossfadeSpeed: Number(e.target.value) })}
                               className="w-full accent-cyan-400 h-1"
                             />
                           </label>
                         </div>
                       )}
                    </div>
                  </div>
                )}

        <LayerStackPanel />

        {mode === "multiSplit" && (
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              <span className="text-slate-300">方向</span>
              <select
                className="rounded-md bg-slate-900/80 px-2 py-1 text-xs"
                value={splitDirection}
                onChange={(e) => setSplit({ direction: e.target.value as any })}
              >
                <option value="vertical">垂直</option>
                <option value="horizontal">水平</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-slate-300">分區數</span>
              <input
                type="number"
                min={2}
                max={4}
                value={splitCount}
                onChange={(e) => setSplit({ count: Number(e.target.value) })}
                className="w-16 rounded-md bg-slate-900/80 px-2 py-1 text-xs"
              />
            </label>
          </div>
        )}

      </div>
    </div>
  );
};
