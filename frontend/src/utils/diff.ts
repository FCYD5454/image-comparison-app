// Lightweight DeltaE(1976) approximation for heatmap generation.
// Downscales images to a manageable size to keep UI responsive.

type HeatmapResult = {
  dataUrl: string;
  meanDelta: number;
  maxDelta: number;
};

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

function srgbToLinear(c: number) {
  const cs = c / 255;
  return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

function srgbToLab(r: number, g: number, b: number) {
  // sRGB to XYZ (D65)
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);
  const X = R * 0.4124 + G * 0.3576 + B * 0.1805;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = R * 0.0193 + G * 0.1192 + B * 0.9505;

  // XYZ to Lab
  const refX = 0.95047;
  const refY = 1.0;
  const refZ = 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X / refX);
  const fy = f(Y / refY);
  const fz = f(Z / refZ);
  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

// DeltaE 2000 implementation (approx) for perceptual difference
function deltaE2000(l1: number, a1: number, b1: number, l2: number, a2: number, b2: number) {
  // Based on Sharma et al. 2005
  const deg2rad = Math.PI / 180;
  const rad2deg = 180 / Math.PI;
  const avgLp = (l1 + l2) / 2;
  const c1 = Math.hypot(a1, b1);
  const c2 = Math.hypot(a2, b2);
  const avgC = (c1 + c2) / 2;
  const g = 0.5 * (1 - Math.sqrt(Math.pow(avgC, 7) / (Math.pow(avgC, 7) + Math.pow(25, 7))));
  const a1p = a1 * (1 + g);
  const a2p = a2 * (1 + g);
  const c1p = Math.hypot(a1p, b1);
  const c2p = Math.hypot(a2p, b2);
  const avgCp = (c1p + c2p) / 2;
  const h1p = (Math.atan2(b1, a1p) * rad2deg + 360) % 360;
  const h2p = (Math.atan2(b2, a2p) * rad2deg + 360) % 360;
  const deltahp = (() => {
    if (Math.abs(h1p - h2p) > 180) {
      return h2p <= h1p ? h2p - h1p + 360 : h2p - h1p - 360;
    }
    return h2p - h1p;
  })();
  const avgHp = (() => {
    if (Math.abs(h1p - h2p) > 180) {
      return (h1p + h2p + 360) / 2;
    }
    return (h1p + h2p) / 2;
  })();

  const t =
    1 -
    0.17 * Math.cos((avgHp - 30) * deg2rad) +
    0.24 * Math.cos(2 * avgHp * deg2rad) +
    0.32 * Math.cos((3 * avgHp + 6) * deg2rad) -
    0.2 * Math.cos((4 * avgHp - 63) * deg2rad);

  const deltaLp = l2 - l1;
  const deltaCp = c2p - c1p;
  const deltaHp = 2 * Math.sqrt(c1p * c2p) * Math.sin((deltahp * deg2rad) / 2);

  const sl = 1 + (0.015 * Math.pow(avgLp - 50, 2)) / Math.sqrt(20 + Math.pow(avgLp - 50, 2));
  const sc = 1 + 0.045 * avgCp;
  const sh = 1 + 0.015 * avgCp * t;

  const rt =
    -2 *
    Math.sqrt(Math.pow(avgCp, 7) / (Math.pow(avgCp, 7) + Math.pow(25, 7))) *
    Math.sin((60 * Math.exp(-Math.pow((avgHp - 275) / 25, 2))) * deg2rad);

  const dl = deltaLp / sl;
  const dc = deltaCp / sc;
  const dh = deltaHp / sh;

  return Math.sqrt(dl * dl + dc * dc + dh * dh + rt * dc * dh);
}

function colorMap(t: number) {
  // t in [0,1]; map to cyan-green-yellow-red scale for visibility
  const r = clamp(Math.min(1.5 * (t - 0.3), 1));
  const g = clamp(t < 0.5 ? t * 2 : 1.2 - t);
  const b = clamp(1.2 - t * 1.2);
  return [r * 255, g * 255, b * 255];
}

async function loadBitmap(url: string): Promise<ImageBitmap> {
  const res = await fetch(url);
  const blob = await res.blob();
  return createImageBitmap(blob);
}

export async function generateHeatmap(
  beforeUrl: string,
  afterUrl: string,
  options?: { maxSize?: number; threshold?: number }
): Promise<HeatmapResult> {
  const maxSize = options?.maxSize ?? 640;
  const threshold = options?.threshold ?? 0.2; // 0-1 normalized threshold relative to max DeltaE range

  const [before, after] = await Promise.all([loadBitmap(beforeUrl), loadBitmap(afterUrl)]);
  const sourceW = Math.max(before.width, after.width);
  const sourceH = Math.max(before.height, after.height);
  const scale = Math.min(1, maxSize / Math.max(sourceW, sourceH));
  const w = Math.max(1, Math.round(sourceW * scale));
  const h = Math.max(1, Math.round(sourceH * scale));

  const canvasA = new OffscreenCanvas(w, h);
  const canvasB = new OffscreenCanvas(w, h);
  const ctxA = canvasA.getContext("2d");
  const ctxB = canvasB.getContext("2d");
  if (!ctxA || !ctxB) {
    throw new Error("Canvas context not available");
  }
  ctxA.drawImage(before, 0, 0, w, h);
  ctxB.drawImage(after, 0, 0, w, h);
  const dataA = ctxA.getImageData(0, 0, w, h).data;
  const dataB = ctxB.getImageData(0, 0, w, h).data;

  const heat = new Uint8ClampedArray(w * h * 4);
  let sum = 0;
  let max = 0;

  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    const aLab = srgbToLab(dataA[idx], dataA[idx + 1], dataA[idx + 2]);
    const bLab = srgbToLab(dataB[idx], dataB[idx + 1], dataB[idx + 2]);
    const dE = deltaE2000(aLab.L, aLab.a, aLab.b, bLab.L, bLab.a, bLab.b);
    sum += dE;
    if (dE > max) max = dE;
  }

  const mean = sum / (w * h);
  // Normalize by max (avoid divide-by-zero)
  const normMax = Math.max(max, 1e-3);
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    const aLab = srgbToLab(dataA[idx], dataA[idx + 1], dataA[idx + 2]);
    const bLab = srgbToLab(dataB[idx], dataB[idx + 1], dataB[idx + 2]);
    const dE = deltaE2000(aLab.L, aLab.a, aLab.b, bLab.L, bLab.a, bLab.b);
    const t = clamp(dE / normMax);
    const [r, g, b] = colorMap(t);
    const alpha = t >= threshold ? 200 : 80;
    heat[idx] = r;
    heat[idx + 1] = g;
    heat[idx + 2] = b;
    heat[idx + 3] = alpha;
  }

  const canvasH = new OffscreenCanvas(w, h);
  const ctxH = canvasH.getContext("2d");
  if (!ctxH) {
    throw new Error("Canvas context not available");
  }
  ctxH.putImageData(new ImageData(heat, w, h), 0, 0);
  const blob = await canvasH.convertToBlob({ type: "image/png" });
  const dataUrl = await blobToDataURL(blob);

  return { dataUrl, meanDelta: mean, maxDelta: max };
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Failed to read blob"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Read error"));
    reader.readAsDataURL(blob);
  });
}

