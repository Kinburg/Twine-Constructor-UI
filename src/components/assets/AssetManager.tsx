import { useState, useRef, useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';
import type { Asset, AssetGroup, AssetTreeNode } from '../../types';
import { fsApi, joinPath, safeName, toLocalFileUrl } from '../../lib/fsApi';

// ─── Video extensions ─────────────────────────────────────────────────────────

const VIDEO_EXTS = new Set(['mp4', 'webm', 'ogg', 'ogv', 'mov', 'avi', 'mkv']);

function getAssetType(filename: string): 'image' | 'video' {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return VIDEO_EXTS.has(ext) ? 'video' : 'image';
}

// ─── Pending "add group" state ────────────────────────────────────────────────

interface PendingGroup {
  parentGroupId: string | null;
  parentRelPath: string;   // e.g. "" for root, "assets/chars" for subgroup
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AssetManager() {
  const {
    project, projectDir, setProjectDir,
    addAssetGroup, addAsset, deleteAssetNode,
  } = useProjectStore();

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // State for the inline "new group" input
  const [pendingGroup, setPendingGroup] = useState<PendingGroup | null>(null);
  const [groupNameDraft, setGroupNameDraft] = useState('');
  const groupInputRef = useRef<HTMLInputElement>(null);

  // Focus the input whenever pendingGroup changes
  useEffect(() => {
    if (pendingGroup) {
      setGroupNameDraft('');
      setTimeout(() => groupInputRef.current?.focus(), 0);
    }
  }, [pendingGroup]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const toggleExpand = (id: string) =>
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });

  /** Ensures project dir + assets/ subfolder exist. Returns project dir path. */
  async function ensureDir(): Promise<string> {
    const dir = projectDir ?? await (async () => {
      const base = await fsApi.getProjectsDir();
      const d = joinPath(base, safeName(project.title));
      await fsApi.mkdir(d);
      setProjectDir(d);
      return d;
    })();
    await fsApi.mkdir(joinPath(dir, 'assets'));
    return dir;
  }

  // ── Add group: open inline input ──────────────────────────────────────────

  function startAddGroup(parentGroupId: string | null, parentRelPath: string) {
    setPendingGroup({ parentGroupId, parentRelPath });
  }

  function cancelAddGroup() {
    setPendingGroup(null);
    setGroupNameDraft('');
  }

  async function confirmAddGroup() {
    const raw = groupNameDraft.trim();
    setPendingGroup(null);
    setGroupNameDraft('');
    if (!raw || !pendingGroup) return;

    const folderName = safeName(raw);
    const relPath = pendingGroup.parentRelPath
      ? `${pendingGroup.parentRelPath}/${folderName}`
      : `assets/${folderName}`;

    try {
      const dir = await ensureDir();
      await fsApi.mkdir(joinPath(dir, relPath));
      addAssetGroup(pendingGroup.parentGroupId, raw, relPath);
      // Auto-expand the parent so user sees the new group
      if (pendingGroup.parentGroupId) {
        setExpandedIds(prev => new Set(prev).add(pendingGroup.parentGroupId!));
      }
    } catch (e) {
      alert(`Ошибка создания папки: ${e}`);
    }
  }

  // ── Add files ──────────────────────────────────────────────────────────────

  async function handleAddFiles(parentGroupId: string | null, groupRelPath: string) {
    const files = await fsApi.openFilesDialog({
      title: 'Выбрать файлы (изображения или видео)',
      filters: [
        {
          name: 'Медиафайлы',
          extensions: [
            'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif',
            'mp4', 'webm', 'ogg', 'ogv', 'mov',
          ],
        },
        { name: 'Изображения', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'] },
        { name: 'Видео',       extensions: ['mp4', 'webm', 'ogg', 'ogv', 'mov'] },
      ],
    });
    if (!files || files.length === 0) return;

    try {
      const dir = await ensureDir();
      // Target folder: groupRelPath is e.g. "assets/chars", or "" for root → "assets"
      const targetRel = groupRelPath || 'assets';
      const targetAbs = joinPath(dir, targetRel);
      await fsApi.mkdir(targetAbs);

      for (const srcPath of files) {
        const filename = srcPath.replace(/\\/g, '/').split('/').pop()!;
        const destAbs  = joinPath(targetAbs, filename);
        await fsApi.copyFile(srcPath, destAbs);
        addAsset(parentGroupId, {
          name: filename,
          assetType: getAssetType(filename),
          relativePath: `${targetRel}/${filename}`,
        });
      }

      // Auto-expand parent group
      if (parentGroupId) setExpandedIds(prev => new Set(prev).add(parentGroupId));
    } catch (e) {
      alert(`Ошибка добавления файлов: ${e}`);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const { assetNodes } = project;

  return (
    <div className="p-2 flex flex-col gap-1">

      {/* Inline "new group" input — shown at top when active */}
      {pendingGroup && (
        <div className="flex items-center gap-1 mb-1 bg-slate-800 rounded px-2 py-1 border border-indigo-600">
          <span className="text-xs">📁</span>
          <input
            ref={groupInputRef}
            className="flex-1 bg-transparent text-xs text-white outline-none min-w-0"
            placeholder="Название группы…"
            value={groupNameDraft}
            onChange={e => setGroupNameDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') confirmAddGroup();
              if (e.key === 'Escape') cancelAddGroup();
            }}
          />
          <button
            className="text-indigo-400 hover:text-indigo-200 text-xs cursor-pointer px-0.5"
            onClick={confirmAddGroup}
          >
            ✓
          </button>
          <button
            className="text-slate-500 hover:text-red-400 text-xs cursor-pointer px-0.5"
            onClick={cancelAddGroup}
          >
            ✕
          </button>
        </div>
      )}

      {/* Root-level toolbar */}
      <div className="flex gap-1 pb-1 border-b border-slate-800 mb-1">
        <button
          className="flex-1 text-xs text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded px-2 py-1.5 transition-colors cursor-pointer border border-dashed border-slate-700 hover:border-indigo-600"
          title="Создать группу (папку) в корне"
          onClick={() => startAddGroup(null, '')}
        >
          + Группа
        </button>
        <button
          className="flex-1 text-xs text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded px-2 py-1.5 transition-colors cursor-pointer border border-dashed border-slate-700 hover:border-indigo-600"
          title="Добавить файлы в корень assets/"
          onClick={() => handleAddFiles(null, '')}
        >
          + Файлы
        </button>
      </div>

      {assetNodes.length === 0 && !pendingGroup && (
        <p className="text-xs text-slate-600 italic px-1 py-2">
          Нет ассетов. Создайте группу или добавьте файлы.
        </p>
      )}

      {assetNodes.map(node => (
        <AssetNodeView
          key={node.id}
          node={node}
          depth={0}
          expandedIds={expandedIds}
          onToggle={toggleExpand}
          onStartAddGroup={startAddGroup}
          onAddFiles={handleAddFiles}
          onDelete={deleteAssetNode}
          projectDir={projectDir}
        />
      ))}
    </div>
  );
}

// ─── Tree node view ───────────────────────────────────────────────────────────

interface NodeViewProps {
  node: AssetTreeNode;
  depth: number;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onStartAddGroup: (parentId: string | null, parentRelPath: string) => void;
  onAddFiles: (parentId: string | null, groupRelPath: string) => void;
  onDelete: (id: string) => void;
  projectDir: string | null;
}

function AssetNodeView(props: NodeViewProps) {
  if (props.node.kind === 'asset') {
    return <AssetRow {...props} asset={props.node} />;
  }
  return <GroupRow {...props} group={props.node} />;
}

// ─── Group row ────────────────────────────────────────────────────────────────

function GroupRow({
  group, depth, expandedIds, onToggle,
  onStartAddGroup, onAddFiles, onDelete, projectDir,
}: NodeViewProps & { group: AssetGroup }) {
  const isOpen = expandedIds.has(group.id);
  const indent = depth * 14;

  return (
    <div>
      {/* Group header */}
      <div
        className="flex items-center gap-1 rounded hover:bg-slate-800 py-1 group/row"
        style={{ paddingLeft: `${indent + 4}px`, paddingRight: '4px' }}
      >
        {/* Toggle arrow */}
        <button
          className="text-slate-600 hover:text-slate-300 text-[10px] w-3 shrink-0 cursor-pointer select-none"
          onClick={() => onToggle(group.id)}
        >
          {isOpen ? '▼' : '▶'}
        </button>

        {/* Icon + name */}
        <span className="text-xs select-none">📁</span>
        <span
          className="text-xs text-slate-300 flex-1 truncate cursor-pointer"
          title={group.relativePath}
          onClick={() => onToggle(group.id)}
        >
          {group.name}
        </span>

        {/* Actions (shown on hover) */}
        <div className="flex gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0">
          <ActionBtn
            title="Добавить подгруппу"
            onClick={() => onStartAddGroup(group.id, group.relativePath)}
          >
            📁+
          </ActionBtn>
          <ActionBtn
            title="Добавить файлы в группу"
            onClick={() => onAddFiles(group.id, group.relativePath)}
          >
            📄+
          </ActionBtn>
          <ActionBtn
            title="Удалить группу (файлы на диске остаются)"
            danger
            onClick={() => {
              if (confirm(`Удалить группу «${group.name}» из дерева?\nФайлы на диске останутся.`))
                onDelete(group.id);
            }}
          >
            ✕
          </ActionBtn>
        </div>
      </div>

      {/* Children */}
      {isOpen && (
        <div>
          {group.children.length === 0 ? (
            <div
              className="text-xs text-slate-700 italic py-0.5"
              style={{ paddingLeft: `${indent + 22}px` }}
            >
              пусто
            </div>
          ) : (
            group.children.map(child => (
              <AssetNodeView
                key={child.id}
                node={child}
                depth={depth + 1}
                expandedIds={expandedIds}
                onToggle={onToggle}
                onStartAddGroup={onStartAddGroup}
                onAddFiles={onAddFiles}
                onDelete={onDelete}
                projectDir={projectDir}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Asset (file) row ─────────────────────────────────────────────────────────

function AssetRow({
  asset, depth, onDelete, projectDir,
}: NodeViewProps & { asset: Asset }) {
  const indent = depth * 14;
  const isVideo = asset.assetType === 'video';

  const previewSrc = projectDir
    ? toLocalFileUrl(joinPath(projectDir, asset.relativePath))
    : null;

  return (
    <div
      className="flex items-center gap-1.5 rounded hover:bg-slate-800 py-1 group/row"
      style={{ paddingLeft: `${indent + 18}px`, paddingRight: '4px' }}
    >
      {/* Thumbnail / icon */}
      {isVideo ? (
        <span className="text-sm shrink-0 select-none" title="Видео">🎥</span>
      ) : previewSrc ? (
        <img
          src={previewSrc}
          className="w-5 h-5 object-cover rounded border border-slate-700 shrink-0"
          draggable={false}
          onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = '0'; }}
        />
      ) : (
        <span className="text-sm shrink-0 select-none">🖼️</span>
      )}

      {/* Name */}
      <span
        className="text-xs text-slate-300 flex-1 truncate"
        title={asset.relativePath}
      >
        {asset.name}
      </span>

      {/* Delete */}
      <button
        className="opacity-0 group-hover/row:opacity-100 text-slate-600 hover:text-red-400 text-xs cursor-pointer transition-opacity shrink-0 px-0.5"
        title="Убрать из списка (файл на диске остаётся)"
        onClick={() => onDelete(asset.id)}
      >
        ✕
      </button>
    </div>
  );
}

// ─── Tiny action button ───────────────────────────────────────────────────────

function ActionBtn({
  children, title, onClick, danger = false,
}: {
  children: React.ReactNode;
  title?: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      className={`text-[10px] px-0.5 cursor-pointer transition-colors ${
        danger
          ? 'text-slate-600 hover:text-red-400'
          : 'text-slate-600 hover:text-indigo-400'
      }`}
      title={title}
      onClick={e => { e.stopPropagation(); onClick(); }}
    >
      {children}
    </button>
  );
}
