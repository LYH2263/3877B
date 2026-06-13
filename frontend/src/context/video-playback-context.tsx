import { createContext, useContext, useMemo, useRef } from "react";

export interface PlaybackHandle {
  requestPlay: () => void;
  notifyPause: () => void;
  cleanup: () => void;
}

export interface PlaybackController {
  register: (id: string, onPause: () => void) => PlaybackHandle;
}

const noopHandle: PlaybackHandle = {
  requestPlay: () => {},
  notifyPause: () => {},
  cleanup: () => {},
};

const VideoPlaybackContext = createContext<PlaybackController>({
  register: () => noopHandle,
});

export function VideoPlaybackProvider({ children }: { children: React.ReactNode }) {
  const activeIdRef = useRef<string | null>(null);
  const pauseCallbacksRef = useRef<Map<string, () => void>>(new Map());

  const controller = useMemo<PlaybackController>(() => {
    const register = (id: string, onPause: () => void): PlaybackHandle => {
      pauseCallbacksRef.current.set(id, onPause);

      return {
        requestPlay: () => {
          if (activeIdRef.current && activeIdRef.current !== id) {
            const prevPause = pauseCallbacksRef.current.get(activeIdRef.current);
            prevPause?.();
          }
          activeIdRef.current = id;
        },
        notifyPause: () => {
          if (activeIdRef.current === id) {
            activeIdRef.current = null;
          }
        },
        cleanup: () => {
          pauseCallbacksRef.current.delete(id);
          if (activeIdRef.current === id) {
            activeIdRef.current = null;
          }
        },
      };
    };

    return { register };
  }, []);

  return (
    <VideoPlaybackContext.Provider value={controller}>
      {children}
    </VideoPlaybackContext.Provider>
  );
}

export function useVideoPlayback(): PlaybackController {
  return useContext(VideoPlaybackContext);
}
