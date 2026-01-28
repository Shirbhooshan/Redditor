import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import type { MediaItem } from "./MediaGrid";

interface MediaLightboxProps {
  media: MediaItem[];
  initialIndex: number;
  onClose: () => void;
}

const MediaLightbox = ({ media, initialIndex, onClose }: MediaLightboxProps) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const currentItem = media[currentIndex];

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : media.length - 1));
  }, [media.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < media.length - 1 ? prev + 1 : 0));
  }, [media.length]);

  const handleDownload = async () => {
    try {
      const response = await fetch(currentItem.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `redditor-media-${currentIndex + 1}.${currentItem.type === "video" ? "mp4" : "jpg"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goToPrevious();
      if (e.key === "ArrowRight") goToNext();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose, goToPrevious, goToNext]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center"
        onClick={onClose}
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10">
          <span className="text-foreground font-medium">
            {currentIndex + 1} / {media.length}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload();
              }}
              className="text-foreground hover:bg-muted"
            >
              <Download className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-foreground hover:bg-muted"
            >
              <X className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* Navigation */}
        {media.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                goToPrevious();
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground hover:bg-muted h-12 w-12"
            >
              <ChevronLeft className="h-8 w-8" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                goToNext();
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground hover:bg-muted h-12 w-12"
            >
              <ChevronRight className="h-8 w-8" />
            </Button>
          </>
        )}

        {/* Content */}
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="max-w-[90vw] max-h-[85vh] flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {currentItem.type === "video" ? (
            <video
              src={currentItem.url}
              controls
              autoPlay
              className="max-w-full max-h-[85vh] rounded-lg"
            />
          ) : (
            <img
              src={currentItem.url}
              alt={`Media ${currentIndex + 1}`}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MediaLightbox;
