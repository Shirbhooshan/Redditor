import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import RedditorSearch from "@/components/RedditorSearch";
import MediaGrid, { MediaItem } from "@/components/MediaGrid";
import Pagination from "@/components/Pagination";

const ITEMS_PER_PAGE = 30; // 3 columns x 10 rows
const MAX_REDDIT_PAGES = 10; // Fetch up to 10 pages from Reddit (250+ posts)

const Redditor = () => {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);
  const { toast } = useToast();

  const totalPages = Math.ceil(media.length / ITEMS_PER_PAGE);

  // Extract media from Reddit post
  const extractMediaFromPost = (post: any) => {
    const postData = post.data;
    const foundMedia: MediaItem[] = [];

    // Check for gallery posts
    if (postData.is_gallery && postData.media_metadata) {
      Object.values(postData.media_metadata).forEach((item: any) => {
        if (item.status === 'valid') {
          const url = item.s?.u?.replace(/&amp;/g, '&') || item.s?.gif?.replace(/&amp;/g, '&');
          if (url) {
            foundMedia.push({
              type: item.e === 'AnimatedImage' ? 'video' : 'image',
              url: url,
              width: item.s?.x,
              height: item.s?.y
            });
          }
        }
      });
    }
    // Check for video posts - Reddit videos have separate audio
    else if (postData.is_video && postData.media?.reddit_video) {
      const videoUrl = postData.media.reddit_video.fallback_url;
      const hasAudio = postData.media.reddit_video.has_audio;
      
      // Construct audio URL - Reddit stores audio separately at /DASH_AUDIO_128.mp4 or /DASH_audio.mp4
      let audioUrl = null;
      if (hasAudio && videoUrl) {
        // Get base URL without the quality suffix
        const baseUrl = videoUrl.substring(0, videoUrl.lastIndexOf('/'));
        audioUrl = `${baseUrl}/DASH_AUDIO_128.mp4`;
      }

      foundMedia.push({
        type: 'video',
        url: videoUrl,
        audioUrl: audioUrl, // Include audio URL if available
        thumbnail: postData.thumbnail,
        width: postData.media.reddit_video.width,
        height: postData.media.reddit_video.height,
        hasAudio: hasAudio
      });
    }
    // Check for image posts
    else if (postData.post_hint === 'image' && postData.url) {
      foundMedia.push({
        type: 'image',
        url: postData.url,
        width: postData.preview?.images?.[0]?.source?.width,
        height: postData.preview?.images?.[0]?.source?.height
      });
    }
    // Check for hosted video (v.redd.it)
    else if (postData.domain === 'v.redd.it' && postData.preview?.reddit_video_preview) {
      foundMedia.push({
        type: 'video',
        url: postData.preview.reddit_video_preview.fallback_url,
        thumbnail: postData.thumbnail,
        width: postData.preview.reddit_video_preview.width,
        height: postData.preview.reddit_video_preview.height
      });
    }
    // Check for external images
    else if (postData.url && /\.(jpg|jpeg|png|gif|webp)$/i.test(postData.url)) {
      foundMedia.push({
        type: 'image',
        url: postData.url
      });
    }

    return foundMedia;
  };

  const fetchRedditPage = async (url: string, after: string | null = null) => {
    let jsonUrl = url;
    if (!jsonUrl.endsWith('.json')) {
      jsonUrl = jsonUrl.replace(/\/$/, '') + '.json';
    }

    // Add pagination parameter if we have an 'after' token
    if (after) {
      jsonUrl += `?after=${after}`;
    }

    const corsProxy = 'https://corsproxy.io/?';
    const response = await fetch(corsProxy + encodeURIComponent(jsonUrl), {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    return await response.json();
  };

  const handleSearch = async (url: string) => {
    setIsLoading(true);
    setHasSearched(true);
    setCurrentPage(1);

    try {
      const allMedia: MediaItem[] = [];
      let after: string | null = null;
      let pagesLoaded = 0;

      toast({
        title: "Fetching media...",
        description: "Loading posts from Reddit...",
      });

      // Fetch multiple pages from Reddit
      while (pagesLoaded < MAX_REDDIT_PAGES) {
        const data = await fetchRedditPage(url.trim(), after);

        // Handle single post
        if (Array.isArray(data) && data.length > 0 && data[0].data?.children) {
          const post = data[0].data.children[0];
          allMedia.push(...extractMediaFromPost(post));
          break; // Single post, no pagination
        }
        // Handle subreddit listing
        else if (data.data?.children) {
          data.data.children.forEach((post: any) => {
            allMedia.push(...extractMediaFromPost(post));
          });

          // Get the 'after' token for next page
          after = data.data.after;
          pagesLoaded++;

          // Update progress toast
          toast({
            title: "Loading...",
            description: `Loaded ${allMedia.length} media items from ${pagesLoaded} page(s)...`,
          });

          // If no more pages, stop
          if (!after) break;

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          break; // Unknown format
        }
      }

      setMedia(allMedia);

      if (allMedia.length === 0) {
        toast({
          title: "No media found",
          description: "This Reddit URL doesn't contain any extractable images or videos.",
        });
      } else {
        toast({
          title: "Success!",
          description: `Found ${allMedia.length} media items from ${pagesLoaded} page(s)`,
        });
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
              {totalPages > 1 && ` (Page ${currentPage} of ${totalPages})`}
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
