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
  isGif?: boolean;
}

interface MediaGridProps {
  media: MediaItem[];
  currentPage: number;
  itemsPerPage: number;
}

const MediaGrid = ({ media, currentPage, itemsPerPage }: MediaGridProps) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentMedia = media.slice(startIndex, startIndex + itemsPerPage);

  if (currentMedia.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {currentMedia.map((item, index) => (
          <div
            key={startIndex + index}
            className="relative aspect-square overflow-hidden rounded-lg bg-muted cursor-pointer group"
            onClick={() => setSelectedIndex(startIndex + index)}
          >
            {item.type === "video" ? (
              <>
                {/* Both GIFs and regular videos use <video> in the grid.
                    GIFs autoplay muted and looping — no overlay needed.
                    Regular videos show a play button overlay. */}
                <video
                  src={item.url}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                  // GIFs autoplay and loop in the grid
                  autoPlay={item.isGif}
                  loop={item.isGif}
                />

                {/* Only show play overlay for real videos, not GIFs */}
                {!item.isGif && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                    <div className="rounded-full bg-white/90 p-3 group-hover:scale-110 transition-transform">
                      <Play className="h-8 w-8 text-black fill-black" />
                    </div>
                  </div>
                )}

                {/* Small GIF badge in corner so user knows it's interactive */}
                {item.isGif && (
                  <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs font-bold px-1.5 py-0.5 rounded opacity-70">
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
                src={item.url}
                alt="Reddit media"
                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                loading="lazy"
                onError={(e) => {
                  const t = e.currentTarget;
                  if (!t.src.includes("media-proxy")) {
                    t.src = `/.netlify/functions/media-proxy?url=${encodeURIComponent(item.url)}`;
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
