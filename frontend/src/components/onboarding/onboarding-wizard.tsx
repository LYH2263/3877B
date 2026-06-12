import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, PartyPopper } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";
import { StepTopics } from "@/components/onboarding/step-topics";
import { StepCreators } from "@/components/onboarding/step-creators";
import { StepProfile } from "@/components/onboarding/step-profile";
import {
  completeOnboarding,
  fetchOnboardingStatus,
  updateOnboardingStep
} from "@/api/onboarding";
import { useAuth } from "@/context/auth-context";
import { toast } from "sonner";

const STEP_LABELS = ["兴趣话题", "关注创作者", "完善资料", "完成"];
const TOTAL_STEPS = 3;

interface OnboardingWizardProps {
  onClose?: () => void;
}

export function OnboardingWizard({ onClose }: OnboardingWizardProps) {
  const navigate = useNavigate();
  const { user, refreshMe } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [initialTopics, setInitialTopics] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadStatus() {
      try {
        const status = await fetchOnboardingStatus();
        if (mounted) {
          if (status.completed) {
            onClose?.();
            return;
          }
          setCurrentStep(Math.min(status.currentStep, TOTAL_STEPS - 1));
          setInitialTopics(status.interests);
        }
      } catch (error) {
        toast.error("加载引导状态失败，请稍后重试");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadStatus();

    return () => {
      mounted = false;
    };
  }, [onClose]);

  const saveStepToBackend = useCallback(async (step: number) => {
    try {
      await updateOnboardingStep(step);
    } catch {
      // ignore step save errors
    }
  }, []);

  const goToNext = useCallback(async () => {
    const nextStep = currentStep + 1;
    if (nextStep >= TOTAL_STEPS) {
      await handleComplete(false);
      return;
    }
    setCurrentStep(nextStep);
    await saveStepToBackend(nextStep);
  }, [currentStep, saveStepToBackend]);

  const goToPrev = useCallback(async () => {
    const prevStep = Math.max(0, currentStep - 1);
    setCurrentStep(prevStep);
    await saveStepToBackend(prevStep);
  }, [currentStep, saveStepToBackend]);

  const handleSkip = useCallback(async () => {
    const nextStep = currentStep + 1;
    if (nextStep >= TOTAL_STEPS) {
      await handleComplete(true);
      return;
    }
    setCurrentStep(nextStep);
    await saveStepToBackend(nextStep);
    toast.info("已跳过当前步骤");
  }, [currentStep, saveStepToBackend]);

  const handleComplete = useCallback(async (skipped: boolean) => {
    setCompleting(true);
    try {
      const result = await completeOnboarding(skipped);
      await refreshMe();
      setShowCompletion(true);
      setTimeout(() => {
        toast.success(skipped ? "已跳过引导" : "欢迎加入！开始探索吧");
        onClose?.();
        navigate("/", { replace: true });
      }, 2000);
    } catch (error) {
      // error handled globally
    } finally {
      setCompleting(false);
    }
  }, [navigate, onClose, refreshMe]);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
        <Card className="w-full max-w-lg">
          <CardContent className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand-500" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showCompletion) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
        <Card className="w-full max-w-lg animate-fade-in">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-brand-200">
              <PartyPopper className="h-10 w-10 text-brand-600" />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-slate-900">设置完成！</h2>
            <p className="text-slate-500">正在为你准备个性化内容...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <Card className="w-full max-w-lg overflow-hidden">
        <CardContent className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-slate-900">欢迎，{user?.nickname || "新朋友"}</h1>
              <p className="text-sm text-slate-500">完成设置，获得更好的体验</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClose}
              disabled={completing}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <OnboardingProgress
            currentStep={currentStep}
            totalSteps={TOTAL_STEPS}
            steps={STEP_LABELS}
          />

          <div className="min-h-[400px]">
            {currentStep === 0 && (
              <StepTopics
                initialTopics={initialTopics}
                onNext={goToNext}
                onSkip={handleSkip}
              />
            )}
            {currentStep === 1 && (
              <StepCreators
                onNext={goToNext}
                onBack={goToPrev}
                onSkip={handleSkip}
              />
            )}
            {currentStep === 2 && (
              <StepProfile
                onNext={goToNext}
                onBack={goToPrev}
                onSkip={handleSkip}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
