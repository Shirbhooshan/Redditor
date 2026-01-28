import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MediaItem } from "./MediaGrid";

interface MediaLightboxProps {
  media: MediaItem;
  allMedia: MediaItem[]; // Pass all media for navigation
  currentIndex: number; // Current media index
  onClose: () => void;
  onNavigate: (index: number) => void; // Callback to change media
}

const MediaLightbox = ({ media, allMedia, currentIndex, onClose, onNavigate }: MediaLightboxProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [audioError, setAudioError] = useState(false);

  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < allMedia.length - 1;

  useEffect(() => {
    // Handle keyboard navigation
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && canGoPrevious) {
        onNavigate(currentIndex - 1);
      } else if (e.key === "ArrowRight" && canGoNext) {
        onNavigate(currentIndex + 1);
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyPress);
      document.body.style.overflow = "unset";
    };
  }, [onClose, onNavigate, currentIndex, canGoPrevious, canGoNext]);

  // Handle audio loading
  useEffect(() => {
    setAudioLoaded(false);
    setAudioError(false);

    if (media.type === "video" && media.audioUrl && audioRef.current) {
      const audio = audioRef.current;

      const handleAudioLoad = () => {
        console.log('✅ Audio loaded:', media.audioUrl);
        setAudioLoaded(true);
        setAudioError(false);
      };

      const handleAudioError = (e: any) => {
        console.error('❌ Audio failed:', media.audioUrl, e);
        setAudioError(true);
        setAudioLoaded(false);
        
        // Try alternative audio URLs
        if (media.audioUrl.includes('DASH_audio.mp4')) {
          const altUrl = media.audioUrl.replace('DASH_audio.mp4', 'DASH_AUDIO_128.mp4');
          console.log('🔄 Trying alternative:', altUrl);
          audio.src = altUrl;
          audio.load();
        } else if (media.audioUrl.includes('DASH_AUDIO_128.mp4')) {
          const altUrl = media.audioUrl.replace('DASH_AUDIO_128.mp4', 'audio');
          console.log('🔄 Trying alternative:', altUrl);
          audio.src = altUrl;
          audio.load();
        }
      };

      audio.addEventListener('loadeddata', handleAudioLoad);
      audio.addEventListener('error', handleAudioError);

      // Force load
      audio.load();

      return () => {
        audio.removeEventListener('loadeddata', handleAudioLoad);
        audio.removeEventListener('error', handleAudioError);
      };
    }
  }, [media.audioUrl, media.type]);

  // Sync video and audio playback
  useEffect(() => {
    if (media.type === "video" && media.audioUrl && videoRef.current && audioRef.current && audioLoaded) {
      const video = videoRef.current;
      const audio = audioRef.current;

      const syncPlayback = () => {
        if (video.paused) {
          audio.pause();
        } else {
          audio.play().catch((err) => {
            console.warn('Audio autoplay blocked:', err);
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
  }, [media, audioLoaded]);

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

      {/* Previous button */}
      {canGoPrevious && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(currentIndex - 1);
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 hover:bg-white/20 transition-colors z-10"
          aria-label="Previous"
        >
          <ChevronLeft className="h-8 w-8 text-white" />
        </button>
      )}

      {/* Next button */}
      {canGoNext && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(currentIndex + 1);
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 hover:bg-white/20 transition-colors z-10"
          aria-label="Next"
        >
          <ChevronRight className="h-8 w-8 text-white" />
        </button>
      )}

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
            {/* Hidden audio element */}
            {media.audioUrl && (
              <audio
                ref={audioRef}
                src={media.audioUrl}
                loop
                preload="auto"
              />
            )}
            {/* Audio status */}
            {media.hasAudio && (
              <div className="absolute bottom-4 left-4">
                {audioLoaded && (
                  <div className="bg-black/70 text-white text-sm px-3 py-2 rounded">
                    🔊 Audio enabled
                  </div>
                )}
                {!audioLoaded && !audioError && (
                  <div className="bg-black/70 text-white text-sm px-3 py-2 rounded">
                    Loading audio...
                  </div>
                )}
                {audioError && (
                  <div className="bg-black/70 text-yellow-400 text-sm px-3 py-2 rounded">
                    ⚠️ Audio unavailable
                  </div>
                )}
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

        {/* Counter */}
        <div className="absolute bottom-4 right-4 bg-black/70 text-white text-sm px-3 py-2 rounded">
          {currentIndex + 1} / {allMedia.length}
        </div>
      </div>
    </div>
  );
};

export default MediaLightbox;
