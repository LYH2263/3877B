export type CropAspectRatio = "free" | "1:1" | "4:3" | "16:9";

export interface TransformState {
  scale: number;
  rotation: number;
  translateX: number;
  translateY: number;
}

export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageEditState {
  originalFile: File;
  originalUrl: string;
  transform: TransformState;
  cropRatio: CropAspectRatio;
  cropRegion: CropRegion;
  canvasSize: { width: number; height: number };
}

export interface ImageEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalFile: File;
  onConfirm: (editedFile: File) => void;
}

export const ASPECT_RATIO_VALUES: Record<CropAspectRatio, number | null> = {
  free: null,
  "1:1": 1,
  "4:3": 4 / 3,
  "16:9": 16 / 9
};

export const DEFAULT_TRANSFORM: TransformState = {
  scale: 1,
  rotation: 0,
  translateX: 0,
  translateY: 0
};

export const EXPORT_CONFIG = {
  maxWidth: 1920,
  maxHeight: 1920,
  initialQuality: 0.9,
  minQuality: 0.6,
  targetSizeBytes: 2 * 1024 * 1024,
  outputFormat: "image/jpeg" as const
};
