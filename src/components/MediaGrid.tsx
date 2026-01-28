import { Play } from "lucide-react";
import { useState } from "react";
import MediaLightbox from "./MediaLightbox";

export interface MediaItem {
  type: "image" | "video";
  url: string;
  audioUrl?: string; // For Reddit videos with separate audio
  hasAudio?: boolean; // Flag to know if video has audio
  thumbnail?: string;
  width?: number;
  height?: number;
}

interface MediaGridProps {
  media: MediaItem[];
  currentPage: number;
  itemsPerPage: number;
}

const MediaGrid = ({ media, currentPage, itemsPerPage }: MediaGridProps) => {
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentMedia = media.slice(startIndex, endIndex);

  if (currentMedia.length === 0) {
    return null;
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {currentMedia.map((item, index) => (
          <div
            key={startIndex + index}
            className="relative aspect-square overflow-hidden rounded-lg bg-muted cursor-pointer group"
            onClick={() => setSelectedMedia(item)}
          >
            {item.type === "video" ? (
              <>
                <video
                  src={item.url}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                  <div className="rounded-full bg-white/90 p-3 group-hover:scale-110 transition-transform">
                    <Play className="h-8 w-8 text-black fill-black" />
                  </div>
                </div>
                {item.hasAudio && (
                  <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                    🔊 Audio
                  </div>
                )}
              </>
            ) : (
              <img
                src={item.url}
                alt="Reddit media"
                className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                loading="lazy"
              />
            )}
          </div>
        ))}
      </div>

      {selectedMedia && (
        <MediaLightbox
          media={selectedMedia}
          onClose={() => setSelectedMedia(null)}
        />
      )}
    </>
  );
};

export default MediaGrid;
