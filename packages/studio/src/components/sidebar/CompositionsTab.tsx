import { memo, useState } from "react";

interface CompositionsTabProps {
  projectId: string;
  compositions: string[];
  activeComposition: string | null;
  onSelect: (comp: string) => void;
}

export const CompositionsTab = memo(function CompositionsTab({
  projectId,
  compositions,
  activeComposition,
  onSelect,
}: CompositionsTabProps) {
  const [hoveredComp, setHoveredComp] = useState<string | null>(null);

  if (compositions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <p className="text-xs text-neutral-600 text-center">No compositions found</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {compositions.map((comp) => {
        const name = comp.replace(/^compositions\//, "").replace(/\.html$/, "");
        const isActive = activeComposition === comp;
        const isHovered = hoveredComp === comp;
        const thumbnailUrl = `/api/projects/${projectId}/thumbnail/${comp}?t=0.5`;

        return (
          <button
            key={comp}
            type="button"
            onClick={() => onSelect(comp)}
            onPointerEnter={() => setHoveredComp(comp)}
            onPointerLeave={() => setHoveredComp(null)}
            className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors ${
              isActive
                ? "bg-blue-500/10 border-l-2 border-blue-500"
                : isHovered
                  ? "bg-neutral-800/50"
                  : ""
            } ${!isActive ? "border-l-2 border-transparent" : ""}`}
          >
            {/* Thumbnail */}
            <div className="w-16 h-9 rounded overflow-hidden bg-neutral-900 flex-shrink-0 relative">
              <img
                src={thumbnailUrl}
                alt={name}
                loading="lazy"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.opacity = "0";
                }}
              />
              {/* Fallback: show name initial when thumbnail fails */}
              <div className="absolute inset-0 flex items-center justify-center text-[10px] text-neutral-600 font-mono pointer-events-none">
                {name.charAt(0).toUpperCase()}
              </div>
            </div>
            {/* Name */}
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-medium text-neutral-300 truncate block">
                {name}
              </span>
              <span className="text-[9px] text-neutral-600 truncate block">{comp}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
});
