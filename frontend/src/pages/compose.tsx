import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Edit3, ImagePlus, RotateCcw, Trash2, Upload, Video } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";

import { createPost } from "@/api/discovery";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { ImageEditor } from "@/components/image-editor/image-editor";
import { parseApiError } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import type { FeedChannel } from "@/types/models";

const composeSchema = z.object({
  content: z.string().min(3, "正文至少 3 个字符").max(1000, "正文最多 1000 个字符")
});

interface MediaItem {
  file: File;
  url: string;
  originalFile: File;
  isEdited: boolean;
}

export default function ComposePage() {
  const navigate = useNavigate();
  const [channel, setChannel] = useState<FeedChannel>("hot");
  const [content, setContent] = useState("");
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [contentError, setContentError] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const previewUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrlsRef.current = mediaItems.map((item) => item.url);
  }, [mediaItems]);

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const onChangeFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    if (selected.length === 0) {
      setMediaItems([]);
      setMediaError(null);
      return;
    }

    if (selected.some((file) => !file.type.startsWith("image/") && !file.type.startsWith("video/"))) {
      setMediaError("仅支持图片或视频文件");
      return;
    }

    if (selected.some((file) => file.size > 30 * 1024 * 1024)) {
      setMediaError("单个文件不能超过 30MB");
      return;
    }

    const videos = selected.filter((file) => file.type.startsWith("video/"));
    if (videos.length > 1) {
      setMediaError("最多只能上传 1 个视频");
      return;
    }

    if (videos.length === 1 && selected.length > 1) {
      setMediaError("视频发布时不支持混传多图");
      return;
    }

    const images = selected.filter((file) => file.type.startsWith("image/"));
    if (images.length > 9) {
      setMediaError("最多上传 9 张图片");
      return;
    }

    setMediaError(null);

    const items: MediaItem[] = selected.map((file) => ({
      file,
      url: URL.createObjectURL(file),
      originalFile: file,
      isEdited: false
    }));
    setMediaItems(items);
  };

  const handleEditImage = (index: number) => {
    const item = mediaItems[index];
    if (!item || !item.file.type.startsWith("image/")) return;

    setEditingIndex(index);
    setEditorOpen(true);
  };

  const handleConfirmEdit = (editedFile: File) => {
    if (editingIndex === null) return;

    setMediaItems((prev) => {
      const next = [...prev];
      const item = next[editingIndex];
      if (item) {
        if (item.url) {
          URL.revokeObjectURL(item.url);
        }
        next[editingIndex] = {
          ...item,
          file: editedFile,
          url: URL.createObjectURL(editedFile),
          isEdited: true
        };
      }
      return next;
    });

    toast.success("图片已更新");
    setEditingIndex(null);
  };

  const handleResetImage = (index: number) => {
    setMediaItems((prev) => {
      const next = [...prev];
      const item = next[index];
      if (item && item.isEdited) {
        if (item.url) {
          URL.revokeObjectURL(item.url);
        }
        next[index] = {
          ...item,
          file: item.originalFile,
          url: URL.createObjectURL(item.originalFile),
          isEdited: false
        };
        toast.success("已重置为原图");
      }
      return next;
    });
  };

  const handleRemoveMedia = (index: number) => {
    setMediaItems((prev) => {
      const next = [...prev];
      const item = next[index];
      if (item && item.url) {
        URL.revokeObjectURL(item.url);
      }
      next.splice(index, 1);
      return next;
    });
  };

  const onSubmit = async () => {
    const parsed = composeSchema.safeParse({ content });
    if (!parsed.success) {
      setContentError(parsed.error.issues[0]?.message ?? "请检查输入");
      return;
    }

    if (mediaError) {
      return;
    }

    setContentError(null);

    const files = mediaItems.map((item) => item.file);

    try {
      setSubmitting(true);
      await createPost({ content: parsed.data.content, channel, files });
      toast.success("发布成功");
      navigate("/");
    } catch (error) {
      const parsedError = parseApiError(error);
      if (parsedError.message.includes("正文")) {
        setContentError(parsedError.message);
      } else if (parsedError.message.includes("上传") || parsedError.message.includes("视频") || parsedError.message.includes("图片")) {
        setMediaError(parsedError.message);
      }
      toast.error(parsedError.message || "发布失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (contentError && content.trim().length >= 3) {
      setContentError(null);
    }
  }, [content, contentError]);

  return (
    <main className="mx-auto mt-6 w-full max-w-6xl px-4 pb-12">
      <Card className="mx-auto w-full max-w-3xl">
        <CardHeader>
          <CardTitle>发布动态</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>发布频道</Label>
            <Tabs value={channel} onValueChange={(value) => setChannel(value as FeedChannel)}>
              <TabsList>
                <TabsTrigger value="hot">热门</TabsTrigger>
                <TabsTrigger value="city">同城</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">正文内容</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(event) => {
                setContent(event.target.value);
                if (contentError) {
                  setContentError(null);
                }
              }}
              placeholder="分享此刻想法，支持 #话题# 形式"
              invalid={Boolean(contentError)}
              className="min-h-[180px]"
            />
            {contentError ? <p className="text-xs text-red-500">{contentError}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="media">媒体上传</Label>
            <label
              htmlFor="media"
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-sm transition-colors ${
                mediaError
                  ? "border-red-400 bg-red-50 text-red-600 shadow-[0_0_0_3px_rgba(248,113,113,0.2)]"
                  : "border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Upload className="h-4 w-4" />
              上传图片（最多9张）或视频（1个）
            </label>
            <input id="media" type="file" accept="image/*,video/*" multiple className="hidden" onChange={onChangeFiles} />

            {mediaItems.length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {mediaItems.map((item, index) => (
                  <div key={index} className="group relative">
                    {item.file.type.startsWith("video/") ? (
                      <video
                        src={item.url}
                        className="h-32 w-full rounded-lg border border-slate-200 object-cover"
                        controls
                      />
                    ) : (
                      <img
                        src={item.url}
                        alt="预览"
                        className={cn(
                          "h-32 w-full rounded-lg border object-cover transition-all",
                          item.isEdited
                            ? "border-brand-400 ring-2 ring-brand-200"
                            : "border-slate-200"
                        )}
                      />
                    )}
                    {item.file.type.startsWith("image/") && (
                      <>
                        <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 rounded-lg">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditImage(index)}
                            className="h-8 px-2 bg-white/90 text-slate-700 hover:bg-white"
                          >
                            <Edit3 className="h-4 w-4 mr-1" />
                            编辑
                          </Button>
                          {item.isEdited && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResetImage(index)}
                              className="h-8 px-2 bg-white/90 text-slate-700 hover:bg-white"
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              重置
                            </Button>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveMedia(index)}
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white hover:bg-red-600 opacity-0 transition-opacity group-hover:opacity-100 shadow-md"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                        {item.isEdited && (
                          <span className="absolute top-2 left-2 rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-medium text-white">
                            已编辑
                          </span>
                        )}
                      </>
                    )}
                    {item.file.type.startsWith("video/") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveMedia(index)}
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white hover:bg-red-600 opacity-0 transition-opacity group-hover:opacity-100 shadow-md"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex gap-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
                  <ImagePlus className="h-3.5 w-3.5" /> 图文
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
                  <Video className="h-3.5 w-3.5" /> 视频
                </span>
              </div>
            )}
          </div>

          {mediaError ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{mediaError}</p> : null}

          <div className="flex justify-end gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">取消</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>放弃本次编辑？</AlertDialogTitle>
                  <AlertDialogDescription>未发布内容将不会保存。</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>继续编辑</AlertDialogCancel>
                  <AlertDialogAction onClick={() => navigate(-1)}>确认放弃</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button onClick={() => void onSubmit()} disabled={submitting}>
              {submitting ? "发布中..." : "立即发布"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {editingIndex !== null && mediaItems[editingIndex] && (
        <ImageEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          originalFile={mediaItems[editingIndex].originalFile}
          onConfirm={handleConfirmEdit}
        />
      )}
    </main>
  );
}
