import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import RedditorSearch from "@/components/RedditorSearch";
import MediaGrid, { MediaItem } from "@/components/MediaGrid";
import Pagination from "@/components/Pagination";

const ITEMS_PER_PAGE = 30; // 3 columns x 10 rows

const Redditor = () => {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);
  const { toast } = useToast();

  const totalPages = Math.ceil(media.length / ITEMS_PER_PAGE);

  const handleSearch = async (url: string) => {
    setIsLoading(true);
    setHasSearched(true);
    setCurrentPage(1);

    try {
      const { data, error } = await supabase.functions.invoke("fetch-reddit-media", {
        body: { url },
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        toast({
          title: "Error",
          description: data.error,
          variant: "destructive",
        });
        setMedia([]);
      } else {
        setMedia(data.media || []);
        if (data.media?.length === 0) {
          toast({
            title: "No media found",
            description: "This Reddit post doesn't contain any extractable images or videos.",
          });
        } else {
          toast({
            title: "Success",
            description: `Found ${data.total} media items`,
          });
        }
      }
    } catch (error) {
      console.error("Error fetching media:", error);
      toast({
        title: "Error",
        description: "Failed to fetch media from Reddit. Please try again.",
        variant: "destructive",
      });
      setMedia([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header with title */}
      <header className="py-8">
        <h1 className="text-center">
          <span className="text-5xl md:text-6xl font-bold text-primary tracking-tight">
            Redditor
          </span>
        </h1>
      </header>

      {/* Main content */}
      <main className="container max-w-6xl mx-auto px-4 pb-16">
        {/* Search section - centered when no results */}
        <div
          className={`transition-all duration-500 ${
            hasSearched && media.length > 0
              ? "mb-12"
              : "min-h-[50vh] flex flex-col justify-center"
          }`}
        >
          <RedditorSearch onSearch={handleSearch} isLoading={isLoading} />
        </div>

        {/* Results */}
        {hasSearched && media.length > 0 && (
          <>
            <div className="mb-6 text-muted-foreground text-sm">
              Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, media.length)}-
              {Math.min(currentPage * ITEMS_PER_PAGE, media.length)} of {media.length} items
            </div>
            <MediaGrid
              media={media}
              currentPage={currentPage}
              itemsPerPage={ITEMS_PER_PAGE}
            />
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </>
        )}

        {/* Empty state */}
        {hasSearched && !isLoading && media.length === 0 && (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg">
              No media found. Try a different Reddit URL.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Redditor;
