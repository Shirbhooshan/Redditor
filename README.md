# Redditor 🔴

A clean, fast media browser for Reddit. Enter any subreddit and instantly extract all its images, GIFs, and videos into a paginated gallery with lightbox support.

---

## Features

- 🔍 **Subreddit search** — paste a subreddit name or full Reddit URL
- 🖼 **Media grid** — images, GIFs, and videos in a responsive 3-column grid
- 🎛 **Type filters** — filter by Image, GIF, or Video with live counts
- 📄 **Pagination** — 30 items per page, mobile-friendly prev/next controls
- 🔦 **Lightbox** — full-screen viewer with keyboard navigation (← → Esc)
- 🎬 **Video player** — custom controls, scrub bar, volume, and synced audio tracks for Reddit videos
- 🎞 **GIF player** — frame-by-frame scrubbing in the lightbox
- 📱 **Mobile responsive** — works on all screen sizes
- 🔃 **Sort options** — Best, Hot, Top (with timeframe), New
- 🌑 **Dark mode** — dark theme throughout

---

## Tech Stack

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Netlify Functions](https://www.netlify.com/products/functions/) — proxy for Reddit & media requests
- [React Router](https://reactrouter.com/)
- [TanStack Query](https://tanstack.com/query)

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- [Netlify CLI](https://docs.netlify.com/cli/get-started/) (for local proxy functions)

### Installation

```bash
# Clone the repo
git clone https://github.com/your-username/redditor.git
cd redditor

# Install dependencies
npm install
```

### Running locally

The app uses Netlify Functions as a proxy to bypass Reddit's CORS restrictions. You'll need the Netlify CLI to run them locally.

```bash
# Install Netlify CLI globally
npm install -g netlify-cli

# Start the dev server with functions
netlify dev
```

The app will be available at `http://localhost:8888`.

> **Note:** Running with plain `npm run dev` (Vite only) will work for the UI, but Reddit API calls will fail without the proxy functions running.

### Building for production

```bash
npm run build
```

Output goes to the `dist/` folder. Deploy to Netlify and the functions will be picked up automatically.

---

## Project Structure

```
├── netlify/
│   └── functions/
│       ├── reddit-proxy.js     # Proxies Reddit API requests
│       └── media-proxy.js      # Proxies media (images/videos) to avoid CORS
├── src/
│   ├── components/
│   │   ├── MediaGrid.tsx       # Responsive media grid
│   │   ├── MediaLightbox.tsx   # Full-screen lightbox with video/GIF players
│   │   ├── Pagination.tsx      # Page controls
│   │   └── RedditorSearch.tsx  # Search bar and sort controls
│   ├── pages/
│   │   └── Redditor.tsx        # Main page — fetching, filtering, state
│   └── ...
```

---

## Deployment

This project is built to deploy on **Netlify**:

1. Push to GitHub
2. Connect the repo in the [Netlify dashboard](https://app.netlify.com/)
3. Set build command to `npm run build` and publish directory to `dist`
4. Netlify will auto-detect and deploy the functions in `netlify/functions/`

No environment variables are required.

---

## How It Works

1. The user enters a subreddit name
2. `Redditor.tsx` fetches up to 10 pages (1000 posts) from the Reddit JSON API via the `reddit-proxy` Netlify function
3. Each post is parsed by `extractMediaFromPost` which handles galleries, Reddit videos, GIFs, and direct image links
4. Extracted media is stored in state and rendered through `MediaGrid`
5. Images that fail to load are automatically retried through the `media-proxy` function

---

## Known Limitations

- Some videos may be missing audio if Reddit's DASH audio track URL can't be resolved
- Reddit's API returns a maximum of 100 posts per request; the app fetches up to 10 pages (1000 posts)

---

## License

Shiroe 2026
