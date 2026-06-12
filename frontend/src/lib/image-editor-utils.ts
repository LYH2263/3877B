import { ASPECT_RATIO_VALUES, EXPORT_CONFIG, type CropAspectRatio, type CropRegion, type TransformState } from "@/types/image-editor";

export function getAspectRatioValue(ratio: CropAspectRatio): number | null {
  return ASPECT_RATIO_VALUES[ratio];
}

export function calculateInitialCropRegion(
  imageWidth: number,
  imageHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  ratio: CropAspectRatio
): CropRegion {
  const aspect = getAspectRatioValue(ratio);
  let cropWidth: number;
  let cropHeight: number;

  if (aspect) {
    const canvasAspect = canvasWidth / canvasHeight;
    if (aspect > canvasAspect) {
      cropWidth = canvasWidth * 0.85;
      cropHeight = cropWidth / aspect;
    } else {
      cropHeight = canvasHeight * 0.85;
      cropWidth = cropHeight * aspect;
    }
  } else {
    const scale = Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight, 1);
    cropWidth = imageWidth * scale * 0.9;
    cropHeight = imageHeight * scale * 0.9;
  }

  return {
    x: (canvasWidth - cropWidth) / 2,
    y: (canvasHeight - cropHeight) / 2,
    width: cropWidth,
    height: cropHeight
  };
}

export function calculateInitialTransform(
  imageWidth: number,
  imageHeight: number,
  canvasWidth: number,
  canvasHeight: number
): TransformState {
  const scale = Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight, 1);
  return {
    scale,
    rotation: 0,
    translateX: canvasWidth / 2,
    translateY: canvasHeight / 2
  };
}

export function clampCropRegion(
  region: CropRegion,
  canvasWidth: number,
  canvasHeight: number,
  ratio: CropAspectRatio
): CropRegion {
  const aspect = getAspectRatioValue(ratio);
  let { x, y, width, height } = region;

  const minSize = 40;
  width = Math.max(minSize, width);
  height = Math.max(minSize, height);

  if (aspect) {
    const currentAspect = width / height;
    if (Math.abs(currentAspect - aspect) > 0.01) {
      if (currentAspect > aspect) {
        width = height * aspect;
      } else {
        height = width / aspect;
      }
    }
  }

  width = Math.min(width, canvasWidth);
  height = Math.min(height, canvasHeight);

  if (aspect) {
    if (width > canvasWidth) {
      width = canvasWidth;
      height = width / aspect;
    }
    if (height > canvasHeight) {
      height = canvasHeight;
      width = height * aspect;
    }
  }

  x = Math.max(0, Math.min(x, canvasWidth - width));
  y = Math.max(0, Math.min(y, canvasHeight - height));

  return { x, y, width, height };
}

export async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = url;
  });
}

export function calculateExportSize(
  imageWidth: number,
  imageHeight: number,
  scale: number,
  cropWidth: number,
  cropHeight: number,
  canvasWidth: number,
  canvasHeight: number
): { width: number; height: number } {
  const { maxWidth, maxHeight } = EXPORT_CONFIG;
  const displayScale = Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight, 1);

  const imageCropWidth = cropWidth / (displayScale * scale);
  const imageCropHeight = cropHeight / (displayScale * scale);

  let exportWidth = Math.round(imageCropWidth);
  let exportHeight = Math.round(imageCropHeight);

  const ratio = Math.min(maxWidth / exportWidth, maxHeight / exportHeight, 1);
  exportWidth = Math.round(exportWidth * ratio);
  exportHeight = Math.round(exportHeight * ratio);

  return { width: exportWidth, height: exportHeight };
}

export async function canvasToBlobWithQuality(
  canvas: HTMLCanvasElement,
  format: string,
  initialQuality: number,
  minQuality: number,
  targetSizeBytes: number
): Promise<Blob> {
  let quality = initialQuality;

  while (quality >= minQuality) {
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, format, quality);
    });

    if (blob && blob.size <= targetSizeBytes) {
      return blob;
    }

    quality -= 0.1;
  }

  const finalBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, format, minQuality);
  });

  if (!finalBlob) {
    throw new Error("图片导出失败");
  }

  return finalBlob;
}

export function getRotatedDimensions(width: number, height: number, rotation: number): { width: number; height: number } {
  const rad = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  return {
    width: width * cos + height * sin,
    height: width * sin + height * cos
  };
}

export function isSafari(): boolean {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}
