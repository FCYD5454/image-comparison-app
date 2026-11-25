import "./index.css";
import { UploadPanel } from "./components/UploadPanel";
import { ComparisonViewer } from "./components/ComparisonViewer";
import { InfoPanel } from "./components/InfoPanel";
import { ControlsBar } from "./components/ControlsBar";
import { ViewerControlPanel } from "./components/ViewerControlPanel";

function App() {
  return (
    <div className="min-h-screen bg-transparent text-slate-50">
      <div className="w-full px-4 py-8 md:px-6 xl:px-10">
        <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/70">Image Compare Lab</p>
            <h1 className="text-3xl font-bold text-slate-50">人眼導向的前/後圖片比較 (Human-eye-centric Image Compare)</h1>
            <p className="text-sm text-slate-400">
              支援滑桿、並排、多分區、DeltaE 熱度圖、交錯閃爍、通道檢視、局部放大、網格與尺標。
            </p>
          </div>
          <div className="rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-xs text-cyan-100">
            提示：可先用任何兩張圖片測試滑桿、熱度圖、Blink 及通道切換。
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px,1fr,480px]">
          <aside className="glass-panel h-full rounded-2xl border border-slate-800/70 px-4 py-4 lg:col-start-1">
            <UploadPanel />
            <div className="mt-6 text-xs text-slate-500">
              快捷鍵：S 滑桿 / B 並排 / F 全螢幕 / G 熱度圖 / K Blink / L Loupe
            </div>
          </aside>

          <main className="flex flex-col gap-4 lg:col-start-2">
            <ComparisonViewer />
            <ViewerControlPanel />
          </main>

          <section className="flex flex-col gap-4 lg:col-start-3">
            <ControlsBar />
          </section>
        </div>

        <InfoPanel />
      </div>
      </div>
  );
}

export default App;
