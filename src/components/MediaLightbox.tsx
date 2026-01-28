import { X, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MediaItem } from "./MediaGrid";

interface MediaLightboxProps {
  media: MediaItem;
  onClose: () => void;
}

const MediaLightbox = ({ media, onClose }: MediaLightboxProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

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

  // Handle audio loading
  useEffect(() => {
    if (media.type === "video" && media.audioUrl && audioRef.current) {
      const audio = audioRef.current;

      const handleAudioLoad = () => {
        console.log('Audio loaded successfully:', media.audioUrl);
        setAudioLoaded(true);
        setAudioError(false);
      };

      const handleAudioError = (e: any) => {
        console.error('Audio failed to load:', media.audioUrl, e);
        setAudioError(true);
        setAudioLoaded(false);
        
        // Try alternative audio URL
        if (media.audioUrl.includes('DASH_audio.mp4')) {
          const altUrl = media.audioUrl.replace('DASH_audio.mp4', 'DASH_AUDIO_128.mp4');
          console.log('Trying alternative audio URL:', altUrl);
          audio.src = altUrl;
          audio.load();
        } else if (media.audioUrl.includes('DASH_AUDIO_128.mp4')) {
          const altUrl = media.audioUrl.replace('DASH_AUDIO_128.mp4', 'audio');
          console.log('Trying alternative audio URL:', altUrl);
          audio.src = altUrl;
          audio.load();
        }
      };

      audio.addEventListener('loadeddata', handleAudioLoad);
      audio.addEventListener('error', handleAudioError);

      return () => {
        audio.removeEventListener('loadeddata', handleAudioLoad);
        audio.removeEventListener('error', handleAudioError);
      };
    }
  }, [media.audioUrl, media.type]);

  // Sync video and audio playback for Reddit videos
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
            // If autoplay is blocked, mute and try again
            audio.muted = true;
            setIsMuted(true);
            audio.play().catch(() => {
              console.error('Audio play failed even when muted');
            });
          });
        }
      };

      const syncTime = () => {
        // Only sync if difference is significant (more than 0.3 seconds)
        if (Math.abs(video.currentTime - audio.currentTime) > 0.3) {
          audio.currentTime = video.currentTime;
        }
      };

      const syncVolume = () => {
        audio.volume = video.volume;
        audio.muted = video.muted || isMuted;
      };

      video.addEventListener('play', syncPlayback);
      video.addEventListener('pause', syncPlayback);
      video.addEventListener('timeupdate', syncTime);
      video.addEventListener('seeked', syncTime);
      video.addEventListener('volumechange', syncVolume);

      // Initial sync
      syncVolume();

      return () => {
        video.removeEventListener('play', syncPlayback);
        video.removeEventListener('pause', syncPlayback);
        video.removeEventListener('timeupdate', syncTime);
        video.removeEventListener('seeked', syncTime);
        video.removeEventListener('volumechange', syncVolume);
      };
    }
  }, [media, audioLoaded, isMuted]);

  const toggleMute = () => {
    if (audioRef.current) {
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      audioRef.current.muted = newMuted;
      if (videoRef.current) {
        videoRef.current.muted = newMuted;
      }
    }
  };

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
              muted={!media.hasAudio || !audioLoaded} // Mute video if no audio or audio not loaded
            />
            {/* Hidden audio element for Reddit videos with separate audio */}
            {media.audioUrl && (
              <audio
                ref={audioRef}
                src={media.audioUrl}
                loop
                preload="auto"
                muted={isMuted}
              />
            )}
            {/* Audio status indicator */}
            <div className="absolute bottom-4 left-4 flex gap-2">
              {media.hasAudio && audioLoaded && (
                <button
                  onClick={toggleMute}
                  className="bg-black/70 text-white text-sm px-3 py-2 rounded flex items-center gap-2 hover:bg-black/80 transition-colors"
                >
                  {isMuted ? (
                    <>
                      <VolumeX className="h-4 w-4" />
                      <span>Unmute</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-4 w-4" />
                      <span>Audio On</span>
                    </>
                  )}
                </button>
              )}
              {media.hasAudio && !audioLoaded && !audioError && (
                <div className="bg-black/70 text-white text-sm px-3 py-2 rounded">
                  Loading audio...
                </div>
              )}
              {media.hasAudio && audioError && (
                <div className="bg-black/70 text-white text-sm px-3 py-2 rounded">
                  ⚠️ Audio unavailable
                </div>
              )}
            </div>
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
