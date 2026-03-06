import { X, ChevronLeft, ChevronRight, Play, Pause } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { MediaItem } from "./MediaGrid";
import { proxyUrl } from "./MediaGrid";

interface MediaLightboxProps {
  media: MediaItem;
  allMedia: MediaItem[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

// ---------- GIF scrubber (renders GIF-as-MP4 with frame slider) ----------
const GifScrubber = ({ src }: { src: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onMeta = () => {
      setDuration(video.duration);
      setLoaded(true);
    };
    const onTime = () => setCurrentTime(video.currentTime);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);

    return () => {
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [src]);

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const t = parseFloat(e.target.value);
    video.currentTime = t;
    setCurrentTime(t);
  };

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  };

  const frameCount = duration > 0 ? Math.round(duration * 25) : 100; // ~25fps estimate
  const currentFrame = Math.round(currentTime * 25);

  return (
    <div className="flex flex-col items-center gap-3 max-w-[90vw] max-h-[90vh]">
      <video
        ref={videoRef}
        src={src}
        autoPlay
        loop
        muted
        playsInline
        className="max-h-[75vh] max-w-[90vw] rounded-lg object-contain"
      />

      {loaded && (
        <div
          className="w-full bg-black/60 rounded-xl px-4 py-3 flex flex-col gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Scrub bar */}
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="text-white hover:text-orange-400 transition-colors flex-shrink-0"
            >
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>

            <input
              type="range"
              min={0}
              max={duration}
              step={1 / 25}
              value={currentTime}
              onChange={handleScrub}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #f97316 ${(currentTime / duration) * 100}%, #4b5563 ${(currentTime / duration) * 100}%)`,
              }}
            />

            <span className="text-white/70 text-xs font-mono flex-shrink-0 min-w-[60px] text-right">
              {currentFrame} / {frameCount}
            </span>
          </div>

          <div className="text-center text-white/40 text-xs">
            Drag slider to scrub frames · Click play/pause
          </div>
        </div>
      )}
    </div>
  );
};

// ---------- Main lightbox ----------
const MediaLightbox = ({ media, allMedia, currentIndex, onClose, onNavigate }: MediaLightboxProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [imgSrc, setImgSrc] = useState(proxyUrl(media.url));

  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < allMedia.length - 1;

  // Update imgSrc when media changes
  useEffect(() => {
    setImgSrc(proxyUrl(media.url));
  }, [media.url]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && canGoPrevious) onNavigate(currentIndex - 1);
      else if (e.key === "ArrowRight" && canGoNext) onNavigate(currentIndex + 1);
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "unset";
    };
  }, [onClose, onNavigate, currentIndex, canGoPrevious, canGoNext]);

  // Audio handling for videos
  useEffect(() => {
    setAudioLoaded(false);
    setAudioError(false);

    if (media.type === "video" && !media.isGif && media.audioUrl && audioRef.current) {
      const audio = audioRef.current;

      const handleLoad = () => { setAudioLoaded(true); setAudioError(false); };
      const handleError = () => {
        setAudioError(true);
        // Try fallback audio URL
        if (media.audioUrl!.includes('DASH_audio.mp4')) {
          audio.src = media.audioUrl!.replace('DASH_audio.mp4', 'DASH_AUDIO_128.mp4');
          audio.load();
        }
      };

      audio.addEventListener('loadeddata', handleLoad);
      audio.addEventListener('error', handleError);
      audio.load();

      return () => {
        audio.removeEventListener('loadeddata', handleLoad);
        audio.removeEventListener('error', handleError);
      };
    }
  }, [media.audioUrl, media.type, media.isGif]);

  // Sync video + audio
  useEffect(() => {
    if (media.type === "video" && !media.isGif && media.audioUrl && videoRef.current && audioRef.current && audioLoaded) {
      const video = videoRef.current;
      const audio = audioRef.current;

      const syncPlay = () => { if (video.paused) audio.pause(); else audio.play().catch(() => {}); };
      const syncTime = () => { if (Math.abs(video.currentTime - audio.currentTime) > 0.3) audio.currentTime = video.currentTime; };

      video.addEventListener('play', syncPlay);
      video.addEventListener('pause', syncPlay);
      video.addEventListener('timeupdate', syncTime);
      video.addEventListener('seeked', syncTime);

      return () => {
        video.removeEventListener('play', syncPlay);
        video.removeEventListener('pause', syncPlay);
        video.removeEventListener('timeupdate', syncTime);
        video.removeEventListener('seeked', syncTime);
      };
    }
  }, [media, audioLoaded]);

  const handleImgError = useCallback(() => {
    // If not already proxied, try proxy
    if (!imgSrc.includes('media-proxy')) {
      setImgSrc(`/.netlify/functions/media-proxy?url=${encodeURIComponent(media.url)}`);
    }
  }, [imgSrc, media.url]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 p-4"
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 rounded-full bg-white/10 p-2 hover:bg-white/20 transition-colors z-10"
      >
        <X className="h-6 w-6 text-white" />
      </button>

      {/* Previous */}
      {canGoPrevious && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate(currentIndex - 1); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 hover:bg-white/20 transition-colors z-10"
        >
          <ChevronLeft className="h-8 w-8 text-white" />
        </button>
      )}

      {/* Next */}
      {canGoNext && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate(currentIndex + 1); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 hover:bg-white/20 transition-colors z-10"
        >
          <ChevronRight className="h-8 w-8 text-white" />
        </button>
      )}

      {/* Media */}
      <div
        className="relative flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {media.type === "video" && media.isGif ? (
          // GIF-as-MP4 with frame scrubber
          <GifScrubber src={proxyUrl(media.url)} />
        ) : media.type === "video" ? (
          <>
            <video
              ref={videoRef}
              src={proxyUrl(media.url)}
              controls
              autoPlay
              loop
              playsInline
              className="max-h-[90vh] max-w-[90vw] rounded-lg"
            />
            {media.audioUrl && (
              <audio ref={audioRef} src={media.audioUrl} loop preload="auto" />
            )}
            {media.hasAudio && (
              <div className="absolute bottom-4 left-4">
                {audioLoaded && <div className="bg-black/70 text-white text-sm px-3 py-2 rounded">🔊 Audio enabled</div>}
                {!audioLoaded && !audioError && <div className="bg-black/70 text-white text-sm px-3 py-2 rounded">Loading audio…</div>}
                {audioError && <div className="bg-black/70 text-yellow-400 text-sm px-3 py-2 rounded">⚠️ Audio unavailable</div>}
              </div>
            )}
          </>
        ) : (
          <img
            src={imgSrc}
            alt="Reddit media"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onError={handleImgError}
          />
        )}

        {/* Counter */}
        <div className="absolute bottom-4 right-4 bg-black/70 text-white text-sm px-3 py-2 rounded pointer-events-none">
          {currentIndex + 1} / {allMedia.length}
        </div>
      </div>
    </div>
  );
};

export default MediaLightbox;
