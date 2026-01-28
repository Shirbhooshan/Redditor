import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Convert regular Reddit URL to JSON API URL
    let jsonUrl = url
    if (!url.endsWith('.json')) {
      jsonUrl = url.replace(/\/$/, '') + '.json'
    }

    // Add user agent to avoid rate limiting
    const response = await fetch(jsonUrl, {
      headers: {
        'User-Agent': 'Redditor Media Fetcher/1.0'
      }
    })

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch from Reddit' }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const data = await response.json()
    const media: any[] = []

    // Helper function to extract media from a post
    const extractMediaFromPost = (post: any) => {
      const postData = post.data

      // Check for gallery posts
      if (postData.is_gallery && postData.media_metadata) {
        Object.values(postData.media_metadata).forEach((item: any) => {
          if (item.status === 'valid') {
            const url = item.s?.u?.replace(/&amp;/g, '&') || item.s?.gif?.replace(/&amp;/g, '&')
            if (url) {
              media.push({
                type: item.e === 'AnimatedImage' ? 'video' : 'image',
                url: url,
                width: item.s?.x,
                height: item.s?.y
              })
            }
          }
        })
      }
      // Check for video posts
      else if (postData.is_video && postData.media?.reddit_video?.fallback_url) {
        media.push({
          type: 'video',
          url: postData.media.reddit_video.fallback_url,
          thumbnail: postData.thumbnail,
          width: postData.media.reddit_video.width,
          height: postData.media.reddit_video.height
        })
      }
      // Check for image posts
      else if (postData.post_hint === 'image' && postData.url) {
        media.push({
          type: 'image',
          url: postData.url,
          width: postData.preview?.images?.[0]?.source?.width,
          height: postData.preview?.images?.[0]?.source?.height
        })
      }
      // Check for hosted video (v.redd.it)
      else if (postData.domain === 'v.redd.it' && postData.preview?.reddit_video_preview?.fallback_url) {
        media.push({
          type: 'video',
          url: postData.preview.reddit_video_preview.fallback_url,
          thumbnail: postData.thumbnail,
          width: postData.preview.reddit_video_preview.width,
          height: postData.preview.reddit_video_preview.height
        })
      }
      // Check for external images
      else if (postData.url && /\.(jpg|jpeg|png|gif|webp)$/i.test(postData.url)) {
        media.push({
          type: 'image',
          url: postData.url
        })
      }
    }

    // Handle single post
    if (Array.isArray(data) && data.length > 0 && data[0].data?.children) {
      // This is a post with comments
      const post = data[0].data.children[0]
      extractMediaFromPost(post)
    }
    // Handle subreddit listing
    else if (data.data?.children) {
      data.data.children.forEach((post: any) => {
        extractMediaFromPost(post)
      })
    }

    return new Response(
      JSON.stringify({ 
        media, 
        total: media.length 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})