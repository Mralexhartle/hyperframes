import { memo, useState, useCallback, useRef } from "react";

interface AssetsTabProps {
  projectId: string;
  assets: string[];
  onImport?: (files: FileList) => void;
}

const MEDIA_EXT = /\.(mp4|webm|mov|mp3|wav|ogg|m4a|jpg|jpeg|png|gif|webp|svg)$/i;
const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov)$/i;
const AUDIO_EXT = /\.(mp3|wav|ogg|m4a)$/i;

function AssetIcon({ ext }: { ext: string }) {
  if (VIDEO_EXT.test(ext)) {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-blue-400"
      >
        <polygon points="5 3 19 12 5 21" />
      </svg>
    );
  }
  if (AUDIO_EXT.test(ext)) {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-purple-400"
      >
        <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    );
  }
  if (IMAGE_EXT.test(ext)) {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-green-400"
      >
        <rect
          x="3"
          y="3"
          width="18"
          height="18"
          rx="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="text-neutral-500"
    >
      <path
        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const AssetsTab = memo(function AssetsTab({ projectId, assets, onImport }: AssetsTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) onImport?.(e.dataTransfer.files);
    },
    [onImport],
  );

  const handleCopyPath = useCallback(async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      setCopiedPath(path);
      setTimeout(() => setCopiedPath(null), 1500);
    } catch {
      // ignore
    }
  }, []);

  const mediaAssets = assets.filter((a) => MEDIA_EXT.test(a));

  return (
    <div
      className={`flex-1 flex flex-col min-h-0 transition-colors ${dragOver ? "bg-blue-950/20" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Import button */}
      {onImport && (
        <div className="px-3 py-2 border-b border-neutral-800/40 flex-shrink-0">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] rounded-lg border border-dashed border-neutral-700/50 text-neutral-500 hover:text-neutral-300 hover:border-neutral-600 transition-colors"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Import media
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,image/*,audio/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) {
                onImport(e.target.files);
                e.target.value = "";
              }
            }}
          />
        </div>
      )}

      {/* Asset list */}
      <div className="flex-1 overflow-y-auto">
        {mediaAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 gap-2">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-neutral-700"
            >
              <path
                d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" />
            </svg>
            <p className="text-[10px] text-neutral-600 text-center">Drop media files here</p>
          </div>
        ) : (
          mediaAssets.map((asset) => {
            const name = asset.split("/").pop() ?? asset;
            const ext = "." + (name.split(".").pop() ?? "");
            const isImage = IMAGE_EXT.test(asset);
            const isCopied = copiedPath === asset;
            const serveUrl = `/api/projects/${projectId}/serve/${asset}`;

            return (
              <button
                key={asset}
                type="button"
                onClick={() => handleCopyPath(asset)}
                title="Click to copy path"
                className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-neutral-800/40 transition-colors"
              >
                {isImage ? (
                  <div className="w-8 h-8 rounded overflow-hidden bg-neutral-900 flex-shrink-0">
                    <img
                      src={serveUrl}
                      alt={name}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded bg-neutral-900 flex items-center justify-center flex-shrink-0">
                    <AssetIcon ext={ext} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] text-neutral-300 truncate block">{name}</span>
                  {isCopied && <span className="text-[9px] text-green-400">Copied!</span>}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
});
