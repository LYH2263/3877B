import { useCallback, useEffect, useState } from "react";

import { fetchOnboardingStatus, type OnboardingStatus } from "@/api/onboarding";
import { useAuth } from "@/context/auth-context";

const ONBOARDING_LOCAL_KEY = "onboarding_dismissed";

export function useOnboarding() {
  const { user, loading: authLoading } = useAuth();
  const [showWizard, setShowWizard] = useState(false);
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [checking, setChecking] = useState(false);

  const shouldShow = useCallback(async () => {
    if (!user) return false;

    const locallyDismissed = localStorage.getItem(ONBOARDING_LOCAL_KEY);
    if (locallyDismissed === "true") return false;

    try {
      const onboardingStatus = await fetchOnboardingStatus();
      setStatus(onboardingStatus);
      return !onboardingStatus.completed;
    } catch {
      return false;
    }
  }, [user]);

  const checkAndShow = useCallback(async () => {
    if (authLoading || !user) return;

    setChecking(true);
    try {
      const should = await shouldShow();
      setShowWizard(should);
    } finally {
      setChecking(false);
    }
  }, [authLoading, user, shouldShow]);

  useEffect(() => {
    if (!authLoading && user) {
      void checkAndShow();
    }
  }, [authLoading, user, checkAndShow]);

  const closeWizard = useCallback(() => {
    setShowWizard(false);
    localStorage.setItem(ONBOARDING_LOCAL_KEY, "true");
  }, []);

  const resetAndShow = useCallback(() => {
    localStorage.removeItem(ONBOARDING_LOCAL_KEY);
    setShowWizard(true);
  }, []);

  return {
    showWizard,
    status,
    checking,
    closeWizard,
    resetAndShow,
    checkAndShow
  };
}
