export type ComparisonMode = 'slider' | 'opacity' | 'side-by-side' | 'loupe';

export interface ImagePair {
  id: string;
  beforeImage: File;
  afterImage: File;
  beforeUrl: string;
  afterUrl: string;
  diffCount?: number;
  isCalculating?: boolean;
}

export interface OrphanImage {
  id: string;
  file: File;
  url: string;
  type: 'before' | 'after' | 'unknown';
}

export interface ViewState {
  mode: ComparisonMode;
  globalSliderValue: number;
  globalOpacity: number;
  applyToSelected: boolean;
  selectedCards: Set<string>;
  imagePairs: ImagePair[];
  orphanImages: OrphanImage[];
  fullscreenCardId: string | null;
}

export interface CardState {
  sliderValue: number;
  opacity: number;
  isSelected: boolean;
}

export interface DiffWorkerMessage {
  type: 'calculate';
  id: string;
  beforeImage: ImageBitmap;
  afterImage: ImageBitmap;
}

export interface DiffWorkerResponse {
  type: 'result';
  id: string;
  diffCount: number;
  error?: string;
}
