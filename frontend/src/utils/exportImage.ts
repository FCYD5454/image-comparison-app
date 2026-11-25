import { useComparisonStore } from "../store/comparisonStore";

export const exportComparisonImage = async () => {
  const state = useComparisonStore.getState();
  const { mode, compareOrder, images, sliderPositions, sideBySide, layerSettings, heatmap, heatmapImage } = state;

  const activeIds = compareOrder.filter(id => layerSettings[id]?.visible !== false);
  const activeImages = activeIds.map(id => images.find(img => img.id === id)).filter(Boolean) as typeof images;

  if (activeImages.length === 0) return;

  let maxWidth = 0;
  let maxHeight = 0;

  // Load all images to get original dimensions
  const loadedImages = await Promise.all(
    activeImages.map(async (meta) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = meta.url;
      });
      maxWidth = Math.max(maxWidth, img.naturalWidth || meta.width || 1920);
      maxHeight = Math.max(maxHeight, img.naturalHeight || meta.height || 1080);
      return { meta, img };
    })
  );

  if (maxWidth === 0 || maxHeight === 0) return;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Helper to draw image maintaining aspect ratio within a cell
  const drawObjectContain = (img: HTMLImageElement, x: number, y: number, w: number, h: number) => {
    const imgAR = img.naturalWidth / img.naturalHeight;
    const boxAR = w / h;
    let drawW = w;
    let drawH = h;
    let drawX = x;
    let drawY = y;

    if (imgAR > boxAR) {
      drawH = w / imgAR;
      drawY = y + (h - drawH) / 2;
    } else {
      drawW = h * imgAR;
      drawX = x + (w - drawW) / 2;
    }
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
  };

  // Pre-calculate grid for multiSplit so it can be used for images and heatmap
  const countN = loadedImages.length;
  let totalAR = 0;
  loadedImages.forEach(l => {
    totalAR += l.img.naturalWidth / l.img.naturalHeight;
  });
  const avgAR = totalAR / countN || (4 / 3);

  let bestCols = 1;
  let bestRows = countN;
  let minWaste = Infinity;
  const containerAR = 16 / 9; // Assume 16:9 for generic layout if we don't have exact container size

  for (let c = 1; c <= countN; c++) {
    const r = Math.ceil(countN / c);
    const currentCellAR = (containerAR / c) * r;
    const waste = Math.abs(currentCellAR - avgAR);
    if (waste < minWaste) {
      minWaste = waste;
      bestCols = c;
      bestRows = r;
    }
  }

  if (mode === "slider") {
    canvas.width = maxWidth;
    canvas.height = maxHeight;

    // Draw Base Layer
    const base = loadedImages[0];
    if (base) {
      ctx.globalAlpha = layerSettings[base.meta.id!]?.opacity ?? 1;
      drawObjectContain(base.img, 0, 0, canvas.width, canvas.height);
    }

    // Draw overlay layers with clipping
    for (let i = 1; i < loadedImages.length; i++) {
      const layer = loadedImages[i];
      const sliderPos = sliderPositions[i - 1] ?? 50;

      ctx.save();
      const clipX = canvas.width * (1 - sliderPos / 100);
      ctx.beginPath();
      ctx.rect(clipX, 0, canvas.width - clipX, canvas.height);
      ctx.clip();

      ctx.globalAlpha = layerSettings[layer.meta.id!]?.opacity ?? 1;
      drawObjectContain(layer.img, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
  } else if (mode === "sideBySide") {
    canvas.width = maxWidth * 2;
    canvas.height = maxHeight;

    const leftId = sideBySide.leftId;
    const rightId = sideBySide.rightId;
    const left = leftId ? loadedImages.find(l => l.meta.id === leftId) : loadedImages[0];
    const right = rightId ? loadedImages.find(l => l.meta.id === rightId) : (loadedImages.find(l => l !== left) ?? loadedImages[1]);

    if (left) {
      ctx.globalAlpha = layerSettings[left.meta.id!]?.opacity ?? 1;
      drawObjectContain(left.img, 0, 0, maxWidth, maxHeight);
    }
    if (right) {
      ctx.globalAlpha = layerSettings[right.meta.id!]?.opacity ?? 1;
      drawObjectContain(right.img, maxWidth, 0, maxWidth, maxHeight);
    }

    // Draw separator line
    ctx.beginPath();
    ctx.moveTo(maxWidth, 0);
    ctx.lineTo(maxWidth, maxHeight);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 4;
    ctx.stroke();
  } else if (mode === "multiSplit") {
    canvas.width = maxWidth * bestCols;
    canvas.height = maxHeight * bestRows;
    
    // Background for grid
    ctx.fillStyle = "#020617"; // slate-950
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    loadedImages.forEach((layer, idx) => {
      const col = idx % bestCols;
      const row = Math.floor(idx / bestCols);
      ctx.globalAlpha = layerSettings[layer.meta.id!]?.opacity ?? 1;
      drawObjectContain(layer.img, col * maxWidth, row * maxHeight, maxWidth, maxHeight);
    });

    // Draw grid lines
    ctx.beginPath();
    ctx.strokeStyle = "#1e293b"; // slate-800
    ctx.lineWidth = 4;
    for (let c = 1; c < bestCols; c++) {
      ctx.moveTo(c * maxWidth, 0);
      ctx.lineTo(c * maxWidth, canvas.height);
    }
    for (let r = 1; r < bestRows; r++) {
      ctx.moveTo(0, r * maxHeight);
      ctx.lineTo(canvas.width, r * maxHeight);
    }
    ctx.stroke();
  } else if (mode === "sequence") {
    const index = state.sequence.index % loadedImages.length;
    const current = loadedImages[index];
    canvas.width = maxWidth;
    canvas.height = maxHeight;
    if (current) {
      ctx.globalAlpha = layerSettings[current.meta.id!]?.opacity ?? 1;
      drawObjectContain(current.img, 0, 0, maxWidth, maxHeight);
    }
  }

  // Handle Heatmap Overlay
  if (heatmap.enabled && heatmapImage) {
    const hmImg = new Image();
    hmImg.crossOrigin = "anonymous";
    await new Promise((resolve, reject) => {
      hmImg.onload = resolve;
      hmImg.onerror = reject;
      hmImg.src = heatmapImage;
    });

    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = heatmap.opacity;

    if (mode === "slider") {
       // Just draw it full screen for now to ensure it's exported
       drawObjectContain(hmImg, 0, 0, canvas.width, canvas.height);
    } else if (mode === "sideBySide") {
        const leftId = sideBySide.leftId;
        const rightId = sideBySide.rightId;
        const left = leftId ? loadedImages.find(l => l.meta.id === leftId) : loadedImages[0];
        const right = rightId ? loadedImages.find(l => l.meta.id === rightId) : (loadedImages.find(l => l !== left) ?? loadedImages[1]);
        
        const showLeft = left && ((heatmap.applyTo === "before" && left.meta.id === heatmap.baseId) || (heatmap.applyTo === "after" && left.meta.id === heatmap.targetId) || (!heatmap.baseId && !heatmap.targetId));
        const showRight = right && ((heatmap.applyTo === "before" && right.meta.id === heatmap.baseId) || (heatmap.applyTo === "after" && right.meta.id === heatmap.targetId) || (!heatmap.baseId && !heatmap.targetId));
        
        if (showLeft) drawObjectContain(hmImg, 0, 0, maxWidth, maxHeight);
        if (showRight) drawObjectContain(hmImg, maxWidth, 0, maxWidth, maxHeight);
    } else if (mode === "multiSplit") {
        loadedImages.forEach((layer, idx) => {
          const show = (!heatmap.baseId && !heatmap.targetId) || (heatmap.applyTo === "before" && layer.meta.id === heatmap.baseId) || (heatmap.applyTo === "after" && layer.meta.id === heatmap.targetId);
          if (show) {
              const col = idx % bestCols;
              const row = Math.floor(idx / bestCols);
              drawObjectContain(hmImg, col * maxWidth, row * maxHeight, maxWidth, maxHeight);
          }
        });
    } else if (mode === "sequence") {
        drawObjectContain(hmImg, 0, 0, maxWidth, maxHeight);
    }

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  // Export to PNG
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `export-${mode}-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
};
