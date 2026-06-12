import { useEffect, useState, useCallback } from "react";

import { fetchSensitiveWords } from "@/api/discovery";
import {
  type SensitiveWordCheckResult,
  SensitiveWordFilter,
  getSensitiveFilter,
  setGlobalSensitiveFilter
} from "@/lib/sensitive-words";

let loadingPromise: Promise<void> | null = null;

export function useSensitiveWords() {
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSensitiveWords = useCallback(async () => {
    if (loadingPromise) {
      await loadingPromise;
      return;
    }

    if (getSensitiveFilter()) {
      setIsReady(true);
      return;
    }

    setIsLoading(true);
    setError(null);

    loadingPromise = (async () => {
      try {
        const words = await fetchSensitiveWords();
        const filter = new SensitiveWordFilter(words.map((w) => ({ word: w.word, level: w.level })));
        setGlobalSensitiveFilter(filter);
        setIsReady(true);
      } catch (err) {
        setError("敏感词加载失败");
        console.warn("Failed to load sensitive words:", err);
      } finally {
        setIsLoading(false);
        loadingPromise = null;
      }
    })();

    await loadingPromise;
  }, []);

  const checkText = useCallback((text: string): SensitiveWordCheckResult | null => {
    const filter = getSensitiveFilter();
    if (!filter) {
      return null;
    }
    return filter.check(text);
  }, []);

  useEffect(() => {
    void loadSensitiveWords();
  }, [loadSensitiveWords]);

  return {
    isLoading,
    isReady,
    error,
    checkText,
    reload: loadSensitiveWords
  };
}
