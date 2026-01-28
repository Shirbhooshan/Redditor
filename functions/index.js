// Firebase Cloud Function
// File: functions/index.js

const functions = require('firebase-functions');
const cors = require('cors')({origin: true});

exports.fetchRedditMedia = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({error: 'Method not allowed'});
    }

    try {
      const { url } = req.body;

      if (!url) {
        return res.status(400).json({error: 'URL is required'});
      }

      // Convert regular Reddit URL to JSON API URL
      let jsonUrl = url;
      if (!url.endsWith('.json')) {
        jsonUrl = url.replace(/\/$/, '') + '.json';
      }

      // Fetch from Reddit with user agent
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(jsonUrl, {
        headers: {
          'User-Agent': 'Redditor Media Fetcher/1.0'
        }
      });

      if (!response.ok) {
        return res.status(response.status).json({error: 'Failed to fetch from Reddit'});
      }

      const data = await response.json();
      const media = [];

      // Helper function to extract media from a post
      const extractMediaFromPost = (post) => {
        const postData = post.data;

        // Check for gallery posts
        if (postData.is_gallery && postData.media_metadata) {
          Object.values(postData.media_metadata).forEach((item) => {
            if (item.status === 'valid') {
              const url = item.s?.u?.replace(/&amp;/g, '&') || item.s?.gif?.replace(/&amp;/g, '&');
              if (url) {
                media.push({
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
        else if (postData.is_video && postData.media?.reddit_video?.fallback_url) {
          media.push({
            type: 'video',
            url: postData.media.reddit_video.fallback_url,
            thumbnail: postData.thumbnail,
            width: postData.media.reddit_video.width,
            height: postData.media.reddit_video.height
          });
        }
        // Check for image posts
        else if (postData.post_hint === 'image' && postData.url) {
          media.push({
            type: 'image',
            url: postData.url,
            width: postData.preview?.images?.[0]?.source?.width,
            height: postData.preview?.images?.[0]?.source?.height
          });
        }
        // Check for hosted video (v.redd.it)
        else if (postData.domain === 'v.redd.it' && postData.preview?.reddit_video_preview?.fallback_url) {
          media.push({
            type: 'video',
            url: postData.preview.reddit_video_preview.fallback_url,
            thumbnail: postData.thumbnail,
            width: postData.preview.reddit_video_preview.width,
            height: postData.preview.reddit_video_preview.height
          });
        }
        // Check for external images
        else if (postData.url && /\.(jpg|jpeg|png|gif|webp)$/i.test(postData.url)) {
          media.push({
            type: 'image',
            url: postData.url
          });
        }
      };

      // Handle single post
      if (Array.isArray(data) && data.length > 0 && data[0].data?.children) {
        const post = data[0].data.children[0];
        extractMediaFromPost(post);
      }
      // Handle subreddit listing
      else if (data.data?.children) {
        data.data.children.forEach((post) => {
          extractMediaFromPost(post);
        });
      }

      return res.status(200).json({
        media,
        total: media.length
      });

    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({error: error.message || 'Internal server error'});
    }
  });
});