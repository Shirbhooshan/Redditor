import { X, ChevronLeft, ChevronRight, Play, Pause, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { MediaItem } from "./MediaGrid";

interface MediaLightboxProps {
  media: MediaItem;
  allMedia: MediaItem[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (s: number) => {
  if (!isFinite(s) || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

// ── Shared scrub bar ──────────────────────────────────────────────────────────
const ScrubBar = ({ current, duration, onChange }: { current: number; duration: number; onChange: (t: number) => void }) => {
  const pct = duration > 0 ? (current / duration) * 100 : 0;
  return (
    <input
      type="range"
      min={0}
      max={duration || 1}
      step={0.001}
      value={current}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      onClick={(e) => e.stopPropagation()}
      className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
      style={{
        background: `linear-gradient(to right, #f97316 ${pct}%, rgba(255,255,255,0.2) ${pct}%)`,
        accentColor: "#f97316",
      }}
    />
  );
};

// ── Volume control ────────────────────────────────────────────────────────────
const VolumeControl = ({
  volume, muted, onVolumeChange, onToggleMute,
}: { volume: number; muted: boolean; onVolumeChange: (v: number) => void; onToggleMute: () => void }) => {
  const pct = (muted ? 0 : volume) * 100;
  return (
    <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
      <button onClick={onToggleMute} className="text-white/80 hover:text-white transition-colors">
        {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>
      <input
        type="range" min={0} max={1} step={0.01} value={muted ? 0 : volume}
        onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
        className="w-20 h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, #f97316 ${pct}%, rgba(255,255,255,0.2) ${pct}%)`,
          accentColor: "#f97316",
        }}
      />
    </div>
  );
};

// ── GIF player — muted autoplay MP4 + frame scrubber ─────────────────────────
const GifPlayer = ({ src }: { src: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onMeta = () => { setDuration(v.duration); setLoaded(true); };
    const onTime = () => setCurrentTime(v.currentTime);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => {
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, [src]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play() : v.pause();
  };

  const fps = 25;
  const totalFrames = duration > 0 ? Math.round(duration * fps) : 0;
  const currentFrame = Math.round(currentTime * fps);

  return (
    <div className="flex flex-col items-center gap-3" style={{ maxWidth: "90vw" }}>
      <video
        ref={videoRef}
        src={src}
        autoPlay loop muted playsInline
        className="rounded-lg object-contain"
        style={{ maxHeight: "75vh", maxWidth: "90vw" }}
      />
      {loaded && (
        <div className="w-full bg-black/70 rounded-xl px-4 py-3 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
          <ScrubBar current={currentTime} duration={duration} onChange={(t) => { if (videoRef.current) videoRef.current.currentTime = t; }} />
          <div className="flex items-center justify-between">
            <button onClick={togglePlay} className="text-white hover:text-orange-400 transition-colors">
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            <span className="text-white/50 text-xs font-mono">frame {currentFrame} / {totalFrames}</span>
            <span className="text-white/50 text-xs font-mono">{fmt(currentTime)} / {fmt(duration)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Video player — custom controls, synced separate audio track ───────────────
const VideoPlayer = ({ src, audioSrc, hasAudio }: { src: string; audioSrc?: string; hasAudio?: boolean }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [audioFailed, setAudioFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Video events + autoplay
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onMeta = () => { setDuration(v.duration); setLoaded(true); };
    const onTime = () => setCurrentTime(v.currentTime);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    // Autoplay
    v.play().catch(() => {});
    return () => {
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, [src]);

  // Audio loading with fallback URLs
  useEffect(() => {
    if (!audioSrc || !audioRef.current) return;
    const a = audioRef.current;
    const tryUrl = (url: string) => { a.src = url; a.load(); };
    const onLoad = () => setAudioReady(true);
    const onError = () => {
      if (a.src.includes("DASH_audio.mp4")) tryUrl(a.src.replace("DASH_audio.mp4", "DASH_AUDIO_128.mp4"));
      else if (a.src.includes("DASH_AUDIO_128.mp4")) tryUrl(a.src.replace("DASH_AUDIO_128.mp4", "audio"));
      else setAudioFailed(true);
    };
    a.addEventListener("loadeddata", onLoad);
    a.addEventListener("error", onError);
    a.load();
    return () => { a.removeEventListener("loadeddata", onLoad); a.removeEventListener("error", onError); };
  }, [audioSrc]);

  // Sync video ↔ separate audio track
  useEffect(() => {
    const v = videoRef.current;
    const a = audioRef.current;
    if (!v || !a || !audioReady) return;
    const syncPlay = () => { if (v.paused) a.pause(); else a.play().catch(() => {}); };
    const syncTime = () => { if (Math.abs(v.currentTime - a.currentTime) > 0.3) a.currentTime = v.currentTime; };
    v.addEventListener("play", syncPlay);
    v.addEventListener("pause", syncPlay);
    v.addEventListener("timeupdate", syncTime);
    v.addEventListener("seeked", syncTime);
    return () => {
      v.removeEventListener("play", syncPlay);
      v.removeEventListener("pause", syncPlay);
      v.removeEventListener("timeupdate", syncTime);
      v.removeEventListener("seeked", syncTime);
    };
  }, [audioReady]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play() : v.pause();
  };

  const handleSeek = (t: number) => {
    if (videoRef.current) videoRef.current.currentTime = t;
    if (audioRef.current) audioRef.current.currentTime = t;
    setCurrentTime(t);
  };

  const handleVolumeChange = (val: number) => {
    setVolume(val);
    setMuted(val === 0);
    // If there's a separate audio track, volume goes there; otherwise to video
    if (audioSrc) {
      if (audioRef.current) { audioRef.current.volume = val; audioRef.current.muted = false; }
      if (videoRef.current) videoRef.current.muted = true; // video track stays muted
    } else {
      if (videoRef.current) { videoRef.current.volume = val; videoRef.current.muted = val === 0; }
    }
  };

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    if (audioSrc) {
      if (audioRef.current) audioRef.current.muted = next;
    } else {
      if (videoRef.current) videoRef.current.muted = next;
    }
  };

  return (
    <div className="flex flex-col items-center gap-3" style={{ maxWidth: "90vw" }}>
      {/* Video is always muted at element level when separate audio track exists */}
      <video
        ref={videoRef}
        src={src}
        muted={!!audioSrc}
        loop
        playsInline
        className="rounded-lg object-contain"
        style={{ maxHeight: "75vh", maxWidth: "90vw" }}
      />
      {audioSrc && <audio ref={audioRef} src={audioSrc} loop preload="auto" />}

      {loaded && (
        <div className="w-full bg-black/70 rounded-xl px-4 py-3 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
          {/* Scrub bar */}
          <ScrubBar current={currentTime} duration={duration} onChange={handleSeek} />

          {/* Controls row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button onClick={togglePlay} className="text-white hover:text-orange-400 transition-colors">
                {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </button>
              <span className="text-white/60 text-xs font-mono">{fmt(currentTime)} / {fmt(duration)}</span>
            </div>
            <VolumeControl volume={volume} muted={muted} onVolumeChange={handleVolumeChange} onToggleMute={handleToggleMute} />
          </div>

          {/* Audio status messages */}
          {hasAudio && audioFailed && (
            <p className="text-yellow-400/70 text-xs text-center">⚠️ Audio track unavailable</p>
          )}
          {hasAudio && !audioFailed && !audioReady && audioSrc && (
            <p className="text-white/40 text-xs text-center">Loading audio…</p>
          )}
        </div>
      )}
    </div>
  );
};

// ── Main lightbox ─────────────────────────────────────────────────────────────
const MediaLightbox = ({ media, allMedia, currentIndex, onClose, onNavigate }: MediaLightboxProps) => {
  const [imgSrc, setImgSrc] = useState(media.url);
  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < allMedia.length - 1;

  useEffect(() => { setImgSrc(media.url); }, [media.url]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && canGoPrevious) onNavigate(currentIndex - 1);
      else if (e.key === "ArrowRight" && canGoNext) onNavigate(currentIndex + 1);
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "unset";
    };
  }, [onClose, onNavigate, currentIndex, canGoPrevious, canGoNext]);

  const handleImgError = useCallback(() => {
    if (!imgSrc.includes("media-proxy")) {
      setImgSrc(`/.netlify/functions/media-proxy?url=${encodeURIComponent(media.url)}`);
    }
  }, [imgSrc, media.url]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 rounded-full bg-white/10 p-2 hover:bg-white/20 transition-colors z-10"
        aria-label="Close"
      >
        <X className="h-6 w-6 text-white" />
      </button>

      {/* Previous */}
      {canGoPrevious && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate(currentIndex - 1); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 hover:bg-white/20 transition-colors z-10"
          aria-label="Previous"
        >
          <ChevronLeft className="h-8 w-8 text-white" />
        </button>
      )}

      {/* Next */}
      {canGoNext && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate(currentIndex + 1); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 hover:bg-white/20 transition-colors z-10"
          aria-label="Next"
        >
          <ChevronRight className="h-8 w-8 text-white" />
        </button>
      )}

      {/* Media content — stopPropagation so clicking media doesn't close */}
      <div
        className="relative flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {media.type === "video" && media.isGif ? (
          <GifPlayer src={media.url} />
        ) : media.type === "video" ? (
          <VideoPlayer src={media.url} audioSrc={media.audioUrl} hasAudio={media.hasAudio} />
        ) : (
          <img
            src={imgSrc}
            alt="Reddit media"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onError={handleImgError}
          />
        )}

        {/* Counter badge */}
        <div className="absolute top-4 right-4 bg-black/70 text-white text-sm px-3 py-2 rounded pointer-events-none">
          {currentIndex + 1} / {allMedia.length}
        </div>
      </div>
    </div>
  );
};

export default MediaLightbox;
