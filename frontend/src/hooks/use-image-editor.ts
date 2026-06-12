import { useCallback, useEffect, useRef, useState } from "react";

import {
  calculateExportSize,
  calculateInitialCropRegion,
  calculateInitialTransform,
  canvasToBlobWithQuality,
  clampCropRegion,
  getRotatedDimensions,
  isSafari,
  loadImage
} from "@/lib/image-editor-utils";
import {
  DEFAULT_TRANSFORM,
  EXPORT_CONFIG,
  type CropAspectRatio,
  type CropRegion,
  type TransformState
} from "@/types/image-editor";

interface UseImageEditorOptions {
  originalFile: File;
  canvasWidth: number;
  canvasHeight: number;
}

interface UseImageEditorReturn {
  image: HTMLImageElement | null;
  transform: TransformState;
  cropRegion: CropRegion;
  cropRatio: CropAspectRatio;
  isLoading: boolean;
  setTransform: (transform: TransformState) => void;
  setCropRegion: (region: CropRegion) => void;
  setCropRatio: (ratio: CropAspectRatio) => void;
  rotate: () => void;
  reset: () => void;
  exportImage: () => Promise<File>;
  updateCanvasSize: (width: number, height: number) => void;
}

export function useImageEditor({
  originalFile,
  canvasWidth,
  canvasHeight
}: UseImageEditorOptions): UseImageEditorReturn {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [transform, setTransform] = useState<TransformState>(DEFAULT_TRANSFORM);
  const [cropRegion, setCropRegion] = useState<CropRegion>({ x: 0, y: 0, width: 0, height: 0 });
  const [cropRatio, setCropRatio] = useState<CropAspectRatio>("free");
  const [isLoading, setIsLoading] = useState(true);
  const [canvasSize, setCanvasSize] = useState({ width: canvasWidth, height: canvasHeight });

  const objectUrlRef = useRef<string | null>(null);
  const originalFileRef = useRef(originalFile);

  useEffect(() => {
    originalFileRef.current = originalFile;
  }, [originalFile]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setIsLoading(true);
      try {
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
        }
        const url = URL.createObjectURL(originalFileRef.current);
        objectUrlRef.current = url;
        const img = await loadImage(url);

        if (cancelled) return;

        setImage(img);

        const initialTransform = calculateInitialTransform(
          img.naturalWidth,
          img.naturalHeight,
          canvasSize.width,
          canvasSize.height
        );
        setTransform(initialTransform);

        const initialCrop = calculateInitialCropRegion(
          img.naturalWidth,
          img.naturalHeight,
          canvasSize.width,
          canvasSize.height,
          cropRatio
        );
        setCropRegion(initialCrop);
      } catch (error) {
        console.error("加载图片失败:", error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void init();

    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [originalFile, canvasSize]);

  const handleSetCropRegion = useCallback(
    (region: CropRegion) => {
      const clamped = clampCropRegion(region, canvasSize.width, canvasSize.height, cropRatio);
      setCropRegion(clamped);
    },
    [canvasSize, cropRatio]
  );

  const handleSetCropRatio = useCallback(
    (ratio: CropAspectRatio) => {
      setCropRatio(ratio);
      if (image) {
        const newRegion = calculateInitialCropRegion(
          image.naturalWidth,
          image.naturalHeight,
          canvasSize.width,
          canvasSize.height,
          ratio
        );
        setCropRegion(newRegion);
      }
    },
    [image, canvasSize]
  );

  const rotate = useCallback(() => {
    setTransform((prev) => {
      const newRotation = (prev.rotation + 90) % 360;

      if (image) {
        const rotated = getRotatedDimensions(
          image.naturalWidth * prev.scale,
          image.naturalHeight * prev.scale,
          90
        );
        const canvasRotated = getRotatedDimensions(canvasSize.width, canvasSize.height, 90);

        const newScale = Math.min(
          canvasRotated.width / (image.naturalWidth * prev.scale),
          canvasRotated.height / (image.naturalHeight * prev.scale),
          1
        );

        return {
          ...prev,
          rotation: newRotation,
          scale: prev.scale * newScale,
          translateX: canvasSize.width / 2,
          translateY: canvasSize.height / 2
        };
      }

      return {
        ...prev,
        rotation: newRotation,
        translateX: canvasSize.width / 2,
        translateY: canvasSize.height / 2
      };
    });
  }, [image, canvasSize]);

  const reset = useCallback(() => {
    if (image) {
      const initialTransform = calculateInitialTransform(
        image.naturalWidth,
        image.naturalHeight,
        canvasSize.width,
        canvasSize.height
      );
      setTransform(initialTransform);

      const initialCrop = calculateInitialCropRegion(
        image.naturalWidth,
        image.naturalHeight,
        canvasSize.width,
        canvasSize.height,
        cropRatio
      );
      setCropRegion(initialCrop);
    }
  }, [image, canvasSize, cropRatio]);

  const updateCanvasSize = useCallback((width: number, height: number) => {
    setCanvasSize({ width, height });
  }, []);

  const exportImage = useCallback(async (): Promise<File> => {
    if (!image) {
      throw new Error("图片未加载");
    }

    const displayImageScale = Math.min(
      canvasSize.width / image.naturalWidth,
      canvasSize.height / image.naturalHeight,
      1
    );

    const exportSize = calculateExportSize(
      image.naturalWidth,
      image.naturalHeight,
      transform.scale,
      cropRegion.width,
      cropRegion.height,
      canvasSize.width,
      canvasSize.height
    );

    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) {
      throw new Error("临时 Canvas 上下文创建失败");
    }

    const tempRotated = getRotatedDimensions(image.naturalWidth, image.naturalHeight, transform.rotation);
    tempCanvas.width = tempRotated.width;
    tempCanvas.height = tempRotated.height;

    const rad = (transform.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    tempCtx.save();
    tempCtx.translate(tempRotated.width / 2, tempRotated.height / 2);
    tempCtx.rotate(rad);
    tempCtx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
    tempCtx.restore();

    const cropCenterX = cropRegion.x + cropRegion.width / 2;
    const cropCenterY = cropRegion.y + cropRegion.height / 2;

    const imageCropCenterX = (cropCenterX - transform.translateX) / (displayImageScale * transform.scale);
    const imageCropCenterY = (cropCenterY - transform.translateY) / (displayImageScale * transform.scale);

    const imageCropWidth = cropRegion.width / (displayImageScale * transform.scale);
    const imageCropHeight = cropRegion.height / (displayImageScale * transform.scale);

    const rotatedCenterX = imageCropCenterX * cos - imageCropCenterY * sin;
    const rotatedCenterY = imageCropCenterX * sin + imageCropCenterY * cos;

    const cropInTempX = rotatedCenterX - imageCropWidth / 2 + image.naturalWidth / 2;
    const cropInTempY = rotatedCenterY - imageCropHeight / 2 + image.naturalHeight / 2;

    const actualCropX = cropInTempX + (tempRotated.width - image.naturalWidth) / 2;
    const actualCropY = cropInTempY + (tempRotated.height - image.naturalHeight) / 2;
    const actualCropWidth = imageCropWidth;
    const actualCropHeight = imageCropHeight;

    const finalCanvas = document.createElement("canvas");
    const finalCtx = finalCanvas.getContext("2d");
    if (!finalCtx) {
      throw new Error("最终 Canvas 上下文创建失败");
    }

    finalCanvas.width = exportSize.width;
    finalCanvas.height = exportSize.height;

    finalCtx.drawImage(
      tempCanvas,
      Math.max(0, actualCropX),
      Math.max(0, actualCropY),
      Math.min(tempCanvas.width - Math.max(0, actualCropX), actualCropWidth),
      Math.min(tempCanvas.height - Math.max(0, actualCropY), actualCropHeight),
      0,
      0,
      exportSize.width,
      exportSize.height
    );

    const blob = await canvasToBlobWithQuality(
      finalCanvas,
      EXPORT_CONFIG.outputFormat,
      EXPORT_CONFIG.initialQuality,
      EXPORT_CONFIG.minQuality,
      EXPORT_CONFIG.targetSizeBytes
    );

    const originalName = originalFileRef.current.name;
    const dotIndex = originalName.lastIndexOf(".");
    const baseName = dotIndex > 0 ? originalName.slice(0, dotIndex) : originalName;
    const newName = `${baseName}_edited.jpg`;

    return new File([blob], newName, { type: EXPORT_CONFIG.outputFormat, lastModified: Date.now() });
  }, [image, transform, cropRegion, canvasSize]);

  return {
    image,
    transform,
    cropRegion,
    cropRatio,
    isLoading,
    setTransform,
    setCropRegion: handleSetCropRegion,
    setCropRatio: handleSetCropRatio,
    rotate,
    reset,
    exportImage,
    updateCanvasSize
  };
}
