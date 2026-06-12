import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Crown,
  Flame,
  Hash,
  LoaderCircle,
  Minus,
  Trophy,
  TrendingUp,
  Users
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import {
  fetchCreatorLeaderboard,
  fetchPostLeaderboard,
  fetchTopicLeaderboard
} from "@/api/leaderboard";
import { toggleFollow } from "@/api/discovery";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/auth-context";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import { parseApiError } from "@/lib/api-error";
import type {
  CreatorSortBy,
  LeaderboardPeriod,
  LeaderboardTab,
  RankedCreatorItem,
  RankedPostItem,
  RankedTopicItem
} from "@/types/models";

const TABS: Array<{ key: LeaderboardTab; label: string; icon: typeof Trophy }> = [
  { key: "posts", label: "动态榜", icon: Flame },
  { key: "topics", label: "话题榜", icon: Hash },
  { key: "creators", label: "创作者榜", icon: Users }
];

const PERIODS: Array<{ key: LeaderboardPeriod; label: string }> = [
  { key: "day", label: "日榜" },
  { key: "week", label: "周榜" },
  { key: "total", label: "总榜" }
];

const CREATOR_SORTS: Array<{ key: CreatorSortBy; label: string }> = [
  { key: "followers", label: "粉丝" },
  { key: "interactions", label: "互动" }
];

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-md">
        <Crown className="h-4 w-4" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-slate-300 to-slate-400 text-white shadow-sm">
        <span className="text-sm font-bold">{rank}</span>
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-sm">
        <span className="text-sm font-bold">{rank}</span>
      </div>
    );
  }
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500">
      <span className="text-sm font-semibold">{rank}</span>
    </div>
  );
}

function RankChangeIndicator({ change }: { change: number | null }) {
  if (change === null) {
    return <Minus className="h-3.5 w-3.5 text-slate-400" />;
  }
  if (change > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-emerald-600">
        <ArrowUp className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">{change}</span>
      </span>
    );
  }
  if (change < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-red-500">
        <ArrowDown className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">{Math.abs(change)}</span>
      </span>
    );
  }
  return <Minus className="h-3.5 w-3.5 text-slate-400" />;
}

function MetricChangeIndicator({ change }: { change: number | null }) {
  if (change === null) {
    return null;
  }
  if (change > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-emerald-600">
        <ArrowUp className="h-3 w-3" />
        <span className="text-xs font-medium">{change.toFixed(1)}%</span>
      </span>
    );
  }
  if (change < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-red-500">
        <ArrowDown className="h-3 w-3" />
        <span className="text-xs font-medium">{Math.abs(change).toFixed(1)}%</span>
      </span>
    );
  }
  return <span className="text-xs text-slate-400">持平</span>;
}

function TopicTag({ tag }: { tag: string }) {
  if (tag === "沸") {
    return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">沸</Badge>;
  }
  if (tag === "热") {
    return <Badge className="bg-orange-100 text-orange-700 text-[10px] px-1.5 py-0">热</Badge>;
  }
  if (tag === "新") {
    return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">新</Badge>;
  }
  return null;
}

function PostSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-9 w-9 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    </div>
  );
}

function TopicSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-6 w-16" />
      </div>
    </div>
  );
}

function CreatorSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-full" />
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="h-8 w-16 rounded-lg" />
      </div>
    </div>
  );
}

interface PostRankItemProps {
  entry: RankedPostItem;
  onClick: () => void;
}

function PostRankItem({ entry, onClick }: PostRankItemProps) {
  const { rank, rankChange, hotScore, hotScoreChange, item } = entry;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full rounded-2xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-brand-200 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-1 pt-0.5">
          <RankBadge rank={rank} />
          <RankChangeIndicator change={rankChange} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2">
            <Avatar className="h-6 w-6 border-0">
              <AvatarImage src={item.author.avatarUrl ?? undefined} />
              <AvatarFallback>{item.author.nickname.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-slate-700">
              {item.author.nickname}
            </span>
            <span className="text-xs text-slate-400">·</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              <Flame className="mr-0.5 h-3 w-3" />
              {formatCount(hotScore)}
            </Badge>
            <MetricChangeIndicator change={hotScoreChange} />
          </div>
          <p className="line-clamp-2 text-sm text-slate-800 group-hover:text-brand-700">
            {item.content}
          </p>
          {item.media.length > 0 ? (
            <div className="mt-2 flex gap-1.5">
              {item.media.slice(0, 3).map((media) => (
                <div
                  key={media.id}
                  className="h-14 w-14 overflow-hidden rounded-lg bg-slate-100"
                >
                  <img
                    src={media.url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          ) : null}
          <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
            <span>赞 {formatCount(item.likesCount)}</span>
            <span>评 {formatCount(item.commentsCount)}</span>
            <span>转 {formatCount(item.repostsCount)}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

interface TopicRankItemProps {
  entry: RankedTopicItem;
  onClick: () => void;
}

function TopicRankItem({ entry, onClick }: TopicRankItemProps) {
  const { rank, rankChange, heat, heatChange, topic } = entry;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full rounded-2xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-brand-200 hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center gap-1">
          <RankBadge rank={rank} />
          <RankChangeIndicator change={rankChange} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-base font-semibold text-slate-800 group-hover:text-brand-700">
              #{topic.keyword}
            </span>
            {topic.tag ? <TopicTag tag={topic.tag} /> : null}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              热度 {formatCount(heat)}
            </span>
            {topic.postCount ? (
              <span>{formatCount(topic.postCount)} 条动态</span>
            ) : null}
            <MetricChangeIndicator change={heatChange} />
          </div>
        </div>
      </div>
    </button>
  );
}

interface CreatorRankItemProps {
  entry: RankedCreatorItem;
  sortBy: CreatorSortBy;
  onFollow: () => void;
  following: boolean;
  followLoading: boolean;
  onClickProfile: () => void;
}

function CreatorRankItem({
  entry,
  sortBy,
  onFollow,
  following,
  followLoading,
  onClickProfile
}: CreatorRankItemProps) {
  const { rank, rankChange, metricValue, metricChange, creator } = entry;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-brand-200 hover:shadow-md">
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center gap-1">
          <RankBadge rank={rank} />
          <RankChangeIndicator change={rankChange} />
        </div>
        <button
          type="button"
          onClick={onClickProfile}
          className="shrink-0"
        >
          <Avatar className="h-11 w-11">
            <AvatarImage src={creator.avatarUrl ?? undefined} />
            <AvatarFallback>{creator.nickname.slice(0, 1)}</AvatarFallback>
          </Avatar>
        </button>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onClickProfile}
            className="text-left"
          >
            <div className="mb-0.5 flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-800 hover:text-brand-700">
                {creator.nickname}
              </span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {creator.level}
              </Badge>
            </div>
          </button>
          {creator.bio ? (
            <p className="line-clamp-1 text-xs text-slate-500">{creator.bio}</p>
          ) : null}
          <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
            <span>
              {sortBy === "followers" ? "新增粉丝 " : "互动值 "}
              <span className="font-semibold text-slate-700">
                {formatCount(metricValue)}
              </span>
            </span>
            <span>粉丝 {formatCount(creator.followersCount)}</span>
            <MetricChangeIndicator change={metricChange} />
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant={following ? "outline" : "default"}
          disabled={followLoading}
          onClick={(e) => {
            e.stopPropagation();
            onFollow();
          }}
          className={cn(
            "shrink-0",
            following && "border-slate-300 text-slate-600 hover:bg-slate-50"
          )}
        >
          {followLoading ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : following ? (
            "已关注"
          ) : (
            "+ 关注"
          )}
        </Button>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<LeaderboardTab>("posts");
  const [period, setPeriod] = useState<LeaderboardPeriod>("week");
  const [creatorSortBy, setCreatorSortBy] = useState<CreatorSortBy>("followers");

  const [posts, setPosts] = useState<RankedPostItem[]>([]);
  const [topics, setTopics] = useState<RankedTopicItem[]>([]);
  const [creators, setCreators] = useState<RankedCreatorItem[]>([]);

  const [postsCursor, setPostsCursor] = useState<string | null>(null);
  const [topicsCursor, setTopicsCursor] = useState<string | null>(null);
  const [creatorsCursor, setCreatorsCursor] = useState<string | null>(null);

  const [postsHasMore, setPostsHasMore] = useState(false);
  const [topicsHasMore, setTopicsHasMore] = useState(false);
  const [creatorsHasMore, setCreatorsHasMore] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [followingIds, setFollowingIds] = useState<Set<number>>(new Set());
  const [followLoadingIds, setFollowLoadingIds] = useState<Set<number>>(new Set());

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === "posts") {
        const data = await fetchPostLeaderboard(period, null);
        setPosts(data.items);
        setPostsCursor(data.nextCursor);
        setPostsHasMore(data.nextCursor !== null);
      } else if (activeTab === "topics") {
        const data = await fetchTopicLeaderboard(period, null);
        setTopics(data.items);
        setTopicsCursor(data.nextCursor);
        setTopicsHasMore(data.nextCursor !== null);
      } else {
        const data = await fetchCreatorLeaderboard(period, creatorSortBy, null);
        setCreators(data.items);
        setCreatorsCursor(data.nextCursor);
        setCreatorsHasMore(data.nextCursor !== null);
        setFollowingIds(new Set(data.items.filter((i) => i.creator.isFollowed).map((i) => i.creator.id)));
      }
    } catch (err) {
      const parsed = parseApiError(err);
      toast.error(parsed.message || "榜单加载失败");
    } finally {
      setLoading(false);
    }
  }, [activeTab, period, creatorSortBy]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore) return;

    let cursor: string | null = null;
    let hasMore = false;

    if (activeTab === "posts") {
      cursor = postsCursor;
      hasMore = postsHasMore;
    } else if (activeTab === "topics") {
      cursor = topicsCursor;
      hasMore = topicsHasMore;
    } else {
      cursor = creatorsCursor;
      hasMore = creatorsHasMore;
    }

    if (!cursor || !hasMore) return;

    setLoadingMore(true);
    try {
      if (activeTab === "posts") {
        const data = await fetchPostLeaderboard(period, cursor);
        setPosts((prev) => [...prev, ...data.items]);
        setPostsCursor(data.nextCursor);
        setPostsHasMore(data.nextCursor !== null);
      } else if (activeTab === "topics") {
        const data = await fetchTopicLeaderboard(period, cursor);
        setTopics((prev) => [...prev, ...data.items]);
        setTopicsCursor(data.nextCursor);
        setTopicsHasMore(data.nextCursor !== null);
      } else {
        const data = await fetchCreatorLeaderboard(period, creatorSortBy, cursor);
        setCreators((prev) => [...prev, ...data.items]);
        setCreatorsCursor(data.nextCursor);
        setCreatorsHasMore(data.nextCursor !== null);
        setFollowingIds(
          (prev) =>
            new Set([
              ...prev,
              ...data.items.filter((i) => i.creator.isFollowed).map((i) => i.creator.id)
            ])
        );
      }
    } catch (err) {
      const parsed = parseApiError(err);
      toast.error(parsed.message || "加载更多失败");
    } finally {
      setLoadingMore(false);
    }
  }, [activeTab, period, creatorSortBy, loadingMore, postsCursor, postsHasMore, topicsCursor, topicsHasMore, creatorsCursor, creatorsHasMore]);

  const handleFollow = useCallback(
    async (userId: number) => {
      if (!user) {
        toast.error("请先登录");
        return;
      }

      setFollowLoadingIds((prev) => new Set(prev).add(userId));
      const wasFollowing = followingIds.has(userId);

      try {
        const result = await toggleFollow(userId);
        if (result.isFollowed) {
          setFollowingIds((prev) => new Set(prev).add(userId));
          toast.success("关注成功");
        } else {
          setFollowingIds((prev) => {
            const next = new Set(prev);
            next.delete(userId);
            return next;
          });
          toast.success("已取消关注");
        }

        setCreators((prev) =>
          prev.map((item) =>
            item.creator.id === userId
              ? { ...item, creator: { ...item.creator, isFollowed: result.isFollowed } }
              : item
          )
        );
      } catch (err) {
        const parsed = parseApiError(err);
        toast.error(parsed.message || "操作失败");
        if (wasFollowing) {
          setFollowingIds((prev) => new Set(prev).add(userId));
        }
      } finally {
        setFollowLoadingIds((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      }
    },
    [user, followingIds]
  );

  const periodLabel = useMemo(
    () => PERIODS.find((p) => p.key === period)?.label ?? "周榜",
    [period]
  );

  const showEmpty =
    !loading &&
    ((activeTab === "posts" && posts.length === 0) ||
      (activeTab === "topics" && topics.length === 0) ||
      (activeTab === "creators" && creators.length === 0));

  const currentHasMore =
    activeTab === "posts"
      ? postsHasMore
      : activeTab === "topics"
        ? topicsHasMore
        : creatorsHasMore;

  return (
    <main className="mx-auto w-full max-w-[1320px] px-3 pb-10 pt-4 md:px-4 lg:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-brand-500" />
            <h1 className="text-lg font-bold text-slate-800">排行榜中心</h1>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as LeaderboardTab)}
          >
            <TabsList className="w-full">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger key={tab.key} value={tab.key} className="flex-1 gap-1.5">
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value="posts" className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  {PERIODS.map((p) => (
                    <Button
                      key={p.key}
                      type="button"
                      size="sm"
                      variant={period === p.key ? "default" : "secondary"}
                      onClick={() => setPeriod(p.key)}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
                <Badge variant="outline" className="text-xs">
                  按热度 · {periodLabel}
                </Badge>
              </div>

              {loading && posts.length === 0 ? (
                <div className="space-y-3">
                  <PostSkeleton />
                  <PostSkeleton />
                  <PostSkeleton />
                </div>
              ) : null}

              {showEmpty ? (
                <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center text-slate-500">
                  暂无动态榜数据
                </div>
              ) : null}

              {posts.map((entry) => (
                <PostRankItem
                  key={entry.item.id}
                  entry={entry}
                  onClick={() => navigate(`/post/${entry.item.id}`)}
                />
              ))}
            </TabsContent>

            <TabsContent value="topics" className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  {PERIODS.map((p) => (
                    <Button
                      key={p.key}
                      type="button"
                      size="sm"
                      variant={period === p.key ? "default" : "secondary"}
                      onClick={() => setPeriod(p.key)}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
                <Badge variant="outline" className="text-xs">
                  按热度 · {periodLabel}
                </Badge>
              </div>

              {loading && topics.length === 0 ? (
                <div className="space-y-3">
                  <TopicSkeleton />
                  <TopicSkeleton />
                  <TopicSkeleton />
                </div>
              ) : null}

              {showEmpty ? (
                <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center text-slate-500">
                  暂无话题榜数据
                </div>
              ) : null}

              {topics.map((entry) => (
                <TopicRankItem
                  key={entry.topic.id}
                  entry={entry}
                  onClick={() => navigate(`/topic/${entry.topic.id}`)}
                />
              ))}
            </TabsContent>

            <TabsContent value="creators" className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  {PERIODS.map((p) => (
                    <Button
                      key={p.key}
                      type="button"
                      size="sm"
                      variant={period === p.key ? "default" : "secondary"}
                      onClick={() => setPeriod(p.key)}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  {CREATOR_SORTS.map((s) => (
                    <Button
                      key={s.key}
                      type="button"
                      size="sm"
                      variant={creatorSortBy === s.key ? "default" : "secondary"}
                      onClick={() => setCreatorSortBy(s.key)}
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
              </div>

              {loading && creators.length === 0 ? (
                <div className="space-y-3">
                  <CreatorSkeleton />
                  <CreatorSkeleton />
                  <CreatorSkeleton />
                </div>
              ) : null}

              {showEmpty ? (
                <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center text-slate-500">
                  暂无创作者榜数据
                </div>
              ) : null}

              {creators.map((entry) => (
                <CreatorRankItem
                  key={entry.creator.id}
                  entry={entry}
                  sortBy={creatorSortBy}
                  following={followingIds.has(entry.creator.id)}
                  followLoading={followLoadingIds.has(entry.creator.id)}
                  onFollow={() => handleFollow(entry.creator.id)}
                  onClickProfile={() => navigate(`/u/${entry.creator.id}`)}
                />
              ))}
            </TabsContent>
          </Tabs>

          {currentHasMore && !loading ? (
            <div className="pt-4 text-center">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleLoadMore()}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    加载中...
                  </>
                ) : (
                  "加载更多"
                )}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
