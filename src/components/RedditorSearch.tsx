import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="url"
            placeholder="Paste a Reddit post URL..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="pl-12 pr-4 py-6 text-lg bg-secondary border-border focus:border-primary focus:ring-primary"
            disabled={isLoading}
          />
        </div>
        <Button
          type="submit"
          disabled={isLoading || !url.trim()}
          className="py-6 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            "Search"
          )}
        </Button>
      </div>
      <p className="text-muted-foreground text-sm mt-3 text-center">
        Enter a Reddit post, subreddit, or gallery URL to extract all media
      </p>
    </form>
  );
};

export default RedditorSearch;
