import { useProjectStore, flattenAssets } from '../../store/projectStore';
import type { ImageBlock } from '../../types';
import { joinPath, toLocalFileUrl } from '../../lib/fsApi';

export function ImageBlockEditor({
  block,
  sceneId,
  onUpdate,
}: {
  block: ImageBlock;
  sceneId: string;
  onUpdate?: (patch: Partial<ImageBlock>) => void;
}) {
  const { project, projectDir, updateBlock } = useProjectStore();
  const update = onUpdate ?? ((p: Partial<ImageBlock>) => updateBlock(sceneId, block.id, p as never));
  const imageAssets = flattenAssets(project.assetNodes).filter(a => a.assetType === 'image');

  /**
   * Resolve a src string to a URL suitable for the <img> preview in the editor.
   * - If src starts with "assets/", it's a project-relative path → use localfile://
   * - Otherwise treat as-is (external URL, data: URL, etc.)
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
      {imageAssets.length > 0 && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 w-20 shrink-0">Из ассетов:</label>
          <select
            className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
            value=""
            onChange={e => {
              const asset = imageAssets.find(a => a.id === e.target.value);
              if (asset) {
                // Store the relative path as src so export uses it directly
                update({ src: asset.relativePath, alt: asset.name });
              }
            }}
          >
            <option value="">— выбрать ассет —</option>
            {imageAssets.map(a => (
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
          placeholder="assets/bg.jpg или https://..."
          value={block.src}
          onChange={e => update({ src: e.target.value })}
        />
      </div>

      {/* Alt text */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-20 shrink-0">Alt текст:</label>
        <input
          className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500"
          placeholder="описание изображения"
          value={block.alt}
          onChange={e => update({ alt: e.target.value })}
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
          onChange={e => update({ width: parseInt(e.target.value) || 0 })}
        />
      </div>

      {/* Preview */}
      {block.src && (
        <img
          src={resolvePreviewSrc(block.src)}
          alt={block.alt || 'preview'}
          className="max-h-32 object-contain rounded border border-slate-700"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}
    </div>
  );
}
