import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ImageMeta = {
  url: string;
  fileKey?: string;
  width?: number;
  height?: number;
  size?: number;
  exif?: Record<string, unknown>;
  filename?: string;
  id?: string; // optional id for legacy
  linkedId?: string | null; // Next image in the chain
  groupName?: string;
};

export type Annotation = {
  id: string;
  x: number;
  y: number;
  label: string;
  color: string;
  createdAt: string;
  author?: string;
};

export type ComparisonMode = "slider" | "sideBySide" | "multiSplit" | "sequence";
export type SplitDirection = "vertical" | "horizontal";
export type Channel = "rgb" | "r" | "g" | "b" | "luma";

type State = {
  beforeImage?: ImageMeta;
  afterImage?: ImageMeta;
  thirdImage?: ImageMeta;
  images: ImageMeta[]; // library with id
  compareOrder: string[]; // layer order by image id, index 0 is bottom
  layerSettings: Record<string, { opacity: number; visible: boolean }>;
  magnifierLinks: Record<string, string | null>; // layerId -> linked layerId for multiSplit magnifier
  sideBySide: { leftId?: string | null; rightId?: string | null };
  mode: ComparisonMode;
  splitDirection: SplitDirection;
  splitCount: number;
  zoom: number;
  pan: { x: number; y: number };
  syncViewports: boolean;
  annotations: Annotation[];
  heatmap: { enabled: boolean; opacity: number; threshold: number; applyTo: "after" | "before" | "both"; baseId?: string | null; targetId?: string | null; overlayId?: string | null };
  heatmapImage?: string | null;
  heatmapStats?: { mean: number; max: number } | null;
  heatmapStatus: "idle" | "processing" | "error";
  blink: { enabled: boolean; rateHz: number; targetGroup: string | null; autoGroupSwitch: boolean; groupSwitchInterval: number };
  sequence: { playing: boolean; speed: number; index: number; direction: "forward" | "backward"; crossfade: boolean; crossfadeOnlyLinked: boolean; crossfadeSpeed: number };
  magnifier: {
    enabled: boolean;
    radius: number;
    lockedPosition?: { x: number; y: number } | null;
    targetId?: string | null; // optional designated layer to show
  };
  sliderOpacity: number;
  sliderPositions: number[]; // length = layers-1
  channel: Channel;
  edgeEmphasis: { enabled: boolean; strength: number };
  gammaPreview: { enabled: boolean; gamma: number; brightness: number };
  gridRuler: { showGrid: boolean; showRuler: boolean; gridSize: number };
  loading: boolean;
  errors?: string | null;
};

type Actions = {
  setImages: (payload: { before?: ImageMeta; after?: ImageMeta; third?: ImageMeta }) => void;
  addImage: (img: ImageMeta) => void;
  setCompareOrder: (order: string[]) => void;
  linkImages: (ids: string[], name?: string) => void;
  unlinkImage: (id: string) => void;
  setGroupName: (id: string, name: string) => void;
  getChain: (id: string) => ImageMeta[]; // helper to get full chain
  autoArrangeStack: () => void;
  setLayerSettings: (id: string, partial: Partial<{ opacity: number; visible: boolean }>) => void;
  removeImage: (id: string) => void;
  updateImage: (id: string, patch: Partial<ImageMeta>) => void;
  setHeatmapPair: (baseId?: string | null, targetId?: string | null) => void;
  setMagnifierLink: (id: string, targetId?: string | null) => void;
  setSideBySide: (leftId?: string | null, rightId?: string | null) => void;
  setMode: (mode: ComparisonMode) => void;
  setSplit: (payload: { direction?: SplitDirection; count?: number }) => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  resetView: () => void;
  setHeatmap: (payload: Partial<State["heatmap"]>) => void;
  setHeatmapImage: (dataUrl: string | null, stats?: { mean: number; max: number } | null) => void;
  setHeatmapStatus: (status: State["heatmapStatus"]) => void;
  setSliderOpacity: (opacity: number) => void;
  setSliderPositions: (index: number, value: number) => void;
  setBlink: (payload: Partial<State["blink"]>) => void;
  setSequence: (payload: Partial<State["sequence"]>) => void;
  setMagnifier: (payload: Partial<State["magnifier"]>) => void;
  setChannel: (channel: Channel) => void;
  setEdgeEmphasis: (payload: Partial<State["edgeEmphasis"]>) => void;
  setGammaPreview: (payload: Partial<State["gammaPreview"]>) => void;
  setGridRuler: (payload: Partial<State["gridRuler"]>) => void;
  setSyncViewports: (sync: boolean) => void;
  addAnnotation: (annotation: Annotation) => void;
  removeAnnotation: (id: string) => void;
  setErrors: (msg: string | null) => void;
  toggleAllLayerVisibility: (visible: boolean) => void;
  hideAllBottomLayers: () => void;
  resetAllSliderPositions: (value?: number) => void;
  importState: (data: { images: ImageMeta[], compareOrder?: string[] }) => void;
};

export const MAX_LAYERS = 500;

const initialState: State = {
  mode: "slider",
  splitDirection: "vertical",
  splitCount: 2,
  zoom: 1,
  pan: { x: 0, y: 0 },
  syncViewports: true,
  annotations: [],
  images: [],
  compareOrder: [],
  layerSettings: {},
  magnifierLinks: {},
  sideBySide: { leftId: null, rightId: null },
  heatmap: { enabled: false, opacity: 0.35, threshold: 0.2, applyTo: "after", baseId: null, targetId: null, overlayId: null },
  heatmapImage: null,
  heatmapStats: null,
  heatmapStatus: "idle",
  blink: { enabled: false, rateHz: 1.5, targetGroup: null, autoGroupSwitch: false, groupSwitchInterval: 5 },
  sequence: { playing: false, speed: 2, index: 0, direction: "backward", crossfade: false, crossfadeOnlyLinked: false, crossfadeSpeed: 1 },
  magnifier: { enabled: false, radius: 120, lockedPosition: null, targetId: null },
  sliderOpacity: 1,
  sliderPositions: Array(MAX_LAYERS).fill(50), // supports up to MAX_LAYERS
  channel: "rgb",
  edgeEmphasis: { enabled: false, strength: 0.3 },
  gammaPreview: { enabled: false, gamma: 1.0, brightness: 1.0 },
  gridRuler: { showGrid: false, showRuler: false, gridSize: 32 },
  loading: false,
  errors: null,
};

export const useComparisonStore = create<State & Actions>()(
  persist(
    (set) => ({
      ...initialState,
      setImages: ({ before, after, third }) =>
    set((state) => ({
      beforeImage: before ?? state.beforeImage,
      afterImage: after ?? state.afterImage,
      thirdImage: third ?? state.thirdImage,
      errors: null,
    })),
  addImage: (img) =>
    set((state) => {
      const id = img.id ?? crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
      const withId = { ...img, id };
      const images = [...state.images, withId];
      const layerSettings = { ...state.layerSettings, [id]: { opacity: 1, visible: true } };
      const magnifierLinks = { ...state.magnifierLinks };
      let compareOrder = state.compareOrder;
      if (compareOrder.length < MAX_LAYERS) {
        compareOrder = [...compareOrder, id];
      }
      compareOrder = Array.from(new Set(compareOrder)).filter((x) => images.some((img) => img.id === x)).slice(0, MAX_LAYERS);
      return { images, compareOrder, layerSettings, magnifierLinks };
    }),
  setCompareOrder: (order) =>
    set((state) => ({
      compareOrder: order.filter((id) => state.images.some((img) => img.id === id)).slice(0, MAX_LAYERS),
    })),
  linkImages: (ids, name) =>
    set((state) => {
      if (ids.length < 2) return state;
      const images = [...state.images];
      
      // Determine group name: use provided, or existing from first, or generate new
      let groupName = name;
      if (!groupName) {
          const first = images.find(i => i.id === ids[0]);
          groupName = first?.groupName ?? `Group ${Math.floor(Math.random() * 10000)}`;
      }

      for (let i = 0; i < ids.length - 1; i++) {
        const currentId = ids[i];
        const nextId = ids[i + 1];
        const imgIndex = images.findIndex((img) => img.id === currentId);
        if (imgIndex !== -1) {
          images[imgIndex] = { ...images[imgIndex], linkedId: nextId, groupName };
        }
      }
      // Set name on the last one too
      const lastId = ids[ids.length - 1];
      const lastIndex = images.findIndex((img) => img.id === lastId);
      if (lastIndex !== -1) {
          images[lastIndex] = { ...images[lastIndex], groupName };
      }

      return { images };
    }),
  unlinkImage: (id) =>
    set((state) => ({
      images: state.images.map((img) =>
        img.id === id ? { ...img, linkedId: null } : img
      ),
    })),
  setGroupName: (id, name) => 
    set((state) => {
       const chain = state.getChain(id);
       if (chain.length === 0) return {}; // or just self?
       
       const ids = chain.map(c => c.id);
       const images = state.images.map(img => 
         ids.includes(img.id) ? { ...img, groupName: name } : img
       );
       return { images };
    }),
  getChain: (id) => {
    const state = useComparisonStore.getState();
    const images = state.images;
    if (!images.find((img) => img.id === id)) return [];

    // 1. Find the head of the chain containing id
    // Backtrack until no one points to current
    // Since we don't store "prevId", we have to search the whole array for who points to current.
    // This is O(N) per step, but chains are short.
    let head = id;
    let prev = images.find((img) => img.linkedId === head);
    const visited = new Set<string>([head]);
    
    while (prev && !visited.has(prev.id!)) {
      head = prev.id!;
      visited.add(head);
      prev = images.find((img) => img.linkedId === head);
    }

    // 2. Traverse forward from head
    const chain: ImageMeta[] = [];
    let curr: string | undefined = head;
    const forwardVisited = new Set<string>();

    while (curr && !forwardVisited.has(curr)) {
        forwardVisited.add(curr);
        const img = images.find(i => i.id === curr);
        if (img) {
            chain.push(img);
            curr = img.linkedId ?? undefined;
        } else {
            curr = undefined;
        }
    }
    return chain;
  },
  autoArrangeStack: () =>
    set((state) => {
      const currentOrder = state.compareOrder;
      if (currentOrder.length < 2) return {};

      // 1. Identify relationships within the current stack
      // parentMap[child] = parent
      const parentMap = new Map<string, string>();
      const presentSet = new Set(currentOrder);
      
      for (const id of currentOrder) {
        const img = state.images.find(i => i.id === id);
        if (img?.linkedId && presentSet.has(img.linkedId)) {
           parentMap.set(img.linkedId, id);
        }
      }

      // 2. Identify "heads" (items in stack that have no parent in stack)
      // These are the starting points of chains (or isolated items)
      // We maintain their relative order from the original stack to keep stability
      const heads = currentOrder.filter(id => !parentMap.has(id));

      const newOrder: string[] = [];
      const visited = new Set<string>();

      // 3. Process each head and traverse its chain
      for (const head of heads) {
        if (visited.has(head)) continue;

        let curr: string | undefined = head;
        // Traverse chain
        while (curr && presentSet.has(curr) && !visited.has(curr)) {
           visited.add(curr);
           newOrder.push(curr);
           
           const img = state.images.find(i => i.id === curr);
           curr = img?.linkedId ?? undefined;
           
           // If next link is not in stack, stop chain here
           if (curr && !presentSet.has(curr)) {
             curr = undefined;
           }
        }
      }
      
      // 4. Fallback for any cycles or missed items (shouldn't happen with the logic above unless pure cycle)
      // If we have items in currentOrder not in newOrder (e.g. pure cycle A->B->A with no external entry),
      // pick one and process.
      if (newOrder.length < currentOrder.length) {
         const remaining = currentOrder.filter(id => !visited.has(id));
         // Just append them in their original order, or try to follow chains?
         // Simplest is to just append them to avoid infinite loops in complex cycle resolution
         newOrder.push(...remaining);
      }

      return { compareOrder: newOrder };
    }),
  setLayerSettings: (id, partial) =>
    set((state) => ({
      layerSettings: {
        ...state.layerSettings,
        [id]: {
          opacity: partial.opacity !== undefined ? Math.min(1, Math.max(0, partial.opacity)) : state.layerSettings[id]?.opacity ?? 1,
          visible: partial.visible !== undefined ? partial.visible : state.layerSettings[id]?.visible ?? true,
        },
      },
    })),
  removeImage: (id) =>
    set((state) => {
      const images = state.images.filter((img) => img.id !== id);
      const compareOrder = state.compareOrder.filter((x) => x !== id);
      const { [id]: _, ...restSettings } = state.layerSettings;
      const { [id]: __, ...restLinks } = state.magnifierLinks;
      const nextBefore = state.beforeImage?.id === id ? undefined : state.beforeImage;
      const nextAfter = state.afterImage?.id === id ? undefined : state.afterImage;
      const nextThird = state.thirdImage?.id === id ? undefined : state.thirdImage;
      return {
        images,
        compareOrder,
        layerSettings: restSettings,
        magnifierLinks: Object.fromEntries(
          Object.entries(restLinks).map(([k, v]) => [k, v === id ? null : v])
        ),
        beforeImage: nextBefore,
        afterImage: nextAfter,
        thirdImage: nextThird,
      };
    }),
  updateImage: (id, patch) =>
    set((state) => ({
      images: state.images.map((img) => (img.id === id ? { ...img, ...patch } : img)),
    })),
  setMode: (mode) => set({ mode }),
  setSplit: ({ direction, count }) =>
    set((state) => ({
      splitDirection: direction ?? state.splitDirection,
      splitCount: Math.min(4, Math.max(2, count ?? state.splitCount)),
    })),
  setZoom: (zoom) => set({ zoom }),
  setPan: (pan) => set({ pan }),
  resetView: () => set({ zoom: 1, pan: { x: 0, y: 0 }, sliderOpacity: 1, sliderPositions: Array(MAX_LAYERS).fill(50) }),
  setHeatmap: (payload) =>
    set((state) => ({
      heatmap: { ...state.heatmap, ...payload },
    })),
  setHeatmapPair: (baseId, targetId) =>
    set((state) => ({
      heatmap: { ...state.heatmap, baseId: baseId ?? null, targetId: targetId ?? null },
    })),
  setMagnifierLink: (id, targetId) =>
    set((state) => ({
      magnifierLinks: {
        ...state.magnifierLinks,
        [id]: targetId ?? null,
      },
    })),
  setSideBySide: (leftId, rightId) =>
    set(() => ({
      sideBySide: {
        leftId: leftId ?? null,
        rightId: rightId ?? null,
      },
    })),
  setHeatmapImage: (dataUrl, stats) =>
    set(() => ({
      heatmapImage: dataUrl,
      heatmapStats: stats ?? null,
    })),
  setHeatmapStatus: (status) => set({ heatmapStatus: status }),
  setBlink: (payload) =>
    set((state) => ({
      blink: { ...state.blink, ...payload },
    })),
  setSequence: (payload) =>
    set((state) => ({
      sequence: { ...state.sequence, ...payload },
    })),
  setMagnifier: (payload) =>
    set((state) => ({
      magnifier: { ...state.magnifier, ...payload },
    })),
  setSliderOpacity: (opacity) => set({ sliderOpacity: Math.min(1, Math.max(0, opacity)) }),
  setSliderPositions: (index, value) =>
    set((state) => {
      const next = [...state.sliderPositions];
      next[index] = Math.min(100, Math.max(0, value));
      return { sliderPositions: next };
    }),
  setChannel: (channel) => set({ channel }),
  setEdgeEmphasis: (payload) =>
    set((state) => ({
      edgeEmphasis: { ...state.edgeEmphasis, ...payload },
    })),
  setGammaPreview: (payload) =>
    set((state) => ({
      gammaPreview: { ...state.gammaPreview, ...payload },
    })),
  setGridRuler: (payload) =>
    set((state) => ({
      gridRuler: { ...state.gridRuler, ...payload },
    })),
  setSyncViewports: (syncViewports) => set({ syncViewports }),
  addAnnotation: (annotation) =>
    set((state) => ({
      annotations: [...state.annotations, annotation],
    })),
  removeAnnotation: (id) =>
    set((state) => ({
      annotations: state.annotations.filter((a) => a.id !== id),
    })),
  setErrors: (msg) => set({ errors: msg }),
  toggleAllLayerVisibility: (visible) =>
    set((state) => {
      const nextSettings = { ...state.layerSettings };
      state.compareOrder.forEach((id) => {
        nextSettings[id] = { ...(nextSettings[id] ?? { opacity: 1 }), visible };
      });
      return { layerSettings: nextSettings };
    }),
  hideAllBottomLayers: () =>
    set((state) => {
      // 1. Identify groups/chains
      const chains = new Map<string, ImageMeta[]>();
      // Helper to find root of chain
      const findRoot = (id: string) => {
          let curr = state.images.find(i => i.id === id);
          if (!curr) return null;
          // Backtrack
          let prev = state.images.find(i => i.linkedId === curr!.id);
          const visited = new Set<string>();
          while (prev && !visited.has(prev.id!)) {
              visited.add(prev.id!);
              curr = prev;
              prev = state.images.find(i => i.linkedId === curr!.id);
          }
          return curr;
      };

      // Group images by their chain root
      state.compareOrder.forEach(id => {
          const root = findRoot(id);
          if (root && root.id) {
              if (!chains.has(root.id)) {
                  // Reconstruct chain from root
                  const chain = state.getChain(root.id);
                  chains.set(root.id, chain);
              }
          }
      });

      const nextSettings = { ...state.layerSettings };
      
      // For each chain, hide the bottom-most (last index) image IF chain length > 1
      // Wait, "buttom image" usually means the one at the bottom of the stack (Layer 1, index 0).
      // But user said "buttom image in all group".
      // In a visual stack (Layer 1 bottom, Layer N top), index 0 is bottom.
      // But in a *chain* (A->B->C), usually A is base, B overlays A...
      // If "buttom image" means the Base image of the group (the one others are compared against), it's the first one in the chain.
      // If "buttom image" means the one visually at the bottom, it's the first one.
      // Let's assume user means the Base Image (First in chain).
      
      chains.forEach((chain) => {
          if (chain.length > 0) {
              const bottomImg = chain[0]; // The first image in the chain (Base)
              // Only hide if it's in the current compareOrder
              if (state.compareOrder.includes(bottomImg.id!)) {
                  nextSettings[bottomImg.id!] = { 
                      ...(nextSettings[bottomImg.id!] ?? { opacity: 1 }), 
                      visible: false 
                  };
              }
          }
      });

      return { layerSettings: nextSettings };
    }),
  resetAllSliderPositions: (value = 100) =>
    set(() => ({
      sliderPositions: Array(MAX_LAYERS).fill(value),
    })),
  importState: (data) =>
    set((state) => {
      // Merge imported images with existing ones (prefer imported ones for linkedId/groupName)
      const newImages = [...state.images];
      data.images.forEach((importedImg) => {
        const existingIdx = newImages.findIndex(img => img.id === importedImg.id);
        if (existingIdx !== -1) {
          newImages[existingIdx] = { ...newImages[existingIdx], ...importedImg };
        } else {
          newImages.push(importedImg);
        }
      });
      
      // Ensure layer settings exist for new images
      const newLayerSettings = { ...state.layerSettings };
      newImages.forEach(img => {
        if (!newLayerSettings[img.id!]) {
          newLayerSettings[img.id!] = { opacity: 1, visible: true };
        }
      });

      return {
        images: newImages,
        compareOrder: data.compareOrder ?? state.compareOrder,
        layerSettings: newLayerSettings,
        beforeImage: newImages.find(img => img.id === (data.compareOrder?.[0] ?? state.compareOrder?.[0])) ?? state.beforeImage,
        afterImage: newImages.find(img => img.id === (data.compareOrder?.[1] ?? state.compareOrder?.[1])) ?? state.afterImage,
      };
    }),
}),
{
  name: "image-comparison-storage",
  partialize: (state) => ({
    images: state.images.filter(img => !img.url.startsWith("blob:")), // Only persist non-blob images
    compareOrder: state.compareOrder,
    layerSettings: state.layerSettings,
    magnifierLinks: state.magnifierLinks,
    sideBySide: state.sideBySide,
    mode: state.mode,
    splitDirection: state.splitDirection,
    splitCount: state.splitCount,
    zoom: state.zoom,
    pan: state.pan,
    syncViewports: state.syncViewports,
    annotations: state.annotations,
    heatmap: state.heatmap,
    blink: state.blink,
    sequence: state.sequence,
    magnifier: state.magnifier,
    sliderOpacity: state.sliderOpacity,
    sliderPositions: state.sliderPositions,
    channel: state.channel,
    edgeEmphasis: state.edgeEmphasis,
    gammaPreview: state.gammaPreview,
    gridRuler: state.gridRuler,
  }),
}
)
);

export const useImages = () =>
  useComparisonStore((s) => ({
    beforeImage: s.beforeImage,
    afterImage: s.afterImage,
  }));

