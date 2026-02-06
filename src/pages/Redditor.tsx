import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import RedditorSearch from "@/components/RedditorSearch";
import MediaGrid, { MediaItem } from "@/components/MediaGrid";
import Pagination from "@/components/Pagination";

const ITEMS_PER_PAGE = 30;
const MAX_REDDIT_PAGES = 10;

type SortOption = "hot" | "best" | "top" | "new";
type TopTimeframe = "hour" | "day" | "week" | "month" | "year" | "all";

// Use relative path for Netlify Functions
const PROXY_URL = '/.netlify/functions/reddit-proxy?url=';

const Redditor = () => {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("best");
  const [topTimeframe, setTopTimeframe] = useState<TopTimeframe>("all");
  const { toast } = useToast();

  const totalPages = Math.ceil(media.length / ITEMS_PER_PAGE);

  const extractMediaFromPost = (post: any) => {
    const postData = post.data;
    const foundMedia: MediaItem[] = [];

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
    else if (postData.post_hint === 'image' && postData.url) {
      foundMedia.push({
        type: 'image',
        url: postData.url,
        width: postData.preview?.images?.[0]?.source?.width,
        height: postData.preview?.images?.[0]?.source?.height
      });
    }
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
    else if (postData.url && /\.(jpg|jpeg|png|gif|webp)$/i.test(postData.url)) {
      foundMedia.push({
        type: 'image',
        url: postData.url
      });
    }
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

  const fetchRedditPage = async (url: string, after: string | null = null) => {
    const jsonUrl = buildRedditUrl(url, after);
    console.log('📍 Fetching URL:', jsonUrl);
    
    // Try method 1: Netlify Function proxy
    try {
      const proxyUrl = `${PROXY_URL}${encodeURIComponent(jsonUrl)}`;
      console.log('🔗 Method 1: Via Netlify Function:', proxyUrl);

      const response = await fetch(proxyUrl, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        return await response.json();
      }
      
      console.warn('⚠️ Method 1 failed with status:', response.status);
    } catch (error) {
      console.warn('⚠️ Method 1 error:', error);
    }

    // Try method 2: Direct fetch with old.reddit.com
    try {
      console.log('🔗 Method 2: Direct fetch with old.reddit.com');
      const oldRedditUrl = jsonUrl.replace('www.reddit.com', 'old.reddit.com');
      
      const response = await fetch(oldRedditUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
        mode: 'cors',
      });

      if (response.ok) {
        return await response.json();
      }
      
      console.warn('⚠️ Method 2 failed with status:', response.status);
    } catch (error) {
      console.warn('⚠️ Method 2 error:', error);
    }

    throw new Error('All fetch methods failed. Reddit may be blocking requests. Try:\n1. Using old.reddit.com URLs directly\n2. Waiting a few minutes\n3. Using a VPN if available');
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
        description: error instanceof Error ? error.message : "Failed to fetch media from Reddit. Check console for details.",
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
