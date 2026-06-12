import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Download, Image as ImageIcon, Loader2, Share2, X } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { generatePoster, downloadPoster, type PosterData } from "@/lib/poster-generator";
import type { FeedItem } from "@/types/models";

interface SharePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: FeedItem;
}

type PanelView = "options" | "poster";

export function SharePanel({ open, onOpenChange, post }: SharePanelProps) {
  const [view, setView] = useState<PanelView>("options");
  const [copied, setCopied] = useState(false);
  const [posterState, setPosterState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [posterData, setPosterData] = useState<PosterData | null>(null);

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/post/${post.id}` : `/post/${post.id}`;

  useEffect(() => {
    if (!open) {
      setView("options");
      setCopied(false);
      setPosterState("idle");
      setPosterData(null);
    }
  }, [open]);

  const handleCopyLink = useCallback(async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = shareUrl;
        textarea.style.position = "fixed";
        textarea.style.top = "-1000px";
        textarea.style.left = "-1000px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      toast.success("链接已复制到剪贴板");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("复制失败，请手动复制");
    }
  }, [shareUrl]);

  const handleGeneratePoster = useCallback(async () => {
    setView("poster");
    setPosterState("loading");
    setPosterData(null);
    try {
      const data = await generatePoster(post, shareUrl);
      setPosterData(data);
      setPosterState("success");
    } catch (err) {
      console.error("海报生成失败:", err);
      setPosterState("error");
      toast.error("海报生成失败，请稍后重试");
    }
  }, [post, shareUrl]);

  const handleDownload = useCallback(() => {
    if (posterData?.dataUrl) {
      downloadPoster(posterData.dataUrl, `asolo-post-${post.id}.png`);
      toast.success("海报已开始下载");
    }
  }, [posterData, post.id]);

  const handleSaveImage = useCallback(async () => {
    if (!posterData?.blob) return;
    try {
      if ((navigator as unknown as { canShare?: (d: { files: Blob[] }) => boolean }).canShare?.({ files: [posterData.blob] })) {
        const file = new File([posterData.blob], `asolo-post-${post.id}.png`, { type: "image/png" });
        await (navigator as unknown as { share: (d: { files: File[]; title?: string; text?: string }) => Promise<void> }).share({
          files: [file],
          title: "ASOLO 动态分享",
          text: `${post.author.nickname} 的动态`
        });
      } else {
        handleDownload();
      }
    } catch {
      handleDownload();
    }
  }, [posterData, post.id, post.author.nickname, handleDownload]);

  const handleBack = useCallback(() => {
    setView("options");
    setPosterState("idle");
  }, []);

  return (
    <>
      <Dialog open={open && view === "options"} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-brand-500" />
              分享动态
            </DialogTitle>
            <DialogDescription>将这条动态分享给朋友</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Button
              variant="outline"
              size="lg"
              className="w-full justify-start gap-3 rounded-xl border-slate-200 p-4 hover:bg-slate-50"
              onClick={handleCopyLink}
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-50">
                {copied ? (
                  <Check className="h-5 w-5 text-green-600" />
                ) : (
                  <Copy className="h-5 w-5 text-blue-600" />
                )}
              </div>
              <div className="flex flex-col items-start gap-0.5">
                <span className="text-sm font-semibold text-slate-900">
                  {copied ? "已复制链接" : "复制动态链接"}
                </span>
                <span className="truncate text-xs font-normal text-slate-500 max-w-[260px]">
                  {shareUrl}
                </span>
              </div>
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="w-full justify-start gap-3 rounded-xl border-slate-200 p-4 hover:bg-slate-50"
              onClick={handleGeneratePoster}
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-orange-50">
                <ImageIcon className="h-5 w-5 text-brand-600" />
              </div>
              <div className="flex flex-col items-start gap-0.5">
                <span className="text-sm font-semibold text-slate-900">生成分享海报</span>
                <span className="text-xs font-normal text-slate-500">
                  生成精美海报图片，可保存或分享
                </span>
              </div>
            </Button>
          </div>

          <div className="rounded-xl bg-slate-50 p-3">
            <p className="truncate text-xs text-slate-500">
              来自 <span className="font-medium text-slate-700">@{post.author.nickname}</span> 的动态
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={open && view === "poster"} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[420px] gap-0 overflow-hidden p-0 sm:max-w-md">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-auto gap-1 px-2 text-slate-600"
              onClick={handleBack}
            >
              <X className="h-4 w-4" />
              返回
            </Button>
            <h3 className="text-sm font-semibold text-slate-900">分享海报</h3>
            <div className="w-16" />
          </div>

          <div className="bg-slate-100 p-4">
            <div className="mx-auto max-w-[340px]">
              {posterState === "loading" ? (
                <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-14 w-14 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-24" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                  <Skeleton className="h-44 w-full rounded-xl" />
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-20 w-20 rounded-lg" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
                    <span className="ml-2 text-sm text-slate-500">正在生成海报...</span>
                  </div>
                </div>
              ) : posterState === "success" && posterData ? (
                <div className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-slate-200/60">
                  <img
                    src={posterData.dataUrl}
                    alt="分享海报"
                    className="block h-auto w-full"
                    draggable={false}
                  />
                </div>
              ) : posterState === "error" ? (
                <div className="flex flex-col items-center justify-center rounded-2xl bg-white p-10 text-center shadow-sm">
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
                    <X className="h-7 w-7 text-red-500" />
                  </div>
                  <p className="text-base font-semibold text-slate-900">生成失败</p>
                  <p className="mt-1 text-sm text-slate-500">海报生成出现问题，请重试</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={handleGeneratePoster}
                  >
                    重新生成
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

          {posterState === "success" && posterData ? (
            <div className="flex gap-3 border-t border-slate-100 p-4 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="flex-1 gap-2"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4" />
                下载海报
              </Button>
              <Button
                type="button"
                size="lg"
                className="flex-1 gap-2 bg-brand-500 hover:bg-brand-600"
                onClick={handleSaveImage}
              >
                <Share2 className="h-4 w-4" />
                分享
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
