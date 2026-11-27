import { ListPlus, Play } from 'lucide-react';
import type { MoodId, Playlist, Track } from '../types/music';
import { SEED_TRACKS } from '../services/seedCatalog';
import { TrackRow } from './TrackRow';

const FALLBACK_ART = SEED_TRACKS[0]?.artworkUrl ?? '';

const MOODS: Array<{ id: MoodId; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'chill', label: 'Chill' },
  { id: 'focus', label: 'Focus' },
  { id: 'late-night', label: 'Late Night' },
  { id: 'workout', label: 'Workout' },
  { id: 'indie', label: 'Indie' },
  { id: 'jazz', label: 'Jazz' },
];

interface HomeViewProps {
  tracks: Track[];
  recentTracks: Track[];
  currentTrackId?: string | null;
  isPlaying: boolean;
  isLoading: boolean;
  activeMood: MoodId;
  likedIds: string[];
  playlists: Playlist[];
  onMoodChange: (mood: MoodId) => void;
  onPlayTrack: (track: Track, contextList: Track[]) => void;
  onAddToQueue: (track: Track) => void;
  onPlayNext: (track: Track) => void;
  onToggleLike: (track: Track) => void;
  onStartRadio: (track: Track) => void;
  onAddToPlaylist: (playlistId: string, track: Track) => void;
}

export function HomeView({
  tracks,
  recentTracks,
  currentTrackId,
  isPlaying,
  isLoading,
  activeMood,
  likedIds,
  playlists,
  onMoodChange,
  onPlayTrack,
  onAddToQueue,
  onPlayNext,
  onToggleLike,
  onStartRadio,
  onAddToPlaylist,
}: HomeViewProps) {
  const quickPicks = tracks.slice(0, 8);
  const moreTracks = tracks.slice(8, 20);
  const recentStrip = recentTracks.slice(0, 8);

  return (
    <div className="space-y-7">
      {/* Clean Mood Strip */}
      <div
        role="group"
        aria-label="Mood filters"
        className="flex items-center gap-2 overflow-x-auto pb-1 rv-scroll"
      >
        {MOODS.map((mood) => {
          const active = activeMood === mood.id;
          return (
            <button
              key={mood.id}
              type="button"
              aria-pressed={active}
              onClick={() => onMoodChange(mood.id)}
              className={`rv-interactive-btn shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold border ${
                active
                  ? 'bg-[#22d3a6] text-[#042019] border-[#22d3a6]'
                  : 'bg-[#121620] text-[rgba(244,245,247,0.75)] border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.18)] hover:text-[#f4f5f7]'
              }`}
            >
              {mood.label}
            </button>
          );
        })}
      </div>

      {/* Quick Picks */}
      <section aria-labelledby="quick-picks-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#22d3a6]">
              Start Listening
            </span>
            <h1 id="quick-picks-heading" className="text-lg font-bold text-[#f4f5f7] tracking-tight">
              Quick Picks
            </h1>
          </div>
          {quickPicks.length > 0 ? (
            <button
              type="button"
              onClick={() => onPlayTrack(quickPicks[0]!, tracks)}
              className="rv-interactive-btn px-3 py-1.5 rounded-lg bg-[#121620] hover:bg-[#19202e] border border-[rgba(255,255,255,0.1)] text-xs font-semibold text-[#f4f5f7]"
            >
              Play all
            </button>
          ) : null}
        </div>

        {isLoading && quickPicks.length === 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-[#11151e] animate-pulse" />
            ))}
          </div>
        ) : (
          <ul role="list" className="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
            {quickPicks.map((track, idx) => (
              <TrackRow
                key={track.id}
                track={track}
                index={idx}
                compact
                isActive={currentTrackId === track.id}
                isPlaying={isPlaying}
                isLiked={likedIds.includes(track.id)}
                playlists={playlists}
                onPlay={(t) => onPlayTrack(t, tracks)}
                onAddToQueue={onAddToQueue}
                onPlayNext={onPlayNext}
                onToggleLike={onToggleLike}
                onStartRadio={onStartRadio}
                onAddToPlaylist={onAddToPlaylist}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Keep Listening (only shown for tracks the user actually played) */}
      {recentStrip.length > 0 ? (
        <section aria-labelledby="recent-heading" className="space-y-3">
          <h2 id="recent-heading" className="text-base font-bold text-[#f4f5f7] tracking-tight">
            Keep Listening
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2 rv-scroll">
            {recentStrip.map((track) => {
              const active = currentTrackId === track.id;
              return (
                <div
                  key={`recent-${track.id}`}
                  className="group w-36 sm:w-40 shrink-0 rounded-xl p-2 bg-[#10131b] border border-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.16)] transition-colors"
                >
                  <div className="relative aspect-square rounded-lg overflow-hidden bg-[#181d29]">
                    <img
                      src={track.artworkUrl || FALLBACK_ART}
                      alt={track.title}
                      onError={(e) => {
                        if (e.currentTarget.src !== FALLBACK_ART) {
                          e.currentTarget.src = FALLBACK_ART;
                        }
                      }}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-between gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        aria-label={`Add ${track.title} to queue`}
                        title="Add to queue"
                        onClick={() => onAddToQueue(track)}
                        className="w-8 h-8 rounded-lg bg-[rgba(9,11,16,0.85)] border border-[rgba(255,255,255,0.14)] text-[#f4f5f7] hover:text-[#22d3a6] flex items-center justify-center"
                      >
                        <ListPlus className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Play ${track.title}`}
                        onClick={() => onPlayTrack(track, recentStrip)}
                        className="w-8 h-8 rounded-lg bg-[#22d3a6] text-[#042019] flex items-center justify-center shadow-lg"
                      >
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onPlayTrack(track, recentStrip)}
                    className="mt-2 w-full text-left"
                  >
                    <div
                      className={`text-xs font-semibold truncate ${
                        active ? 'text-[#22d3a6]' : 'text-[#f4f5f7]'
                      }`}
                    >
                      {track.title}
                    </div>
                    <div className="text-[11px] text-[rgba(244,245,247,0.55)] truncate">
                      {track.artist}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* More to Explore (only additional distinct tracks beyond Quick Picks) */}
      {moreTracks.length > 0 ? (
        <section aria-labelledby="discover-heading" className="space-y-3">
          <h2 id="discover-heading" className="text-base font-bold text-[#f4f5f7] tracking-tight">
            More to Explore
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {moreTracks.map((track) => {
              const active = currentTrackId === track.id;
              return (
                <article
                  key={`card-${track.id}`}
                  className={`group rounded-xl p-2 bg-[#10131b] border transition-colors ${
                    active
                      ? 'border-[rgba(34,211,166,0.45)] bg-[rgba(34,211,166,0.06)]'
                      : 'border-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.16)]'
                  }`}
                >
                  <div className="relative aspect-square rounded-lg overflow-hidden bg-[#181d29]">
                    <img
                      src={track.artworkUrl || FALLBACK_ART}
                      alt={`${track.album} art`}
                      loading="lazy"
                      onError={(e) => {
                        if (e.currentTarget.src !== FALLBACK_ART) {
                          e.currentTarget.src = FALLBACK_ART;
                        }
                      }}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />

                    <div className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-between gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
                      <button
                        type="button"
                        aria-label={`Add ${track.title} to queue`}
                        title="Add to queue"
                        onClick={() => onAddToQueue(track)}
                        className="rv-interactive-btn w-8 h-8 rounded-lg bg-[rgba(9,11,16,0.86)] border border-[rgba(255,255,255,0.15)] text-[#f4f5f7] hover:text-[#22d3a6] flex items-center justify-center"
                      >
                        <ListPlus className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        aria-label={`Play ${track.title}`}
                        onClick={() => onPlayTrack(track, tracks)}
                        className="rv-interactive-btn w-8 h-8 rounded-lg bg-[#22d3a6] text-[#042019] flex items-center justify-center shadow-lg"
                      >
                        {active && isPlaying ? (
                          <span className="inline-flex items-end gap-0.5 h-3" aria-hidden="true">
                            <span className="w-0.5 h-full bg-[#042019] rounded-full rv-eq-bar" />
                            <span className="w-0.5 h-full bg-[#042019] rounded-full rv-eq-bar" />
                            <span className="w-0.5 h-full bg-[#042019] rounded-full rv-eq-bar" />
                          </span>
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onPlayTrack(track, tracks)}
                    className="mt-2 w-full min-w-0 text-left"
                  >
                    <div
                      className={`text-[13px] font-semibold truncate ${
                        active ? 'text-[#22d3a6]' : 'text-[#f4f5f7]'
                      }`}
                    >
                      {track.title}
                    </div>
                    <div className="text-[11px] text-[rgba(244,245,247,0.56)] truncate">
                      {track.artist}
                    </div>
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
