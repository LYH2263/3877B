import { useEffect, useState } from "react";
import { Users, RefreshCw, Check } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  fetchRecommendedCreators,
  followCreators,
  type OnboardingCreator
} from "@/api/onboarding";
import { useAuth } from "@/context/auth-context";
import { toast } from "sonner";
import { formatCount } from "@/lib/format";

interface StepCreatorsProps {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export function StepCreators({ onNext, onBack, onSkip }: StepCreatorsProps) {
  const { refreshMe } = useAuth();
  const [creators, setCreators] = useState<OnboardingCreator[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadCreators = async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      }
      const data = await fetchRecommendedCreators();
      setCreators(data);
      setSelectedIds(new Set(data.filter((c) => c.isFollowed).map((c) => c.id)));
    } catch (error) {
      toast.error("加载推荐创作者失败，请稍后重试");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadCreators();
  }, []);

  const toggleSelect = (userId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleRefresh = () => {
    void loadCreators(true);
  };

  const handleNext = async () => {
    setSubmitting(true);
    try {
      await followCreators({
        userIds: Array.from(selectedIds)
      });
      await refreshMe();
      toast.success(
        selectedIds.size > 0
          ? `已关注 ${selectedIds.size} 位创作者`
          : "已跳过关注"
      );
      onNext();
    } catch (error) {
      // error handled globally
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-100 to-purple-200">
          <Users className="h-8 w-8 text-purple-600" />
        </div>
        <h2 className="mb-2 text-2xl font-bold text-slate-900">关注你感兴趣的创作者</h2>
        <p className="text-slate-500">
          关注他们后，他们的新内容会出现在你的关注流中
        </p>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-slate-500">
          已选择 <span className="font-semibold text-brand-600">{selectedIds.size}</span> 位创作者
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing || submitting}
        >
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          换一批
        </Button>
      </div>

      <div className="space-y-3">
        {creators.map((creator) => {
          const isSelected = selectedIds.has(creator.id);
          return (
            <Card
              key={creator.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                isSelected ? "border-brand-300 bg-brand-50/50" : ""
              }`}
              onClick={() => toggleSelect(creator.id)}
            >
              <div className="flex items-center gap-3 p-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={creator.avatarUrl ?? undefined} alt={creator.nickname} />
                  <AvatarFallback>{creator.nickname.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-slate-900">{creator.nickname}</p>
                    {isSelected && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-white">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-slate-500">
                    {creator.bio || "有趣的人，值得关注"}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {formatCount(creator.followersCount)} 粉丝
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={isSelected ? "default" : "secondary"}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelect(creator.id);
                  }}
                >
                  {isSelected ? "已选择" : "选择"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-4">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={submitting}
          >
            上一步
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onSkip}
            disabled={submitting}
            className="text-slate-500 hover:text-slate-700"
          >
            跳过此步
          </Button>
        </div>
        <Button
          type="button"
          onClick={handleNext}
          disabled={submitting}
          className="min-w-[120px]"
        >
          {submitting ? "保存中..." : "下一步"}
        </Button>
      </div>
    </div>
  );
}
