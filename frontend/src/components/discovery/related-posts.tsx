import { useCallback, useEffect, useState } from "react";
import { Heart, MessageCircle, RefreshCw, Flame } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { fetchRelatedPosts, type RelatedPostsResponse } from "@/api/discovery";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { parseApiError } from "@/lib/api-error";
import { formatCount } from "@/lib/format";
import type { FeedItem } from "@/types/models";

interface RelatedPostsProps {
  postId: number;
}

function RelatedPostCard({ item }: { item: FeedItem }) {
  const coverMedia = item.media.find((m) => m.type === "image") ?? item.media[0] ?? null;

  return (
    <Link
      to={`/post/${item.id}`}
      className="group flex shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all hover:border-slate-300 hover:shadow-md"
      style={{ width: "220px" }}
    >
      <div className="relative h-32 w-full overflow-hidden bg-slate-100">
        {coverMedia ? (
          <img
            src={coverMedia.url}
            alt=""
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
            <MessageCircle className="h-8 w-8 text-slate-300" />
          </div>
        )}
        <div className="absolute right-2 top-2 flex gap-1">
          {item.media.length > 0 && (
            <Badge variant="secondary" className="bg-black/50 text-[10px] text-white backdrop-blur-sm">
              {item.media.length > 1 ? `${item.media.length}图` : "图"}
            </Badge>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="line-clamp-2 text-sm leading-5 text-slate-700">{item.content}</p>
        <div className="mt-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={item.author.avatarUrl ?? undefined} alt={item.author.nickname} />
              <AvatarFallback className="text-[10px]">{item.author.nickname.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <span className="truncate text-xs text-slate-500">{item.author.nickname}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span className="flex items-center gap-0.5">
              <Heart className="h-3 w-3" />
              {formatCount(item.likesCount)}
            </span>
            <span className="flex items-center gap-0.5">
              <MessageCircle className="h-3 w-3" />
              {formatCount(item.commentsCount)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function RelatedPostsSkeleton() {
  const cards = Array.from({ length: 4 });
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {cards.map((_, idx) => (
        <div key={idx} className="flex shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200" style={{ width: "220px" }}>
          <Skeleton className="h-32 w-full rounded-none" />
          <div className="flex flex-col gap-2 p-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <div className="mt-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-3 w-12" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function RelatedPosts({ postId }: RelatedPostsProps) {
  const [data, setData] = useState<RelatedPostsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadRelated = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const payload = await fetchRelatedPosts(postId, {
          limit: 8,
          offset: 0,
          seed: isRefresh ? Math.floor(Math.random() * 1000000) : undefined
        });
        setData(payload);
      } catch (error) {
        const parsed = parseApiError(error);
        toast.error(parsed.message || "相关推荐加载失败");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [postId]
  );

  useEffect(() => {
    void loadRelated();
  }, [loadRelated]);

  const handleRefresh = () => {
    void loadRelated(true);
  };

  const hasItems = data && data.items.length > 0;

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {hasItems && data?.isFallback ? (
              <Flame className="h-4 w-4 text-amber-500" />
            ) : (
              <MessageCircle className="h-4 w-4 text-brand-500" />
            )}
            <h3 className="text-sm font-semibold text-slate-800">
              {hasItems && data?.isFallback ? "热门动态" : "相关动态"}
            </h3>
            {hasItems && data?.isFallback ? (
              <Badge variant="outline" className="text-[10px]">
                暂无相关内容
              </Badge>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs"
            onClick={handleRefresh}
            disabled={loading || refreshing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            换一批
          </Button>
        </div>

        {loading ? (
          <RelatedPostsSkeleton />
        ) : hasItems ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {data.items.map((item) => (
              <RelatedPostCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MessageCircle className="mb-2 h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-500">暂无相关内容</p>
            <p className="mt-1 text-xs text-slate-400">请稍后再来看看吧</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
