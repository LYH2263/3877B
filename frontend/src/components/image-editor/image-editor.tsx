import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw, RotateCw, ZoomIn, ZoomOut, Check, X, Edit3 } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useImageEditor } from "@/hooks/use-image-editor";
import { cn } from "@/lib/utils";
import type { CropAspectRatio, CropRegion, ImageEditorProps, TransformState } from "@/types/image-editor";

const CROP_RATIO_OPTIONS: { value: CropAspectRatio; label: string }[] = [
  { value: "free", label: "自由" },
  { value: "1:1", label: "1:1" },
  { value: "4:3", label: "4:3" },
  { value: "16:9", label: "16:9" }
];

const MIN_SCALE = 0.5;
const MAX_SCALE = 5;
const SCALE_STEP = 0.1;

type DragMode = "none" | "move" | "crop-move" | "crop-resize-nw" | "crop-resize-ne" | "crop-resize-sw" | "crop-resize-se";

const RESIZE_HANDLE_SIZE = 16;

export function ImageEditor({ open, onOpenChange, originalFile, onConfirm }: ImageEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 450 });
  const [isExporting, setIsExporting] = useState(false);
  const [dragMode, setDragMode] = useState<DragMode>("none");
  const dragStartRef = useRef<{ x: number; y: number; transform: TransformState; cropRegion: CropRegion } | null>(null);
  const touchStartRef = useRef<{ distance: number; scale: number } | null>(null);
  const [showResetHint, setShowResetHint] = useState(false);

  const {
    image,
    transform,
    cropRegion,
    cropRatio,
    isLoading,
    setTransform,
    setCropRegion,
    setCropRatio,
    rotate,
    reset,
    exportImage,
    updateCanvasSize
  } = useImageEditor({
    originalFile,
    canvasWidth: canvasSize.width,
    canvasHeight: canvasSize.height
  });

  useEffect(() => {
    if (!open || !containerRef.current) return;

    const updateSize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const width = Math.min(rect.width, 800);
      const height = Math.min(rect.height, 600);
      setCanvasSize({ width, height });
      updateCanvasSize(width, height);
    };

    updateSize();
    window.addEventListener("resize", updateSize);

    return () => window.removeEventListener("resize", updateSize);
  }, [open, updateCanvasSize]);

  useEffect(() => {
    if (!canvasRef.current || !image || isLoading) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;
    canvas.style.width = `${canvasSize.width}px`;
    canvas.style.height = `${canvasSize.height}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    ctx.save();
    ctx.translate(transform.translateX, transform.translateY);
    ctx.rotate((transform.rotation * Math.PI) / 180);
    ctx.scale(transform.scale, transform.scale);

    const displayScale = Math.min(
      canvasSize.width / image.naturalWidth,
      canvasSize.height / image.naturalHeight,
      1
    );
    const drawWidth = image.naturalWidth * displayScale;
    const drawHeight = image.naturalHeight * displayScale;

    ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    ctx.restore();

    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, canvasSize.width, cropRegion.y);
    ctx.fillRect(0, cropRegion.y + cropRegion.height, canvasSize.width, canvasSize.height - cropRegion.y - cropRegion.height);
    ctx.fillRect(0, cropRegion.y, cropRegion.x, cropRegion.height);
    ctx.fillRect(cropRegion.x + cropRegion.width, cropRegion.y, canvasSize.width - cropRegion.x - cropRegion.width, cropRegion.height);

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(cropRegion.x, cropRegion.y, cropRegion.width, cropRegion.height);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    const thirdW = cropRegion.width / 3;
    const thirdH = cropRegion.height / 3;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(cropRegion.x + thirdW * i, cropRegion.y);
      ctx.lineTo(cropRegion.x + thirdW * i, cropRegion.y + cropRegion.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cropRegion.x, cropRegion.y + thirdH * i);
      ctx.lineTo(cropRegion.x + cropRegion.width, cropRegion.y + thirdH * i);
      ctx.stroke();
    }

    const handleSize = RESIZE_HANDLE_SIZE;
    ctx.fillStyle = "#ffffff";
    const corners = [
      { x: cropRegion.x, y: cropRegion.y },
      { x: cropRegion.x + cropRegion.width, y: cropRegion.y },
      { x: cropRegion.x, y: cropRegion.y + cropRegion.height },
      { x: cropRegion.x + cropRegion.width, y: cropRegion.y + cropRegion.height }
    ];
    corners.forEach(({ x, y }) => {
      ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
    });
  }, [image, transform, cropRegion, canvasSize, isLoading]);

  const getMousePos = useCallback(
    (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
      if (!canvasRef.current) return { x: 0, y: 0 };
      const rect = canvasRef.current.getBoundingClientRect();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    },
    []
  );

  const getResizeHandle = useCallback(
    (x: number, y: number): DragMode => {
      const handleSize = RESIZE_HANDLE_SIZE;
      const { x: cx, y: cy, width, height } = cropRegion;

      if (Math.abs(x - cx) < handleSize && Math.abs(y - cy) < handleSize) return "crop-resize-nw";
      if (Math.abs(x - (cx + width)) < handleSize && Math.abs(y - cy) < handleSize) return "crop-resize-ne";
      if (Math.abs(x - cx) < handleSize && Math.abs(y - (cy + height)) < handleSize) return "crop-resize-sw";
      if (Math.abs(x - (cx + width)) < handleSize && Math.abs(y - (cy + height)) < handleSize) return "crop-resize-se";

      if (x >= cx && x <= cx + width && y >= cy && y <= cy + height) return "crop-move";

      return "move";
    },
    [cropRegion]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (isLoading) return;

      const pos = getMousePos(e);
      const mode = getResizeHandle(pos.x, pos.y);

      setDragMode(mode);
      dragStartRef.current = {
        x: pos.x,
        y: pos.y,
        transform: { ...transform },
        cropRegion: { ...cropRegion }
      };

      if ("touches" in e && e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchStartRef.current = {
          distance: Math.sqrt(dx * dx + dy * dy),
          scale: transform.scale
        };
      }
    },
    [isLoading, getMousePos, getResizeHandle, transform, cropRegion]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (dragMode === "none" || !dragStartRef.current || isLoading) return;

      const pos = getMousePos(e);
      const start = dragStartRef.current;
      const dx = pos.x - start.x;
      const dy = pos.y - start.y;

      if ("touches" in e && e.touches.length === 2 && touchStartRef.current) {
        const touchDx = e.touches[0].clientX - e.touches[1].clientX;
        const touchDy = e.touches[0].clientY - e.touches[1].clientY;
        const distance = Math.sqrt(touchDx * touchDx + touchDy * touchDy);
        const scaleDiff = distance / touchStartRef.current.distance;
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, touchStartRef.current.scale * scaleDiff));
        setTransform({ ...transform, scale: newScale });
        return;
      }

      switch (dragMode) {
        case "move":
          setTransform({
            ...transform,
            translateX: start.transform.translateX + dx,
            translateY: start.transform.translateY + dy
          });
          break;

        case "crop-move":
          setCropRegion({
            ...start.cropRegion,
            x: Math.max(0, Math.min(canvasSize.width - start.cropRegion.width, start.cropRegion.x + dx)),
            y: Math.max(0, Math.min(canvasSize.height - start.cropRegion.height, start.cropRegion.y + dy))
          });
          break;

        case "crop-resize-nw":
          setCropRegion({
            ...start.cropRegion,
            x: start.cropRegion.x + dx,
            y: start.cropRegion.y + dy,
            width: start.cropRegion.width - dx,
            height: start.cropRegion.height - dy
          });
          break;

        case "crop-resize-ne":
          setCropRegion({
            ...start.cropRegion,
            y: start.cropRegion.y + dy,
            width: start.cropRegion.width + dx,
            height: start.cropRegion.height - dy
          });
          break;

        case "crop-resize-sw":
          setCropRegion({
            ...start.cropRegion,
            x: start.cropRegion.x + dx,
            width: start.cropRegion.width - dx,
            height: start.cropRegion.height + dy
          });
          break;

        case "crop-resize-se":
          setCropRegion({
            ...start.cropRegion,
            width: start.cropRegion.width + dx,
            height: start.cropRegion.height + dy
          });
          break;
      }
    },
    [dragMode, isLoading, getMousePos, transform, setTransform, setCropRegion, canvasSize]
  );

  const handleMouseUp = useCallback(() => {
    setDragMode("none");
    dragStartRef.current = null;
    touchStartRef.current = null;
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (isLoading) return;
      e.preventDefault();

      const delta = e.deltaY > 0 ? -SCALE_STEP : SCALE_STEP;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, transform.scale + delta));
      setTransform({ ...transform, scale: newScale });
    },
    [isLoading, transform, setTransform]
  );

  const handleZoomIn = useCallback(() => {
    const newScale = Math.min(MAX_SCALE, transform.scale + SCALE_STEP);
    setTransform({ ...transform, scale: newScale });
  }, [transform, setTransform]);

  const handleZoomOut = useCallback(() => {
    const newScale = Math.max(MIN_SCALE, transform.scale - SCALE_STEP);
    setTransform({ ...transform, scale: newScale });
  }, [transform, setTransform]);

  const handleReset = useCallback(() => {
    reset();
    setShowResetHint(true);
    setTimeout(() => setShowResetHint(false), 1500);
  }, [reset]);

  const handleConfirm = useCallback(async () => {
    if (isExporting || isLoading) return;

    try {
      setIsExporting(true);
      const editedFile = await exportImage();
      onConfirm(editedFile);
      onOpenChange(false);
    } catch (error) {
      console.error("导出图片失败:", error);
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, isLoading, exportImage, onConfirm, onOpenChange]);

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-5xl p-0 overflow-hidden" aria-describedby={undefined}>
        <DialogTitle className="sr-only">图片编辑器</DialogTitle>
        <div className="flex flex-col h-[85vh] bg-slate-900">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <Edit3 className="h-5 w-5 text-brand-400" />
              <h2 className="text-lg font-semibold text-white">编辑图片</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{Math.round(transform.scale * 100)}%</span>
              <Button variant="ghost" size="icon" onClick={handleZoomOut} className="text-slate-300 hover:text-white hover:bg-slate-700">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleZoomIn} className="text-slate-300 hover:text-white hover:bg-slate-700">
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleReset} className="text-slate-300 hover:text-white hover:bg-slate-700 relative">
                <RotateCcw className="h-4 w-4" />
                {showResetHint && <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-green-400 whitespace-nowrap">已重置</span>}
              </Button>
              <Button variant="ghost" size="icon" onClick={rotate} className="text-slate-300 hover:text-white hover:bg-slate-700">
                <RotateCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div ref={containerRef} className="flex-1 flex items-center justify-center p-4 overflow-hidden">
            {isLoading ? (
              <div className="flex flex-col items-center gap-3">
                <Skeleton className="w-64 h-64 rounded-lg bg-slate-700" />
                <p className="text-sm text-slate-400">加载图片中...</p>
              </div>
            ) : (
              <canvas
                ref={canvasRef}
                className={cn(
                  "rounded-lg shadow-2xl",
                  dragMode === "move" ? "cursor-grabbing" : "cursor-grab",
                  dragMode.startsWith("crop") && "cursor-crosshair"
                )}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleMouseDown}
                onTouchMove={handleMouseMove}
                onTouchEnd={handleMouseUp}
                onWheel={handleWheel}
                style={{ touchAction: "none" }}
              />
            )}
          </div>

          <div className="px-4 py-3 border-t border-slate-700 space-y-3">
            <Tabs value={cropRatio} onValueChange={(value) => setCropRatio(value as CropAspectRatio)} className="w-full">
              <TabsList className="w-full grid grid-cols-4 bg-slate-800">
                {CROP_RATIO_OPTIONS.map((option) => (
                  <TabsTrigger
                    key={option.value}
                    value={option.value}
                    className="data-[state=active]:bg-brand-500 data-[state=active]:text-white text-slate-300"
                  >
                    {option.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={handleCancel} className="text-slate-300 hover:text-white hover:bg-slate-700">
                <X className="h-4 w-4 mr-2" />
                取消
              </Button>
              <Button onClick={handleConfirm} disabled={isExporting || isLoading} className="bg-brand-500 hover:bg-brand-600 text-white min-w-[120px]">
                {isExporting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    导出中...
                  </span>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    确认
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
