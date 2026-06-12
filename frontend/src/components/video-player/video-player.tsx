import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RefreshCw,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  LoaderCircle,
} from "lucide-react";

import { useVideoPlayer } from "@/hooks/use-video-player";

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const sec = s % 60;
  const mm = m % 60;
  if (h > 0) return `${h}:${String(mm).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${mm}:${String(sec).padStart(2, "0")}`;
}

interface VideoPlayerProps {
  src: string;
  className?: string;
  autoPauseOnLeave?: boolean;
}

const CONTROLS_HIDE_DELAY = 3000;

export function VideoPlayer({ src, className, autoPauseOnLeave = true }: VideoPlayerProps) {
  const { videoRef, containerRef, state, actions, playbackRates } = useVideoPlayer(src);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [seeking, setSeeking] = useState(false);
  const [seekTime, setSeekTime] = useState(0);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const speedMenuRef = useRef<HTMLDivElement>(null);
  const isMobileRef = useRef(false);

  useEffect(() => {
    isMobileRef.current = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  }, []);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (state.playing && !seeking && !speedMenuOpen) {
      hideTimerRef.current = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_DELAY);
    }
  }, [state.playing, seeking, speedMenuOpen]);

  const hideControls = useCallback(() => {
    if (state.playing && !seeking && !speedMenuOpen) {
      hideTimerRef.current = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_DELAY);
    }
  }, [state.playing, seeking, speedMenuOpen]);

  useEffect(() => {
    if (!state.playing) {
      setControlsVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    }
  }, [state.playing]);

  useEffect(() => {
    if (seeking || speedMenuOpen) {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setControlsVisible(true);
    }
  }, [seeking, speedMenuOpen]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (speedMenuRef.current && !speedMenuRef.current.contains(e.target as Node)) {
        setSpeedMenuOpen(false);
      }
    }
    if (speedMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [speedMenuOpen]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !autoPauseOnLeave) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting && state.playing) {
            videoRef.current?.pause();
          }
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [autoPauseOnLeave, state.playing, containerRef, videoRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          actions.togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          actions.seekDelta(-5);
          break;
        case "ArrowRight":
          e.preventDefault();
          actions.seekDelta(5);
          break;
        case "ArrowUp":
          e.preventDefault();
          actions.setVolume(state.volume + 0.1);
          break;
        case "ArrowDown":
          e.preventDefault();
          actions.setVolume(state.volume - 0.1);
          break;
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [containerRef, actions, state.volume]);

  const getProgressRatio = useCallback(
    (clientX: number) => {
      const bar = progressRef.current;
      if (!bar) return 0;
      const rect = bar.getBoundingClientRect();
      return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    },
    [],
  );

  const handleProgressMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const ratio = getProgressRatio(e.clientX);
      const time = ratio * state.duration;
      setSeeking(true);
      setSeekTime(time);
    },
    [getProgressRatio, state.duration],
  );

  useEffect(() => {
    if (!seeking) return;

    const onMouseMove = (e: MouseEvent) => {
      const ratio = getProgressRatio(e.clientX);
      setSeekTime(ratio * state.duration);
    };

    const onMouseUp = (e: MouseEvent) => {
      const ratio = getProgressRatio(e.clientX);
      const time = ratio * state.duration;
      actions.seek(time);
      setSeeking(false);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [seeking, getProgressRatio, state.duration, actions]);

  const handleProgressTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      const ratio = getProgressRatio(touch.clientX);
      const time = ratio * state.duration;
      setSeeking(true);
      setSeekTime(time);
    },
    [getProgressRatio, state.duration],
  );

  useEffect(() => {
    if (!seeking) return;

    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      const ratio = getProgressRatio(touch.clientX);
      setSeekTime(ratio * state.duration);
    };

    const onTouchEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      const ratio = getProgressRatio(touch.clientX);
      const time = ratio * state.duration;
      actions.seek(time);
      setSeeking(false);
    };

    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [seeking, getProgressRatio, state.duration, actions]);

  const displayTime = seeking ? seekTime : state.currentTime;
  const progressPercent = state.duration > 0 ? (displayTime / state.duration) * 100 : 0;
  const bufferPercent = state.duration > 0 ? (state.bufferedEnd / state.duration) * 100 : 0;

  const handleCoverClick = useCallback(() => {
    if (!state.hasStarted) {
      actions.togglePlay();
    } else {
      actions.togglePlay();
    }
  }, [actions, state.hasStarted]);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className={`vp-container group relative overflow-hidden rounded-xl border border-slate-200 bg-black outline-none ${className ?? ""}`}
      onMouseMove={showControls}
      onMouseLeave={hideControls}
      role="application"
      aria-label="视频播放器"
    >
      <video
        ref={videoRef}
        className="max-h-[420px] w-full bg-black"
        preload="metadata"
        playsInline
        onClick={handleCoverClick}
      />

      {!state.hasStarted && !state.error && (
        <div
          className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/30"
          onClick={handleCoverClick}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 shadow-lg transition-transform hover:scale-105">
            <Play className="h-7 w-7 fill-brand-600 text-brand-600 ml-1" />
          </div>
        </div>
      )}

      {state.loading && state.hasStarted && !state.error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <LoaderCircle className="h-10 w-10 animate-spin text-white/80" />
        </div>
      )}

      {state.error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="max-w-[80%] text-center text-sm text-slate-200">{state.error}</p>
          <button
            type="button"
            onClick={actions.retry}
            className="flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-sm text-white transition hover:bg-white/30"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            重试
          </button>
        </div>
      )}

      <div
        className={`vp-controls absolute right-0 bottom-0 left-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-3 pb-2 pt-8 transition-opacity duration-200 ${controlsVisible || !state.playing ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        <div
          ref={progressRef}
          className="vp-progress-bar relative mb-2 h-1.5 cursor-pointer rounded-full bg-white/25 transition-[height] hover:h-2.5"
          onMouseDown={handleProgressMouseDown}
          onTouchStart={handleProgressTouchStart}
          role="slider"
          aria-label="视频进度"
          aria-valuemin={0}
          aria-valuemax={state.duration}
          aria-valuenow={displayTime}
        >
          <div
            className="vp-buffer absolute top-0 left-0 h-full rounded-full bg-white/30"
            style={{ width: `${bufferPercent}%` }}
          />
          <div
            className="vp-progress absolute top-0 left-0 h-full rounded-full bg-brand-500"
            style={{ width: `${progressPercent}%` }}
          />
          <div
            className="vp-thumb absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand-500 shadow-md opacity-0 transition-opacity group-hover:opacity-100"
            style={{ left: `${progressPercent}%` }}
          />
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="vp-btn"
            onClick={actions.togglePlay}
            aria-label={state.playing ? "暂停" : "播放"}
          >
            {state.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>

          <button type="button" className="vp-btn" onClick={() => actions.seekDelta(-5)} aria-label="快退5秒">
            <SkipBack className="h-3.5 w-3.5" />
          </button>

          <button type="button" className="vp-btn" onClick={() => actions.seekDelta(5)} aria-label="快进5秒">
            <SkipForward className="h-3.5 w-3.5" />
          </button>

          <span className="mx-1 select-none text-xs tabular-nums text-white/90">
            {formatTime(displayTime)} / {formatTime(state.duration)}
          </span>

          <div className="flex-auto" />

          <div className="group/vol relative flex items-center">
            <button
              type="button"
              className="vp-btn"
              onClick={actions.toggleMute}
              aria-label={state.muted ? "取消静音" : "静音"}
            >
              {state.muted || state.volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={state.muted ? 0 : state.volume}
              onChange={(e) => actions.setVolume(Number(e.target.value))}
              className="vp-volume-slider ml-1 hidden w-16 group-hover/vol:block"
              aria-label="音量"
            />
          </div>

          <div ref={speedMenuRef} className="relative">
            <button
              type="button"
              className="vp-btn text-xs font-medium"
              onClick={() => setSpeedMenuOpen((v) => !v)}
              aria-label="播放速度"
            >
              {state.playbackRate}x
            </button>
            {speedMenuOpen && (
              <div className="absolute right-0 bottom-full mb-2 min-w-[80px] rounded-lg border border-white/10 bg-black/85 py-1 shadow-xl backdrop-blur">
                {playbackRates.map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    className={`block w-full px-3 py-1 text-left text-xs transition hover:bg-white/10 ${state.playbackRate === rate ? "text-brand-400" : "text-white/80"}`}
                    onClick={() => {
                      actions.setPlaybackRate(rate);
                      setSpeedMenuOpen(false);
                    }}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            className="vp-btn hidden sm:block"
            onClick={actions.togglePiP}
            aria-label="画中画"
          >
            <PictureInPicture2 className="h-4 w-4" />
          </button>

          <button
            type="button"
            className="vp-btn"
            onClick={actions.toggleFullscreen}
            aria-label={state.fullscreen ? "退出全屏" : "全屏"}
          >
            {state.fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
