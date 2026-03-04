import JSZip from 'jszip';
import type { Project } from '../types';
import { generateStandaloneHtml } from './exportToHtml';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg':  'jpg',
  'image/png':  'png',
  'image/gif':  'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'video/mp4':  'mp4',
  'video/webm': 'webm',
  'video/ogg':  'ogv',
};

function mimeToExt(mime: string): string {
  return MIME_TO_EXT[mime.toLowerCase()] ?? 'bin';
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return arr;
}

// ─── ZIP export ───────────────────────────────────────────────────────────────

/**
 * Generates a ZIP archive containing:
 *   index.html  — the story with asset src paths replaced to relative ones
 *   assets/     — extracted image/video files
 *
 * All base64 dataUrls found in the HTML are extracted automatically.
 * External URLs (https://...) are left unchanged.
 */
export async function exportToZip(
  project: Project,
  scTemplate: string,
  safeName: string,
): Promise<void> {
  // 1. Generate single-file HTML (all assets are base64 embedded at this point)
  let html = generateStandaloneHtml(project, scTemplate);

  // 2. Find every data: URL, replace with relative path, collect binary data
  const zip = new JSZip();
  const assetsFolder = zip.folder('assets')!;

  // dedup: same asset used multiple times → same file
  const seen = new Map<string, string>(); // dedup key → filename
  let counter = 1;

  const DATA_URL_RE = /data:([a-zA-Z0-9]+\/[a-zA-Z0-9.+\-]+);base64,([A-Za-z0-9+/=]+)/g;

  html = html.replace(DATA_URL_RE, (_match, mime: string, b64: string) => {
    // Dedup key: mime + first 64 chars of base64 (fast, good enough)
    const key = `${mime}::${b64.slice(0, 64)}`;
    if (!seen.has(key)) {
      const filename = `asset-${counter++}.${mimeToExt(mime)}`;
      seen.set(key, filename);
      assetsFolder.file(filename, base64ToUint8Array(b64));
    }
    return `assets/${seen.get(key)}`;
  });

  // 3. Add HTML to zip
  zip.file('index.html', html);

  // 4. Download
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${safeName}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
