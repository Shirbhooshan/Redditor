import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { MediaItem } from "./MediaGrid";

interface MediaLightboxProps {
  media: MediaItem;
  onClose: () => void;
}

const MediaLightbox = ({ media, onClose }: MediaLightboxProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    // Handle escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [onClose]);

  // Sync video and audio playback for Reddit videos
  useEffect(() => {
    if (media.type === "video" && media.audioUrl && videoRef.current && audioRef.current) {
      const video = videoRef.current;
      const audio = audioRef.current;

      const syncPlayback = () => {
        if (video.paused) {
          audio.pause();
        } else {
          audio.play().catch(() => {
            // Audio play failed, mute it
            audio.muted = true;
            audio.play();
          });
        }
      };

      const syncTime = () => {
        if (Math.abs(video.currentTime - audio.currentTime) > 0.3) {
          audio.currentTime = video.currentTime;
        }
      };

      video.addEventListener('play', syncPlayback);
      video.addEventListener('pause', syncPlayback);
      video.addEventListener('timeupdate', syncTime);
      video.addEventListener('seeked', syncTime);

      return () => {
        video.removeEventListener('play', syncPlayback);
        video.removeEventListener('pause', syncPlayback);
        video.removeEventListener('timeupdate', syncTime);
        video.removeEventListener('seeked', syncTime);
      };
    }
  }, [media]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 rounded-full bg-white/10 p-2 hover:bg-white/20 transition-colors"
        aria-label="Close"
      >
        <X className="h-6 w-6 text-white" />
      </button>

      {/* Media content */}
      <div
        className="relative max-h-[90vh] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        {media.type === "video" ? (
          <>
            <video
              ref={videoRef}
              src={media.url}
              controls
              autoPlay
              loop
              className="max-h-[90vh] max-w-[90vw] rounded-lg"
              playsInline
            />
            {/* Hidden audio element for Reddit videos with separate audio */}
            {media.audioUrl && (
              <audio
                ref={audioRef}
                src={media.audioUrl}
                loop
                preload="auto"
              />
            )}
            {media.hasAudio && media.audioUrl && (
              <div className="absolute bottom-4 left-4 bg-black/70 text-white text-sm px-3 py-1 rounded">
                🔊 Audio enabled
              </div>
            )}
          </>
        ) : (
          <img
            src={media.url}
            alt="Reddit media"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
          />
        )}
      </div>
    </div>
  );
};

export default MediaLightbox;
