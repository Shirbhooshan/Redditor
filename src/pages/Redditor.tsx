import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import RedditorSearch from "@/components/RedditorSearch";
import MediaGrid, { MediaItem } from "@/components/MediaGrid";
import Pagination from "@/components/Pagination";

const ITEMS_PER_PAGE = 30; // 3 columns x 10 rows
const MAX_REDDIT_PAGES = 10; // Fetch up to 10 pages from Reddit (250+ posts)

type SortOption = "hot" | "best" | "top" | "new";
type TopTimeframe = "hour" | "day" | "week" | "month" | "year" | "all";

const Redditor = () => {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("best");
  const [topTimeframe, setTopTimeframe] = useState<TopTimeframe>("all");
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
      const videoData = postData.media.reddit_video;
      const videoUrl = videoData.fallback_url || videoData.hls_url;
      const hasAudio = videoData.has_audio;
      
      // Try to construct audio URL - Reddit stores audio at different paths
      let audioUrl = null;
      if (hasAudio && videoUrl) {
        // Method 1: Try replacing video quality with audio
        audioUrl = videoUrl.replace(/DASH_\d+\.mp4/, 'DASH_audio.mp4');
        
        // Method 2: If that doesn't work, try the 128k version
        if (!audioUrl.includes('audio')) {
          const baseUrl = videoUrl.substring(0, videoUrl.lastIndexOf('/'));
          audioUrl = `${baseUrl}/DASH_AUDIO_128.mp4`;
        }
      }

      foundMedia.push({
        type: 'video',
        url: videoUrl,
        audioUrl: audioUrl,
        thumbnail: postData.thumbnail !== 'default' ? postData.thumbnail : undefined,
        width: videoData.width,
        height: videoData.height,
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
      const videoUrl = postData.preview.reddit_video_preview.fallback_url;
      let audioUrl = null;
      
      if (videoUrl) {
        audioUrl = videoUrl.replace(/DASH_\d+/, 'DASH_audio');
      }
      
      foundMedia.push({
        type: 'video',
        url: videoUrl,
        audioUrl: audioUrl,
        thumbnail: postData.thumbnail,
        width: postData.preview.reddit_video_preview.width,
        height: postData.preview.reddit_video_preview.height,
        hasAudio: true
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

  const buildRedditUrl = (baseUrl: string, after: string | null = null) => {
    // Remove trailing slash and .json if present
    let cleanUrl = baseUrl.trim().replace(/\/$/, '').replace(/\.json$/, '');
    
    // Check if URL is a subreddit or user profile
    const isSubreddit = cleanUrl.match(/reddit\.com\/r\/[\w]+$/);
    const isUserPosts = cleanUrl.match(/reddit\.com\/user\/[\w]+$/);
    
    let finalUrl = cleanUrl;
    
    // Add sort parameters for subreddits and user profiles
    if (isSubreddit || isUserPosts) {
      // Add sort type to URL path
      if (sortBy === 'best' || sortBy === 'hot') {
        finalUrl = `${cleanUrl}/${sortBy}`;
      } else if (sortBy === 'top') {
        finalUrl = `${cleanUrl}/top`;
      } else if (sortBy === 'new') {
        finalUrl = `${cleanUrl}/new`;
      }
      
      // Add .json
      finalUrl += '.json';
      
      // Build query parameters
      const params = new URLSearchParams();
      if (after) {
        params.append('after', after);
      }
      if (sortBy === 'top' && topTimeframe) {
        params.append('t', topTimeframe);
      }
      
      const queryString = params.toString();
      if (queryString) {
        finalUrl += `?${queryString}`;
      }
    } else {
      // For specific posts, just add .json and after if needed
      finalUrl += '.json';
      if (after) {
        finalUrl += `?after=${after}`;
      }
    }
    
    return finalUrl;
  };

  const fetchRedditPage = async (url: string, after: string | null = null) => {
    const jsonUrl = buildRedditUrl(url, after);
    
    console.log('Fetching:', jsonUrl); // Debug log

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
        description: `Loading ${sortBy === 'top' ? `top posts (${topTimeframe})` : sortBy} posts from Reddit...`,
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
          <RedditorSearch 
            onSearch={handleSearch} 
            isLoading={isLoading}
            sortBy={sortBy}
            onSortChange={setSortBy}
            topTimeframe={topTimeframe}
            onTopTimeframeChange={setTopTimeframe}
          />
        </div>

        {/* Results */}
        {hasSearched && media.length > 0 && (
          <>
            <div className="mb-6 text-muted-foreground text-sm">
              Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, media.length)}-
              {Math.min(currentPage * ITEMS_PER_PAGE, media.length)} of {media.length} items
              {totalPages > 1 && ` (Page ${currentPage} of ${totalPages})`}
              {sortBy === 'top' && ` • Sorted by: Top (${topTimeframe})`}
              {sortBy !== 'top' && ` • Sorted by: ${sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}`}
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
