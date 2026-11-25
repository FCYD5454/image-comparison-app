import React, { useState, useMemo } from "react";
import { useComparisonStore } from "../store/comparisonStore";
import clsx from "classnames";
import { uploadImage } from "../api/client";

interface Props {
  onClose: () => void;
}

const formatSize = (size?: number) => {
  if (!size) return "—";
  const mb = size / 1024 / 1024;
  return `${mb.toFixed(1)} MB`;
};

type SortOption = "time_desc" | "time_asc" | "name_asc" | "name_desc" | "size_desc";

export const ImageLibraryModal: React.FC<Props> = ({ onClose }) => {
  const { images, removeImage, setCompareOrder, compareOrder, addImage, updateImage, setErrors, linkImages, unlinkImage, getChain, importState } = useComparisonStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("time_desc");
  const [isUploading, setIsUploading] = useState(false);
  const [selectionMode, setSelectionMode] = useState<"compare" | "link">("compare");
  const [selectedForLink, setSelectedForLink] = useState<string[]>([]);
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");

  const linkGroups = useMemo(() => {
    const map = new Map<string, { groupId: string, index: number, total: number, name?: string }>();
    const visited = new Set<string>();
    let groupCount = 0;

    // Helper to process a chain
    const processChain = (startId: string) => {
        const chain: string[] = [];
        let curr: string | undefined = startId;
        const chainVisited = new Set<string>();
        
        while (curr && !chainVisited.has(curr)) {
            chainVisited.add(curr);
            chain.push(curr);
            visited.add(curr);
            const img = images.find(i => i.id === curr);
            curr = img?.linkedId ?? undefined;
        }
        
        if (chain.length > 1) {
            const groupId = `g-${groupCount++}`;
            const firstImg = images.find(i => i.id === chain[0]);
            const groupName = firstImg?.groupName;
            chain.forEach((id, idx) => {
                map.set(id, { groupId, index: idx + 1, total: chain.length, name: groupName });
            });
        }
    };

    // 1. Build parent map to find roots
    const parentMap = new Map<string, string>();
    images.forEach(img => {
        if (img.linkedId) {
             if (images.some(i => i.id === img.linkedId)) {
                 parentMap.set(img.linkedId, img.id!);
             }
        }
    });

    // 2. Find roots
    const roots = images.filter(img => !parentMap.has(img.id!));
    roots.forEach(root => {
        if (!visited.has(root.id!)) {
            processChain(root.id!);
        }
    });

    // 3. Handle cycles
    images.forEach(img => {
        if (!visited.has(img.id!)) {
            processChain(img.id!);
        }
    });

    return map;
  }, [images]);

  // Filter and Sort
  const filteredImages = useMemo(() => {
    let result = [...images];

    // Filter
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(img => 
        (img.filename?.toLowerCase().includes(lower)) || 
        (img.id?.toLowerCase().includes(lower))
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "time_desc":
          return (b.id || "").localeCompare(a.id || ""); // id is roughly timestamp based
        case "time_asc":
          return (a.id || "").localeCompare(b.id || "");
        case "name_asc":
          return (a.filename || "").localeCompare(b.filename || "");
        case "name_desc":
          return (b.filename || "").localeCompare(a.filename || "");
        case "size_desc":
          return (b.size || 0) - (a.size || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [images, searchTerm, sortBy]);

  const toggleSelection = (id: string) => {
    if (selectionMode === "compare") {
      if (compareOrder.includes(id)) {
        setCompareOrder(compareOrder.filter((x) => x !== id));
      } else {
        setCompareOrder([...compareOrder, id]);
      }
    } else {
      // Logic for Link Mode: If clicking a chain member, select whole chain
      // If already selected, maybe deselect? Or just toggle individual if user wants to break it?
      // Let's keep it simple: Toggle individual, BUT if it's a new selection and part of a chain, ask or auto-select whole?
      // Better: User wants to reorder. If they click one, they might want to add it.
      // If they want to EDIT a chain, they should select all of them.
      // Let's try: If the clicked image is part of a chain and NOT in selection, add the whole chain.
      
      if (selectedForLink.includes(id)) {
        setSelectedForLink(selectedForLink.filter((x) => x !== id));
      } else {
        const chain = getChain(id);
        if (chain.length > 1) {
            // It's a chain. Add all that are not already selected.
            const newIds = chain.map(c => c.id!).filter(cid => !selectedForLink.includes(cid));
            setSelectedForLink([...selectedForLink, ...newIds]);
        } else {
            setSelectedForLink([...selectedForLink, id]);
        }
      }
    }
  };

  const moveLinkItem = (index: number, direction: -1 | 1) => {
    if (index + direction < 0 || index + direction >= selectedForLink.length) return;
    const newOrder = [...selectedForLink];
    [newOrder[index], newOrder[index + direction]] = [newOrder[index + direction], newOrder[index]];
    setSelectedForLink(newOrder);
  };

  // Effect to sync newGroupName with selected chain name
  React.useEffect(() => {
      if (selectionMode === "link" && selectedForLink.length > 0) {
          const names = new Set(selectedForLink.map(id => images.find(i => i.id === id)?.groupName).filter(Boolean));
          if (names.size === 1) {
              setNewGroupName(Array.from(names)[0]!);
          } else {
              setNewGroupName("");
          }
      }
  }, [selectionMode, selectedForLink, images]);

  const handleLink = () => {
    if (selectedForLink.length < 2) return;
    linkImages(selectedForLink, newGroupName || undefined);
    setSelectedForLink([]);
    // Do not exit link mode automatically
    // setSelectionMode("compare");
    setNewGroupName("");
  };

  const handleUnlink = () => {
    if (selectedForLink.length === 0) return;
    selectedForLink.forEach(id => unlinkImage(id));
    setSelectedForLink([]);
    // Do not exit link mode automatically
    // setSelectionMode("compare");
    setNewGroupName("");
  };

  const handleDeleteSelected = () => {
    if (compareOrder.length === 0) return;
    if (confirm(`確定要刪除這 ${compareOrder.length} 張選取的影像嗎？此動作無法復原。`)) {
      // Create a copy because removeImage modifies compareOrder which we are iterating
      const idsToDelete = [...compareOrder];
      idsToDelete.forEach(id => removeImage(id));
      // compareOrder is updated by removeImage via store
    }
  };

  const onRemove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("確定要刪除此影像嗎？")) {
      removeImage(id);
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    const fileArray = Array.from(files);
    const MAX_SIZE_MB = 25;

    for (const file of fileArray) {
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
        await new Promise((resolve) => {
          img.onload = () => {
             addImage({
              id,
              url: localUrl,
              filename: file.name,
              size: file.size,
              width: img.width,
              height: img.height
            });
            resolve(true);
          };
          img.onerror = () => {
             // Fallback if image load fails
             addImage({
              id,
              url: localUrl,
              filename: file.name,
              size: file.size,
            });
            resolve(true);
          }
        });

        // Background upload
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
    setIsUploading(false);
  };

  const clearSelection = () => {
    setCompareOrder([]);
  };

  const selectAll = () => {
    const allIds = filteredImages.map(img => img.id!);
    if (selectionMode === "compare") {
      // Add all visible images to compare order
      setCompareOrder(Array.from(new Set([...compareOrder, ...allIds])));
    } else {
      // Add all visible images to link selection
      // Note: link selection is order-sensitive, so we just append unseen ones
      const newSelection = [...selectedForLink];
      allIds.forEach(id => {
        if (!newSelection.includes(id)) {
          newSelection.push(id);
        }
      });
      setSelectedForLink(newSelection);
    }
  };

  const handleExport = () => {
    const dataToExport = {
      images: images.filter(img => !img.url.startsWith("blob:")),
      compareOrder
    };
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `image-compare-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.images && Array.isArray(data.images)) {
          importState(data);
          alert("匯入成功！");
        } else {
          alert("匯入失敗：檔案格式錯誤");
        }
      } catch (err) {
        alert("匯入失敗：無法解析 JSON 檔案");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative flex h-[85vh] w-full max-w-6xl flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-slate-700/50 px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-end gap-3">
            <h2 className="text-xl font-bold text-slate-100">影像庫管理</h2>
            <span className="text-sm text-slate-400 mb-0.5">共 {images.length} 張影像</span>
          </div>
          
          <div className="flex flex-1 items-center gap-3 md:justify-end">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="搜尋影像名稱..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-48 rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-1.5 text-slate-500 hover:text-slate-300"
                >
                  ×
                </button>
              )}
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
            >
              <option value="time_desc">最新上傳</option>
              <option value="time_asc">最早上傳</option>
              <option value="name_asc">名稱 (A-Z)</option>
              <option value="name_desc">名稱 (Z-A)</option>
              <option value="size_desc">檔案大小</option>
            </select>

            <div className="h-6 w-px bg-slate-700 mx-1" />

            {/* Link Mode Controls */}
            {selectionMode === "link" ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 bg-slate-800/80 rounded-lg px-2 py-1 border border-indigo-500/30">
                  <span className="text-xs text-indigo-200">已選 {selectedForLink.length} 張</span>
                  
                  {/* Group Name Input */}
                  <input
                    type="text"
                    placeholder="群組名稱 (選填)"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="w-32 rounded bg-slate-900 border border-slate-700 px-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                  />

                  <button 
                    onClick={handleLink}
                    disabled={selectedForLink.length < 2}
                    className="rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={selectedForLink.length < 2 ? "請至少選取兩張影像" : "建立或更新關聯"}
                  >
                    {selectedForLink.length > 0 && linkGroups.has(selectedForLink[0]) ? "更新/重設" : "建立關聯"}
                  </button>
                  <button 
                    onClick={handleUnlink}
                    disabled={selectedForLink.length === 0}
                    className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600 disabled:opacity-50"
                  >
                    解除關聯
                  </button>
                  <button 
                    onClick={() => {
                      setSelectionMode("compare");
                      setSelectedForLink([]);
                      setNewGroupName("");
                    }}
                    className="ml-1 rounded-full p-0.5 text-slate-400 hover:text-white"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setSelectionMode("link")}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-indigo-300 transition-colors flex items-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                關聯設定
              </button>
            )}

            <div className="h-6 w-px bg-slate-700 mx-1" />

            {/* Actions */}
            {selectionMode === "compare" && (
              <>
                <button
                  onClick={selectAll}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                  disabled={filteredImages.length === 0}
                >
                  一鍵選取
                </button>
                <button 
                  onClick={clearSelection}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                  disabled={compareOrder.length === 0}
                >
                  清除選取 ({compareOrder.length})
                </button>
                <button 
                  onClick={handleDeleteSelected}
                  className="rounded-lg border border-rose-900/50 bg-rose-950/30 px-3 py-1.5 text-sm text-rose-300 hover:bg-rose-900/50 hover:text-rose-100 transition-colors"
                  disabled={compareOrder.length === 0}
                  title="刪除選取的影像"
                >
                  刪除選取 ({compareOrder.length})
                </button>
              </>
            )}

            <div className="h-6 w-px bg-slate-700 mx-1" />

            {/* Export / Import */}
            <div className="flex gap-2">
              <button 
                onClick={handleExport}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                title="匯出目前的關聯設定與影像清單"
              >
                匯出
              </button>
              <label className="cursor-pointer rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors" title="匯入先前備份的設定">
                匯入
                <input 
                  type="file" 
                  accept=".json" 
                  className="hidden" 
                  onChange={handleImport}
                />
              </label>
            </div>

            <button 
              onClick={onClose}
              className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-600 transition-colors"
            >
              關閉
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-track-slate-900 scrollbar-thumb-slate-700">
          
          {/* Chain Reorder Panel */}
          {selectionMode === "link" && selectedForLink.length > 0 && (
            <div className="sticky top-0 z-20 mb-4 rounded-xl border border-indigo-500/30 bg-slate-900/95 p-3 shadow-lg backdrop-blur-sm">
              <div className="flex items-center justify-between mb-2">
                 <span className="text-xs font-semibold text-indigo-200">關聯順序預覽 (左=底層 → 右=頂層)</span>
                 <span className="text-[10px] text-slate-400">使用箭頭調整順序</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {selectedForLink.map((id, idx) => {
                  const img = images.find(i => i.id === id);
                  return (
                    <div key={id} className="relative flex-shrink-0 flex flex-col items-center gap-1 group">
                      <div className="relative h-16 w-16 rounded border border-indigo-500/50 bg-slate-900 overflow-hidden">
                        <img src={img?.url} alt="" className="h-full w-full object-contain p-1" />
                        <div className="absolute top-0 left-0 bg-indigo-600 text-white text-[9px] px-1 rounded-br">
                          {idx + 1}
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => moveLinkItem(idx, -1)} disabled={idx === 0} className="p-0.5 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30">
                            <svg className="w-3 h-3 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                         </button>
                         <button onClick={() => moveLinkItem(idx, 1)} disabled={idx === selectedForLink.length - 1} className="p-0.5 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30">
                            <svg className="w-3 h-3 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                         </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Upload Drop Zone */}
          <div className="mb-6 relative group">
            <input 
              type="file" 
              multiple 
              accept="image/*" 
              className="absolute inset-0 z-10 w-full h-full opacity-0 cursor-pointer"
              onChange={(e) => handleUpload(e.target.files)}
            />
            <div className={clsx(
              "flex items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-700 bg-slate-800/30 p-4 transition-colors group-hover:border-cyan-500/50 group-hover:bg-slate-800/60",
              isUploading && "opacity-50 pointer-events-none"
            )}>
              <svg className="h-6 w-6 text-slate-400 group-hover:text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-sm font-medium text-slate-400 group-hover:text-cyan-200">
                {isUploading ? "正在處理影像..." : "點擊或拖放以新增更多影像到此庫"}
              </span>
            </div>
          </div>

          {filteredImages.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-slate-500">
              <p className="text-lg">
                {images.length === 0 ? "尚未上傳任何影像" : "找不到符合搜尋條件的影像"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {filteredImages.map((img) => {
                const isSelected = selectionMode === "compare" 
                  ? compareOrder.includes(img.id!) 
                  : selectedForLink.includes(img.id!);
                
                const selectionIndex = selectionMode === "compare"
                  ? compareOrder.indexOf(img.id!) + 1
                  : selectedForLink.indexOf(img.id!) + 1;
                
                const linkInfo = linkGroups.get(img.id!);
                const isGroupHovered = linkInfo && linkInfo.groupId === hoveredGroupId;

                return (
                  <div
                    key={img.id}
                    className={clsx(
                      "group relative flex flex-col overflow-hidden rounded-xl border bg-slate-950 transition-all duration-200 hover:shadow-lg hover:shadow-cyan-900/10",
                      isSelected 
                        ? (selectionMode === "link" ? "border-indigo-500 ring-1 ring-indigo-500/30" : "border-cyan-500 ring-1 ring-cyan-500/30")
                        : (isGroupHovered ? "border-indigo-400 ring-1 ring-indigo-400/50" : "border-slate-800 hover:border-slate-600")
                    )}
                    onClick={() => toggleSelection(img.id!)}
                    onMouseEnter={() => linkInfo && setHoveredGroupId(linkInfo.groupId)}
                    onMouseLeave={() => setHoveredGroupId(null)}
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-square w-full bg-[url('../checker-pattern.png')] bg-repeat">
                      <img 
                        src={img.url} 
                        alt={img.filename} 
                        className="absolute inset-0 h-full w-full object-contain p-2"
                      />
                      
                      {/* Selection Overlay */}
                      <div className={clsx(
                        "absolute inset-0 transition-colors",
                        isSelected 
                          ? (selectionMode === "link" ? "bg-indigo-500/10" : "bg-cyan-500/10")
                          : "group-hover:bg-white/5"
                      )} />

                      {/* Selection Badge */}
                      <div className={clsx(
                        "absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shadow-sm transition-transform",
                        isSelected 
                          ? (selectionMode === "link" ? "bg-indigo-500 text-white scale-100" : "bg-cyan-500 text-white scale-100") 
                          : "bg-slate-900/80 text-slate-400 scale-90 opacity-0 group-hover:opacity-100 group-hover:scale-100"
                      )}>
                        {isSelected ? selectionIndex : ""}
                        {!isSelected && <div className="h-2 w-2 rounded-full border border-slate-400" />}
                      </div>

                      {/* Link Indicator / Badge */}
                      {linkInfo && (
                         <div className={clsx(
                           "absolute right-2 top-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm transition-colors",
                           isGroupHovered || isSelected ? "bg-indigo-500 text-white" : "bg-slate-900/80 text-indigo-300"
                         )} title={`關聯群組: ${linkInfo.name || linkInfo.groupId} (${linkInfo.index}/${linkInfo.total})`}>
                           <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                           </svg>
                           <span className="truncate max-w-[60px]">{linkInfo.name || `${linkInfo.index}/${linkInfo.total}`}</span>
                           {linkInfo.name && <span className="opacity-70 text-[9px]"> {linkInfo.index}/{linkInfo.total}</span>}
                         </div>
                      )}
                    </div>


                    {/* Footer Info */}
                    <div className="flex flex-col gap-1 border-t border-slate-800/50 bg-slate-900/90 p-3">
                      <div className="truncate text-xs font-medium text-slate-200" title={img.filename}>
                        {img.filename || "Untitled"}
                      </div>
                      <div className="flex flex-col gap-0.5 text-[10px] text-slate-500 font-mono">
                        <div className="flex items-center justify-between">
                          <span>{formatSize(img.size)}</span>
                          {img.width && img.height && (
                            <span className="text-slate-600">{img.width}x{img.height}</span>
                          )}
                        </div>
                      </div>
                      <div className="mt-1 flex justify-end">
                        <button
                          className="rounded p-1 text-slate-500 hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
                          onClick={(e) => onRemove(img.id!, e)}
                          title="刪除影像"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="border-t border-slate-800 bg-slate-900/50 px-6 py-3 text-xs text-slate-500 flex justify-between items-center">
           <span>
             {selectionMode === "compare" 
               ? "點擊影像可切換是否加入比較 (帶有藍色邊框與數字標記為已選取)" 
               : "選取多張影像以建立順序連結 (紫色邊框)，完成後點擊「建立關聯」"}
           </span>
           {selectionMode === "compare" && compareOrder.length > 0 && (
             <span className="text-cyan-400">已選取 {compareOrder.length} 張用於比較</span>
           )}
           {selectionMode === "link" && selectedForLink.length > 0 && (
             <span className="text-indigo-400">已選取 {selectedForLink.length} 張用於連結</span>
           )}
        </div>
      </div>
    </div>
  );
};
