import { createContext, useCallback, useContext, useRef } from "react";

type PlaybackRegistrar = (id: string) => () => void;

const VideoPlaybackContext = createContext<PlaybackRegistrar>(() => () => {});

export function VideoPlaybackProvider({ children }: { children: React.ReactNode }) {
  const activeIdRef = useRef<string | null>(null);
  const pauseCallbacksRef = useRef<Map<string, () => void>>(new Map());

  const register = useCallback((id: string) => {
    pauseCallbacksRef.current.set(id, () => {});

    return (onPause: () => void) => {
      pauseCallbacksRef.current.set(id, onPause);

      return () => {
        pauseCallbacksRef.current.delete(id);
        if (activeIdRef.current === id) {
          activeIdRef.current = null;
        }
      };
    };
  }, []);

  const requestPlay = useCallback(
    (id: string) => {
      if (activeIdRef.current && activeIdRef.current !== id) {
        const prevPause = pauseCallbacksRef.current.get(activeIdRef.current);
        prevPause?.();
      }
      activeIdRef.current = id;
    },
    [],
  );

  const notifyPause = useCallback((id: string) => {
    if (activeIdRef.current === id) {
      activeIdRef.current = null;
    }
  }, []);

  const contextValue = useCallback<PlaybackRegistrar>(
    (id: string) => {
      const setPauseCallback = register(id);
      return (onPause: () => void) => {
        const cleanup = setPauseCallback(onPause);
        return {
          requestPlay: () => requestPlay(id),
          notifyPause: () => notifyPause(id),
          cleanup,
        };
      };
    },
    [register, requestPlay, notifyPause],
  );

  return (
    <VideoPlaybackContext.Provider value={contextValue}>
      {children}
    </VideoPlaybackContext.Provider>
  );
}

export function useVideoPlayback(id: string) {
  const registrar = useContext(VideoPlaybackContext);
  return registrar(id);
}
