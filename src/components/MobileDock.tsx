import { LayoutGrid, Music2, Radio, Search, Sparkles } from 'lucide-react';
import type { RailSection } from '../types/music';

interface MobileDockProps {
  activeSection: RailSection;
  isForYouActive: boolean;
  onSelectRail: (section: RailSection) => void;
  onSelectForYou: () => void;
}

export function MobileDock({
  activeSection,
  isForYouActive,
  onSelectRail,
  onSelectForYou,
}: MobileDockProps) {
  return (
    <nav
      aria-label="Mobile bottom navigation"
      className="rv-mobile-bottom-dock md:hidden fixed bottom-2 left-2.5 right-2.5 z-30 rounded-full rv-pill-glass px-1.5 py-1 flex items-center justify-between gap-0.5"
      style={{ paddingBottom: 'max(4px, var(--rv-safe-bottom))' }}
    >
      <button
        type="button"
        onClick={onSelectForYou}
        className={`rv-interactive-btn flex-1 min-w-0 min-h-[44px] px-1 rounded-full flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
          isForYouActive
            ? 'text-[#f0c46c] bg-[rgba(240,196,108,0.16)]'
            : 'text-[rgba(247,239,230,0.72)]'
        }`}
      >
        <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="truncate max-w-full">For You</span>
      </button>

      <button
        type="button"
        onClick={() => onSelectRail('browse')}
        className={`rv-interactive-btn flex-1 min-w-0 min-h-[44px] px-1 rounded-full flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
          activeSection === 'browse' && !isForYouActive
            ? 'text-[#fbf7f2] bg-[rgba(255,248,240,0.18)]'
            : 'text-[rgba(247,239,230,0.72)]'
        }`}
      >
        <LayoutGrid className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="truncate max-w-full">Browse</span>
      </button>

      <button
        type="button"
        onClick={() => onSelectRail('songs')}
        className={`rv-interactive-btn flex-1 min-w-0 min-h-[44px] px-1 rounded-full flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
          activeSection === 'songs'
            ? 'text-[#fbf7f2] bg-[rgba(255,248,240,0.18)]'
            : 'text-[rgba(247,239,230,0.72)]'
        }`}
      >
        <Music2 className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="truncate max-w-full">Songs</span>
      </button>

      <button
        type="button"
        onClick={() => onSelectRail('radio')}
        className={`rv-interactive-btn flex-1 min-w-0 min-h-[44px] px-1 rounded-full flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
          activeSection === 'radio'
            ? 'text-[#fbf7f2] bg-[rgba(255,248,240,0.18)]'
            : 'text-[rgba(247,239,230,0.72)]'
        }`}
      >
        <Radio className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="truncate max-w-full">Radio</span>
      </button>

      <button
        type="button"
        onClick={() => onSelectRail('search')}
        className={`rv-interactive-btn flex-1 min-w-0 min-h-[44px] px-1 rounded-full flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
          activeSection === 'search'
            ? 'text-[#fbf7f2] bg-[rgba(255,248,240,0.18)]'
            : 'text-[rgba(247,239,230,0.72)]'
        }`}
      >
        <Search className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="truncate max-w-full">Search</span>
      </button>
    </nav>
  );
}
