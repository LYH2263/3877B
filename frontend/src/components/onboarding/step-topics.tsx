import React, { useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Hash, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchOnboardingTopics, saveInterests } from "@/api/onboarding";
import { useAuth } from "@/context/auth-context";
import { toast } from "sonner";
import type { TrendingTopic } from "@/types/models";

const MIN_SELECTED = 3;

const topicsSchema = z.object({
  topicIds: z.array(z.number()).min(MIN_SELECTED, `至少选择 ${MIN_SELECTED} 个感兴趣的话题`)
});

type TopicsFormValues = z.infer<typeof topicsSchema>;

interface StepTopicsProps {
  initialTopics: number[];
  onNext: () => void;
  onSkip: () => void;
}

export function StepTopics({ initialTopics, onNext, onSkip }: StepTopicsProps) {
  const { refreshMe } = useAuth();
  const [topics, setTopics] = React.useState<TrendingTopic[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  const {
    setValue,
    watch,
    handleSubmit,
    formState: { errors }
  } = useForm<TopicsFormValues>({
    resolver: zodResolver(topicsSchema),
    defaultValues: {
      topicIds: initialTopics
    }
  });

  const selectedIds = watch("topicIds");

  useEffect(() => {
    let mounted = true;

    async function loadTopics() {
      try {
        const data = await fetchOnboardingTopics();
        if (mounted) {
          setTopics(data);
        }
      } catch (error) {
        toast.error("加载话题失败，请稍后重试");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadTopics();

    return () => {
      mounted = false;
    };
  }, []);

  const toggleTopic = (topicId: number) => {
    const current = selectedIds || [];
    const next = current.includes(topicId)
      ? current.filter((id) => id !== topicId)
      : [...current, topicId];
    setValue("topicIds", next, { shouldDirty: true, shouldValidate: true });
  };

  const selectedCount = selectedIds?.length || 0;
  const canProceed = selectedCount >= MIN_SELECTED;

  const popularTags = useMemo(() => ["科技", "生活", "娱乐", "美食", "旅行", "摄影", "健身", "读书", "音乐", "电影"], []);

  const onSubmit = async (values: TopicsFormValues) => {
    setSubmitting(true);
    try {
      await saveInterests(values);
      await refreshMe();
      toast.success(`已选择 ${values.topicIds.length} 个兴趣话题`);
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
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-brand-200">
          <Sparkles className="h-8 w-8 text-brand-600" />
        </div>
        <h2 className="mb-2 text-2xl font-bold text-slate-900">选择你感兴趣的话题</h2>
        <p className="text-slate-500">
          我们将根据你的选择为你推荐个性化内容
        </p>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-slate-500">
          已选择 <span className={canProceed ? "text-brand-600 font-semibold" : "text-amber-600"}>{selectedCount}</span> / 至少 {MIN_SELECTED} 个
        </span>
        {errors.topicIds && (
          <span className="text-xs text-red-500">{errors.topicIds.message}</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {topics.map((topic, index) => (
          <button
            key={topic.id}
            type="button"
            onClick={() => toggleTopic(topic.id)}
            className="group relative"
          >
            <Badge
              variant={selectedIds?.includes(topic.id) ? "default" : "secondary"}
              className="cursor-pointer px-4 py-2 text-sm transition-all hover:scale-105"
            >
              <Hash className="mr-1 h-3.5 w-3.5" />
              {topic.keyword}
              {index < 3 && (
                <span className="ml-1 text-xs opacity-75">热</span>
              )}
            </Badge>
          </button>
        ))}
      </div>

      <div className="border-t border-slate-100 pt-4">
        <p className="mb-3 text-xs text-slate-400">热门分类</p>
        <div className="flex flex-wrap gap-2">
          {popularTags.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="cursor-pointer px-3 py-1.5 text-xs transition-all hover:bg-slate-100"
            >
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-4">
        <Button
          type="button"
          variant="ghost"
          onClick={onSkip}
          disabled={submitting}
          className="text-slate-500 hover:text-slate-700"
        >
          跳过此步
        </Button>
        <Button
          type="submit"
          disabled={!canProceed || submitting}
          className="min-w-[120px]"
        >
          {submitting ? "保存中..." : "下一步"}
        </Button>
      </div>
    </form>
  );
}
