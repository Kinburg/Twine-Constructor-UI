import { useState, useRef, useEffect } from 'react';
import { useProjectStore, DEFAULT_PANEL_STYLE } from '../../store/projectStore';
import { useEditorPrefsStore } from '../../store/editorPrefsStore';
import { useT } from '../../i18n';
import type { Block, BlockType } from '../../types';

const BLOCK_ICONS: Record<BlockType, string> = {
  'text':         '📝',
  'dialogue':     '💬',
  'choice':       '🔀',
  'condition':    '❓',
  'variable-set': '📊',
  'button':       '🔘',
  'link':         '🔗',
  'input-field':  '✏️',
  'image':        '🖼️',
  'video':        '🎥',
  'raw':          '🧩',
  'note':         '🗒️',
  'table':        '🗂️',
  'include':      '📎',
  'divider':      '─',
  'checkbox':     '☑',
  'radio':        '🔵',
  'function':     'ƒ',
  'popup':        '🪟',
  'audio':        '🔊',
};

export function makeBlock(type: BlockType): Block {
  const id = crypto.randomUUID();
  switch (type) {
    case 'text':         return { id, type, content: '' };
    case 'dialogue':     return { id, type, characterId: '', text: '', align: 'left' as const };
    case 'choice':       return { id, type, options: [] };
    case 'condition':    return { id, type, branches: [] };
    case 'variable-set': return { id, type, variableId: '', operator: '=', value: '' };
    case 'image':        return { id, type, src: '', alt: '', width: 0 };
    case 'video':        return { id, type, src: '', autoplay: false, loop: false, controls: true, width: 0 };
    case 'input-field':  return { id, type, label: '', variableId: '', placeholder: '' };
    case 'button':       return {
      id, type, label: '',
      style: {
        bgColor: '#3b82f6', textColor: '#ffffff', borderColor: '#2563eb',
        borderRadius: 4, paddingV: 6, paddingH: 14,
        fontSize: 10, bold: false, fullWidth: false,
      },
      actions: [],
    };
    case 'link':         return {
      id, type, label: '', target: 'scene' as const,
      style: {
        bgColor: '#059669', textColor: '#ffffff', borderColor: '#047857',
        borderRadius: 4, paddingV: 6, paddingH: 14,
        fontSize: 10, bold: false, fullWidth: false,
      },
      actions: [],
    };
    case 'raw':          return { id, type, code: '' };
    case 'note':         return { id, type, text: '' };
    case 'table':        return { id, type, rows: [], style: { ...DEFAULT_PANEL_STYLE } };
    case 'include':      return { id, type, passageName: '' };
    case 'divider':      return { id, type };
    case 'checkbox':     return { id, type, mode: 'flags' as const, options: [] };
    case 'radio':        return { id, type, variableId: '', options: [] };
    case 'function':     return {
      id, type, label: '', targetSceneId: '',
      style: {
        bgColor: '#7c3aed', textColor: '#ffffff', borderColor: '#6d28d9',
        borderRadius: 4, paddingV: 6, paddingH: 14,
        fontSize: 10, bold: false, fullWidth: false,
      },
      actions: [],
    };
    case 'popup':        return { id, type, targetSceneId: '' };
    case 'audio':        return { id, type, src: '', trigger: 'immediate' as const, loop: false, onLeave: 'stop' as const, volume: 100 };
  }
}

// ── Category definitions ──────────────────────────────────────────────────────

type CategoryKey = 'content' | 'interaction' | 'logic' | 'system';

const BLOCK_CATEGORIES: { key: CategoryKey; types: BlockType[] }[] = [
  { key: 'content',     types: ['text', 'dialogue', 'image', 'video', 'audio', 'table', 'divider'] },
  { key: 'interaction', types: ['choice', 'button', 'link', 'input-field', 'checkbox', 'radio'] },
  { key: 'logic',       types: ['condition', 'variable-set', 'function', 'popup'] },
  { key: 'system',      types: ['raw', 'include', 'note'] },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

interface BlockEntry { type: BlockType; label: string; icon: string; desc: string }

function buildEntries(t: ReturnType<typeof useT>): BlockEntry[] {
  return [
    { type: 'text',         icon: BLOCK_ICONS['text'],         label: t.addBlock.text.label,        desc: t.addBlock.text.desc },
    { type: 'dialogue',     icon: BLOCK_ICONS['dialogue'],     label: t.addBlock.dialogue.label,    desc: t.addBlock.dialogue.desc },
    { type: 'choice',       icon: BLOCK_ICONS['choice'],       label: t.addBlock.choice.label,      desc: t.addBlock.choice.desc },
    { type: 'condition',    icon: BLOCK_ICONS['condition'],    label: t.addBlock.condition.label,   desc: t.addBlock.condition.desc },
    { type: 'variable-set', icon: BLOCK_ICONS['variable-set'], label: t.addBlock.variableSet.label, desc: t.addBlock.variableSet.desc },
    { type: 'button',       icon: BLOCK_ICONS['button'],       label: t.addBlock.button.label,      desc: t.addBlock.button.desc },
    { type: 'link',         icon: BLOCK_ICONS['link'],         label: t.addBlock.link.label,        desc: t.addBlock.link.desc },
    { type: 'input-field',  icon: BLOCK_ICONS['input-field'],  label: t.addBlock.inputField.label,  desc: t.addBlock.inputField.desc },
    { type: 'image',        icon: BLOCK_ICONS['image'],        label: t.addBlock.image.label,       desc: t.addBlock.image.desc },
    { type: 'video',        icon: BLOCK_ICONS['video'],        label: t.addBlock.video.label,       desc: t.addBlock.video.desc },
    { type: 'raw',          icon: BLOCK_ICONS['raw'],          label: t.addBlock.raw.label,         desc: t.addBlock.raw.desc },
    { type: 'note',         icon: BLOCK_ICONS['note'],         label: t.addBlock.note.label,        desc: t.addBlock.note.desc },
    { type: 'table',        icon: BLOCK_ICONS['table'],        label: t.addBlock.table.label,       desc: t.addBlock.table.desc },
    { type: 'include',      icon: BLOCK_ICONS['include'],      label: t.addBlock.include.label,     desc: t.addBlock.include.desc },
    { type: 'divider',      icon: BLOCK_ICONS['divider'],      label: t.addBlock.divider.label,     desc: t.addBlock.divider.desc },
    { type: 'checkbox',     icon: BLOCK_ICONS['checkbox'],     label: t.addBlock.checkbox.label,    desc: t.addBlock.checkbox.desc },
    { type: 'radio',        icon: BLOCK_ICONS['radio'],        label: t.addBlock.radio.label,       desc: t.addBlock.radio.desc },
    { type: 'function',     icon: BLOCK_ICONS['function'],     label: t.addBlock.function.label,    desc: t.addBlock.function.desc },
    { type: 'popup',        icon: BLOCK_ICONS['popup'],        label: t.addBlock.popup.label,       desc: t.addBlock.popup.desc },
    { type: 'audio',        icon: BLOCK_ICONS['audio'],        label: t.addBlock.audio.label,       desc: t.addBlock.audio.desc },
  ];
}

// ── Block button (full — with desc) ──────────────────────────────────────────

function BlockButton({ entry, onClick }: { entry: BlockEntry; onClick: () => void }) {
  return (
    <button
      className="flex items-center gap-2 px-3 py-2 hover:bg-slate-700 text-left transition-colors cursor-pointer border-b border-r border-slate-700"
      onClick={onClick}
    >
      <span className="text-base leading-none">{entry.icon}</span>
      <div>
        <div className="text-xs text-white font-medium">{entry.label}</div>
        <div className="text-xs text-slate-400 leading-tight">{entry.desc}</div>
      </div>
    </button>
  );
}

// ── Block button (compact — icon + label only, for "Recent") ─────────────────

function BlockButtonCompact({ entry, onClick }: { entry: BlockEntry; onClick: () => void }) {
  return (
    <button
      className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-slate-700 rounded text-left transition-colors cursor-pointer"
      onClick={onClick}
      title={entry.desc}
    >
      <span className="text-sm leading-none">{entry.icon}</span>
      <span className="text-xs text-white">{entry.label}</span>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  sceneId: string;
  /** Override the add handler — used for nested blocks inside conditions */
  onAdd?: (block: Block) => void;
  /** Hide certain block types (e.g. prevent nesting conditions) */
  excludeTypes?: BlockType[];
  /** Start in open state (used by InsertZone) */
  initialOpen?: boolean;
  /** Called when cancel is clicked in initialOpen mode */
  onClose?: () => void;
}

export function AddBlockMenu({ sceneId, onAdd, excludeTypes = [], initialOpen, onClose }: Props) {
  const { addBlock } = useProjectStore();
  const { recentBlockTypes, trackRecentBlock } = useEditorPrefsStore();
  const t = useT();
  const [open, setOpen] = useState(initialOpen ?? false);
  const [search, setSearch] = useState('');
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const close = () => { setOpen(false); setSearch(''); setExpandedCats(new Set()); onClose?.(); };

  // Auto-focus search when menu opens
  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const allEntries = buildEntries(t);
  const entryMap = new Map(allEntries.map((e) => [e.type, e]));

  const excluded = new Set(excludeTypes);
  const isVisible = (type: BlockType) => !excluded.has(type);

  const add = (type: BlockType) => {
    const block = makeBlock(type);
    trackRecentBlock(type);
    if (onAdd) {
      onAdd(block);
    } else {
      addBlock(sceneId, block);
    }
    close();
  };

  const toggleCat = (key: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // ── Search filtering ────────────────────────────────────────────────────────
  const q = search.trim().toLowerCase();
  const searchResults = q
    ? allEntries.filter(
        (e) => isVisible(e.type) && (e.label.toLowerCase().includes(q) || e.desc.toLowerCase().includes(q)),
      )
    : null;

  // ── Recent entries (only those not excluded) ────────────────────────────────
  const recentEntries = recentBlockTypes
    .filter((type) => isVisible(type) && entryMap.has(type))
    .map((type) => entryMap.get(type)!);

  // ── Closed state ────────────────────────────────────────────────────────────
  if (!open) {
    return (
      <div ref={ref} className="mt-1">
        <button
          className="w-full py-1.5 border border-dashed border-slate-700 hover:border-indigo-500 text-slate-500 hover:text-indigo-400 rounded text-xs transition-colors cursor-pointer"
          onClick={() => setOpen(true)}
        >
          {t.addBlock.trigger}
        </button>
      </div>
    );
  }

  // ── Open state ──────────────────────────────────────────────────────────────
  return (
    <div ref={ref} className="mt-1">
      <div className="border border-slate-600 rounded bg-slate-800 overflow-hidden">
        {/* Search */}
        <div className="px-2 pt-2 pb-1">
          <input
            ref={searchRef}
            type="text"
            className="w-full px-2 py-1 text-xs bg-slate-900 border border-slate-600 rounded text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors"
            placeholder={t.addBlock.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Search results (flat list) */}
        {searchResults ? (
          searchResults.length > 0 ? (
            <div className="grid grid-cols-2">
              {searchResults.map((e) => (
                <BlockButton key={e.type} entry={e} onClick={() => add(e.type)} />
              ))}
            </div>
          ) : (
            <div className="px-3 py-2 text-xs text-slate-500 text-center">—</div>
          )
        ) : (
          <>
            {/* Recent */}
            {recentEntries.length > 0 && (
              <div className="px-2 py-1 border-b border-slate-700">
                <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">{t.addBlock.recent}</div>
                <div className="flex flex-wrap">
                  {recentEntries.map((e) => (
                    <BlockButtonCompact key={e.type} entry={e} onClick={() => add(e.type)} />
                  ))}
                </div>
              </div>
            )}

            {/* Categories accordion */}
            {BLOCK_CATEGORIES.map((cat) => {
              const catEntries = cat.types.filter(isVisible).map((type) => entryMap.get(type)!);
              if (catEntries.length === 0) return null;
              const isExpanded = expandedCats.has(cat.key);
              return (
                <div key={cat.key} className="border-b border-slate-700 last:border-b-0">
                  <button
                    className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700/50 transition-colors cursor-pointer"
                    onClick={() => toggleCat(cat.key)}
                  >
                    <span className="font-medium">
                      {isExpanded ? '▾' : '▸'}{' '}
                      {t.addBlock.categories[cat.key]}
                    </span>
                    <span className="text-slate-500">{catEntries.length}</span>
                  </button>
                  {isExpanded && (
                    <div className="grid grid-cols-2">
                      {catEntries.map((e) => (
                        <BlockButton key={e.type} entry={e} onClick={() => add(e.type)} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* Cancel */}
        <button
          className="w-full py-1 text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
          onClick={close}
        >
          {t.addBlock.cancel}
        </button>
      </div>
    </div>
  );
}
