import { useState, useEffect } from 'react';
import type { Asset } from '../../types';
import { fsApi, toLocalFileUrl, resolveAssetPath } from '../../lib/fsApi';
import { useT } from '../../i18n';

interface AssetInfoModalProps {
  asset: Asset;
  projectDir: string;
  onClose: () => void;
}

interface MediaInfo {
  size: number;
  width?: number;
  height?: number;
  duration?: number;
  /** Approximate bitrate in kbps (fileSize * 8 / duration / 1000) */
  bitrate?: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const VIDEO_MIME: Record<string, string> = {
  mp4: 'video/mp4', webm: 'video/webm', ogg: 'video/ogg',
  ogv: 'video/ogg', mov: 'video/quicktime',
  avi: 'video/x-msvideo', mkv: 'video/x-matroska',
};

const AUDIO_MIME: Record<string, string> = {
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
  flac: 'audio/flac', m4a: 'audio/mp4', aac: 'audio/aac',
  weba: 'audio/webm',
};

/**
 * Read a file via IPC as binary and return a blob: URL.
 * This bypasses the localfile:// protocol entirely —
 * works reliably for video where the custom protocol fails.
 */
async function createBlobUrl(absPath: string, mime: string): Promise<string> {
  const bytes = await fsApi.readFileBinary(absPath);
  const blob = new Blob([new Uint8Array(bytes)], { type: mime });
  return URL.createObjectURL(blob);
}

export function AssetInfoModal({ asset, projectDir, onClose }: AssetInfoModalProps) {
  const t = useT();
  const [info, setInfo] = useState<MediaInfo | null>(null);
  const [mediaBlobSrc, setMediaBlobSrc] = useState<string | null>(null);

  const isVideo = asset.assetType === 'video';
  const isAudio = asset.assetType === 'audio';
  const absPath = resolveAssetPath(projectDir, asset.relativePath);
  const imgSrc = toLocalFileUrl(absPath);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Load metadata + blob for video/audio
  useEffect(() => {
    let cancelled = false;
    let blobUrl: string | undefined;

    async function load() {
      // File size
      let size = 0;
      try {
        const st = await fsApi.stat(absPath);
        size = st.size;
      } catch { /* ignore */ }

      if (cancelled) return;

      if (isVideo || isAudio) {
        // Build blob URL (localfile:// doesn't support video/audio streaming)
        const ext = asset.name.split('.').pop()?.toLowerCase() ?? '';
        const mime = isVideo
          ? (VIDEO_MIME[ext] || 'video/mp4')
          : (AUDIO_MIME[ext] || 'audio/mpeg');
        try {
          blobUrl = await createBlobUrl(absPath, mime);
        } catch {
          if (!cancelled) setInfo({ size });
          return;
        }
        if (cancelled) { URL.revokeObjectURL(blobUrl); return; }
        setMediaBlobSrc(blobUrl);

        if (isVideo) {
          const video = document.createElement('video');
          video.preload = 'metadata';
          video.src = blobUrl;
          video.onloadedmetadata = () => {
            if (cancelled) return;
            const duration = video.duration;
            const bitrate = duration > 0 ? Math.round((size * 8) / duration / 1000) : undefined;
            setInfo({ size, width: video.videoWidth, height: video.videoHeight, duration, bitrate });
          };
          video.onerror = () => { if (!cancelled) setInfo({ size }); };
        } else {
          // Audio — get duration only (no dimensions)
          const audio = document.createElement('audio');
          audio.preload = 'metadata';
          audio.src = blobUrl;
          audio.onloadedmetadata = () => {
            if (cancelled) return;
            const duration = audio.duration;
            const bitrate = duration > 0 ? Math.round((size * 8) / duration / 1000) : undefined;
            setInfo({ size, duration, bitrate });
          };
          audio.onerror = () => { if (!cancelled) setInfo({ size }); };
        }
      } else {
        // Image — localfile:// works fine
        const img = new Image();
        img.src = imgSrc;
        img.onload = () => {
          if (!cancelled) setInfo({ size, width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = () => { if (!cancelled) setInfo({ size }); };
      }
    }

    load();
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [absPath, imgSrc, isVideo, isAudio, asset.name]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative bg-slate-800 border border-slate-600 rounded-lg shadow-2xl flex flex-col max-w-[90vw] max-h-[90vh] min-w-[320px]">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700">
          <span className="text-sm">{isAudio ? '🔊' : isVideo ? '🎥' : '🖼️'}</span>
          <span className="text-sm text-slate-200 font-medium truncate flex-1" title={asset.relativePath}>
            {asset.name}
          </span>
          <button
            className="text-slate-500 hover:text-white text-lg cursor-pointer transition-colors leading-none"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-900/50 p-4 min-h-[200px]">
          {isVideo ? (
            mediaBlobSrc ? (
              <video
                src={mediaBlobSrc}
                controls
                className="max-w-full max-h-[60vh] rounded"
                style={{ objectFit: 'contain' }}
              />
            ) : (
              <span className="text-xs text-slate-600 italic">{t.assetInfo.loading}</span>
            )
          ) : isAudio ? (
            mediaBlobSrc ? (
              <audio src={mediaBlobSrc} controls className="w-full max-w-md" />
            ) : (
              <span className="text-xs text-slate-600 italic">{t.assetInfo.loading}</span>
            )
          ) : (
            <img
              src={imgSrc}
              className="max-w-full max-h-[60vh] rounded"
              style={{ objectFit: 'contain' }}
              draggable={false}
              onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = '0.3'; }}
            />
          )}
        </div>

        {/* Info */}
        <div className="px-4 py-3 border-t border-slate-700 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400">
          {info === null ? (
            <span className="text-slate-600 italic">{t.assetInfo.loading}</span>
          ) : (
            <>
              <InfoItem label={t.assetInfo.fileSize} value={formatSize(info.size)} />
              {info.width != null && info.height != null && (
                <InfoItem label={t.assetInfo.dimensions} value={`${info.width} × ${info.height} px`} />
              )}
              {info.duration != null && (
                <InfoItem label={t.assetInfo.duration} value={formatDuration(info.duration)} />
              )}
              {info.bitrate != null && (
                <InfoItem label={t.assetInfo.bitrate} value={`≈ ${info.bitrate} kbps`} />
              )}
              <InfoItem label={t.assetInfo.path} value={asset.relativePath} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span className="text-slate-500">{label}: </span>
      <span className="text-slate-300">{value}</span>
    </span>
  );
}
