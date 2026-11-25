import React, { useState } from "react";
import { useComparisonStore } from "../store/comparisonStore";
import { uploadImage } from "../api/client";
import { ImageLibraryModal } from "./ImageLibrary"; // Importing the new modal

const ACCEPT = "image/png,image/jpeg,image/webp,image/avif";
const MAX_SIZE_MB = 25;

export const UploadPanel: React.FC = () => {
  const { setErrors, addImage, images, setCompareOrder, compareOrder, updateImage, removeImage } = useComparisonStore();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);

  const handleFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    for (const file of files) {
      if (file.size / (1024 * 1024) > MAX_SIZE_MB) {
        setErrors(`檔案超過 ${MAX_SIZE_MB}MB：${file.name}`);
        continue;
      }
      try {
        const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
        const localUrl = URL.createObjectURL(file);
        
        // Load image to get dimensions
        const img = new Image();
        img.src = localUrl;
        
        // We use a promise to wait for image load if we wanted to guarantee dimensions 
        // before adding, but to keep UI responsive we can add immediately OR 
        // wait slightly. Let's wait slightly as it's usually fast for local blobs.
        await new Promise((resolve) => {
             img.onload = () => resolve(true);
             img.onerror = () => resolve(false);
        });

        addImage({
          id,
          url: localUrl,
          filename: file.name,
          size: file.size,
          width: img.width || undefined,
          height: img.height || undefined,
        });
        
        // async upload and update url when done
        uploadImage(file)
          .then((res) => {
            updateImage(id, {
              url: res.url,
              fileKey: res.fileKey,
              filename: res.filename,
              size: res.size,
            });
            setErrors(null);
          })
          .catch((err: any) => {
            setErrors(err?.message ?? `上傳失敗：${file.name}`);
          });
      } catch (err: any) {
        setErrors(err?.message ?? "上傳失敗");
      }
    }
    // 若 compareOrder 未滿 3，自動填入最新加入的影像
    const latest = useComparisonStore.getState().images;
    if (latest.length) {
      const toFill = latest
        .map((img) => img.id!)
        .filter((id) => !compareOrder.includes(id))
        .slice(0, 3 - compareOrder.length);
      if (toFill.length) setCompareOrder([...compareOrder, ...toFill]);
    }
  };

  const onInput = (ev: React.ChangeEvent<HTMLInputElement>) => {
    if (ev.target.files?.length) {
      handleFiles(ev.target.files);
      ev.target.value = "";
    }
  };

  const onDrop = (ev: React.DragEvent<HTMLDivElement>) => {
    ev.preventDefault();
    if (ev.dataTransfer.files?.length) {
      handleFiles(ev.dataTransfer.files);
    }
  };

  const onDragOver = (ev: React.DragEvent<HTMLDivElement>) => {
    ev.preventDefault();
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">圖片上傳</h3>
        <p className="text-xs text-slate-500">拖放或選取多張圖片，支援 PNG / JPG / WEBP / AVIF，單檔上限 {MAX_SIZE_MB}MB</p>
      </div>

      <div
        onDragOver={onDragOver}
        onDrop={onDrop}
        className="flex min-h-[140px] cursor-pointer flex-col justify-center rounded-xl border border-dashed border-slate-700/70 bg-slate-900/50 px-4 py-4 text-center text-sm text-slate-200 transition hover:border-cyan-400/70 hover:bg-slate-900/70"
      >
        <label>
          <span className="text-lg font-semibold text-cyan-200">拖放圖片到此或點擊上傳</span>
          <span className="mt-1 block text-xs text-slate-500">可一次上傳多張，將會加入影像庫並可在圖層堆疊選用</span>
          <input aria-label="上傳圖片" type="file" accept={ACCEPT} multiple className="hidden" onChange={onInput} />
        </label>
      </div>

      <div className="rounded-xl border border-slate-800/70 bg-slate-900/50 px-3 py-3 text-xs text-slate-200">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-semibold">已上傳影像</span>
          <span className="text-[11px] text-slate-500">{images.length} 張</span>
        </div>
        {images.length === 0 ? (
          <p className="text-slate-500">尚未有影像</p>
        ) : (
          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
            {images.map((img) => (
              <div key={img.id} className="group relative">
                <div className="flex items-center justify-between rounded-lg bg-slate-800/60 px-2 py-1">
                  <span className="truncate text-slate-100">{img.filename ?? img.id}</span>
                  <span className="text-[11px] text-slate-500">
                    {img.size ? `${(img.size / 1024 / 1024).toFixed(1)} MB` : ""}
                  </span>
                </div>
                <div className="pointer-events-none absolute inset-0 hidden items-center justify-end gap-2 rounded-lg bg-slate-950/90 px-2 py-1 text-xs text-slate-100 shadow-lg ring-1 ring-slate-700/60 group-hover:flex z-10">
                  <button
                    className="pointer-events-auto rounded bg-cyan-600 px-2 py-1 text-[11px] font-semibold hover:bg-cyan-500"
                    onClick={() => setPreviewId(img.id!)}
                  >
                    Open
                  </button>
                  <button
                    className="pointer-events-auto rounded bg-rose-600 px-2 py-1 text-[11px] font-semibold hover:bg-rose-500"
                    onClick={() => removeImage(img.id!)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Manage Button */}
        <div className="mt-3 border-t border-slate-700/50 pt-2">
          <button
            onClick={() => setShowLibrary(true)}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-slate-800 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700 hover:text-white group"
          >
            <svg className="h-4 w-4 text-slate-400 group-hover:text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            圖片庫管理
          </button>
        </div>
      </div>

      {showLibrary && <ImageLibraryModal onClose={() => setShowLibrary(false)} />}

      {previewId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewId(null)}
        >
          <div
            className="relative w-full max-w-4xl rounded-2xl bg-slate-950/95 p-6 shadow-2xl ring-1 ring-slate-700 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const target = images.find((i) => i.id === previewId);
              if (!target) return <p className="text-slate-200">Image not found.</p>;
              return (
                <>
                  {/* Header: Name (Left), Resolution (Center), Close (Right) */}
                  <div className="flex items-center justify-between w-full relative h-8">
                     {/* Name */}
                     <div className="text-sm font-semibold text-slate-100 truncate max-w-[35%]">
                       {target.filename ?? target.id}
                     </div>

                     {/* Resolution (Absolute Center) */}
                     {target.width && target.height && (
                       <div className="absolute left-1/2 -translate-x-1/2">
                         <span className="rounded-full bg-slate-800/80 px-3 py-1 text-xs font-mono text-cyan-300 ring-1 ring-slate-700">
                           {target.width} × {target.height} px
                         </span>
                       </div>
                     )}

                     {/* Close Button */}
                     <button
                       className="rounded bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 transition-colors z-10"
                       onClick={() => setPreviewId(null)}
                     >
                       Close
                     </button>
                  </div>

                  {/* Image Area */}
                  <div className="flex max-h-[70vh] w-full items-center justify-center overflow-hidden rounded-xl bg-slate-900/50 p-2">
                    <img 
                      src={target.url} 
                      alt={target.filename ?? target.id} 
                      className="max-h-[70vh] max-w-full object-contain" 
                    />
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      ) : null}
    </div>
  );
};

