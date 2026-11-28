import { ListPlus, Play } from 'lucide-react';
import type { MoodId, Playlist, Track } from '../types/music';
import { TrackRow } from './TrackRow';
import { ArtworkImage } from './ArtworkImage';

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
    <div className="space-y-6">
      {/* Unified Pill Mood Filter Strip */}
      <div
        role="group"
        aria-label="Mood filters"
        className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar"
      >
        {MOODS.map((mood) => {
          const active = activeMood === mood.id;
          return (
            <button
              key={mood.id}
              type="button"
              aria-pressed={active}
              onClick={() => onMoodChange(mood.id)}
              className={`rv-interactive-btn shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                active
                  ? 'bg-[#7c5cff] text-white border-[#8d70ff] shadow-[0_4px_16px_rgba(124,92,255,0.35)]'
                  : 'bg-[#121620] text-[rgba(244,245,247,0.75)] border-[rgba(255,255,255,0.08)] hover:border-[rgba(167,139,250,0.35)] hover:text-[#f4f5f7]'
              }`}
            >
              {mood.label}
            </button>
          );
        })}
      </div>

      {/* Quick Picks — Swipeable 4-row Carousel on Mobile, 2-col Grid on Desktop */}
      <section aria-labelledby="quick-picks-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#a78bfa]">
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
              className="rv-interactive-btn px-3.5 py-1.5 rounded-full bg-[#121620] hover:bg-[#19202e] border border-[rgba(255,255,255,0.1)] text-xs font-semibold text-[#f4f5f7]"
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
          <ul
            role="list"
            className="grid grid-rows-4 grid-flow-col auto-cols-[88%] sm:auto-cols-[62%] snap-x snap-mandatory overflow-x-auto no-scrollbar lg:grid-rows-none lg:grid-flow-row lg:auto-cols-auto lg:grid-cols-2 lg:overflow-visible gap-x-3 gap-y-1.5 pb-1"
          >
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

      {/* Keep Listening (Clean Edge-to-Edge Artwork Cards) */}
      {recentStrip.length > 0 ? (
        <section aria-labelledby="recent-heading" className="space-y-3">
          <h2 id="recent-heading" className="text-base font-bold text-[#f4f5f7] tracking-tight">
            Keep Listening
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
            {recentStrip.map((track) => {
              const active = currentTrackId === track.id;
              return (
                <div
                  key={`recent-${track.id}`}
                  className={`group w-36 sm:w-40 shrink-0 rounded-2xl p-2 bg-[#10131b] border transition-colors ${
                    active
                      ? 'border-[rgba(167,139,250,0.48)] bg-[rgba(124,92,255,0.08)]'
                      : 'border-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.16)]'
                  }`}
                >
                  <button
                    type="button"
                    aria-label={`Play ${track.title}`}
                    onClick={() => onPlayTrack(track, recentStrip)}
                    className="relative block w-full aspect-square rounded-xl overflow-hidden bg-[#181d29]"
                  >
                    <ArtworkImage
                      src={track.artworkUrl}
                      youtubeVideoId={track.youtubeVideoId}
                      alt={track.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                    <span
                      className={`absolute right-2 bottom-2 w-8 h-8 rounded-full bg-[#7c5cff] text-white flex items-center justify-center shadow-lg transition-opacity ${
                        active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      {active && isPlaying ? (
                        <span className="inline-flex items-end gap-0.5 h-3" aria-hidden="true">
                          <span className="w-0.5 h-full bg-white rounded-full rv-eq-bar" />
                          <span className="w-0.5 h-full bg-white rounded-full rv-eq-bar" />
                          <span className="w-0.5 h-full bg-white rounded-full rv-eq-bar" />
                        </span>
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" aria-hidden="true" />
                      )}
                    </span>
                  </button>
                  <div className="mt-2 flex items-start justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => onPlayTrack(track, recentStrip)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div
                        className={`text-xs font-semibold truncate ${
                          active ? 'text-[#a78bfa]' : 'text-[#f4f5f7]'
                        }`}
                      >
                        {track.title}
                      </div>
                      <div className="text-[11px] text-[rgba(244,245,247,0.55)] truncate">
                        {track.artist}
                      </div>
                    </button>
                    <button
                      type="button"
                      aria-label={`Add ${track.title} to queue`}
                      title="Add to queue"
                      onClick={() => onAddToQueue(track)}
                      className="rv-interactive-btn w-7 h-7 rounded-lg hover:bg-[rgba(124,92,255,0.16)] text-[rgba(244,245,247,0.56)] hover:text-[#a78bfa] flex items-center justify-center shrink-0"
                    >
                      <ListPlus className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* More to Explore (Clean Edge-to-Edge Cover Artwork + Compact Title Footer Action) */}
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
                  className={`group rounded-2xl p-2 bg-[#10131b] border transition-colors ${
                    active
                      ? 'border-[rgba(167,139,250,0.48)] bg-[rgba(124,92,255,0.08)]'
                      : 'border-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.16)]'
                  }`}
                >
                  <button
                    type="button"
                    aria-label={`Play ${track.title}`}
                    onClick={() => onPlayTrack(track, tracks)}
                    className="relative block w-full aspect-square rounded-xl overflow-hidden bg-[#181d29]"
                  >
                    <ArtworkImage
                      src={track.artworkUrl}
                      youtubeVideoId={track.youtubeVideoId}
                      alt={`${track.album} art`}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />

                    <span
                      className={`absolute right-2 bottom-2 w-8 h-8 rounded-full bg-[#7c5cff] text-white flex items-center justify-center shadow-lg transition-opacity ${
                        active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      {active && isPlaying ? (
                        <span className="inline-flex items-end gap-0.5 h-3" aria-hidden="true">
                          <span className="w-0.5 h-full bg-white rounded-full rv-eq-bar" />
                          <span className="w-0.5 h-full bg-white rounded-full rv-eq-bar" />
                          <span className="w-0.5 h-full bg-white rounded-full rv-eq-bar" />
                        </span>
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" aria-hidden="true" />
                      )}
                    </span>
                  </button>

                  <div className="mt-2 flex items-start justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => onPlayTrack(track, tracks)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div
                        className={`text-[13px] font-semibold truncate ${
                          active ? 'text-[#a78bfa]' : 'text-[#f4f5f7]'
                        }`}
                      >
                        {track.title}
                      </div>
                      <div className="text-[11px] text-[rgba(244,245,247,0.56)] truncate">
                        {track.artist}
                      </div>
                    </button>

                    <button
                      type="button"
                      aria-label={`Add ${track.title} to queue`}
                      title="Add to queue"
                      onClick={() => onAddToQueue(track)}
                      className="rv-interactive-btn w-7 h-7 rounded-lg hover:bg-[rgba(124,92,255,0.16)] text-[rgba(244,245,247,0.56)] hover:text-[#a78bfa] flex items-center justify-center shrink-0"
                    >
                      <ListPlus className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
