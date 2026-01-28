import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MediaItem {
  type: 'image' | 'video';
  url: string;
  thumbnail?: string;
  width?: number;
  height?: number;
}

function extractMediaFromPost(post: any): MediaItem[] {
  const media: MediaItem[] = [];
  const data = post.data;

  // Check for direct image
  if (data.url && /\.(jpg|jpeg|png|gif|webp)$/i.test(data.url)) {
    media.push({
      type: 'image',
      url: data.url,
      thumbnail: data.thumbnail !== 'self' && data.thumbnail !== 'default' ? data.thumbnail : undefined,
    });
  }

  // Check for Reddit hosted images
  if (data.preview?.images) {
    for (const img of data.preview.images) {
      const source = img.source;
      if (source?.url) {
        media.push({
          type: 'image',
          url: source.url.replace(/&amp;/g, '&'),
          width: source.width,
          height: source.height,
          thumbnail: img.resolutions?.[2]?.url?.replace(/&amp;/g, '&'),
        });
      }
      
      // Check for gif/video variants
      if (img.variants?.mp4?.source?.url) {
        media.push({
          type: 'video',
          url: img.variants.mp4.source.url.replace(/&amp;/g, '&'),
          thumbnail: source?.url?.replace(/&amp;/g, '&'),
        });
      }
    }
  }

  // Check for Reddit video
  if (data.media?.reddit_video?.fallback_url) {
    media.push({
      type: 'video',
      url: data.media.reddit_video.fallback_url,
      thumbnail: data.thumbnail !== 'self' && data.thumbnail !== 'default' ? data.thumbnail : undefined,
      width: data.media.reddit_video.width,
      height: data.media.reddit_video.height,
    });
  }

  // Check for gallery
  if (data.is_gallery && data.media_metadata) {
    for (const [key, value] of Object.entries(data.media_metadata as Record<string, any>)) {
      if (value.status === 'valid') {
        if (value.e === 'Image') {
          const url = value.s?.u?.replace(/&amp;/g, '&') || `https://i.redd.it/${key}.jpg`;
          media.push({
            type: 'image',
            url,
            width: value.s?.x,
            height: value.s?.y,
            thumbnail: value.p?.[2]?.u?.replace(/&amp;/g, '&'),
          });
        } else if (value.e === 'AnimatedImage') {
          media.push({
            type: 'video',
            url: value.s?.mp4?.replace(/&amp;/g, '&') || value.s?.gif?.replace(/&amp;/g, '&'),
            thumbnail: value.p?.[2]?.u?.replace(/&amp;/g, '&'),
          });
        }
      }
    }
  }

  // Check for crosspost
  if (data.crosspost_parent_list?.length > 0) {
    for (const crosspost of data.crosspost_parent_list) {
      media.push(...extractMediaFromPost({ data: crosspost }));
    }
  }

  return media;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching Reddit URL:', url);

    // Clean up the URL and append .json
    let redditUrl = url.trim();
    
    // Remove trailing slash
    redditUrl = redditUrl.replace(/\/$/, '');
    
    // Add .json if not present
    if (!redditUrl.endsWith('.json')) {
      redditUrl = redditUrl + '.json';
    }

    // Ensure it's a reddit URL
    if (!redditUrl.includes('reddit.com')) {
      return new Response(
        JSON.stringify({ error: 'Please provide a valid Reddit URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response = await fetch(redditUrl, {
      headers: {
        'User-Agent': 'Redditor Media Viewer/1.0',
      },
    });

    if (!response.ok) {
      console.error('Reddit API error:', response.status, response.statusText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch Reddit data. Please check the URL.' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('Reddit data received');

    const allMedia: MediaItem[] = [];

    // Handle different Reddit JSON structures
    if (Array.isArray(data)) {
      // Single post page (has comments)
      if (data[0]?.data?.children) {
        for (const child of data[0].data.children) {
          allMedia.push(...extractMediaFromPost(child));
        }
      }
    } else if (data?.data?.children) {
      // Subreddit or listing page
      for (const child of data.data.children) {
        allMedia.push(...extractMediaFromPost(child));
      }
    }

    // Remove duplicates based on URL
    const uniqueMedia = allMedia.filter((item, index, self) =>
      index === self.findIndex(t => t.url === item.url)
    );

    console.log(`Found ${uniqueMedia.length} media items`);

    return new Response(
      JSON.stringify({ media: uniqueMedia, total: uniqueMedia.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred while processing your request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
