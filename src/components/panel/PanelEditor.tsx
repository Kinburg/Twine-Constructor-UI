import { useState, useRef } from 'react';
import { useProjectStore, flattenVariables, flattenAssets, DEFAULT_PANEL_STYLE, redistributeWidths } from '../../store/projectStore';
import { useT } from '../../i18n';
import type {
  SidebarTab, SidebarRow, SidebarCell, CellContent, PanelStyle,
  CellText, CellVariable, CellProgress, CellImageStatic, CellImageBound, CellRaw,
  CellButton, CellList, ButtonAction, ButtonStyle, VarOperator,
  ImageBoundMapping,
  Variable, Asset,
} from '../../types';

// ─── Root ─────────────────────────────────────────────────────────────────────

export function PanelEditor() {
  const t = useT();
  const {
    project,
    addPanelTab,
    updatePanelTab,
    updatePanelStyle,
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
  const style: PanelStyle = sidebarPanel.style ?? DEFAULT_PANEL_STYLE;

  const confirmAddTab = () => {
    const label = tabNameDraft.trim();
    if (label) {
      addPanelTab(label);
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
        <span className="text-sm font-semibold text-slate-200">{t.panel.title}</span>
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
                <button className="text-slate-600 hover:text-slate-300 text-xs px-0.5 cursor-pointer" title={t.panel.moveLeft}
                  onClick={() => moveTab(tab.id, -1)} disabled={idx === 0}>◀</button>
                <button className="text-slate-600 hover:text-slate-300 text-xs px-0.5 cursor-pointer" title={t.panel.moveRight}
                  onClick={() => moveTab(tab.id, 1)} disabled={idx === sidebarPanel.tabs.length - 1}>▶</button>
                <button className="text-slate-600 hover:text-red-400 text-xs px-0.5 cursor-pointer" title={t.panel.deleteTab}
                  onClick={() => {
                    if (!confirm(t.panel.confirmDeleteTab(tab.label))) return;
                    deletePanelTab(tab.id);
                    const remaining = sidebarPanel.tabs.filter(t => t.id !== tab.id);
                    setActiveTabId(remaining[0]?.id ?? null);
                  }}>✕</button>
              </div>
            )}
          </div>
        ))}

        {addingTab ? (
          <input autoFocus
            className="text-xs bg-slate-800 text-white rounded px-2 py-1 outline-none border border-indigo-500 w-28 shrink-0"
            placeholder={t.panel.tabNamePlaceholder}
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
            {t.panel.addTab}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

        {/* ── Panel style settings ── */}
        <PanelStyleEditor style={style} onChange={updatePanelStyle} />

        {!activeTab ? (
          <p className="text-sm text-slate-600 italic">{t.panel.noTabs}</p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 shrink-0">{t.panel.tabNameLabel}</label>
              <input
                className="bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 w-48"
                value={activeTab.label}
                onChange={e => updatePanelTab(activeTab.id, { label: e.target.value })}
              />
            </div>

            <TabRowsEditor tab={activeTab} vars={vars} imgAssets={imgAssets} />
          </>
        )}
      </div>
    </div>
  );
}

// ─── Panel style editor ───────────────────────────────────────────────────────

function PanelStyleEditor({
  style, onChange,
}: {
  style: PanelStyle;
  onChange: (patch: Partial<PanelStyle>) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-slate-700 rounded overflow-hidden">
      <button
        className="flex items-center gap-2 w-full px-3 py-2 bg-slate-800/60 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
        onClick={() => setOpen(v => !v)}
      >
        <span className="text-slate-500">{open ? '▼' : '▶'}</span>
        {t.tableStyle.title}
      </button>

      {open && (
        <div className="px-3 py-3 flex flex-col gap-3 bg-slate-900/40">

          {/* Gaps row */}
          <div className="flex items-center gap-4 flex-wrap">
            <SField label={t.tableStyle.rowGap}>
              <NumInput value={style.rowGap} min={0} max={40}
                onChange={v => onChange({ rowGap: v })} suffix="px" />
            </SField>
          </div>

          {/* Border toggles */}
          <div className="flex flex-col gap-2">
            <span className="text-xs text-slate-500 font-medium">{t.tableStyle.borders}</span>
            <div className="flex flex-wrap gap-3">
              <CheckField label={t.tableStyle.outerBorder}
                checked={style.showOuterBorder} onChange={v => onChange({ showOuterBorder: v })} />
              <CheckField label={t.tableStyle.betweenRows}
                checked={style.showRowBorders}  onChange={v => onChange({ showRowBorders: v })} />
              <CheckField label={t.tableStyle.betweenCells}
                checked={style.showCellBorders} onChange={v => onChange({ showCellBorders: v })} />
            </div>
          </div>

          {/* Border appearance — shown only if any border is on */}
          {(style.showOuterBorder || style.showRowBorders || style.showCellBorders) && (
            <div className="flex items-center gap-4 flex-wrap">
              <SField label={t.tableStyle.thickness}>
                <NumInput value={style.borderWidth} min={1} max={8}
                  onChange={v => onChange({ borderWidth: v })} suffix="px" />
              </SField>
              <SField label={t.tableStyle.borderColor}>
                <div className="flex items-center gap-1.5">
                  <input type="color"
                    className="w-8 h-7 rounded cursor-pointer bg-transparent border border-slate-600"
                    value={style.borderColor}
                    onChange={e => onChange({ borderColor: e.target.value })} />
                  <input
                    className="w-24 bg-slate-800 text-xs text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 font-mono"
                    value={style.borderColor}
                    onChange={e => onChange({ borderColor: e.target.value })} />
                </div>
              </SField>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab rows editor ──────────────────────────────────────────────────────────

function TabRowsEditor({
  tab, vars, imgAssets,
}: {
  tab: SidebarTab;
  vars: Variable[];
  imgAssets: Asset[];
}) {
  const t = useT();
  const { addPanelRow, updatePanelRow, deletePanelRow, addPanelCell } = useProjectStore();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t.rowsEditor.sectionTitle}</span>
      </div>

      {tab.rows.length === 0 && (
        <p className="text-xs text-slate-600 italic">{t.rowsEditor.noRows}</p>
      )}

      {tab.rows.map((row, rowIdx) => (
        <div key={row.id} className="border border-slate-700 rounded overflow-hidden">
          {/* Row header */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/60 border-b border-slate-700 flex-wrap">
            <span className="text-xs text-slate-500">{t.rowsEditor.rowLabel(rowIdx + 1)}</span>

            {/* Row height */}
            <label className="flex items-center gap-1 ml-auto">
              <span className="text-xs text-slate-500">{t.rowsEditor.heightLabel}</span>
              <NumInput value={row.height} min={16} max={400}
                onChange={v => updatePanelRow(tab.id, row.id, { height: v })} suffix="px"
                className="w-16" />
            </label>

            <button className="text-slate-600 hover:text-red-400 text-xs cursor-pointer"
              onClick={() => { if (confirm(t.rowsEditor.confirmDeleteRow)) deletePanelRow(tab.id, row.id); }}>
              ✕
            </button>
          </div>

          {/* Cells preview + width inputs */}
          <div className="p-2 flex flex-col gap-1.5">

            {/* Preview row — DragDividers between cells for width redistribution */}
            <div
              className="flex"
              style={{ height: Math.max(40, row.height) }}
            >
              {row.cells.flatMap((cell, idx) => [
                idx > 0 ? (
                  <DragDivider
                    key={`div-${row.cells[idx - 1].id}`}
                    leftCell={row.cells[idx - 1]}
                    rightCell={cell}
                    tabId={tab.id}
                    rowId={row.id}
                  />
                ) : null,
                <CellEditor
                  key={cell.id}
                  tabId={tab.id}
                  row={row}
                  cell={cell}
                  vars={vars}
                  imgAssets={imgAssets}
                />,
              ]).filter(Boolean)}
              {row.cells.length === 0 && (
                <span className="text-xs text-slate-600 italic self-center px-2">{t.rowsEditor.noCells}</span>
              )}
            </div>

            {/* Width inputs under each cell */}
            {row.cells.length > 0 && (
              <CellWidthBar tabId={tab.id} row={row} />
            )}

            <button
              className="text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded px-2 py-1 transition-colors cursor-pointer self-start"
              onClick={() => addPanelCell(tab.id, row.id)}
            >
              {t.rowsEditor.addCell}
            </button>
          </div>
        </div>
      ))}
      <button
          className="text-xs text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 rounded px-2 py-1 transition-colors cursor-pointer"
          onClick={() => addPanelRow(tab.id)}
      >
        {t.rowsEditor.addRow}
      </button>
    </div>
  );
}

// ─── Cell width bar ───────────────────────────────────────────────────────────

function CellWidthBar({
  tabId, row,
}: {
  tabId: string;
  row: SidebarRow;
}) {
  const t = useT();
  const { updatePanelCell } = useProjectStore();

  const total = row.cells.reduce((s, c) => s + c.width, 0);
  const offBy = total - 100;

  // Change one cell's width; auto-adjust the last other cell to keep Σ=100
  const handleWidthChange = (cellId: string, newW: number) => {
    const idx = row.cells.findIndex(c => c.id === cellId);
    if (idx < 0) return;
    const clampedW = Math.max(1, Math.min(99, newW));
    const diff = clampedW - row.cells[idx].width;
    updatePanelCell(tabId, row.id, cellId, { width: clampedW });
    if (diff !== 0) {
      const buddyIdx = idx === row.cells.length - 1 ? row.cells.length - 2 : row.cells.length - 1;
      if (buddyIdx >= 0 && buddyIdx !== idx) {
        const buddy = row.cells[buddyIdx];
        updatePanelCell(tabId, row.id, buddy.id, { width: Math.max(1, buddy.width - diff) });
      }
    }
  };

  // Equalize all cells in this row
  const handleEqualize = () => {
    const equalized = redistributeWidths(row.cells);
    equalized.forEach(c => updatePanelCell(tabId, row.id, c.id, { width: c.width }));
  };

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        {row.cells.map(cell => (
          <div key={cell.id} style={{ flex: cell.width, minWidth: 0 }} className="flex items-center gap-0.5 min-w-0">
            <input
              type="number"
              min={1} max={99}
              className="w-full text-xs bg-slate-800 text-white rounded px-1.5 py-0.5 outline-none border border-slate-700 focus:border-indigo-500 font-mono text-center"
              value={cell.width}
              onChange={e => handleWidthChange(cell.id, Number(e.target.value))}
            />
            <span className="text-xs text-slate-600 shrink-0">%</span>
          </div>
        ))}
      </div>

      {/* Sum indicator + equalize button */}
      <div className="flex items-center gap-2 mt-0.5">
        <span className={`text-xs font-mono ${offBy === 0 ? 'text-slate-600' : 'text-amber-400'}`}>
          Σ {total}%{offBy !== 0 && ` (${offBy > 0 ? '+' : ''}${offBy})`}
        </span>
        <button
          className="text-xs text-slate-500 hover:text-slate-300 cursor-pointer hover:bg-slate-800 rounded px-1.5 py-0.5 transition-colors"
          title={t.rowsEditor.equalWidthTitle}
          onClick={handleEqualize}
        >
          {t.rowsEditor.equalWidth}
        </button>
      </div>
    </div>
  );
}

// ─── Drag divider (between cells in preview row) ──────────────────────────────

function DragDivider({
  leftCell, rightCell, tabId, rowId,
}: {
  leftCell: SidebarCell;
  rightCell: SidebarCell;
  tabId: string;
  rowId: string;
}) {
  const { updatePanelCell } = useProjectStore();
  const ref = useRef<HTMLDivElement>(null);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startLeftW = leftCell.width;
    const combined = startLeftW + rightCell.width;
    const containerEl = ref.current?.parentElement;
    if (!containerEl) return;
    const containerW = containerEl.clientWidth;

    const onMove = (me: MouseEvent) => {
      const dx = me.clientX - startX;
      const dPct = (dx / containerW) * 100;
      const newLeft = Math.max(5, Math.min(combined - 5, Math.round(startLeftW + dPct)));
      updatePanelCell(tabId, rowId, leftCell.id, { width: newLeft });
      updatePanelCell(tabId, rowId, rightCell.id, { width: combined - newLeft });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div
      ref={ref}
      onMouseDown={onMouseDown}
      style={{
        width: 4,
        flexShrink: 0,
        cursor: 'col-resize',
        background: 'rgba(99,102,241,0.15)',
        borderRadius: 2,
        alignSelf: 'stretch',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.45)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.15)'; }}
    />
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
  const t = useT();
  const { deletePanelCell, updateCellContent } = useProjectStore();
  const [editing, setEditing] = useState(false);

  const updateContent = (c: CellContent) => updateCellContent(tabId, row.id, cell.id, c);

  return (
    <div
      className="relative flex flex-col border border-slate-600 rounded bg-slate-800/40 overflow-hidden cursor-pointer group/cell"
      style={{ flex: cell.width, minWidth: 0, overflow: 'hidden' }}
      onClick={() => setEditing(true)}
    >
      <CellPreview cell={cell} vars={vars} />

      <div className="absolute inset-0 bg-slate-900/85 opacity-0 group-hover/cell:opacity-100 transition-opacity flex items-center justify-center gap-1.5 px-1.5">
        <span className="text-xs text-slate-400 truncate min-w-0">{cellTypeLabelFromT(t, cell.content.type)}</span>
        <button className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer shrink-0 hover:bg-slate-700 rounded px-1 py-0.5"
          title={t.rowsEditor.editTitle}
          onClick={e => { e.stopPropagation(); setEditing(true); }}>✏️</button>
        <button className="text-xs text-red-500 hover:text-red-400 cursor-pointer shrink-0 hover:bg-slate-700 rounded px-1 py-0.5"
          title={t.rowsEditor.deleteTitle}
          onClick={e => { e.stopPropagation(); deletePanelCell(tabId, row.id, cell.id); }}>✕</button>
      </div>

      {editing && (
        <CellEditModal
          cell={cell} vars={vars} imgAssets={imgAssets}
          onUpdateContent={updateContent}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

// ─── Cell type label helper ────────────────────────────────────────────────────

function cellTypeLabelFromT(t: ReturnType<typeof useT>, type: CellContent['type']): string {
  const m: Record<CellContent['type'], string> = {
    text:           t.cellModal.typeText,
    variable:       t.cellModal.typeVariable,
    progress:       t.cellModal.typeProgress,
    'image-static': t.cellModal.typeImageStatic,
    'image-bound':  t.cellModal.typeImageBoundShort,
    raw:            t.cellModal.typeRaw,
    button:         t.cellModal.typeButton,
    list:           t.cellModal.typeList,
  };
  return m[type];
}

// ─── Cell preview ─────────────────────────────────────────────────────────────

function CellPreview({ cell, vars }: { cell: SidebarCell; vars: Variable[] }) {
  const t = useT();
  const c = cell.content;
  const v = 'variableId' in c ? vars.find(x => x.id === c.variableId) : undefined;

  if (c.type === 'text') return (
    <span className="text-xs text-slate-300 p-1 truncate flex-1">
      {c.value || <em className="text-slate-600">{t.rowsEditor.cellTextPlaceholder}</em>}
    </span>
  );
  if (c.type === 'variable') return (
    <span className="text-xs text-sky-300 p-1 font-mono truncate flex-1">
      {c.prefix}{v ? `$${v.name}` : '?'}{c.suffix}
    </span>
  );
  if (c.type === 'progress') {
    const previewColor = c.colorRange?.from ?? c.color;
    if (c.vertical) return (
      <div className="flex-1 p-1 flex justify-center items-stretch">
        <div className="flex-1 rounded overflow-hidden flex flex-col-reverse" style={{ background: c.emptyColor ?? '#333' }}>
          <div className="w-full rounded" style={{ height: '60%', background: previewColor }} />
        </div>
      </div>
    );
    return (
      <div className="flex-1 p-1 flex items-center">
        <div className="w-full h-2 rounded overflow-hidden" style={{ background: c.emptyColor ?? '#333' }}>
          <div className="h-full rounded" style={{ width: '60%', background: previewColor }} />
        </div>
      </div>
    );
  }
  if (c.type === 'image-static' || c.type === 'image-bound') return (
    <div className="flex-1 flex items-center justify-center p-1">
      <span className="text-xs text-slate-500">🖼️</span>
    </div>
  );
  if (c.type === 'raw') return (
    <span className="text-xs text-zinc-400 font-mono p-1 truncate flex-1">
      {c.code || <em className="text-slate-600 not-italic">{t.rowsEditor.cellCodePlaceholder}</em>}
    </span>
  );
  if (c.type === 'button') return (
    <div className="flex-1 flex items-center justify-center p-1">
      <span
        style={{
          background: c.style.bgColor,
          color: c.style.textColor,
          border: `1px solid ${c.style.borderColor}`,
          borderRadius: `${c.style.borderRadius}px`,
          padding: `${Math.min(c.style.paddingV, 4)}px ${Math.min(c.style.paddingH, 8)}px`,
          fontSize: '0.7em',
          fontWeight: c.style.bold ? 'bold' : 'normal',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '100%',
        }}
      >
        {c.label || '…'}
      </span>
    </div>
  );
  if (c.type === 'list') return (
    <span className="text-xs text-violet-300 p-1 font-mono truncate flex-1">
      [{v ? `$${v.name}` : '?'}]
    </span>
  );
  return null;
}

// ─── Cell edit modal ──────────────────────────────────────────────────────────

const DEFAULT_BUTTON_STYLE: ButtonStyle = {
  bgColor: '#3b82f6', textColor: '#ffffff', borderColor: '#2563eb',
  borderRadius: 4, paddingV: 4, paddingH: 10,
  fontSize: 9, bold: false, fullWidth: false,
};

function makeDefaultContent(type: CellContent['type']): CellContent {
  switch (type) {
    case 'text':         return { type: 'text', value: '' } as CellText;
    case 'variable':     return { type: 'variable', variableId: '', prefix: '', suffix: '' } as CellVariable;
    case 'progress':     return { type: 'progress', variableId: '', maxValue: 100, color: '#4ade80', emptyColor: '#333333', textColor: '', colorRange: null, showText: false } as CellProgress;
    case 'image-static': return { type: 'image-static', src: '', objectFit: 'cover' } as CellImageStatic;
    case 'image-bound':  return { type: 'image-bound', variableId: '', mapping: [], defaultSrc: '', objectFit: 'cover' } as CellImageBound;
    case 'raw':          return { type: 'raw', code: '' } as CellRaw;
    case 'button':       return { type: 'button', label: '', style: { ...DEFAULT_BUTTON_STYLE }, actions: [] } as CellButton;
    case 'list':         return { type: 'list', variableId: '', separator: ', ', emptyText: '', prefix: '', suffix: '' } as CellList;
  }
}

function CellEditModal({
  cell, vars, imgAssets, onUpdateContent, onClose,
}: {
  cell: SidebarCell;
  vars: Variable[];
  imgAssets: Asset[];
  onUpdateContent: (c: CellContent) => void;
  onClose: () => void;
}) {
  const t = useT();
  const c = cell.content;

  const CELL_TYPES: { value: CellContent['type']; label: string }[] = [
    { value: 'text',         label: t.cellModal.typeText },
    { value: 'variable',     label: t.cellModal.typeVariable },
    { value: 'progress',     label: t.cellModal.typeProgress },
    { value: 'image-static', label: t.cellModal.typeImageStatic },
    { value: 'image-bound',  label: t.cellModal.typeImageBound },
    { value: 'raw',          label: t.cellModal.typeRaw },
    { value: 'button',       label: t.cellModal.typeButton },
    { value: 'list',         label: t.cellModal.typeList },
  ];

  const handleTypeChange = (type: CellContent['type']) => {
    if (type !== c.type) onUpdateContent(makeDefaultContent(type));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-600 rounded-lg shadow-2xl w-96 max-h-[80vh] overflow-y-auto p-4 flex flex-col gap-3"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-white">{t.cellModal.title}</span>
          <button className="text-slate-500 hover:text-white text-xs cursor-pointer" onClick={onClose}>✕</button>
        </div>

        {/* Type */}
        <MField label={t.cellModal.contentType}>
          <select
            className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
            value={c.type}
            onChange={e => handleTypeChange(e.target.value as CellContent['type'])}
          >
            {CELL_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
          </select>
        </MField>

        {/* Type-specific fields */}
        {c.type === 'text' && (
          <MField label={t.cellModal.typeText}>
            <input className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500"
              value={c.value} onChange={e => onUpdateContent({ ...c, value: e.target.value })} />
          </MField>
        )}

        {c.type === 'variable' && (
          <>
            <VarSelect vars={vars} value={c.variableId} onChange={v => onUpdateContent({ ...c, variableId: v })} />
            <MField label={t.cellModal.prefix}>
              <input className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600"
                value={c.prefix} onChange={e => onUpdateContent({ ...c, prefix: e.target.value })} />
            </MField>
            <MField label={t.cellModal.suffix}>
              <input className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600"
                value={c.suffix} onChange={e => onUpdateContent({ ...c, suffix: e.target.value })} />
            </MField>
          </>
        )}

        {c.type === 'progress' && (
          <>
            <VarSelect vars={vars.filter(v => v.varType === 'number')} value={c.variableId} onChange={v => onUpdateContent({ ...c, variableId: v })} />
            <MField label={t.cellModal.maximum}>
              <input type="number" min={1}
                className="w-24 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 font-mono"
                value={c.maxValue} onChange={e => onUpdateContent({ ...c, maxValue: Number(e.target.value) })} />
            </MField>
            {/* Colour range toggle */}
            <MField label={t.cellModal.colorRange}>
              <input type="checkbox" className="accent-indigo-500 cursor-pointer"
                checked={!!c.colorRange}
                onChange={e => onUpdateContent({ ...c, colorRange: e.target.checked ? { from: c.color, to: c.color } : null })} />
              <span className="text-xs text-slate-500 ml-1">{c.colorRange ? '0% → 100%' : t.cellModal.colorRangeOff}</span>
            </MField>
            {/* Fill colour(s) */}
            {c.colorRange ? (
              <>
                <MField label={t.cellModal.colorAt0}>
                  <input type="color" className="w-10 h-8 rounded cursor-pointer bg-transparent border border-slate-600"
                    value={c.colorRange.from} onChange={e => onUpdateContent({ ...c, colorRange: { ...c.colorRange!, from: e.target.value } })} />
                  <input className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 font-mono ml-2"
                    value={c.colorRange.from} onChange={e => onUpdateContent({ ...c, colorRange: { ...c.colorRange!, from: e.target.value } })} />
                </MField>
                <MField label={t.cellModal.colorAt100}>
                  <input type="color" className="w-10 h-8 rounded cursor-pointer bg-transparent border border-slate-600"
                    value={c.colorRange.to} onChange={e => onUpdateContent({ ...c, colorRange: { ...c.colorRange!, to: e.target.value } })} />
                  <input className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 font-mono ml-2"
                    value={c.colorRange.to} onChange={e => onUpdateContent({ ...c, colorRange: { ...c.colorRange!, to: e.target.value } })} />
                </MField>
              </>
            ) : (
              <MField label={t.cellModal.fillColor}>
                <input type="color" className="w-10 h-8 rounded cursor-pointer bg-transparent border border-slate-600"
                  value={c.color} onChange={e => onUpdateContent({ ...c, color: e.target.value })} />
                <input className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 font-mono ml-2"
                  value={c.color} onChange={e => onUpdateContent({ ...c, color: e.target.value })} />
              </MField>
            )}
            {/* Empty-portion colour */}
            <MField label={t.cellModal.barBgColor}>
              <input type="color" className="w-10 h-8 rounded cursor-pointer bg-transparent border border-slate-600"
                value={c.emptyColor ?? '#333333'} onChange={e => onUpdateContent({ ...c, emptyColor: e.target.value })} />
              <input className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 font-mono ml-2"
                value={c.emptyColor ?? '#333333'} onChange={e => onUpdateContent({ ...c, emptyColor: e.target.value })} />
            </MField>
            {/* Text colour */}
            <MField label={t.cellModal.textColor}>
              <input type="checkbox" className="accent-indigo-500 cursor-pointer"
                checked={!!c.textColor}
                onChange={e => onUpdateContent({ ...c, textColor: e.target.checked ? '#ffffff' : '' })} />
              {c.textColor ? (
                <>
                  <input type="color" className="w-8 h-7 rounded cursor-pointer bg-transparent border border-slate-600 ml-1"
                    value={c.textColor} onChange={e => onUpdateContent({ ...c, textColor: e.target.value })} />
                  <input className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 font-mono"
                    value={c.textColor} onChange={e => onUpdateContent({ ...c, textColor: e.target.value })} />
                </>
              ) : (
                <span className="text-xs text-slate-500 italic ml-1">{t.cellModal.inherited}</span>
              )}
            </MField>
            <MField label={t.cellModal.vertical}>
              <input type="checkbox" className="accent-indigo-500 cursor-pointer"
                checked={!!c.vertical} onChange={e => onUpdateContent({ ...c, vertical: e.target.checked })} />
            </MField>
            <MField label={t.cellModal.showNumbers}>
              <input type="checkbox" className="accent-indigo-500 cursor-pointer"
                checked={c.showText} onChange={e => onUpdateContent({ ...c, showText: e.target.checked })} />
            </MField>
          </>
        )}

        {c.type === 'image-static' && (
          <>
            <MField label={t.cellModal.imageLabel}>
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
                <span className="text-xs text-slate-400">{t.cellModal.mappingsLabel}</span>
                <button className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer"
                  onClick={() => onUpdateContent({
                    ...c,
                    mapping: [...c.mapping, {
                      id: crypto.randomUUID(), matchType: 'exact', value: '', rangeMin: '', rangeMax: '', src: '',
                    } satisfies ImageBoundMapping],
                  })}>{t.cellModal.addMapping}</button>
              </div>

              {c.mapping.map((m, i) => {
                const patchM = (patch: Partial<ImageBoundMapping>) =>
                  onUpdateContent({ ...c, mapping: c.mapping.map((x, j) => j === i ? { ...x, ...patch } : x) });
                const mt = m.matchType ?? 'exact';
                return (
                  <div key={m.id ?? i} className="flex flex-col gap-1.5 border border-slate-700/60 rounded p-1.5">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-500 shrink-0">{t.cellModal.matchMode}</span>
                      <select className="flex-1 bg-slate-800 text-xs text-white rounded px-1.5 py-0.5 outline-none border border-slate-600 cursor-pointer"
                        value={mt} onChange={e => patchM({ matchType: e.target.value as 'exact' | 'range' })}>
                        <option value="exact">{t.cellModal.matchExact}</option>
                        <option value="range">{t.cellModal.matchRange}</option>
                      </select>
                      <button className="text-slate-600 hover:text-red-400 text-xs cursor-pointer shrink-0 ml-1"
                        onClick={() => onUpdateContent({ ...c, mapping: c.mapping.filter((_, j) => j !== i) })}>✕</button>
                    </div>
                    {mt === 'exact' && (
                      <div className="flex gap-1 items-center">
                        <span className="text-xs text-slate-500 shrink-0 w-10">{t.cellModal.valueLabel}</span>
                        <input className="flex-1 bg-slate-800 text-xs text-white rounded px-1.5 py-1 outline-none border border-slate-600 font-mono"
                          placeholder="100" value={m.value} onChange={e => patchM({ value: e.target.value })} />
                      </div>
                    )}
                    {mt === 'range' && (
                      <div className="grid grid-cols-2 gap-1">
                        <div className="flex gap-1 items-center">
                          <span className="text-xs text-slate-500 shrink-0 w-10">{t.cellModal.fromLabel}</span>
                          <input className="flex-1 min-w-0 bg-slate-800 text-xs text-white rounded px-1.5 py-1 outline-none border border-slate-600 font-mono"
                            placeholder="0" value={m.rangeMin ?? ''} onChange={e => patchM({ rangeMin: e.target.value })} />
                        </div>
                        <div className="flex gap-1 items-center">
                          <span className="text-xs text-slate-500 shrink-0">{t.cellModal.toLabel}</span>
                          <input className="flex-1 min-w-0 bg-slate-800 text-xs text-white rounded px-1.5 py-1 outline-none border border-slate-600 font-mono"
                            placeholder="20" value={m.rangeMax ?? ''} onChange={e => patchM({ rangeMax: e.target.value })} />
                        </div>
                      </div>
                    )}
                    <div className="flex gap-1 items-start">
                      <span className="text-xs text-slate-500 shrink-0 pt-1.5 w-10">{t.cellModal.fileLabel}</span>
                      <AssetImagePicker imgAssets={imgAssets} value={m.src} onChange={src => patchM({ src })} />
                    </div>
                  </div>
                );
              })}

              <MField label={t.cellModal.defaultLabel}>
                <AssetImagePicker imgAssets={imgAssets} value={c.defaultSrc}
                  onChange={defaultSrc => onUpdateContent({ ...c, defaultSrc })} />
              </MField>
            </div>
          </>
        )}

        {c.type === 'raw' && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">{t.cellModal.rawCodeLabel}</label>
            <textarea
              className="w-full min-h-[100px] bg-slate-800 text-xs text-white font-mono rounded px-2 py-1.5 outline-none border border-slate-600 focus:border-indigo-500 resize-y leading-relaxed"
              placeholder={"<<set $x to 1>>\n<<audio 'theme' play>>\n..."}
              value={c.code} onChange={e => onUpdateContent({ ...c, code: e.target.value })} spellCheck={false} />
          </div>
        )}

        {c.type === 'button' && (
          <CellButtonEditor c={c} vars={vars} onUpdateContent={onUpdateContent} />
        )}

        {c.type === 'list' && (
          <>
            <MField label={t.cellModal.listVariableLabel}>
              <select
                className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
                value={c.variableId}
                onChange={e => onUpdateContent({ ...c, variableId: e.target.value })}
              >
                <option value="">— select —</option>
                {vars.filter(v => v.varType === 'array').map(v => (
                  <option key={v.id} value={v.id}>${v.name}</option>
                ))}
              </select>
            </MField>
            <MField label={t.cellModal.listSeparatorLabel}>
              <input
                className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 font-mono"
                value={c.separator}
                onChange={e => onUpdateContent({ ...c, separator: e.target.value })}
              />
            </MField>
            <MField label={t.cellModal.listEmptyTextLabel}>
              <input
                className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600"
                value={c.emptyText}
                onChange={e => onUpdateContent({ ...c, emptyText: e.target.value })}
              />
            </MField>
            <MField label={t.cellModal.listPrefixLabel}>
              <input
                className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600"
                value={c.prefix}
                onChange={e => onUpdateContent({ ...c, prefix: e.target.value })}
              />
            </MField>
            <MField label={t.cellModal.listSuffixLabel}>
              <input
                className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600"
                value={c.suffix}
                onChange={e => onUpdateContent({ ...c, suffix: e.target.value })}
              />
            </MField>
          </>
        )}

        <button className="mt-2 px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium cursor-pointer self-end"
          onClick={onClose}>{t.cellModal.done}</button>
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

function SField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-slate-400 shrink-0">{label}:</label>
      {children}
    </div>
  );
}

function NumInput({
  value, min, max, onChange, suffix, className = 'w-16',
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  suffix?: string;
  className?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={min} max={max}
        className={`${className} text-xs bg-slate-800 text-white rounded px-1.5 py-0.5 outline-none border border-slate-600 focus:border-indigo-500 font-mono`}
        value={value}
        onChange={e => onChange(Math.min(max, Math.max(min, Number(e.target.value))))}
      />
      {suffix && <span className="text-xs text-slate-500">{suffix}</span>}
    </div>
  );
}

function CheckField({
  label, checked, onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer group">
      <input type="checkbox" className="accent-indigo-500 cursor-pointer"
        checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">{label}</span>
    </label>
  );
}

function VarSelect({ vars, value, onChange }: { vars: Variable[]; value: string; onChange: (id: string) => void }) {
  const t = useT();
  return (
    <MField label={t.cellModal.typeVariable}>
      <select className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
        value={value} onChange={e => onChange(e.target.value)}>
        <option value="">{t.cellModal.selectVariable}</option>
        {vars.map(v => <option key={v.id} value={v.id}>${v.name} ({v.varType})</option>)}
      </select>
    </MField>
  );
}

function ObjectFitSelect({ value, onChange }: { value: 'cover' | 'contain'; onChange: (v: 'cover' | 'contain') => void }) {
  const t = useT();
  return (
    <MField label={t.cellModal.objectFit}>
      <select className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 cursor-pointer"
        value={value} onChange={e => onChange(e.target.value as 'cover' | 'contain')}>
        <option value="cover">{t.cellModal.fitCover}</option>
        <option value="contain">{t.cellModal.fitContain}</option>
      </select>
    </MField>
  );
}

function AssetImagePicker({
  imgAssets, value, onChange,
}: {
  imgAssets: Asset[];
  value: string;
  onChange: (src: string) => void;
}) {
  const t = useT();
  const matched = imgAssets.find(a => a.relativePath === value);
  return (
    <div className="flex-1 flex flex-col gap-1 min-w-0">
      {imgAssets.length > 0 && (
        <select className="w-full bg-slate-800 text-xs text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
          value={matched?.id ?? ''}
          onChange={e => {
            const asset = imgAssets.find(a => a.id === e.target.value);
            if (asset) onChange(asset.relativePath);
            else if (e.target.value === '') onChange('');
          }}>
          <option value="">{t.cellModal.selectAsset}</option>
          {imgAssets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      )}
      <input className="w-full bg-slate-800 text-xs text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 font-mono"
        placeholder="assets/img.png" value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

// ─── Cell button editor ────────────────────────────────────────────────────────

const CELL_BTN_OPERATORS: { value: VarOperator; label: string }[] = [
  { value: '=',  label: '=' },
  { value: '+=', label: '+=' },
  { value: '-=', label: '-=' },
  { value: '*=', label: '*=' },
  { value: '/=', label: '/=' },
];

function CellButtonEditor({
  c, vars, onUpdateContent,
}: {
  c: CellButton;
  vars: Variable[];
  onUpdateContent: (content: CellContent) => void;
}) {
  const t = useT();
  const { project } = useProjectStore();
  const scenes = project.scenes;

  const patchStyle = (patch: Partial<ButtonStyle>) =>
    onUpdateContent({ ...c, style: { ...c.style, ...patch } });

  const patchAction = (actionId: string, patch: Partial<ButtonAction>) =>
    onUpdateContent({
      ...c,
      actions: c.actions.map(a => a.id === actionId ? { ...a, ...patch } : a),
    });

  const addAction = () =>
    onUpdateContent({
      ...c,
      actions: [...c.actions, { id: crypto.randomUUID(), variableId: '', operator: '=' as VarOperator, value: '' }],
    });

  const removeAction = (id: string) =>
    onUpdateContent({ ...c, actions: c.actions.filter(a => a.id !== id) });

  // Current navigate type for the select: 'none' | 'scene' | 'back'
  const navType = c.navigate?.type ?? 'none';

  const handleNavTypeChange = (type: string) => {
    if (type === 'none') {
      onUpdateContent({ ...c, navigate: undefined });
    } else if (type === 'back') {
      onUpdateContent({ ...c, navigate: { type: 'back' } });
    } else {
      onUpdateContent({ ...c, navigate: { type: 'scene', sceneId: '' } });
    }
  };

  return (
    <>
      {/* Label */}
      <MField label={t.cellModal.buttonLabelField}>
        <input
          className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500"
          value={c.label}
          onChange={e => onUpdateContent({ ...c, label: e.target.value })}
        />
      </MField>

      {/* Style inline section */}
      <div className="flex flex-col gap-2 border border-slate-700 rounded p-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t.buttonBlock.styleTitle}</span>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* bg */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500">{t.buttonBlock.bgLabel}</span>
            <input type="color" value={c.style.bgColor} onChange={e => patchStyle({ bgColor: e.target.value })}
              className="w-7 h-7 rounded cursor-pointer border border-slate-600 bg-transparent p-0.5" />
            <input type="text" value={c.style.bgColor} onChange={e => patchStyle({ bgColor: e.target.value })}
              className="w-20 bg-slate-800 text-xs text-white rounded px-1.5 py-1 border border-slate-600 outline-none font-mono" />
          </div>
          {/* text color */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500">{t.buttonBlock.textColorLabel}</span>
            <input type="color" value={c.style.textColor} onChange={e => patchStyle({ textColor: e.target.value })}
              className="w-7 h-7 rounded cursor-pointer border border-slate-600 bg-transparent p-0.5" />
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* radius */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500">{t.buttonBlock.radiusLabel}</span>
            <input type="number" min={0} max={50} value={c.style.borderRadius}
              onChange={e => patchStyle({ borderRadius: Number(e.target.value) })}
              className="w-14 bg-slate-800 text-xs text-white rounded px-1.5 py-1 border border-slate-600 outline-none text-right" />
            <span className="text-xs text-slate-500">px</span>
          </div>
          {/* bold */}
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input type="checkbox" checked={c.style.bold} onChange={e => patchStyle({ bold: e.target.checked })}
              className="accent-indigo-500" />
            <span className="text-xs text-slate-300">{t.buttonBlock.bold}</span>
          </label>
          {/* full width */}
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input type="checkbox" checked={c.style.fullWidth} onChange={e => patchStyle({ fullWidth: e.target.checked })}
              className="accent-indigo-500" />
            <span className="text-xs text-slate-300">{t.buttonBlock.fullWidth}</span>
          </label>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex flex-col gap-2 border border-slate-700 rounded p-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t.cellModal.buttonNavigateTitle}</span>
        <select
          className="w-full bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
          value={navType}
          onChange={e => handleNavTypeChange(e.target.value)}
        >
          <option value="none">{t.cellModal.buttonTargetNone}</option>
          <option value="scene">{t.cellModal.buttonTargetScene}</option>
          <option value="back">{t.cellModal.buttonTargetBack}</option>
        </select>

        {navType === 'scene' && (
          <MField label={t.cellModal.buttonSceneLabel}>
            <select
              className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
              value={(c.navigate as { type: 'scene'; sceneId: string } | undefined)?.sceneId ?? ''}
              onChange={e => onUpdateContent({ ...c, navigate: { type: 'scene', sceneId: e.target.value } })}
            >
              <option value="">{t.cellModal.buttonNoScene}</option>
              {scenes.map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </MField>
        )}
      </div>

      {/* Variable actions */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t.cellModal.buttonActionsTitle}</span>
          <button className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer" onClick={addAction}>
            {t.cellModal.buttonAddAction}
          </button>
        </div>

        {c.actions.length === 0 && (
          <div className="text-xs text-slate-500 italic px-1">{t.cellModal.buttonNoActions}</div>
        )}

        {c.actions.map(a => {
          const selVar = vars.find(v => v.id === a.variableId);
          return (
            <div key={a.id} className="flex items-center gap-1.5 bg-slate-800/60 border border-slate-700 rounded px-2 py-1.5">
              <select
                className="flex-1 min-w-0 bg-slate-800 text-xs text-white rounded px-1.5 py-1 border border-slate-600 focus:border-indigo-500 outline-none cursor-pointer"
                value={a.variableId}
                onChange={e => patchAction(a.id, { variableId: e.target.value })}
              >
                <option value="">{t.cellModal.buttonSelectVariable}</option>
                {vars.map(v => <option key={v.id} value={v.id}>${v.name}</option>)}
              </select>
              <select
                className="w-14 bg-slate-800 text-xs text-white rounded px-1.5 py-1 border border-slate-600 outline-none cursor-pointer font-mono"
                value={a.operator}
                onChange={e => patchAction(a.id, { operator: e.target.value as VarOperator })}
              >
                {CELL_BTN_OPERATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
              </select>
              <input
                className="w-20 bg-slate-800 text-xs text-white rounded px-1.5 py-1 border border-slate-600 outline-none font-mono"
                placeholder={selVar?.varType === 'string' ? t.cellModal.buttonTextPlaceholder : '1'}
                value={a.value}
                onChange={e => patchAction(a.id, { value: e.target.value })}
              />
              <button className="text-slate-600 hover:text-red-400 text-sm cursor-pointer shrink-0"
                title={t.cellModal.buttonDeleteAction}
                onClick={() => removeAction(a.id)}>✕</button>
            </div>
          );
        })}
      </div>
    </>
  );
}
