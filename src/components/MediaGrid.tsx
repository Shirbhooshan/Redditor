import { useState } from "react";
import { Play } from "lucide-react";
import MediaLightbox from "./MediaLightbox";

export interface MediaItem {
  type: "image" | "video";
  url: string;
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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentMedia = media.slice(startIndex, endIndex);

  const handleImageLoad = (index: number) => {
    setLoadedImages((prev) => new Set(prev).add(index));
  };

  const handleMediaClick = (index: number) => {
    setLightboxIndex(startIndex + index);
    setLightboxOpen(true);
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {currentMedia.map((item, index) => (
          <button
            key={startIndex + index}
            onClick={() => handleMediaClick(index)}
            className="relative aspect-square bg-card rounded-lg overflow-hidden group cursor-pointer border border-border hover:border-primary transition-colors"
          >
            {item.type === "video" ? (
              <>
                <img
                  src={item.thumbnail || item.url}
                  alt={`Media ${startIndex + index + 1}`}
                  onLoad={() => handleImageLoad(startIndex + index)}
                  className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-105 ${
                    loadedImages.has(startIndex + index) ? "opacity-100" : "opacity-0"
                  }`}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                  <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center">
                    <Play className="w-8 h-8 text-primary-foreground ml-1" />
                  </div>
                </div>
              </>
            ) : (
              <img
                src={item.thumbnail || item.url}
                alt={`Media ${startIndex + index + 1}`}
                onLoad={() => handleImageLoad(startIndex + index)}
                className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-105 ${
                  loadedImages.has(startIndex + index) ? "opacity-100" : "opacity-0"
                }`}
              />
            )}
            {!loadedImages.has(startIndex + index) && (
              <div className="absolute inset-0 bg-muted animate-pulse" />
            )}
          </button>
        ))}
      </div>

      {lightboxOpen && (
        <MediaLightbox
          media={media}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
};

export default MediaGrid;
