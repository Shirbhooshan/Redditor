import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import RedditorSearch from "@/components/RedditorSearch";
import MediaGrid, { MediaItem } from "@/components/MediaGrid";
import Pagination from "@/components/Pagination";

const ITEMS_PER_PAGE = 30;
const MAX_REDDIT_PAGES = 10;

type SortOption = "hot" | "best" | "top" | "new";
type TopTimeframe = "hour" | "day" | "week" | "month" | "year" | "all";

const PROXY_URL = "/.netlify/functions/reddit-proxy?url=";

const Redditor = () => {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("best");
  const [topTimeframe, setTopTimeframe] = useState<TopTimeframe>("all");
  const { toast } = useToast();

  const totalPages = Math.ceil(media.length / ITEMS_PER_PAGE);

  const clean = (url?: string) => url?.replace(/&amp;/g, "&") ?? "";

  const extractMediaFromPost = (post: any): MediaItem[] => {
    const postData = post.data;
    const found: MediaItem[] = [];

    // ── Gallery ────────────────────────────────────────────────
    if (postData.is_gallery && postData.media_metadata) {
      Object.values(postData.media_metadata).forEach((item: any) => {
        if (item.status !== "valid") return;
        if (item.e === "AnimatedImage") {
          const mp4 = clean(item.s?.mp4);
          const gif = clean(item.s?.gif) || clean(item.s?.u);
          if (mp4) found.push({ type: "video", url: mp4, width: item.s?.x, height: item.s?.y, isGif: true });
          else if (gif) found.push({ type: "video", url: gif, width: item.s?.x, height: item.s?.y, isGif: true });
        } else {
          const url = clean(item.s?.u) || clean(item.s?.gif);
          if (url) found.push({ type: "image", url, width: item.s?.x, height: item.s?.y });
        }
      });
    }

    // ── Reddit video ───────────────────────────────────────────
    else if (postData.is_video && postData.media?.reddit_video) {
      const vd = postData.media.reddit_video;
      const videoUrl = vd.fallback_url || vd.hls_url;
      const hasAudio = vd.has_audio;
      let audioUrl: string | undefined;
      if (hasAudio && videoUrl) {
        const i = videoUrl.lastIndexOf("/DASH_");
        if (i !== -1) audioUrl = `${videoUrl.substring(0, i)}/DASH_audio.mp4`;
      }
      found.push({ type: "video", url: videoUrl, audioUrl, thumbnail: postData.thumbnail !== "default" ? postData.thumbnail : undefined, width: vd.width, height: vd.height, hasAudio });
    }

    // ── Image post — check for MP4 variant (GIF) ───────────────
    else if (postData.post_hint === "image" && postData.url) {
      const preview = postData.preview?.images?.[0];
      const mp4Url = clean(preview?.variants?.mp4?.source?.url);
      if (mp4Url) {
        found.push({ type: "video", url: mp4Url, isGif: true, width: preview?.variants?.mp4?.source?.width, height: preview?.variants?.mp4?.source?.height });
      } else {
        const previewUrl = clean(preview?.source?.url) || postData.url;
        found.push({ type: "image", url: previewUrl, width: preview?.source?.width, height: preview?.source?.height });
      }
    }

    // ── rich:video ─────────────────────────────────────────────
    else if (postData.post_hint === "rich:video" && postData.preview?.reddit_video_preview) {
      const vp = postData.preview.reddit_video_preview;
      found.push({ type: "video", url: vp.fallback_url, thumbnail: postData.thumbnail, width: vp.width, height: vp.height });
    }

    // ── v.redd.it ──────────────────────────────────────────────
    else if (postData.domain === "v.redd.it") {
      const src = postData.preview?.reddit_video_preview || postData.media?.reddit_video;
      if (src) {
        const videoUrl = src.fallback_url;
        const hasAudio = src.has_audio ?? true;
        let audioUrl: string | undefined;
        if (videoUrl) {
          const i = videoUrl.lastIndexOf("/DASH_");
          if (i !== -1) audioUrl = `${videoUrl.substring(0, i)}/DASH_audio.mp4`;
        }
        found.push({ type: "video", url: videoUrl, audioUrl, thumbnail: postData.thumbnail, width: src.width, height: src.height, hasAudio });
      }
    }

    // ── Direct .gif URL ────────────────────────────────────────
    else if (postData.url && /\.gif$/i.test(postData.url)) {
      const preview = postData.preview?.images?.[0];
      const mp4Url = clean(preview?.variants?.mp4?.source?.url);
      if (mp4Url) found.push({ type: "video", url: mp4Url, isGif: true, width: preview?.variants?.mp4?.source?.width, height: preview?.variants?.mp4?.source?.height });
      else found.push({ type: "image", url: postData.url });
    }

    // ── Other direct image URLs ────────────────────────────────
    else if (postData.url && /\.(jpg|jpeg|png|webp)$/i.test(postData.url)) {
      found.push({ type: "image", url: postData.url });
    }

    // ── i.redd.it / imgur ──────────────────────────────────────
    else if (postData.url && (postData.url.includes("i.redd.it") || postData.url.includes("imgur.com"))) {
      const preview = postData.preview?.images?.[0];
      const mp4Url = clean(preview?.variants?.mp4?.source?.url);
      if (mp4Url) found.push({ type: "video", url: mp4Url, isGif: true, width: preview?.variants?.mp4?.source?.width, height: preview?.variants?.mp4?.source?.height });
      else if (preview?.source?.url) found.push({ type: "image", url: clean(preview.source.url), width: preview.source.width, height: preview.source.height });
      else found.push({ type: "image", url: postData.url });
    }

    // ── Fallback: preview image ────────────────────────────────
    else if (postData.preview?.images?.[0]?.source?.url) {
      const preview = postData.preview.images[0];
      const mp4Url = clean(preview?.variants?.mp4?.source?.url);
      if (mp4Url) found.push({ type: "video", url: mp4Url, isGif: true, width: preview?.variants?.mp4?.source?.width, height: preview?.variants?.mp4?.source?.height });
      else found.push({ type: "image", url: clean(preview.source.url), width: preview.source.width, height: preview.source.height });
    }

    return found;
  };

  const buildRedditUrl = (baseUrl: string, after: string | null = null) => {
    const cleanUrl = baseUrl.trim().replace(/\/$/, "").replace(/\.json$/, "");
    const subredditMatch = cleanUrl.match(/reddit\.com\/r\/([\w]+)/);

    let finalUrl: string;
    if (subredditMatch) {
      const sub = subredditMatch[1];
      const sortSuffix = sortBy === "best" ? "" : `/${sortBy}`;
      finalUrl = `https://www.reddit.com/r/${sub}${sortSuffix}.json`;
    } else {
      finalUrl = cleanUrl + ".json";
    }

    const params = new URLSearchParams();
    if (after) params.append("after", after);
    if (sortBy === "top") params.append("t", topTimeframe);
    params.append("limit", "100");
    params.append("raw_json", "1");
    params.append("include_over_18", "true");
    return `${finalUrl}?${params.toString()}`;
  };

  const fetchRedditPage = async (url: string, after: string | null = null) => {
    const jsonUrl = buildRedditUrl(url, after);

    // Method 1: Netlify proxy
    try {
      const res = await fetch(`${PROXY_URL}${encodeURIComponent(jsonUrl)}`, { headers: { Accept: "application/json" } });
      if (res.ok) return await res.json();
    } catch {}

    // Method 2: Direct old.reddit.com
    try {
      const res = await fetch(jsonUrl.replace("www.reddit.com", "old.reddit.com"), {
        headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
        mode: "cors",
      });
      if (res.ok) return await res.json();
    } catch {}

    throw new Error("Failed to fetch from Reddit.");
  };

  const handleSearch = async (url: string) => {
    setIsLoading(true);
    setHasSearched(true);
    setCurrentPage(1);

    try {
      const allMedia: MediaItem[] = [];
      let after: string | null = null;
      let pagesLoaded = 0;

      toast({ title: "Fetching media…", description: `Loading ${sortBy === "top" ? `top (${topTimeframe})` : sortBy} posts…` });

      while (pagesLoaded < MAX_REDDIT_PAGES) {
        const data = await fetchRedditPage(url.trim(), after);

        if (Array.isArray(data) && data[0]?.data?.children) {
          allMedia.push(...extractMediaFromPost(data[0].data.children[0]));
          break;
        } else if (data.data?.children) {
          data.data.children.forEach((post: any) => allMedia.push(...extractMediaFromPost(post)));
          after = data.data.after;
          pagesLoaded++;
          toast({ title: "Loading…", description: `${allMedia.length} items from ${pagesLoaded} page(s)…` });
          if (!after) break;
          await new Promise((r) => setTimeout(r, 500));
        } else break;
      }

      setMedia(allMedia);
      if (allMedia.length === 0) toast({ title: "No media found", description: "This subreddit has no extractable media." });
      else toast({ title: "Done!", description: `Found ${allMedia.length} items` });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to fetch.", variant: "destructive" });
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
          <span className="text-5xl md:text-6xl font-bold text-primary tracking-tight">Redditor</span>
        </h1>
      </header>

      <main className="container max-w-6xl mx-auto px-4 pb-16">
        <div className={`transition-all duration-500 ${hasSearched && media.length > 0 ? "mb-12" : "min-h-[50vh] flex flex-col justify-center"}`}>
          <RedditorSearch onSearch={handleSearch} isLoading={isLoading} sortBy={sortBy} onSortChange={setSortBy} topTimeframe={topTimeframe} onTopTimeframeChange={setTopTimeframe} />
        </div>

        {hasSearched && media.length > 0 && (
          <>
            <div className="mb-6 text-muted-foreground text-sm">
              Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, media.length)}–{Math.min(currentPage * ITEMS_PER_PAGE, media.length)} of {media.length} items
              {totalPages > 1 && ` (Page ${currentPage} of ${totalPages})`}
              {" • "}Sorted by: {sortBy === "top" ? `Top (${topTimeframe})` : sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
            </div>
            <MediaGrid media={media} currentPage={currentPage} itemsPerPage={ITEMS_PER_PAGE} />
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
          </>
        )}

        {hasSearched && !isLoading && media.length === 0 && (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg">No media found. Try a different subreddit.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Redditor;
