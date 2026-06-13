import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "search_history";
const MAX_ITEMS = 20;

function readHistory(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function writeHistory(items: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
}

let listeners: Array<() => void> = [];

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): string[] {
  return readHistory();
}

function getServerSnapshot(): string[] {
  return [];
}

export function useSearchHistory() {
  const history = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const add = useCallback((keyword: string) => {
    const trimmed = keyword.trim();
    if (!trimmed) return;
    const current = readHistory();
    const filtered = current.filter((item) => item !== trimmed);
    const next = [trimmed, ...filtered].slice(0, MAX_ITEMS);
    writeHistory(next);
  }, []);

  const remove = useCallback((keyword: string) => {
    const current = readHistory();
    writeHistory(current.filter((item) => item !== keyword));
  }, []);

  const clear = useCallback(() => {
    writeHistory([]);
  }, []);

  return { history, add, remove, clear };
}
