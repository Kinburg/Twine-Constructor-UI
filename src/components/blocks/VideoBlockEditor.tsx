import { useProjectStore, flattenAssets } from '../../store/projectStore';
import type { VideoBlock } from '../../types';
import { joinPath, toLocalFileUrl } from '../../lib/fsApi';

export function VideoBlockEditor({ block, sceneId }: { block: VideoBlock; sceneId: string }) {
  const { project, projectDir, updateBlock } = useProjectStore();
  const videoAssets = flattenAssets(project.assetNodes).filter(a => a.assetType === 'video');

  /**
   * Resolve a src string to a URL suitable for <video> preview in the editor.
   * - If src starts with "assets/", it's a project-relative path → use localfile://
   * - Otherwise treat as-is (external URL, etc.)
   */
  function resolvePreviewSrc(src: string): string {
    if (src.startsWith('assets/') && projectDir) {
      return toLocalFileUrl(joinPath(projectDir, src));
    }
    return src;
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Asset picker */}
      {videoAssets.length > 0 && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 w-20 shrink-0">Из ассетов:</label>
          <select
            className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
            value=""
            onChange={e => {
              const asset = videoAssets.find(a => a.id === e.target.value);
              if (asset) {
                // Store the relative path as src so export uses it directly
                updateBlock(sceneId, block.id, { src: asset.relativePath });
              }
            }}
          >
            <option value="">— выбрать ассет —</option>
            {videoAssets.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Manual URL / path entry */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-20 shrink-0">URL / путь:</label>
        <input
          className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500"
          placeholder="assets/intro.mp4 или https://..."
          value={block.src}
          onChange={e => updateBlock(sceneId, block.id, { src: e.target.value })}
        />
      </div>

      {/* Width */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-20 shrink-0">Ширина (px):</label>
        <input
          type="number"
          className="w-24 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500"
          placeholder="авто"
          min={0}
          value={block.width || ''}
          onChange={e => updateBlock(sceneId, block.id, { width: parseInt(e.target.value) || 0 })}
        />
      </div>

      {/* Playback options */}
      <div className="flex items-center gap-4">
        {[
          { key: 'controls', label: 'Управление' },
          { key: 'autoplay', label: 'Авто-старт' },
          { key: 'loop',     label: 'Повтор' },
        ].map(({ key, label }) => (
          <label key={key} className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              className="accent-indigo-500"
              checked={block[key as keyof VideoBlock] as boolean}
              onChange={e => updateBlock(sceneId, block.id, { [key]: e.target.checked })}
            />
            <span className="text-xs text-slate-300">{label}</span>
          </label>
        ))}
      </div>

      {/* Preview */}
      {block.src && (
        <video
          src={resolvePreviewSrc(block.src)}
          controls
          className="max-h-32 rounded border border-slate-700 w-full"
          onError={e => { (e.target as HTMLVideoElement).style.display = 'none'; }}
        />
      )}
    </div>
  );
}
