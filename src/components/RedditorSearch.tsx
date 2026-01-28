import { useState } from "react";
import { ArrowUp, Loader2 } from "lucide-react";

type SortOption = "hot" | "best" | "top" | "new";
type TopTimeframe = "hour" | "day" | "week" | "month" | "year" | "all";

interface RedditorSearchProps {
  onSearch: (url: string) => void;
  isLoading: boolean;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  topTimeframe: TopTimeframe;
  onTopTimeframeChange: (timeframe: TopTimeframe) => void;
}

const RedditorSearch = ({ 
  onSearch, 
  isLoading, 
  sortBy, 
  onSortChange,
  topTimeframe,
  onTopTimeframeChange 
}: RedditorSearchProps) => {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSearch(url.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto space-y-4">
      {/* URL Input */}
      <div className="relative flex items-center bg-secondary rounded-full border border-border hover:border-muted-foreground/50 focus-within:border-muted-foreground transition-colors">
        <input
          type="url"
          placeholder="Paste Reddit URL (e.g., https://www.reddit.com/r/pics/)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={isLoading}
          className="flex-1 bg-transparent px-6 py-4 text-base text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !url.trim()}
          className="flex items-center justify-center h-10 w-10 mr-2 rounded-full bg-foreground text-background hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ArrowUp className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Filter Options */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
        {/* Sort By */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">Sort:</label>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            disabled={isLoading}
            className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="best">Best</option>
            <option value="hot">Hot</option>
            <option value="top">Top</option>
            <option value="new">New</option>
          </select>
        </div>

        {/* Top Timeframe (only show when 'top' is selected) */}
        {sortBy === 'top' && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground">Time:</label>
            <select
              value={topTimeframe}
              onChange={(e) => onTopTimeframeChange(e.target.value as TopTimeframe)}
              disabled={isLoading}
              className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="all">All Time</option>
              <option value="year">Past Year</option>
              <option value="month">Past Month</option>
              <option value="week">Past Week</option>
              <option value="day">Past Day</option>
              <option value="hour">Past Hour</option>
            </select>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-4 text-center space-y-2">
        <p className="text-muted-foreground text-sm">
          Enter a Reddit subreddit or post URL to extract all images and videos
        </p>
        <p className="text-muted-foreground text-xs">
          Examples: 
          <code className="mx-1 px-2 py-1 bg-muted rounded">https://www.reddit.com/r/pics</code>
          or
          <code className="mx-1 px-2 py-1 bg-muted rounded">https://www.reddit.com/r/videos</code>
        </p>
        <p className="text-muted-foreground text-xs">
          <span className="font-semibold">Tip:</span> Use <span className="text-primary font-medium">Best</span> for highest quality content, 
          <span className="text-primary font-medium"> Top (All Time)</span> for most popular posts ever
        </p>
      </div>
    </form>
  );
};

export default RedditorSearch;
