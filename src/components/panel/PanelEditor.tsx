import { useState } from 'react';
import { useProjectStore, flattenVariables, flattenAssets } from '../../store/projectStore';
import type {
  SidebarTab, SidebarRow, SidebarCell, CellContent,
  CellText, CellVariable, CellProgress, CellImageStatic, CellImageBound,
  ImageBoundMapping,
  Variable, Asset,
} from '../../types';

// ─── Root ─────────────────────────────────────────────────────────────────────

export function PanelEditor() {
  const {
    project,
    addPanelTab,
    updatePanelTab,
    deletePanelTab,
    reorderPanelTabs,
  } = useProjectStore();
  const { sidebarPanel } = project;
  const [activeTabId, setActiveTabId] = useState<string | null>(
    sidebarPanel.tabs[0]?.id ?? null
  );
  const [addingTab, setAddingTab] = useState(false);
  const [tabNameDraft, setTabNameDraft] = useState('');

  const vars = flattenVariables(project.variableNodes);
  const imgAssets = flattenAssets(project.assetNodes).filter(a => a.assetType === 'image');
  const activeTab = sidebarPanel.tabs.find(t => t.id === activeTabId) ?? null;

  const confirmAddTab = () => {
    const label = tabNameDraft.trim();
    if (label) {
      addPanelTab(label);
      // Select newly added tab after state update
      setTimeout(() => {
        const tabs = useProjectStore.getState().project.sidebarPanel.tabs;
        const last = tabs[tabs.length - 1];
        if (last) setActiveTabId(last.id);
      }, 0);
    }
    setAddingTab(false);
    setTabNameDraft('');
  };

  const moveTab = (id: string, dir: -1 | 1) => {
    const tabs = [...sidebarPanel.tabs];
    const idx = tabs.findIndex(t => t.id === id);
    const next = idx + dir;
    if (next < 0 || next >= tabs.length) return;
    [tabs[idx], tabs[next]] = [tabs[next], tabs[idx]];
    reorderPanelTabs(tabs);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-700 bg-slate-900 shrink-0">
        <span className="text-sm font-semibold text-slate-200">Боковая панель (StoryCaption)</span>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-700 bg-slate-900/60 shrink-0 overflow-x-auto">
        {sidebarPanel.tabs.map((tab, idx) => (
          <div key={tab.id} className="flex items-center gap-0.5 shrink-0">
            <button
              className={`px-3 py-1 rounded-t text-xs font-medium transition-colors cursor-pointer ${
                activeTabId === tab.id
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              onClick={() => setActiveTabId(tab.id)}
            >
              {tab.label}
            </button>
            {activeTabId === tab.id && (
              <div className="flex items-center">
                <button
                  className="text-slate-600 hover:text-slate-300 text-xs px-0.5 cursor-pointer"
                  title="Переместить влево"
                  onClick={() => moveTab(tab.id, -1)}
                  disabled={idx === 0}
                >
                  ◀
                </button>
                <button
                  className="text-slate-600 hover:text-slate-300 text-xs px-0.5 cursor-pointer"
                  title="Переместить вправо"
                  onClick={() => moveTab(tab.id, 1)}
                  disabled={idx === sidebarPanel.tabs.length - 1}
                >
                  ▶
                </button>
                <button
                  className="text-slate-600 hover:text-red-400 text-xs px-0.5 cursor-pointer"
                  title="Удалить вкладку"
                  onClick={() => {
                    if (!confirm(`Удалить вкладку "${tab.label}"?`)) return;
                    deletePanelTab(tab.id);
                    const remaining = sidebarPanel.tabs.filter(t => t.id !== tab.id);
                    setActiveTabId(remaining[0]?.id ?? null);
                  }}
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        ))}

        {addingTab ? (
          <input
            autoFocus
            className="text-xs bg-slate-800 text-white rounded px-2 py-1 outline-none border border-indigo-500 w-28 shrink-0"
            placeholder="Название вкладки"
            value={tabNameDraft}
            onChange={e => setTabNameDraft(e.target.value)}
            onBlur={confirmAddTab}
            onKeyDown={e => {
              if (e.key === 'Enter') confirmAddTab();
              if (e.key === 'Escape') { setAddingTab(false); setTabNameDraft(''); }
            }}
          />
        ) : (
          <button
            className="text-xs text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 rounded px-2 py-1 transition-colors cursor-pointer shrink-0"
            onClick={() => setAddingTab(true)}
          >
            + Вкладка
          </button>
        )}
      </div>

      {/* Active tab name editor + content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {!activeTab ? (
          <p className="text-sm text-slate-600 italic">Нет вкладок. Добавьте вкладку выше.</p>
        ) : (
          <>
            {/* Tab label edit */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 shrink-0">Название вкладки:</label>
              <input
                className="bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 w-48"
                value={activeTab.label}
                onChange={e => updatePanelTab(activeTab.id, { label: e.target.value })}
              />
            </div>

            {/* Rows editor */}
            <TabRowsEditor tab={activeTab} vars={vars} imgAssets={imgAssets} />
          </>
        )}
      </div>
    </div>
  );
}

// ─── Tab rows editor ──────────────────────────────────────────────────────────

function TabRowsEditor({ tab, vars, imgAssets }: { tab: SidebarTab; vars: Variable[]; imgAssets: Asset[] }) {
  const { addPanelRow, updatePanelRow, deletePanelRow, addPanelCell } = useProjectStore();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Строки</span>
        <button
          className="text-xs text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 rounded px-2 py-1 transition-colors cursor-pointer"
          onClick={() => addPanelRow(tab.id)}
        >
          + Строка
        </button>
      </div>

      {tab.rows.length === 0 && (
        <p className="text-xs text-slate-600 italic">Нет строк. Нажмите «+ Строка».</p>
      )}

      {tab.rows.map((row, rowIdx) => (
        <div key={row.id} className="border border-slate-700 rounded overflow-hidden">
          {/* Row header */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/60 border-b border-slate-700">
            <span className="text-xs text-slate-500">Строка {rowIdx + 1}</span>
            <label className="flex items-center gap-1 ml-auto">
              <span className="text-xs text-slate-500">Высота:</span>
              <input
                type="number"
                className="w-16 text-xs bg-slate-800 text-white rounded px-1.5 py-0.5 outline-none border border-slate-600 focus:border-indigo-500 font-mono"
                value={row.height}
                min={16}
                max={400}
                onChange={e => updatePanelRow(tab.id, row.id, { height: Number(e.target.value) })}
              />
              <span className="text-xs text-slate-500">px</span>
            </label>
            <button
              className="text-slate-600 hover:text-red-400 text-xs cursor-pointer"
              onClick={() => {
                if (confirm('Удалить строку?')) deletePanelRow(tab.id, row.id);
              }}
            >
              ✕
            </button>
          </div>

          {/* Cells */}
          <div className="p-2 flex flex-col gap-1.5">
            <div
              className="flex gap-2"
              style={{ height: Math.max(40, row.height) }}
            >
              {row.cells.map(cell => (
                <CellEditor key={cell.id} tabId={tab.id} row={row} cell={cell} vars={vars} imgAssets={imgAssets} />
              ))}
              {row.cells.length === 0 && (
                <span className="text-xs text-slate-600 italic self-center px-2">Нет ячеек</span>
              )}
            </div>
            <button
              className="text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded px-2 py-1 transition-colors cursor-pointer self-start"
              onClick={() => addPanelCell(tab.id, row.id)}
            >
              + Ячейка
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Cell editor ──────────────────────────────────────────────────────────────

function CellEditor({
  tabId, row, cell, vars, imgAssets,
}: {
  tabId: string;
  row: SidebarRow;
  cell: SidebarCell;
  vars: Variable[];
  imgAssets: Asset[];
}) {
  const { updatePanelCell, deletePanelCell, updateCellContent } = useProjectStore();
  const [editing, setEditing] = useState(false);

  const updateContent = (c: CellContent) => updateCellContent(tabId, row.id, cell.id, c);

  return (
    <div
      className="relative flex flex-col border border-slate-600 rounded bg-slate-800/40 overflow-hidden cursor-pointer group/cell"
      style={{ flex: cell.width }}
      onClick={() => setEditing(true)}
    >
      {/* Cell preview */}
      <CellPreview cell={cell} vars={vars} />

      {/* Hover overlay with controls — horizontal, fits any height */}
      <div className="absolute inset-0 bg-slate-900/85 opacity-0 group-hover/cell:opacity-100 transition-opacity flex items-center justify-center gap-1.5 px-1.5">
        <span className="text-xs text-slate-400 truncate min-w-0">{cellTypeLabel(cell.content.type)}</span>
        <button
          className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer shrink-0 hover:bg-slate-700 rounded px-1 py-0.5"
          title="Изменить"
          onClick={e => { e.stopPropagation(); setEditing(true); }}
        >
          ✏️
        </button>
        <button
          className="text-xs text-red-500 hover:text-red-400 cursor-pointer shrink-0 hover:bg-slate-700 rounded px-1 py-0.5"
          title="Удалить"
          onClick={e => { e.stopPropagation(); deletePanelCell(tabId, row.id, cell.id); }}
        >
          ✕
        </button>
      </div>

      {/* Edit modal */}
      {editing && (
        <CellEditModal
          cell={cell}
          vars={vars}
          imgAssets={imgAssets}
          onUpdateCell={patch => updatePanelCell(tabId, row.id, cell.id, patch)}
          onUpdateContent={updateContent}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

function cellTypeLabel(type: CellContent['type']): string {
  const m: Record<CellContent['type'], string> = {
    text: 'Текст', variable: 'Переменная', progress: 'Прогресс-бар',
    'image-static': 'Картинка', 'image-bound': 'Картинка (переменная)',
  };
  return m[type];
}

// ─── Cell preview ─────────────────────────────────────────────────────────────

function CellPreview({ cell, vars }: { cell: SidebarCell; vars: Variable[] }) {
  const c = cell.content;
  const v = 'variableId' in c ? vars.find(x => x.id === c.variableId) : undefined;

  if (c.type === 'text') {
    return <span className="text-xs text-slate-300 p-1 truncate flex-1">{c.value || <em className="text-slate-600">текст</em>}</span>;
  }
  if (c.type === 'variable') {
    return (
      <span className="text-xs text-sky-300 p-1 font-mono truncate flex-1">
        {c.prefix}{v ? `$${v.name}` : '?'}{c.suffix}
      </span>
    );
  }
  if (c.type === 'progress') {
    return (
      <div className="flex-1 p-1 flex items-center">
        <div className="w-full h-2 bg-slate-700 rounded overflow-hidden">
          <div className="h-full rounded" style={{ width: '60%', background: c.color }} />
        </div>
      </div>
    );
  }
  if (c.type === 'image-static' || c.type === 'image-bound') {
    return (
      <div className="flex-1 flex items-center justify-center p-1">
        <span className="text-xs text-slate-500">🖼️</span>
      </div>
    );
  }
  return null;
}

// ─── Cell edit modal ──────────────────────────────────────────────────────────

const CELL_TYPES: { value: CellContent['type']; label: string }[] = [
  { value: 'text',         label: 'Текст' },
  { value: 'variable',     label: 'Переменная' },
  { value: 'progress',     label: 'Прогресс-бар' },
  { value: 'image-static', label: 'Картинка (статическая)' },
  { value: 'image-bound',  label: 'Картинка (по переменной)' },
];

function makeDefaultContent(type: CellContent['type']): CellContent {
  switch (type) {
    case 'text':         return { type: 'text', value: '' } as CellText;
    case 'variable':     return { type: 'variable', variableId: '', prefix: '', suffix: '' } as CellVariable;
    case 'progress':     return { type: 'progress', variableId: '', maxValue: 100, color: '#4ade80', showText: false } as CellProgress;
    case 'image-static': return { type: 'image-static', src: '', objectFit: 'cover' } as CellImageStatic;
    case 'image-bound':  return { type: 'image-bound', variableId: '', mapping: [], defaultSrc: '', objectFit: 'cover' } as CellImageBound;
  }
}

function CellEditModal({
  cell, vars, imgAssets, onUpdateCell, onUpdateContent, onClose,
}: {
  cell: SidebarCell;
  vars: Variable[];
  imgAssets: Asset[];
  onUpdateCell: (patch: Partial<Omit<SidebarCell, 'id'>>) => void;
  onUpdateContent: (c: CellContent) => void;
  onClose: () => void;
}) {
  const c = cell.content;

  const handleTypeChange = (type: CellContent['type']) => {
    if (type !== c.type) onUpdateContent(makeDefaultContent(type));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-600 rounded-lg shadow-2xl w-96 max-h-[80vh] overflow-y-auto p-4 flex flex-col gap-3"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-white">Настройка ячейки</span>
          <button className="text-slate-500 hover:text-white text-xs cursor-pointer" onClick={onClose}>✕</button>
        </div>

        {/* Width */}
        <MField label="Ширина (flex)">
          <input
            type="number"
            min={1} max={12}
            className="w-20 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 font-mono"
            value={cell.width}
            onChange={e => onUpdateCell({ width: Math.max(1, Number(e.target.value)) })}
          />
        </MField>

        {/* Type */}
        <MField label="Тип содержимого">
          <select
            className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
            value={c.type}
            onChange={e => handleTypeChange(e.target.value as CellContent['type'])}
          >
            {CELL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </MField>

        {/* Type-specific fields */}
        {c.type === 'text' && (
          <MField label="Текст">
            <input
              className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500"
              value={c.value}
              onChange={e => onUpdateContent({ ...c, value: e.target.value })}
            />
          </MField>
        )}

        {c.type === 'variable' && (
          <>
            <VarSelect vars={vars} value={c.variableId} onChange={v => onUpdateContent({ ...c, variableId: v })} />
            <MField label="Префикс">
              <input className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600"
                value={c.prefix} onChange={e => onUpdateContent({ ...c, prefix: e.target.value })} />
            </MField>
            <MField label="Суффикс">
              <input className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600"
                value={c.suffix} onChange={e => onUpdateContent({ ...c, suffix: e.target.value })} />
            </MField>
          </>
        )}

        {c.type === 'progress' && (
          <>
            <VarSelect vars={vars} value={c.variableId} onChange={v => onUpdateContent({ ...c, variableId: v })} />
            <MField label="Максимум">
              <input type="number" min={1}
                className="w-24 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 font-mono"
                value={c.maxValue} onChange={e => onUpdateContent({ ...c, maxValue: Number(e.target.value) })} />
            </MField>
            <MField label="Цвет">
              <input type="color"
                className="w-10 h-8 rounded cursor-pointer bg-transparent border border-slate-600"
                value={c.color} onChange={e => onUpdateContent({ ...c, color: e.target.value })} />
              <input className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 font-mono ml-2"
                value={c.color} onChange={e => onUpdateContent({ ...c, color: e.target.value })} />
            </MField>
            <MField label="Показать числа">
              <input type="checkbox" className="accent-indigo-500 cursor-pointer"
                checked={c.showText} onChange={e => onUpdateContent({ ...c, showText: e.target.checked })} />
            </MField>
          </>
        )}

        {c.type === 'image-static' && (
          <>
            <MField label="Картинка">
              <AssetImagePicker imgAssets={imgAssets} value={c.src} onChange={src => onUpdateContent({ ...c, src })} />
            </MField>
            <ObjectFitSelect value={c.objectFit} onChange={v => onUpdateContent({ ...c, objectFit: v })} />
          </>
        )}

        {c.type === 'image-bound' && (
          <>
            <VarSelect vars={vars} value={c.variableId} onChange={v => onUpdateContent({ ...c, variableId: v })} />
            <ObjectFitSelect value={c.objectFit} onChange={v => onUpdateContent({ ...c, objectFit: v })} />
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Соответствия (значение → файл):</span>
                <button
                  className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer"
                  onClick={() => onUpdateContent({
                    ...c,
                    mapping: [...c.mapping, {
                      id: crypto.randomUUID(),
                      matchType: 'exact',
                      value: '', rangeMin: '', rangeMax: '', src: '',
                    } satisfies ImageBoundMapping],
                  })}
                >
                  + Добавить
                </button>
              </div>

              {c.mapping.map((m, i) => {
                const patchM = (patch: Partial<ImageBoundMapping>) =>
                  onUpdateContent({ ...c, mapping: c.mapping.map((x, j) => j === i ? { ...x, ...patch } : x) });
                const mt = m.matchType ?? 'exact';

                return (
                  <div key={m.id ?? i} className="flex flex-col gap-1.5 border border-slate-700/60 rounded p-1.5">
                    {/* Mode toggle + delete */}
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-500 shrink-0">Режим:</span>
                      <select
                        className="flex-1 bg-slate-800 text-xs text-white rounded px-1.5 py-0.5 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
                        value={mt}
                        onChange={e => patchM({ matchType: e.target.value as 'exact' | 'range' })}
                      >
                        <option value="exact">Точное значение</option>
                        <option value="range">Диапазон</option>
                      </select>
                      <button
                        className="text-slate-600 hover:text-red-400 text-xs cursor-pointer shrink-0 ml-1"
                        onClick={() => onUpdateContent({ ...c, mapping: c.mapping.filter((_, j) => j !== i) })}
                      >
                        ✕
                      </button>
                    </div>

                    {/* Exact value input */}
                    {mt === 'exact' && (
                      <div className="flex gap-1 items-center">
                        <span className="text-xs text-slate-500 shrink-0 w-10">Знач.:</span>
                        <input
                          className="flex-1 bg-slate-800 text-xs text-white rounded px-1.5 py-1 outline-none border border-slate-600 font-mono"
                          placeholder="100"
                          value={m.value}
                          onChange={e => patchM({ value: e.target.value })}
                        />
                      </div>
                    )}

                    {/* Range inputs */}
                    {mt === 'range' && (
                      <div className="flex gap-1 items-center">
                        <span className="text-xs text-slate-500 shrink-0 w-10">От:</span>
                        <input
                          className="flex-1 bg-slate-800 text-xs text-white rounded px-1.5 py-1 outline-none border border-slate-600 font-mono"
                          placeholder="0"
                          value={m.rangeMin ?? ''}
                          onChange={e => patchM({ rangeMin: e.target.value })}
                        />
                        <span className="text-xs text-slate-500 shrink-0">До:</span>
                        <input
                          className="flex-1 bg-slate-800 text-xs text-white rounded px-1.5 py-1 outline-none border border-slate-600 font-mono"
                          placeholder="20"
                          value={m.rangeMax ?? ''}
                          onChange={e => patchM({ rangeMax: e.target.value })}
                        />
                      </div>
                    )}

                    {/* File picker */}
                    <div className="flex gap-1 items-start">
                      <span className="text-xs text-slate-500 shrink-0 pt-1.5 w-10">Файл:</span>
                      <AssetImagePicker
                        imgAssets={imgAssets}
                        value={m.src}
                        onChange={src => patchM({ src })}
                      />
                    </div>
                  </div>
                );
              })}

              <MField label="По умолч.">
                <AssetImagePicker imgAssets={imgAssets} value={c.defaultSrc} onChange={defaultSrc => onUpdateContent({ ...c, defaultSrc })} />
              </MField>
            </div>
          </>
        )}

        <button
          className="mt-2 px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium cursor-pointer self-end"
          onClick={onClose}
        >
          Готово
        </button>
      </div>
    </div>
  );
}

// ─── Reusable sub-components ──────────────────────────────────────────────────

function MField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-slate-400 w-28 shrink-0">{label}:</label>
      <div className="flex-1 flex items-center gap-1">{children}</div>
    </div>
  );
}

function VarSelect({ vars, value, onChange }: { vars: Variable[]; value: string; onChange: (id: string) => void }) {
  return (
    <MField label="Переменная">
      <select
        className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">— выбрать —</option>
        {vars.map(v => <option key={v.id} value={v.id}>${v.name} ({v.varType})</option>)}
      </select>
    </MField>
  );
}

function ObjectFitSelect({ value, onChange }: { value: 'cover' | 'contain'; onChange: (v: 'cover' | 'contain') => void }) {
  return (
    <MField label="Заполнение">
      <select
        className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 cursor-pointer"
        value={value}
        onChange={e => onChange(e.target.value as 'cover' | 'contain')}
      >
        <option value="cover">cover (обрезать)</option>
        <option value="contain">contain (вписать)</option>
      </select>
    </MField>
  );
}

// Пикер изображения: дропдаун из загруженных ассетов + ручной ввод пути
function AssetImagePicker({
  imgAssets, value, onChange,
}: {
  imgAssets: Asset[];
  value: string;
  onChange: (src: string) => void;
}) {
  // Находим ассет по совпадению relativePath с текущим value
  const matched = imgAssets.find(a => a.relativePath === value);

  return (
    <div className="flex-1 flex flex-col gap-1 min-w-0">
      {imgAssets.length > 0 && (
        <select
          className="w-full bg-slate-800 text-xs text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
          value={matched?.id ?? ''}
          onChange={e => {
            const asset = imgAssets.find(a => a.id === e.target.value);
            if (asset) onChange(asset.relativePath);
            else if (e.target.value === '') onChange('');
          }}
        >
          <option value="">— выбрать из ассетов —</option>
          {imgAssets.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      )}
      <input
        className="w-full bg-slate-800 text-xs text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 font-mono"
        placeholder="assets/img.png"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}
