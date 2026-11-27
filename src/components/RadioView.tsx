import { useState } from 'react';
import { Globe, Play, Radio as RadioIcon } from 'lucide-react';
import type { RadioStation } from '../types/music';

interface RadioViewProps {
  stations: RadioStation[];
  activeStationId?: string | null;
  isPlaying: boolean;
  isLoading: boolean;
  onPlayStation: (station: RadioStation) => void;
  onFilterTag: (tag: string) => void;
}

const RADIO_TAGS = ['', 'chill', 'jazz', 'electronic', 'lofi', 'indie', 'ambient'];

export function RadioView({
  stations,
  activeStationId,
  isPlaying,
  isLoading,
  onPlayStation,
  onFilterTag,
}: RadioViewProps) {
  const [selectedTag, setSelectedTag] = useState('');

  const handleTag = (tag: string) => {
    setSelectedTag(tag);
    onFilterTag(tag);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#fbf7f2]">Live Vibe Radio</h2>
          <p className="text-xs text-[rgba(247,239,230,0.64)]">
            Global internet stations powered by Radio Browser (no API key required)
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Radio genre filters">
          {RADIO_TAGS.map((tag) => {
            const active = selectedTag === tag;
            return (
              <button
                key={tag || 'all'}
                type="button"
                onClick={() => handleTag(tag)}
                className={`rv-interactive-btn px-3 py-1.5 rounded-full text-xs font-medium border ${
                  active
                    ? 'bg-[#f0c46c] text-[#1a140f] border-[#f0c46c] font-semibold'
                    : 'bg-[rgba(255,248,240,0.08)] text-[rgba(247,239,230,0.82)] border-[rgba(255,244,230,0.14)] hover:bg-[rgba(255,248,240,0.16)]'
                }`}
              >
                {tag ? tag.toUpperCase() : 'TOP STATIONS'}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-[rgba(255,248,240,0.07)] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {stations.map((station) => {
            const active = activeStationId === station.id;
            return (
              <button
                key={station.id}
                type="button"
                onClick={() => onPlayStation(station)}
                className={`rv-interactive-btn text-left p-3.5 rounded-2xl border flex items-center gap-3.5 ${
                  active
                    ? 'bg-[rgba(240,196,108,0.18)] border-[rgba(240,196,108,0.45)]'
                    : 'bg-[rgba(255,248,240,0.07)] border-[rgba(255,244,230,0.12)] hover:bg-[rgba(255,248,240,0.13)]'
                }`}
              >
                <div className="w-12 h-12 rounded-xl bg-[rgba(18,14,11,0.5)] border border-[rgba(255,244,230,0.14)] flex items-center justify-center shrink-0 overflow-hidden">
                  {station.favicon ? (
                    <img
                      src={station.favicon}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <RadioIcon className="w-5 h-5 text-[#f0c46c]" aria-hidden="true" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-[#fbf7f2] truncate">
                    {station.name}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-[rgba(247,239,230,0.64)] mt-0.5">
                    <Globe className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">{station.country}</span>
                    {station.bitrate > 0 ? (
                      <span className="tabular-nums">· {station.bitrate}k</span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {station.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 rounded-md bg-[rgba(255,248,240,0.08)] text-[10px] text-[rgba(247,239,230,0.75)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <span className="w-9 h-9 rounded-full bg-[#f0c46c] text-[#1a140f] flex items-center justify-center shrink-0">
                  {active && isPlaying ? (
                    <span className="flex items-end gap-0.5 h-3" aria-hidden="true">
                      <span className="w-0.5 h-full bg-[#1a140f] rounded-full rv-eq-bar" />
                      <span className="w-0.5 h-full bg-[#1a140f] rounded-full rv-eq-bar" />
                      <span className="w-0.5 h-full bg-[#1a140f] rounded-full rv-eq-bar" />
                    </span>
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" aria-hidden="true" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
