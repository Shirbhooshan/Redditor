import { Play } from "lucide-react";
import { useState } from "react";
import MediaLightbox from "./MediaLightbox";

export interface MediaItem {
  type: "image" | "video";
  url: string;
  audioUrl?: string;
  hasAudio?: boolean;
  thumbnail?: string;
  width?: number;
  height?: number;
  isGif?: boolean; // GIF stored as MP4 — enables frame scrubber
}

interface MediaGridProps {
  media: MediaItem[];
  currentPage: number;
  itemsPerPage: number;
}

const MEDIA_PROXY = '/.netlify/functions/media-proxy?url=';

export const proxyUrl = (url: string) => {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    const proxied = ['preview.redd.it', 'external-preview.redd.it'];
    if (proxied.some((d) => parsed.hostname === d)) {
      return `${MEDIA_PROXY}${encodeURIComponent(url)}`;
    }
  } catch {}
  return url;
};

const MediaGrid = ({ media, currentPage, itemsPerPage }: MediaGridProps) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentMedia = media.slice(startIndex, startIndex + itemsPerPage);

  if (currentMedia.length === 0) return null;

  const handleMediaClick = (localIndex: number) => {
    setSelectedIndex(startIndex + localIndex);
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {currentMedia.map((item, index) => (
          <div
            key={startIndex + index}
            className="relative aspect-square overflow-hidden rounded-lg bg-muted cursor-pointer group"
            onClick={() => handleMediaClick(index)}
          >
            {item.type === "video" ? (
              <>
                <video
                  src={proxyUrl(item.url)}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                  {!item.isGif && (
                    <div className="rounded-full bg-white/90 p-3 group-hover:scale-110 transition-transform">
                      <Play className="h-8 w-8 text-black fill-black" />
                    </div>
                  )}
                </div>
                {item.isGif && (
                  <div className="absolute top-2 left-2 bg-black/70 text-white text-xs font-bold px-2 py-1 rounded">
                    GIF
                  </div>
                )}
                {item.hasAudio && !item.isGif && (
                  <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                    🔊
                  </div>
                )}
              </>
            ) : (
              <img
                src={proxyUrl(item.url)}
                alt="Reddit media"
                className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                loading="lazy"
                onError={(e) => {
                  // If direct load fails, try via proxy
                  const target = e.currentTarget;
                  if (!target.src.includes('media-proxy')) {
                    target.src = `${MEDIA_PROXY}${encodeURIComponent(item.url)}`;
                  }
                }}
              />
            )}
          </div>
        ))}
      </div>

      {selectedIndex !== null && (
        <MediaLightbox
          media={media[selectedIndex]}
          allMedia={media}
          currentIndex={selectedIndex}
          onClose={() => setSelectedIndex(null)}
          onNavigate={(i) => setSelectedIndex(i)}
        />
      )}
    </>
  );
};

export default MediaGrid;
