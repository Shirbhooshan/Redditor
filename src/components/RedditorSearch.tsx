import { useState, useRef } from "react";
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

const PREFIX = "https://www.reddit.com/r/";

const RedditorSearch = ({
  onSearch,
  isLoading,
  sortBy,
  onSortChange,
  topTimeframe,
  onTopTimeframeChange,
}: RedditorSearchProps) => {
  const [subreddit, setSubreddit] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = subreddit.trim();
    if (trimmed) onSearch(PREFIX + trimmed);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    // If user pastes a full Reddit URL, strip it down to just the subreddit name
    if (val.includes("reddit.com/r/")) {
      const match = val.match(/reddit\.com\/r\/([^/?#\s]+)/);
      if (match) val = match[1];
    }
    setSubreddit(val);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto space-y-4">
      {/* Search bar */}
      <div
        className="relative flex items-center bg-secondary rounded-full border border-border hover:border-muted-foreground/50 transition-colors cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {/* Dimmed non-editable prefix */}
        <span
          className="pl-6 text-base text-muted-foreground/40 select-none whitespace-nowrap flex-shrink-0"
          style={{ pointerEvents: "none" }}
        >
          {PREFIX}
        </span>

        {/* Editable subreddit name */}
        <input
          ref={inputRef}
          type="text"
          placeholder="subreddit"
          value={subreddit}
          onChange={handleChange}
          disabled={isLoading}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="flex-1 min-w-0 bg-transparent py-4 pr-2 text-base text-foreground placeholder:text-muted-foreground/40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 selection:bg-red-500 selection:text-white"
        />

        <button
          type="submit"
          disabled={isLoading || !subreddit.trim()}
          className="flex items-center justify-center h-10 w-10 mr-2 rounded-full bg-foreground text-background hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors flex-shrink-0"
        >
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUp className="h-5 w-5" />}
        </button>
      </div>

      {/* Sort controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
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

        {sortBy === "top" && (
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
          Type a subreddit name to extract all its images, GIFs and videos
        </p>
        <p className="text-muted-foreground text-xs">
          Examples:&nbsp;
          <code className="mx-1 px-2 py-1 bg-muted rounded">pics</code>
          <code className="mx-1 px-2 py-1 bg-muted rounded">videos</code>
          <code className="mx-1 px-2 py-1 bg-muted rounded">gifs</code>
        </p>
        <p className="text-muted-foreground text-xs">
          <span className="font-semibold">Tip:</span> Use{" "}
          <span className="text-primary font-medium">Best</span> for highest quality,{" "}
          <span className="text-primary font-medium">Top (All Time)</span> for most popular ever
        </p>
      </div>
    </form>
  );
};

export default RedditorSearch;
