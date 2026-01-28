import { useState } from "react";
import { ArrowUp, Loader2 } from "lucide-react";

interface RedditorSearchProps {
  onSearch: (url: string) => void;
  isLoading: boolean;
}

const RedditorSearch = ({ onSearch, isLoading }: RedditorSearchProps) => {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSearch(url.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto">
      <div className="relative flex items-center bg-secondary rounded-full border border-border hover:border-muted-foreground/50 focus-within:border-muted-foreground transition-colors">
        <input
          type="url"
          placeholder="Paste Reddit URL (e.g., https://www.reddit.com/r/pics/comments/...)"
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
      <div className="mt-4 text-center space-y-2">
        <p className="text-muted-foreground text-sm">
          Enter a Reddit post, subreddit, or user URL to extract all images and videos
        </p>
        <p className="text-muted-foreground text-xs">
          Examples: 
          <code className="mx-1 px-2 py-1 bg-muted rounded">https://www.reddit.com/r/pics</code>
          or
          <code className="mx-1 px-2 py-1 bg-muted rounded">https://www.reddit.com/r/INFJers</code>
        </p>
        <p className="text-muted-foreground text-xs italic">
          Note: ".json" will be automatically added if needed
        </p>
      </div>
    </form>
  );
};

export default RedditorSearch;
