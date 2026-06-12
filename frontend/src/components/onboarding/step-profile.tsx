import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { User, AtSign } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { updateOnboardingProfile, type UpdateProfileInput } from "@/api/onboarding";
import { useAuth } from "@/context/auth-context";
import { toast } from "sonner";

const profileSchema = z.object({
  nickname: z.string().min(2, "昵称至少 2 个字符").max(20, "昵称最多 20 个字符"),
  bio: z.string().max(200, "简介最多 200 个字符").optional()
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface StepProfileProps {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export function StepProfile({ onNext, onBack, onSkip }: StepProfileProps) {
  const { user, refreshMe } = useAuth();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      nickname: user?.nickname || "",
      bio: user?.bio || ""
    }
  });

  const currentNickname = watch("nickname");
  const currentBio = watch("bio");
  const bioLength = currentBio?.length || 0;

  const onSubmit = async (values: ProfileFormValues) => {
    try {
      const input: UpdateProfileInput = {
        nickname: values.nickname,
        bio: values.bio
      };
      await updateOnboardingProfile(input);
      await refreshMe();
      toast.success("个人资料已更新");
      onNext();
    } catch (error) {
      // error handled globally
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-emerald-200">
          <User className="h-8 w-8 text-emerald-600" />
        </div>
        <h2 className="mb-2 text-2xl font-bold text-slate-900">完善你的个人资料</h2>
        <p className="text-slate-500">
          让其他用户更好地了解你
        </p>
      </div>

      <div className="flex flex-col items-center gap-4 py-4">
        <Avatar className="h-20 w-20">
          <AvatarImage src={user?.avatarUrl ?? undefined} alt={currentNickname || user?.nickname || "用户"} />
          <AvatarFallback className="text-lg">
            {(currentNickname || user?.nickname || "用").slice(0, 1)}
          </AvatarFallback>
        </Avatar>
        <div className="text-center">
          <p className="font-medium text-slate-900">{currentNickname || user?.nickname || "新用户"}</p>
          <p className="text-sm text-slate-500">
            {currentBio || user?.bio || "这个人很懒，还没有留下简介"}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="nickname">
            <AtSign className="mr-1 inline h-3.5 w-3.5 text-slate-400" />
            昵称
          </Label>
          <Input
            id="nickname"
            placeholder="请输入你的昵称"
            maxLength={20}
            invalid={Boolean(errors.nickname)}
            {...register("nickname")}
          />
          {errors.nickname && (
            <p className="text-xs text-red-500">{errors.nickname.message}</p>
          )}
          <p className="text-right text-xs text-slate-400">
            {currentNickname?.length || 0}/20
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio">个人简介</Label>
          <Textarea
            id="bio"
            placeholder="介绍一下你自己吧，让大家认识你..."
            maxLength={200}
            rows={4}
            invalid={Boolean(errors.bio)}
            {...register("bio")}
          />
          {errors.bio && (
            <p className="text-xs text-red-500">{errors.bio.message}</p>
          )}
          <p className="text-right text-xs text-slate-400">
            {bioLength}/200
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={isSubmitting}
          >
            上一步
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onSkip}
            disabled={isSubmitting}
            className="text-slate-500 hover:text-slate-700"
          >
            跳过此步
          </Button>
        </div>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="min-w-[120px]"
        >
          {isSubmitting ? "保存中..." : "完成"}
        </Button>
      </div>
    </form>
  );
}
