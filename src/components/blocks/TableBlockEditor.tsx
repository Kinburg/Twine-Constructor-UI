import { useState, useRef } from 'react';
import { useProjectStore, flattenVariables, flattenAssets, DEFAULT_PANEL_STYLE, redistributeWidths } from '../../store/projectStore';
import type {
  TableBlock, SidebarRow, SidebarCell, CellContent, PanelStyle,
  CellText, CellVariable, CellProgress, CellImageStatic, CellImageBound, CellRaw,
  ImageBoundMapping, Variable, Asset,
} from '../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cellTypeLabel(type: CellContent['type']): string {
  const m: Record<CellContent['type'], string> = {
    text: 'Текст', variable: 'Переменная', progress: 'Прогресс-бар',
    'image-static': 'Картинка', 'image-bound': 'Картинка (переменная)', raw: 'Twine-код',
  };
  return m[type];
}

function makeDefaultContent(type: CellContent['type']): CellContent {
  switch (type) {
    case 'text':         return { type: 'text', value: '' } as CellText;
    case 'variable':     return { type: 'variable', variableId: '', prefix: '', suffix: '' } as CellVariable;
    case 'progress':     return { type: 'progress', variableId: '', maxValue: 100, color: '#4ade80', showText: false } as CellProgress;
    case 'image-static': return { type: 'image-static', src: '', objectFit: 'cover' } as CellImageStatic;
    case 'image-bound':  return { type: 'image-bound', variableId: '', mapping: [], defaultSrc: '', objectFit: 'cover' } as CellImageBound;
    case 'raw':          return { type: 'raw', code: '' } as CellRaw;
  }
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function TableBlockEditor({
  block, sceneId, onUpdate,
}: {
  block: TableBlock;
  sceneId: string;
  onUpdate?: (patch: Partial<TableBlock>) => void;
}) {
  const { updateBlock, saveSnapshot } = useProjectStore();
  const project = useProjectStore(s => s.project);
  const vars = flattenVariables(project.variableNodes);
  const imgAssets = flattenAssets(project.assetNodes).filter(a => a.assetType === 'image');

  const update = onUpdate ?? ((p: Partial<TableBlock>) => updateBlock(sceneId, block.id, p as never));
  const updateRows = (rows: SidebarRow[]) => update({ rows });
  const updateStyle = (patch: Partial<PanelStyle>) => update({ style: { ...block.style, ...patch } });

  const addRow = () => {
    saveSnapshot();
    const newRow: SidebarRow = {
      id: crypto.randomUUID(),
      height: 60,
      cells: [{ id: crypto.randomUUID(), width: 100, content: { type: 'text', value: '' } as CellText }],
    };
    updateRows([...block.rows, newRow]);
  };

  const deleteRow = (rowId: string) => {
    saveSnapshot();
    updateRows(block.rows.filter(r => r.id !== rowId));
  };

  const updateRowHeight = (rowId: string, height: number) =>
    updateRows(block.rows.map(r => r.id === rowId ? { ...r, height } : r));

  const addCell = (rowId: string) => {
    saveSnapshot();
    updateRows(block.rows.map(r => {
      if (r.id !== rowId) return r;
      const newCell: SidebarCell = {
        id: crypto.randomUUID(), width: 50,
        content: { type: 'text', value: '' } as CellText,
      };
      return { ...r, cells: redistributeWidths([...r.cells, newCell]) };
    }));
  };

  const deleteCell = (rowId: string, cellId: string) => {
    saveSnapshot();
    updateRows(block.rows.map(r => {
      if (r.id !== rowId) return r;
      return { ...r, cells: redistributeWidths(r.cells.filter(c => c.id !== cellId)) };
    }));
  };

  // Called by DragDivider: direct left/right width assignment
  const patchCellWidths = (rowId: string, cellId: string, w: number, buddyId: string, buddyW: number) =>
    updateRows(block.rows.map(r => {
      if (r.id !== rowId) return r;
      return {
        ...r, cells: r.cells.map(c =>
          c.id === cellId ? { ...c, width: w }
          : c.id === buddyId ? { ...c, width: buddyW }
          : c
        ),
      };
    }));

  // Called by width % input: auto-balance buddy cell
  const setCellWidth = (rowId: string, cellId: string, newW: number) =>
    updateRows(block.rows.map(r => {
      if (r.id !== rowId) return r;
      const idx = r.cells.findIndex(c => c.id === cellId);
      if (idx < 0) return r;
      const diff = newW - r.cells[idx].width;
      const buddyIdx = idx === r.cells.length - 1 ? r.cells.length - 2 : r.cells.length - 1;
      return {
        ...r, cells: r.cells.map((c, i) => {
          if (i === idx) return { ...c, width: newW };
          if (i === buddyIdx && buddyIdx >= 0 && diff !== 0) return { ...c, width: Math.max(1, c.width - diff) };
          return c;
        }),
      };
    }));

  const equalizeRow = (rowId: string) =>
    updateRows(block.rows.map(r =>
      r.id !== rowId ? r : { ...r, cells: redistributeWidths(r.cells) }
    ));

  const updateCellContent = (rowId: string, cellId: string, content: CellContent) =>
    updateRows(block.rows.map(r => {
      if (r.id !== rowId) return r;
      return { ...r, cells: r.cells.map(c => c.id === cellId ? { ...c, content } : c) };
    }));

  const style = block.style ?? DEFAULT_PANEL_STYLE;

  return (
    <div className="flex flex-col gap-3">
      <TStyleEditor style={style} onChange={updateStyle} />

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Строки</span>
          <button
            className="text-xs text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 rounded px-2 py-1 transition-colors cursor-pointer"
            onClick={addRow}
          >
            + Строка
          </button>
        </div>

        {block.rows.length === 0 && (
          <p className="text-xs text-slate-600 italic">Нет строк. Нажмите «+ Строка».</p>
        )}

        {block.rows.map((row, rowIdx) => (
          <div key={row.id} className="border border-slate-700 rounded overflow-hidden">
            {/* Row header */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/60 border-b border-slate-700 flex-wrap">
              <span className="text-xs text-slate-500">Строка {rowIdx + 1}</span>
              <label className="flex items-center gap-1 ml-auto">
                <span className="text-xs text-slate-500">Высота:</span>
                <TNumInput value={row.height} min={16} max={400}
                  onChange={h => updateRowHeight(row.id, h)} suffix="px" className="w-16" />
              </label>
              <button className="text-slate-600 hover:text-red-400 text-xs cursor-pointer"
                onClick={() => { if (confirm('Удалить строку?')) deleteRow(row.id); }}>✕</button>
            </div>

            {/* Cells preview + controls */}
            <div className="p-2 flex flex-col gap-1.5">
              {/* Preview row with drag handles */}
              <div className="flex" style={{ height: Math.max(40, row.height) }}>
                {row.cells.flatMap((cell, idx) => [
                  idx > 0 ? (
                    <TDragDivider
                      key={`div-${row.cells[idx - 1].id}`}
                      leftCell={row.cells[idx - 1]}
                      rightCell={cell}
                      onDrag={(lw, rw) => patchCellWidths(row.id, row.cells[idx - 1].id, lw, cell.id, rw)}
                    />
                  ) : null,
                  <TCellEditor
                    key={cell.id}
                    cell={cell}
                    vars={vars}
                    imgAssets={imgAssets}
                    onUpdateContent={content => updateCellContent(row.id, cell.id, content)}
                    onDelete={() => deleteCell(row.id, cell.id)}
                  />,
                ]).filter(Boolean)}
                {row.cells.length === 0 && (
                  <span className="text-xs text-slate-600 italic self-center px-2">Нет ячеек</span>
                )}
              </div>

              {/* Width bar */}
              {row.cells.length > 0 && (
                <TCellWidthBar
                  cells={row.cells}
                  onWidthChange={(cellId, w) => setCellWidth(row.id, cellId, w)}
                  onEqualize={() => equalizeRow(row.id)}
                />
              )}

              <button
                className="text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded px-2 py-1 transition-colors cursor-pointer self-start"
                onClick={() => addCell(row.id)}
              >
                + Ячейка
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Style editor ─────────────────────────────────────────────────────────────

function TStyleEditor({
  style, onChange,
}: {
  style: PanelStyle;
  onChange: (patch: Partial<PanelStyle>) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-700 rounded overflow-hidden">
      <button
        className="flex items-center gap-2 w-full px-3 py-2 bg-slate-800/60 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
        onClick={() => setOpen(v => !v)}
      >
        <span className="text-slate-500">{open ? '▼' : '▶'}</span>
        Стиль таблицы
      </button>
      {open && (
        <div className="px-3 py-3 flex flex-col gap-3 bg-slate-900/40">
          <div className="flex items-center gap-4 flex-wrap">
            <TSField label="Зазор между строками">
              <TNumInput value={style.rowGap} min={0} max={40}
                onChange={v => onChange({ rowGap: v })} suffix="px" />
            </TSField>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs text-slate-500 font-medium">Линии таблицы</span>
            <div className="flex flex-wrap gap-3">
              <TCheckField label="Внешняя рамка"   checked={style.showOuterBorder} onChange={v => onChange({ showOuterBorder: v })} />
              <TCheckField label="Между строками"  checked={style.showRowBorders}  onChange={v => onChange({ showRowBorders: v })} />
              <TCheckField label="Между ячейками"  checked={style.showCellBorders} onChange={v => onChange({ showCellBorders: v })} />
            </div>
          </div>
          {(style.showOuterBorder || style.showRowBorders || style.showCellBorders) && (
            <div className="flex items-center gap-4 flex-wrap">
              <TSField label="Толщина">
                <TNumInput value={style.borderWidth} min={1} max={8}
                  onChange={v => onChange({ borderWidth: v })} suffix="px" />
              </TSField>
              <TSField label="Цвет линий">
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
              </TSField>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Drag divider ─────────────────────────────────────────────────────────────

function TDragDivider({
  leftCell, rightCell, onDrag,
}: {
  leftCell: SidebarCell;
  rightCell: SidebarCell;
  onDrag: (leftW: number, rightW: number) => void;
}) {
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
      const dPct = ((me.clientX - startX) / containerW) * 100;
      const newLeft = Math.max(5, Math.min(combined - 5, Math.round(startLeftW + dPct)));
      onDrag(newLeft, combined - newLeft);
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
        width: 4, flexShrink: 0, cursor: 'col-resize',
        background: 'rgba(99,102,241,0.15)', borderRadius: 2,
        alignSelf: 'stretch', transition: 'background 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.45)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.15)'; }}
    />
  );
}

// ─── Cell width bar ───────────────────────────────────────────────────────────

function TCellWidthBar({
  cells, onWidthChange, onEqualize,
}: {
  cells: SidebarCell[];
  onWidthChange: (cellId: string, w: number) => void;
  onEqualize: () => void;
}) {
  const total = cells.reduce((s, c) => s + c.width, 0);
  const offBy = total - 100;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        {cells.map(cell => (
          <div key={cell.id} style={{ flex: cell.width, minWidth: 0 }} className="flex items-center gap-0.5 min-w-0">
            <input
              type="number" min={1} max={99}
              className="w-full text-xs bg-slate-800 text-white rounded px-1.5 py-0.5 outline-none border border-slate-700 focus:border-indigo-500 font-mono text-center"
              value={cell.width}
              onChange={e => onWidthChange(cell.id, Math.max(1, Math.min(99, Number(e.target.value))))}
            />
            <span className="text-xs text-slate-600 shrink-0">%</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-0.5">
        <span className={`text-xs font-mono ${offBy === 0 ? 'text-slate-600' : 'text-amber-400'}`}>
          Σ {total}%{offBy !== 0 && ` (${offBy > 0 ? '+' : ''}${offBy})`}
        </span>
        <button
          className="text-xs text-slate-500 hover:text-slate-300 cursor-pointer hover:bg-slate-800 rounded px-1.5 py-0.5 transition-colors"
          onClick={onEqualize}
        >= поровну</button>
      </div>
    </div>
  );
}

// ─── Cell editor ──────────────────────────────────────────────────────────────

function TCellEditor({
  cell, vars, imgAssets, onUpdateContent, onDelete,
}: {
  cell: SidebarCell;
  vars: Variable[];
  imgAssets: Asset[];
  onUpdateContent: (c: CellContent) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div
      className="relative flex flex-col border border-slate-600 rounded bg-slate-800/40 overflow-hidden cursor-pointer group/cell"
      style={{ flex: cell.width, minWidth: 0, overflow: 'hidden' }}
      onClick={() => setEditing(true)}
    >
      <TCellPreview cell={cell} vars={vars} />
      <div className="absolute inset-0 bg-slate-900/85 opacity-0 group-hover/cell:opacity-100 transition-opacity flex items-center justify-center gap-1.5 px-1.5">
        <span className="text-xs text-slate-400 truncate min-w-0">{cellTypeLabel(cell.content.type)}</span>
        <button className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer shrink-0 hover:bg-slate-700 rounded px-1 py-0.5"
          title="Изменить"
          onClick={e => { e.stopPropagation(); setEditing(true); }}>✏️</button>
        <button className="text-xs text-red-500 hover:text-red-400 cursor-pointer shrink-0 hover:bg-slate-700 rounded px-1 py-0.5"
          title="Удалить"
          onClick={e => { e.stopPropagation(); onDelete(); }}>✕</button>
      </div>
      {editing && (
        <TCellEditModal
          cell={cell} vars={vars} imgAssets={imgAssets}
          onUpdateContent={onUpdateContent}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

// ─── Cell preview ─────────────────────────────────────────────────────────────

function TCellPreview({ cell, vars }: { cell: SidebarCell; vars: Variable[] }) {
  const c = cell.content;
  const v = 'variableId' in c ? vars.find(x => x.id === c.variableId) : undefined;
  if (c.type === 'text') return (
    <span className="text-xs text-slate-300 p-1 truncate flex-1">
      {c.value || <em className="text-slate-600">текст</em>}
    </span>
  );
  if (c.type === 'variable') return (
    <span className="text-xs text-sky-300 p-1 font-mono truncate flex-1">
      {c.prefix}{v ? `$${v.name}` : '?'}{c.suffix}
    </span>
  );
  if (c.type === 'progress') return (
    <div className="flex-1 p-1 flex items-center">
      <div className="w-full h-2 bg-slate-700 rounded overflow-hidden">
        <div className="h-full rounded" style={{ width: '60%', background: c.color }} />
      </div>
    </div>
  );
  if (c.type === 'image-static' || c.type === 'image-bound') return (
    <div className="flex-1 flex items-center justify-center p-1">
      <span className="text-xs text-slate-500">🖼️</span>
    </div>
  );
  if (c.type === 'raw') return (
    <span className="text-xs text-zinc-400 font-mono p-1 truncate flex-1">
      {c.code || <em className="text-slate-600 not-italic">код</em>}
    </span>
  );
  return null;
}

// ─── Cell edit modal ──────────────────────────────────────────────────────────

const CELL_TYPES: { value: CellContent['type']; label: string }[] = [
  { value: 'text',         label: 'Текст' },
  { value: 'variable',     label: 'Переменная' },
  { value: 'progress',     label: 'Прогресс-бар' },
  { value: 'image-static', label: 'Картинка (статическая)' },
  { value: 'image-bound',  label: 'Картинка (по переменной)' },
  { value: 'raw',          label: 'Twine-код' },
];

function TCellEditModal({
  cell, vars, imgAssets, onUpdateContent, onClose,
}: {
  cell: SidebarCell;
  vars: Variable[];
  imgAssets: Asset[];
  onUpdateContent: (c: CellContent) => void;
  onClose: () => void;
}) {
  const c = cell.content;
  const changeType = (type: CellContent['type']) => {
    if (type !== c.type) onUpdateContent(makeDefaultContent(type));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-600 rounded-lg shadow-2xl w-96 max-h-[80vh] overflow-y-auto p-4 flex flex-col gap-3"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-white">Настройка ячейки</span>
          <button className="text-slate-500 hover:text-white text-xs cursor-pointer" onClick={onClose}>✕</button>
        </div>

        <TMField label="Тип содержимого">
          <select
            className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
            value={c.type}
            onChange={e => changeType(e.target.value as CellContent['type'])}
          >
            {CELL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </TMField>

        {c.type === 'text' && (
          <TMField label="Текст">
            <input className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500"
              value={c.value} onChange={e => onUpdateContent({ ...c, value: e.target.value })} />
          </TMField>
        )}

        {c.type === 'variable' && (
          <>
            <TVarSelect vars={vars} value={c.variableId} onChange={v => onUpdateContent({ ...c, variableId: v })} />
            <TMField label="Префикс">
              <input className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600"
                value={c.prefix} onChange={e => onUpdateContent({ ...c, prefix: e.target.value })} />
            </TMField>
            <TMField label="Суффикс">
              <input className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600"
                value={c.suffix} onChange={e => onUpdateContent({ ...c, suffix: e.target.value })} />
            </TMField>
          </>
        )}

        {c.type === 'progress' && (
          <>
            <TVarSelect vars={vars} value={c.variableId} onChange={v => onUpdateContent({ ...c, variableId: v })} />
            <TMField label="Максимум">
              <input type="number" min={1}
                className="w-24 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 font-mono"
                value={c.maxValue} onChange={e => onUpdateContent({ ...c, maxValue: Number(e.target.value) })} />
            </TMField>
            <TMField label="Цвет">
              <input type="color" className="w-10 h-8 rounded cursor-pointer bg-transparent border border-slate-600"
                value={c.color} onChange={e => onUpdateContent({ ...c, color: e.target.value })} />
              <input className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 font-mono ml-2"
                value={c.color} onChange={e => onUpdateContent({ ...c, color: e.target.value })} />
            </TMField>
            <TMField label="Показать числа">
              <input type="checkbox" className="accent-indigo-500 cursor-pointer"
                checked={c.showText} onChange={e => onUpdateContent({ ...c, showText: e.target.checked })} />
            </TMField>
          </>
        )}

        {c.type === 'image-static' && (
          <>
            <TMField label="Картинка">
              <TAssetPicker imgAssets={imgAssets} value={c.src} onChange={src => onUpdateContent({ ...c, src })} />
            </TMField>
            <TObjectFitSelect value={c.objectFit} onChange={v => onUpdateContent({ ...c, objectFit: v })} />
          </>
        )}

        {c.type === 'image-bound' && (
          <>
            <TVarSelect vars={vars} value={c.variableId} onChange={v => onUpdateContent({ ...c, variableId: v })} />
            <TObjectFitSelect value={c.objectFit} onChange={v => onUpdateContent({ ...c, objectFit: v })} />
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Соответствия (значение → файл):</span>
                <button className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer"
                  onClick={() => onUpdateContent({
                    ...c,
                    mapping: [...c.mapping, {
                      id: crypto.randomUUID(), matchType: 'exact', value: '', rangeMin: '', rangeMax: '', src: '',
                    } satisfies ImageBoundMapping],
                  })}>+ Добавить</button>
              </div>

              {c.mapping.map((m, i) => {
                const patchM = (patch: Partial<ImageBoundMapping>) =>
                  onUpdateContent({ ...c, mapping: c.mapping.map((x, j) => j === i ? { ...x, ...patch } : x) });
                const mt = m.matchType ?? 'exact';
                return (
                  <div key={m.id ?? i} className="flex flex-col gap-1.5 border border-slate-700/60 rounded p-1.5">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-500 shrink-0">Режим:</span>
                      <select className="flex-1 bg-slate-800 text-xs text-white rounded px-1.5 py-0.5 outline-none border border-slate-600 cursor-pointer"
                        value={mt} onChange={e => patchM({ matchType: e.target.value as 'exact' | 'range' })}>
                        <option value="exact">Точное значение</option>
                        <option value="range">Диапазон</option>
                      </select>
                      <button className="text-slate-600 hover:text-red-400 text-xs cursor-pointer shrink-0 ml-1"
                        onClick={() => onUpdateContent({ ...c, mapping: c.mapping.filter((_, j) => j !== i) })}>✕</button>
                    </div>
                    {mt === 'exact' && (
                      <div className="flex gap-1 items-center">
                        <span className="text-xs text-slate-500 shrink-0 w-10">Знач.:</span>
                        <input className="flex-1 bg-slate-800 text-xs text-white rounded px-1.5 py-1 outline-none border border-slate-600 font-mono"
                          placeholder="100" value={m.value} onChange={e => patchM({ value: e.target.value })} />
                      </div>
                    )}
                    {mt === 'range' && (
                      <div className="flex gap-1 items-center">
                        <span className="text-xs text-slate-500 shrink-0 w-10">От:</span>
                        <input className="flex-1 bg-slate-800 text-xs text-white rounded px-1.5 py-1 outline-none border border-slate-600 font-mono"
                          placeholder="0" value={m.rangeMin ?? ''} onChange={e => patchM({ rangeMin: e.target.value })} />
                        <span className="text-xs text-slate-500 shrink-0">До:</span>
                        <input className="flex-1 bg-slate-800 text-xs text-white rounded px-1.5 py-1 outline-none border border-slate-600 font-mono"
                          placeholder="20" value={m.rangeMax ?? ''} onChange={e => patchM({ rangeMax: e.target.value })} />
                      </div>
                    )}
                    <div className="flex gap-1 items-start">
                      <span className="text-xs text-slate-500 shrink-0 pt-1.5 w-10">Файл:</span>
                      <TAssetPicker imgAssets={imgAssets} value={m.src} onChange={src => patchM({ src })} />
                    </div>
                  </div>
                );
              })}

              <TMField label="По умолч.">
                <TAssetPicker imgAssets={imgAssets} value={c.defaultSrc}
                  onChange={defaultSrc => onUpdateContent({ ...c, defaultSrc })} />
              </TMField>
            </div>
          </>
        )}

        {c.type === 'raw' && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Twine-код (вставляется как есть):</label>
            <textarea
              className="w-full min-h-[100px] bg-slate-800 text-xs text-white font-mono rounded px-2 py-1.5 outline-none border border-slate-600 focus:border-indigo-500 resize-y leading-relaxed"
              placeholder={"<<set $x to 1>>\n..."}
              value={c.code} onChange={e => onUpdateContent({ ...c, code: e.target.value })} spellCheck={false} />
          </div>
        )}

        <button className="mt-2 px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium cursor-pointer self-end"
          onClick={onClose}>Готово</button>
      </div>
    </div>
  );
}

// ─── Reusable sub-components ──────────────────────────────────────────────────

function TMField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-slate-400 w-28 shrink-0">{label}:</label>
      <div className="flex-1 flex items-center gap-1">{children}</div>
    </div>
  );
}

function TSField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-slate-400 shrink-0">{label}:</label>
      {children}
    </div>
  );
}

function TNumInput({
  value, min, max, onChange, suffix, className = 'w-16',
}: {
  value: number; min: number; max: number;
  onChange: (v: number) => void; suffix?: string; className?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number" min={min} max={max}
        className={`${className} text-xs bg-slate-800 text-white rounded px-1.5 py-0.5 outline-none border border-slate-600 focus:border-indigo-500 font-mono`}
        value={value}
        onChange={e => onChange(Math.min(max, Math.max(min, Number(e.target.value))))}
      />
      {suffix && <span className="text-xs text-slate-500">{suffix}</span>}
    </div>
  );
}

function TCheckField({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer group">
      <input type="checkbox" className="accent-indigo-500 cursor-pointer"
        checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">{label}</span>
    </label>
  );
}

function TVarSelect({ vars, value, onChange }: {
  vars: Variable[]; value: string; onChange: (id: string) => void;
}) {
  return (
    <TMField label="Переменная">
      <select className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
        value={value} onChange={e => onChange(e.target.value)}>
        <option value="">— выбрать —</option>
        {vars.map(v => <option key={v.id} value={v.id}>${v.name} ({v.varType})</option>)}
      </select>
    </TMField>
  );
}

function TObjectFitSelect({ value, onChange }: {
  value: 'cover' | 'contain'; onChange: (v: 'cover' | 'contain') => void;
}) {
  return (
    <TMField label="Заполнение">
      <select className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 cursor-pointer"
        value={value} onChange={e => onChange(e.target.value as 'cover' | 'contain')}>
        <option value="cover">cover (обрезать)</option>
        <option value="contain">contain (вписать)</option>
      </select>
    </TMField>
  );
}

function TAssetPicker({ imgAssets, value, onChange }: {
  imgAssets: Asset[]; value: string; onChange: (src: string) => void;
}) {
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
          <option value="">— выбрать из ассетов —</option>
          {imgAssets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      )}
      <input className="w-full bg-slate-800 text-xs text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 font-mono"
        placeholder="assets/img.png" value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}
