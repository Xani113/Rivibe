import {
  Disc3,
  LayoutGrid,
  Music2,
  PlayCircle,
  Radio,
  Search,
} from 'lucide-react';
import type { RailSection } from '../types/music';

interface LeftRailProps {
  activeSection: RailSection;
  onSelect: (section: RailSection) => void;
}

const RAIL_ITEMS: Array<{
  id: RailSection;
  label: string;
  Icon: typeof PlayCircle;
}> = [
  { id: 'now-playing', label: 'Now Playing', Icon: PlayCircle },
  { id: 'browse', label: 'All Playlists & Explore', Icon: LayoutGrid },
  { id: 'songs', label: 'Songs & Recommendations', Icon: Music2 },
  { id: 'radio', label: 'Live Vibe Radio', Icon: Radio },
  { id: 'albums', label: 'Albums', Icon: Disc3 },
  { id: 'search', label: 'Search Music', Icon: Search },
];

export function LeftRail({ activeSection, onSelect }: LeftRailProps) {
  return (
    <nav
      aria-label="Primary rail"
      className="rv-left-rail-shell hidden md:flex flex-col items-center gap-2 py-3 px-2 rounded-full rv-pill-glass shrink-0 sticky top-6 self-start"
    >
      {RAIL_ITEMS.map(({ id, label, Icon }) => {
        const active = activeSection === id;
        return (
          <button
            key={id}
            type="button"
            title={label}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            onClick={() => onSelect(id)}
            className={`rv-interactive-btn w-11 h-11 rounded-full flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c46c] ${
              active
                ? 'bg-[rgba(255,248,240,0.24)] text-[#fbf7f2] shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]'
                : 'text-[rgba(247,239,230,0.68)] hover:text-[#fbf7f2] hover:bg-[rgba(255,248,240,0.12)]'
            }`}
          >
            <Icon className="w-5 h-5" aria-hidden="true" />
          </button>
        );
      })}
    </nav>
  );
}
