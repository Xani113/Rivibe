import type { RefObject } from 'react';
import { Clock3, Search, Sparkles, X } from 'lucide-react';
import type { Playlist, Track } from '../types/music';
import { TrackRow } from './TrackRow';

const QUICK_SEARCHES = [
  'Synthwave',
  'Lo-Fi Beats',
  'Miles Davis',
  'Porter Robinson',
  'Troye Sivan',
  'Ambient Study',
];

interface SearchViewProps {
  query: string;
  results: Track[];
  recentSearches: string[];
  isSearching: boolean;
  currentTrackId?: string | null;
  isPlaying: boolean;
  likedIds: string[];
  playlists: Playlist[];
  inputRef?: RefObject<HTMLInputElement | null>;
  onQueryChange: (q: string) => void;
  onSubmitSearch: (q: string) => void;
  onClearRecentSearches: () => void;
  onPlayTrack: (track: Track, list: Track[]) => void;
  onAddToQueue: (track: Track) => void;
  onPlayNext: (track: Track) => void;
  onToggleLike: (track: Track) => void;
  onStartRadio: (track: Track) => void;
  onAddToPlaylist: (playlistId: string, track: Track) => void;
}

export function SearchView({
  query,
  results,
  recentSearches,
  isSearching,
  currentTrackId,
  isPlaying,
  likedIds,
  playlists,
  inputRef,
  onQueryChange,
  onSubmitSearch,
  onClearRecentSearches,
  onPlayTrack,
  onAddToQueue,
  onPlayNext,
  onToggleLike,
  onStartRadio,
  onAddToPlaylist,
}: SearchViewProps) {
  const hasQuery = query.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-xl font-bold text-[#f4f5f7] tracking-tight">Search</h1>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmitSearch(query);
          }}
          className="relative"
        >
          <Search
            className="w-4 h-4 text-[rgba(244,245,247,0.5)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search songs, artists, albums..."
            aria-label="Search songs, artists, albums"
            className="w-full h-11 pl-10 pr-10 rounded-xl bg-[#10131b] border border-[rgba(255,255,255,0.1)] text-sm text-[#f4f5f7] placeholder:text-[rgba(244,245,247,0.45)] focus:outline-none focus:border-[#a78bfa]"
          />
          {hasQuery ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onQueryChange('')}
              className="w-8 h-8 rounded-lg hover:bg-[rgba(255,255,255,0.08)] flex items-center justify-center text-[rgba(244,245,247,0.65)] absolute right-1.5 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          ) : null}
        </form>
      </div>

      {hasQuery ? (
        <section aria-label="Search results" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#f4f5f7]">
              Results for &ldquo;{query.trim()}&rdquo;
            </h2>
            <span className="text-xs text-[rgba(244,245,247,0.55)] tabular-nums">
              {isSearching ? 'Searching...' : `${results.length} tracks`}
            </span>
          </div>

          {isSearching && results.length === 0 ? (
            <div className="space-y-2" aria-busy="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-[#10131b] animate-pulse" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="py-14 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0f131b] text-center">
              <p className="text-sm font-medium text-[#f4f5f7]">No matching tracks found.</p>
              <p className="text-xs text-[rgba(244,245,247,0.55)] mt-1">
                Try another song title or artist name.
              </p>
            </div>
          ) : (
            <ul role="list" className="space-y-1">
              {results.map((track, idx) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  index={idx}
                  isActive={currentTrackId === track.id}
                  isPlaying={isPlaying}
                  isLiked={likedIds.includes(track.id)}
                  playlists={playlists}
                  onPlay={(t) => {
                    onSubmitSearch(query);
                    onPlayTrack(t, results);
                  }}
                  onAddToQueue={(t) => {
                    onSubmitSearch(query);
                    onAddToQueue(t);
                  }}
                  onPlayNext={onPlayNext}
                  onToggleLike={onToggleLike}
                  onStartRadio={onStartRadio}
                  onAddToPlaylist={onAddToPlaylist}
                />
              ))}
            </ul>
          )}
        </section>
      ) : (
        <div className="space-y-6">
          {recentSearches.length > 0 ? (
            <section aria-label="Recent searches" className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[rgba(244,245,247,0.5)] flex items-center gap-1.5">
                  <Clock3 className="w-3.5 h-3.5" aria-hidden="true" />
                  Recent Searches
                </h2>
                <button
                  type="button"
                  onClick={onClearRecentSearches}
                  className="text-xs text-[rgba(244,245,247,0.55)] hover:text-[#f4f5f7]"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => onQueryChange(term)}
                    className="rv-interactive-btn px-3 py-1.5 rounded-lg bg-[#121620] hover:bg-[#19202e] border border-[rgba(255,255,255,0.08)] text-xs font-medium text-[#f4f5f7]"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section aria-label="Suggested searches" className="space-y-2.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[rgba(244,245,247,0.5)] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#a78bfa]" aria-hidden="true" />
              Browse by Vibe & Artist
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {QUICK_SEARCHES.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => onQueryChange(term)}
                  className="rv-interactive-btn p-3.5 rounded-xl bg-[#10131b] hover:bg-[#161b26] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(167,139,250,0.42)] text-left"
                >
                  <div className="text-sm font-semibold text-[#f4f5f7]">{term}</div>
                  <div className="text-[11px] text-[rgba(244,245,247,0.5)] mt-0.5">
                    Tap to search tracks
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
