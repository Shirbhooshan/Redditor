import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import RedditorSearch from "@/components/RedditorSearch";
import MediaGrid, { MediaItem } from "@/components/MediaGrid";
import Pagination from "@/components/Pagination";

const ITEMS_PER_PAGE = 30;
const MAX_REDDIT_PAGES = 10;

type SortOption = "hot" | "best" | "top" | "new";
type TopTimeframe = "hour" | "day" | "week" | "month" | "year" | "all";

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

  const clean = (url?: string) => url?.replace(/&amp;/g, '&') ?? '';

  const extractMediaFromPost = (post: any) => {
    const postData = post.data;
    const foundMedia: MediaItem[] = [];

    // ── Gallery posts ──────────────────────────────────────────
    if (postData.is_gallery && postData.media_metadata) {
      Object.values(postData.media_metadata).forEach((item: any) => {
        if (item.status !== 'valid') return;
        if (item.e === 'AnimatedImage') {
          // Prefer mp4 over gif for animated gallery items
          const mp4 = clean(item.s?.mp4);
          const gif = clean(item.s?.gif) || clean(item.s?.u);
          if (mp4) {
            foundMedia.push({ type: 'video', url: mp4, width: item.s?.x, height: item.s?.y, isGif: true });
          } else if (gif) {
            foundMedia.push({ type: 'video', url: gif, width: item.s?.x, height: item.s?.y, isGif: true });
          }
        } else {
          const url = clean(item.s?.u) || clean(item.s?.gif);
          if (url) foundMedia.push({ type: 'image', url, width: item.s?.x, height: item.s?.y });
        }
      });
    }

    // ── Reddit-hosted video ────────────────────────────────────
    else if (postData.is_video && postData.media?.reddit_video) {
      const videoData = postData.media.reddit_video;
      const videoUrl = videoData.fallback_url || videoData.hls_url;
      const hasAudio = videoData.has_audio;
      let audioUrl: string | null = null;
      if (hasAudio && videoUrl) {
        const dashIndex = videoUrl.lastIndexOf('/DASH_');
        if (dashIndex !== -1) audioUrl = `${videoUrl.substring(0, dashIndex)}/DASH_audio.mp4`;
      }
      foundMedia.push({
        type: 'video', url: videoUrl, audioUrl: audioUrl ?? undefined,
        thumbnail: postData.thumbnail !== 'default' ? postData.thumbnail : undefined,
        width: videoData.width, height: videoData.height, hasAudio,
      });
    }

    // ── Image post (check for GIF/MP4 variant first) ───────────
    else if (postData.post_hint === 'image' && postData.url) {
      const preview = postData.preview?.images?.[0];
      const mp4Url = clean(preview?.variants?.mp4?.source?.url);
      const isGifPost = /\.gif$/i.test(postData.url) || postData.url.includes('i.redd.it') && preview?.variants?.mp4;

      if (mp4Url) {
        foundMedia.push({
          type: 'video', url: mp4Url, isGif: true,
          width: preview?.variants?.mp4?.source?.width,
          height: preview?.variants?.mp4?.source?.height,
        });
      } else {
        const previewUrl = clean(preview?.source?.url) || postData.url;
        foundMedia.push({ type: 'image', url: previewUrl, width: preview?.source?.width, height: preview?.source?.height });
      }
    }

    // ── rich:video ─────────────────────────────────────────────
    else if (postData.post_hint === 'rich:video' && postData.preview?.reddit_video_preview) {
      const videoUrl = postData.preview.reddit_video_preview.fallback_url;
      foundMedia.push({
        type: 'video', url: videoUrl, thumbnail: postData.thumbnail,
        width: postData.preview.reddit_video_preview.width,
        height: postData.preview.reddit_video_preview.height,
      });
    }

    // ── v.redd.it ──────────────────────────────────────────────
    else if (postData.domain === 'v.redd.it') {
      const src = postData.preview?.reddit_video_preview || postData.media?.reddit_video;
      if (src) {
        const videoUrl = src.fallback_url;
        const hasAudio = src.has_audio ?? true;
        let audioUrl: string | null = null;
        if (videoUrl) {
          const dashIndex = videoUrl.lastIndexOf('/DASH_');
          if (dashIndex !== -1) audioUrl = `${videoUrl.substring(0, dashIndex)}/DASH_audio.mp4`;
        }
        foundMedia.push({
          type: 'video', url: videoUrl, audioUrl: audioUrl ?? undefined,
          thumbnail: postData.thumbnail, width: src.width, height: src.height, hasAudio,
        });
      }
    }

    // ── Direct URL ending in image/gif extension ───────────────
    else if (postData.url && /\.(jpg|jpeg|png|gif|webp)$/i.test(postData.url)) {
      const preview = postData.preview?.images?.[0];
      const mp4Url = clean(preview?.variants?.mp4?.source?.url);
      const isGifUrl = /\.gif$/i.test(postData.url);

      if (isGifUrl && mp4Url) {
        foundMedia.push({
          type: 'video', url: mp4Url, isGif: true,
          width: preview?.variants?.mp4?.source?.width,
          height: preview?.variants?.mp4?.source?.height,
        });
      } else if (isGifUrl) {
        // No mp4 variant — use gif directly (will fallback via proxy in MediaGrid)
        foundMedia.push({ type: 'image', url: postData.url });
      } else {
        foundMedia.push({ type: 'image', url: postData.url });
      }
    }

    // ── i.redd.it / imgur ──────────────────────────────────────
    else if (postData.url && (postData.url.includes('i.redd.it') || postData.url.includes('imgur.com'))) {
      const preview = postData.preview?.images?.[0];
      const mp4Url = clean(preview?.variants?.mp4?.source?.url);
      if (mp4Url) {
        foundMedia.push({
          type: 'video', url: mp4Url, isGif: true,
          width: preview?.variants?.mp4?.source?.width,
          height: preview?.variants?.mp4?.source?.height,
        });
      } else if (preview?.source?.url) {
        foundMedia.push({ type: 'image', url: clean(preview.source.url), width: preview.source.width, height: preview.source.height });
      } else {
        foundMedia.push({ type: 'image', url: postData.url });
      }
    }

    // ── Fallback: any preview image ────────────────────────────
    else if (postData.preview?.images?.[0]?.source?.url) {
      const preview = postData.preview.images[0];
      const mp4Url = clean(preview?.variants?.mp4?.source?.url);
      if (mp4Url) {
        foundMedia.push({
          type: 'video', url: mp4Url, isGif: true,
          width: preview?.variants?.mp4?.source?.width,
          height: preview?.variants?.mp4?.source?.height,
        });
      } else {
        foundMedia.push({ type: 'image', url: clean(preview.source.url), width: preview.source.width, height: preview.source.height });
      }
    }

    return foundMedia;
  };

  const buildRedditUrl = (baseUrl: string, after: string | null = null) => {
    let cleanUrl = baseUrl.trim().replace(/\/$/, '').replace(/\.json$/, '');
    const subredditMatch = cleanUrl.match(/reddit\.com\/r\/([\w]+)/);

    if (subredditMatch) {
      const subreddit = subredditMatch[1];
      let finalUrl = `https://www.reddit.com/r/${subreddit}`;
      if (sortBy === 'best') finalUrl += '.json';
      else if (sortBy === 'hot') finalUrl += '/hot.json';
      else if (sortBy === 'top') finalUrl += '/top.json';
      else if (sortBy === 'new') finalUrl += '/new.json';

      const params = new URLSearchParams();
      if (after) params.append('after', after);
      if (sortBy === 'top') params.append('t', topTimeframe);
      params.append('limit', '100');
      params.append('raw_json', '1');
      params.append('include_over_18', 'true');
      const qs = params.toString();
      return qs ? `${finalUrl}?${qs}` : finalUrl;
    } else {
      let finalUrl = cleanUrl + '.json';
      const params = new URLSearchParams();
      if (after) params.append('after', after);
      params.append('raw_json', '1');
      params.append('include_over_18', 'true');
      const qs = params.toString();
      return qs ? `${finalUrl}?${qs}` : finalUrl;
    }
  };

  const fetchRedditPage = async (url: string, after: string | null = null) => {
    const jsonUrl = buildRedditUrl(url, after);

    try {
      const proxyUrl = `${PROXY_URL}${encodeURIComponent(jsonUrl)}`;
      const response = await fetch(proxyUrl, { headers: { 'Accept': 'application/json' } });
      if (response.ok) return await response.json();
    } catch (error) {
      console.warn('Method 1 error:', error);
    }

    try {
      const oldRedditUrl = jsonUrl.replace('www.reddit.com', 'old.reddit.com');
      const response = await fetch(oldRedditUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
        mode: 'cors',
      });
      if (response.ok) return await response.json();
    } catch (error) {
      console.warn('Method 2 error:', error);
    }

    throw new Error('All fetch methods failed.');
  };

  const handleSearch = async (url: string) => {
    setIsLoading(true);
    setHasSearched(true);
    setCurrentPage(1);

    try {
      const allMedia: MediaItem[] = [];
      let after: string | null = null;
      let pagesLoaded = 0;

      toast({ title: "Fetching media...", description: `Loading ${sortBy === 'top' ? `top posts (${topTimeframe})` : sortBy} posts from Reddit...` });

      while (pagesLoaded < MAX_REDDIT_PAGES) {
        const data = await fetchRedditPage(url.trim(), after);

        if (Array.isArray(data) && data.length > 0 && data[0].data?.children) {
          allMedia.push(...extractMediaFromPost(data[0].data.children[0]));
          break;
        } else if (data.data?.children) {
          data.data.children.forEach((post: any) => allMedia.push(...extractMediaFromPost(post)));
          after = data.data.after;
          pagesLoaded++;
          toast({ title: "Loading...", description: `Loaded ${allMedia.length} media items from ${pagesLoaded} page(s)...` });
          if (!after) break;
          await new Promise(resolve => setTimeout(resolve, 500));
        } else break;
      }

      setMedia(allMedia);

      if (allMedia.length === 0) {
        toast({ title: "No media found", description: "This Reddit URL doesn't contain any extractable images or videos." });
      } else {
        toast({ title: "Success!", description: `Found ${allMedia.length} media items from ${pagesLoaded} page(s)` });
      }
    } catch (error) {
      console.error("Error fetching media:", error);
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to fetch media.", variant: "destructive" });
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
        <div className={`transition-all duration-500 ${hasSearched && media.length > 0 ? "mb-12" : "min-h-[50vh] flex flex-col justify-center"}`}>
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
              Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, media.length)}-{Math.min(currentPage * ITEMS_PER_PAGE, media.length)} of {media.length} items
              {totalPages > 1 && ` (Page ${currentPage} of ${totalPages})`}
              {sortBy === 'top' && ` • Sorted by: Top (${topTimeframe})`}
              {sortBy !== 'top' && ` • Sorted by: ${sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}`}
            </div>
            <MediaGrid media={media} currentPage={currentPage} itemsPerPage={ITEMS_PER_PAGE} />
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
          </>
        )}

        {hasSearched && !isLoading && media.length === 0 && (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg">No media found. Try a different Reddit URL.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Redditor;
