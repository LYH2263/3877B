import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";

import { useVideoPlayback } from "@/context/video-playback-context";

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
const THROTTLE_MS = 250;

function throttle<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const throttled = ((...args: Parameters<T>) => {
    const now = Date.now();
    const delta = now - last;
    if (delta >= ms) {
      last = now;
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now();
        timer = null;
        fn(...args);
      }, ms - delta);
    }
  }) as T;
  return throttled;
}

function getBufferedEnd(video: HTMLVideoElement): number {
  if (!video.buffered.length) return 0;
  return video.buffered.end(video.buffered.length - 1);
}

function requestFullscreen(el: HTMLElement): Promise<void> {
  if (el.requestFullscreen) return el.requestFullscreen();
  if ((el as HTMLVideoElement).webkitEnterFullscreen) {
    (el as HTMLVideoElement).webkitEnterFullscreen();
    return Promise.resolve();
  }
  if ((el as unknown as { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen) {
    return (el as unknown as { webkitRequestFullscreen: () => Promise<void> }).webkitRequestFullscreen();
  }
  return Promise.reject(new Error("Fullscreen not supported"));
}

function exitFullscreen(): Promise<void> {
  if (document.exitFullscreen) return document.exitFullscreen();
  if ((document as unknown as { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen) {
    return (document as unknown as { webkitExitFullscreen: () => Promise<void> }).webkitExitFullscreen();
  }
  return Promise.reject(new Error("Exit fullscreen not supported"));
}

function isFullscreenActive(container: HTMLElement): boolean {
  if (document.fullscreenElement) return document.fullscreenElement === container;
  if ((document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement) {
    return (document as unknown as { webkitFullscreenElement: Element }).webkitFullscreenElement === container;
  }
  if ((container as HTMLVideoElement).webkitDisplayingFullscreen) {
    return (container as HTMLVideoElement).webkitDisplayingFullscreen;
  }
  return false;
}

async function requestPiP(video: HTMLVideoElement): Promise<void> {
  if (video.requestPictureInPicture) return video.requestPictureInPicture();
  if ((video as unknown as { webkitSetPresentationMode?: (mode: string) => boolean }).webkitSetPresentationMode) {
    (video as unknown as { webkitSetPresentationMode: (mode: string) => boolean }).webkitSetPresentationMode("picture-in-picture");
    return;
  }
  throw new Error("Picture-in-Picture not supported");
}

async function exitPiP(): Promise<void> {
  if (document.pictureInPictureElement && document.exitPictureInPicture) {
    return document.exitPictureInPicture();
  }
}

function supportsPiP(video: HTMLVideoElement): boolean {
  return !!video.requestPictureInPicture || !!(video as unknown as { webkitSetPresentationMode?: (mode: string) => boolean }).webkitSetPresentationMode;
}

export interface VideoPlayerState {
  playing: boolean;
  currentTime: number;
  duration: number;
  bufferedEnd: number;
  volume: number;
  muted: boolean;
  playbackRate: number;
  fullscreen: boolean;
  pip: boolean;
  loading: boolean;
  error: string | null;
  hasStarted: boolean;
}

export interface VideoPlayerActions {
  togglePlay: () => void;
  seek: (time: number) => void;
  seekDelta: (delta: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  setPlaybackRate: (rate: number) => void;
  cyclePlaybackRate: () => void;
  toggleFullscreen: () => void;
  togglePiP: () => void;
  retry: () => void;
}

export interface UseVideoPlayerReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  state: VideoPlayerState;
  actions: VideoPlayerActions;
  playbackRates: number[];
}

export function useVideoPlayer(src: string): UseVideoPlayerReturn {
  const videoRef = useRef<HTMLVideoElement>(null!);
  const containerRef = useRef<HTMLDivElement>(null!);
  const reactId = useId();
  const instanceId = useMemo(() => `vp-${reactId.replace(/:/g, "")}`, [reactId]);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [pip, setPip] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  const registerPlayback = useVideoPlayback(instanceId);
  const playbackHandleRef = useRef<{ requestPlay: () => void; notifyPause: () => void; cleanup: () => void } | null>(null);

  const throttledTimeUpdate = useMemo(
    () =>
      throttle((time: number) => setCurrentTime(time), THROTTLE_MS),
    [],
  );

  const throttledBufferUpdate = useMemo(
    () =>
      throttle((end: number) => setBufferedEnd(end), THROTTLE_MS),
    [],
  );

  useLayoutEffect(() => {
    const init = registerPlayback(() => {
      videoRef.current?.pause();
      setPlaying(false);
    });
    playbackHandleRef.current = init(() => {
      videoRef.current?.pause();
      setPlaying(false);
    });
    return () => {
      playbackHandleRef.current?.cleanup();
    };
  }, [registerPlayback]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onLoadedMetadata = () => {
      setDuration(video.duration);
      setLoading(false);
    };

    const onTimeUpdate = () => {
      throttledTimeUpdate(video.currentTime);
    };

    const onProgress = () => {
      throttledBufferUpdate(getBufferedEnd(video));
    };

    const onPlay = () => {
      setPlaying(true);
      playbackHandleRef.current?.requestPlay();
    };

    const onPause = () => {
      setPlaying(false);
      playbackHandleRef.current?.notifyPause();
    };

    const onEnded = () => {
      setPlaying(false);
      playbackHandleRef.current?.notifyPause();
    };

    const onWaiting = () => setLoading(true);
    const onCanPlay = () => setLoading(false);
    const onPlaying = () => setLoading(false);

    const onError = () => {
      const mediaError = video.error;
      const msg = mediaError
        ? mediaError.code === mediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
          ? "视频格式不支持"
          : mediaError.code === mediaError.MEDIA_ERR_NETWORK
            ? "网络加载失败"
            : mediaError.code === mediaError.MEDIA_ERR_DECODE
              ? "视频解码失败"
              : "播放出错"
        : "播放出错";
      setError(msg);
      setLoading(false);
    };

    const onVolumeChange = () => {
      setVolumeState(video.volume);
      setMuted(video.muted);
    };

    const onRateChange = () => {
      setPlaybackRate(video.playbackRate);
    };

    const onEnterPiP = () => setPip(true);
    const onLeavePiP = () => setPip(false);

    const onFullscreenChange = () => {
      setFullscreen(isFullscreenActive(containerRef.current));
    };

    const onSafariPresentationModeChanged = () => {
      const mode = (video as unknown as { webkitPresentationMode?: string }).webkitPresentationMode;
      setPip(mode === "picture-in-picture");
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("progress", onProgress);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("error", onError);
    video.addEventListener("volumechange", onVolumeChange);
    video.addEventListener("ratechange", onRateChange);
    video.addEventListener("enterpictureinpicture", onEnterPiP);
    video.addEventListener("leavepictureinpicture", onLeavePiP);
    video.addEventListener("webkitpresentationmodechanged", onSafariPresentationModeChanged);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("error", onError);
      video.removeEventListener("volumechange", onVolumeChange);
      video.removeEventListener("ratechange", onRateChange);
      video.removeEventListener("enterpictureinpicture", onEnterPiP);
      video.removeEventListener("leavepictureinpicture", onLeavePiP);
      video.removeEventListener("webkitpresentationmodechanged", onSafariPresentationModeChanged);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
    };
  }, [throttledTimeUpdate, throttledBufferUpdate]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.src !== src) {
      video.src = src;
      video.load();
      setError(null);
      setLoading(true);
      setHasStarted(false);
      setPlaying(false);
      setCurrentTime(0);
      setBufferedEnd(0);
      setDuration(0);
    }
  }, [src]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || error) return;
    if (video.paused) {
      video.play().catch(() => {});
      setHasStarted(true);
    } else {
      video.pause();
    }
  }, [error]);

  const seek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video || !isFinite(time)) return;
    video.currentTime = Math.max(0, Math.min(time, video.duration || 0));
  }, []);

  const seekDelta = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    seek(video.currentTime + delta);
  }, [seek]);

  const setVolume = useCallback((v: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.max(0, Math.min(1, v));
    video.volume = clamped;
    video.muted = clamped === 0;
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  }, []);

  const setPlaybackRateAction = useCallback((rate: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
  }, []);

  const cyclePlaybackRate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const idx = PLAYBACK_RATES.indexOf(video.playbackRate);
    const next = PLAYBACK_RATES[(idx + 1) % PLAYBACK_RATES.length];
    video.playbackRate = next;
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (fullscreen) {
      exitFullscreen().catch(() => {});
    } else {
      requestFullscreen(containerRef.current).catch(() => {
        requestFullscreen(videoRef.current).catch(() => {});
      });
    }
  }, [fullscreen]);

  const togglePiP = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (pip) {
      exitPiP().catch(() => {});
      const modeSetter = (video as unknown as { webkitSetPresentationMode?: (mode: string) => boolean }).webkitSetPresentationMode;
      if (modeSetter) modeSetter("inline");
    } else {
      requestPiP(video).catch(() => {});
    }
  }, [pip]);

  const retry = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setError(null);
    setLoading(true);
    video.load();
  }, []);

  const state: VideoPlayerState = useMemo(
    () => ({
      playing,
      currentTime,
      duration,
      bufferedEnd,
      volume,
      muted,
      playbackRate,
      fullscreen,
      pip,
      loading,
      error,
      hasStarted,
    }),
    [playing, currentTime, duration, bufferedEnd, volume, muted, playbackRate, fullscreen, pip, loading, error, hasStarted],
  );

  const actions: VideoPlayerActions = useMemo(
    () => ({
      togglePlay,
      seek,
      seekDelta,
      setVolume,
      toggleMute,
      setPlaybackRate: setPlaybackRateAction,
      cyclePlaybackRate,
      toggleFullscreen,
      togglePiP,
      retry,
    }),
    [togglePlay, seek, seekDelta, setVolume, toggleMute, setPlaybackRateAction, cyclePlaybackRate, toggleFullscreen, togglePiP, retry],
  );

  return {
    videoRef,
    containerRef,
    state,
    actions,
    playbackRates: PLAYBACK_RATES,
  };
}
