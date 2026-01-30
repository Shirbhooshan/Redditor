import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import RedditorSearch from "@/components/RedditorSearch";
import MediaGrid, { MediaItem } from "@/components/MediaGrid";
import Pagination from "@/components/Pagination";

const ITEMS_PER_PAGE = 30; // 3 columns x 10 rows
const MAX_REDDIT_PAGES = 10; // Fetch up to 10 pages from Reddit (250+ posts)

type SortOption = "hot" | "best" | "top" | "new";
type TopTimeframe = "hour" | "day" | "week" | "month" | "year" | "all";

// Multiple CORS proxies as fallbacks
const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
  'https://cors-anywhere.herokuapp.com/',
];

const Redditor = () => {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("best");
  const [topTimeframe, setTopTimeframe] = useState<TopTimeframe>("all");
  const [currentProxyIndex, setCurrentProxyIndex] = useState(0);
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
    // Check for video posts
    else if (postData.is_video && postData.media?.reddit_video) {
      const videoData = postData.media.reddit_video;
      const videoUrl = videoData.fallback_url || videoData.hls_url;
      const hasAudio = videoData.has_audio;
      
      let audioUrl = null;
      if (hasAudio && videoUrl) {
        const dashIndex = videoUrl.lastIndexOf('/DASH_');
        if (dashIndex !== -1) {
          const basePath = videoUrl.substring(0, dashIndex);
          audioUrl = `${basePath}/DASH_audio.mp4`;
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
    // Check for rich:video
    else if (postData.post_hint === 'rich:video' && postData.preview?.reddit_video_preview) {
      const videoUrl = postData.preview.reddit_video_preview.fallback_url;
      foundMedia.push({
        type: 'video',
        url: videoUrl,
        thumbnail: postData.thumbnail,
        width: postData.preview.reddit_video_preview.width,
        height: postData.preview.reddit_video_preview.height
      });
    }
    // Check for hosted video (v.redd.it)
    else if (postData.domain === 'v.redd.it') {
      if (postData.preview?.reddit_video_preview) {
        const videoUrl = postData.preview.reddit_video_preview.fallback_url;
        let audioUrl = null;
        
        if (videoUrl) {
          const dashIndex = videoUrl.lastIndexOf('/DASH_');
          if (dashIndex !== -1) {
            const basePath = videoUrl.substring(0, dashIndex);
            audioUrl = `${basePath}/DASH_audio.mp4`;
          }
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
      } else if (postData.media?.reddit_video) {
        const videoData = postData.media.reddit_video;
        const videoUrl = videoData.fallback_url;
        let audioUrl = null;
        
        if (videoData.has_audio && videoUrl) {
          const dashIndex = videoUrl.lastIndexOf('/DASH_');
          if (dashIndex !== -1) {
            const basePath = videoUrl.substring(0, dashIndex);
            audioUrl = `${basePath}/DASH_audio.mp4`;
          }
        }
        
        foundMedia.push({
          type: 'video',
          url: videoUrl,
          audioUrl: audioUrl,
          thumbnail: postData.thumbnail,
          width: videoData.width,
          height: videoData.height,
          hasAudio: videoData.has_audio
        });
      }
    }
    // Check for external images
    else if (postData.url && /\.(jpg|jpeg|png|gif|webp)$/i.test(postData.url)) {
      foundMedia.push({
        type: 'image',
        url: postData.url
      });
    }
    // Check for imgur and other image hosts
    else if (postData.url && (postData.url.includes('i.redd.it') || postData.url.includes('imgur.com'))) {
      if (postData.preview?.images?.[0]?.source?.url) {
        const imageUrl = postData.preview.images[0].source.url.replace(/&amp;/g, '&');
        foundMedia.push({
          type: 'image',
          url: imageUrl,
          width: postData.preview.images[0].source.width,
          height: postData.preview.images[0].source.height
        });
      } else {
        foundMedia.push({
          type: 'image',
          url: postData.url
        });
      }
    }
    // Fallback: Try preview images
    else if (postData.preview?.images?.[0]?.source?.url) {
      const imageUrl = postData.preview.images[0].source.url.replace(/&amp;/g, '&');
      foundMedia.push({
        type: 'image',
        url: imageUrl,
        width: postData.preview.images[0].source.width,
        height: postData.preview.images[0].source.height
      });
    }

    return foundMedia;
  };

  const buildRedditUrl = (baseUrl: string, after: string | null = null) => {
    let cleanUrl = baseUrl.trim().replace(/\/$/, '').replace(/\.json$/, '');
    
    const subredditMatch = cleanUrl.match(/reddit\.com\/r\/([\w]+)/);
    
    if (subredditMatch) {
      const subreddit = subredditMatch[1];
      let finalUrl = `https://www.reddit.com/r/${subreddit}`;
      
      if (sortBy === 'best') {
        finalUrl += '.json';
      } else if (sortBy === 'hot') {
        finalUrl += '/hot.json';
      } else if (sortBy === 'top') {
        finalUrl += '/top.json';
      } else if (sortBy === 'new') {
        finalUrl += '/new.json';
      }
      
      const params = new URLSearchParams();
      if (after) {
        params.append('after', after);
      }
      if (sortBy === 'top') {
        params.append('t', topTimeframe);
      }
      params.append('limit', '100');
      params.append('raw_json', '1');
      params.append('include_over_18', 'true');
      
      const queryString = params.toString();
      if (queryString) {
        finalUrl += `?${queryString}`;
      }
      
      return finalUrl;
    } else {
      let finalUrl = cleanUrl + '.json';
      const params = new URLSearchParams();
      if (after) {
        params.append('after', after);
      }
      params.append('raw_json', '1');
      params.append('include_over_18', 'true');
      
      const queryString = params.toString();
      if (queryString) {
        finalUrl += `?${queryString}`;
      }
      
      return finalUrl;
    }
  };

  const fetchWithFallback = async (jsonUrl: string, proxyIndex: number = 0): Promise<any> => {
    if (proxyIndex >= CORS_PROXIES.length) {
      throw new Error('All CORS proxies failed');
    }

    const proxy = CORS_PROXIES[proxyIndex];
    const proxyUrl = proxy + encodeURIComponent(jsonUrl);
    
    console.log(`🔄 Trying proxy ${proxyIndex + 1}/${CORS_PROXIES.length}:`, proxy);

    try {
      const response = await fetch(proxyUrl, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`❌ Proxy ${proxyIndex + 1} failed with status ${response.status}`);
        // Try next proxy
        return fetchWithFallback(jsonUrl, proxyIndex + 1);
      }

      console.log(`✅ Proxy ${proxyIndex + 1} succeeded!`);
      setCurrentProxyIndex(proxyIndex); // Remember working proxy
      return await response.json();
    } catch (error) {
      console.warn(`❌ Proxy ${proxyIndex + 1} error:`, error);
      // Try next proxy
      return fetchWithFallback(jsonUrl, proxyIndex + 1);
    }
  };

  const fetchRedditPage = async (url: string, after: string | null = null) => {
    const jsonUrl = buildRedditUrl(url, after);
    console.log('📍 Fetching URL:', jsonUrl);
    
    return fetchWithFallback(jsonUrl, currentProxyIndex);
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

      while (pagesLoaded < MAX_REDDIT_PAGES) {
        const data = await fetchRedditPage(url.trim(), after);

        if (Array.isArray(data) && data.length > 0 && data[0].data?.children) {
          const post = data[0].data.children[0];
          allMedia.push(...extractMediaFromPost(post));
          break;
        }
        else if (data.data?.children) {
          console.log(`📦 Page ${pagesLoaded + 1}: Got ${data.data.children.length} posts`);
          
          data.data.children.forEach((post: any) => {
            const extracted = extractMediaFromPost(post);
            allMedia.push(...extracted);
          });

          after = data.data.after;
          pagesLoaded++;

          toast({
            title: "Loading...",
            description: `Loaded ${allMedia.length} media items from ${pagesLoaded} page(s)...`,
          });

          if (!after) {
            console.log('✅ No more pages available');
            break;
          }

          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          break;
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
        description: error instanceof Error && error.message === 'All CORS proxies failed' 
          ? "All proxy servers are unavailable. Please try again later or use a CORS browser extension."
          : "Failed to fetch media from Reddit. Please try again.",
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
      <header className="py-8">
        <h1 className="text-center">
          <span className="text-5xl md:text-6xl font-bold text-primary tracking-tight">
            Redditor
          </span>
        </h1>
      </header>

      <main className="container max-w-6xl mx-auto px-4 pb-16">
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
