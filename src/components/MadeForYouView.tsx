import { Play, Sparkles } from 'lucide-react';
import type { CuratedMix, Playlist, ScoredTrack, Track } from '../types/music';
import { TrackList } from './TrackList';

interface MadeForYouViewProps {
  mixes: CuratedMix[];
  recommendations: ScoredTrack[];
  currentTrackId?: string | null;
  isPlaying: boolean;
  likedIds: string[];
  playlists: Playlist[];
  onPlayMix: (mix: CuratedMix) => void;
  onPlayTrack: (track: Track, list: Track[]) => void;
  onToggleLike: (track: Track) => void;
  onSkipTrack: (track: Track) => void;
  onStartRadio: (track: Track) => void;
  onAddToPlaylist: (playlistId: string, track: Track) => void;
}

export function MadeForYouView({
  mixes,
  recommendations,
  currentTrackId,
  isPlaying,
  likedIds,
  playlists,
  onPlayMix,
  onPlayTrack,
  onToggleLike,
  onSkipTrack,
  onStartRadio,
  onAddToPlaylist,
}: MadeForYouViewProps) {
  return (
    <div className="space-y-7">
      {/* Curated Spotify-style Mixes */}
      <section aria-labelledby="mixes-heading">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#f0c46c]" aria-hidden="true" />
            <h2 id="mixes-heading" className="text-base font-semibold text-[#fbf7f2]">
              Your Personalized Mixes
            </h2>
          </div>
          <span className="text-xs text-[rgba(247,239,230,0.6)]">
            Updated live as you like & skip
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {mixes.map((mix) => (
            <div
              key={mix.id}
              className="rv-cover-card group min-w-0 bg-[rgba(255,248,240,0.06)] border border-[rgba(255,244,230,0.12)] flex flex-col justify-between"
            >
              <div className="relative aspect-square rounded-[11px] overflow-hidden bg-[#241d17]">
                <img
                  src={mix.coverUrl}
                  alt={mix.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
                <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[rgba(18,14,11,0.76)] text-[#f0c46c] border border-[rgba(240,196,108,0.3)] backdrop-blur-md">
                  {mix.badge}
                </span>
                <button
                  type="button"
                  aria-label={`Play ${mix.title}`}
                  onClick={() => onPlayMix(mix)}
                  className="rv-interactive-btn absolute bottom-2.5 right-2.5 w-11 h-11 rounded-full bg-[#f0c46c] text-[#1a140f] shadow-lg flex items-center justify-center"
                >
                  <Play className="w-4 h-4 fill-current ml-0.5" aria-hidden="true" />
                </button>
              </div>
              <div className="p-2">
                <h3 className="text-sm font-semibold text-[#fbf7f2] truncate">{mix.title}</h3>
                <p className="text-xs text-[rgba(247,239,230,0.65)] line-clamp-2 text-pretty mt-0.5">
                  {mix.subtitle}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Ranked Spotify-style Recommendation Feed */}
      <section aria-labelledby="recommended-heading">
        <div className="flex items-center justify-between mb-2">
          <h2 id="recommended-heading" className="text-base font-semibold text-[#fbf7f2]">
            Recommended For Your Vibe
          </h2>
          <span className="text-xs text-[rgba(247,239,230,0.6)] tabular-nums">
            {recommendations.length} ranked picks
          </span>
        </div>

        <TrackList
          items={recommendations}
          currentTrackId={currentTrackId}
          isPlaying={isPlaying}
          likedIds={likedIds}
          playlists={playlists}
          onPlayTrack={onPlayTrack}
          onToggleLike={onToggleLike}
          onSkipTrack={onSkipTrack}
          onStartRadio={onStartRadio}
          onAddToPlaylist={onAddToPlaylist}
        />
      </section>
    </div>
  );
}
