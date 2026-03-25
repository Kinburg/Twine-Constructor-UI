import { useState, useEffect, useRef, useCallback } from 'react';
import type { Variable, Asset, VariableTreeNode, Scene } from '../../types';
import { useT } from '../../i18n';
import { getVariablePath } from '../../utils/treeUtils';
import { PickerTree } from './VariablePicker';

type PanelType = 'var' | 'code';
type TemplateType = 'tooltip' | 'expr' | 'cond' | 'link';

interface Props {
  targetRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  value: string;
  onChange: (v: string) => void;
  vars: Variable[];
  imageAssets?: Asset[];
  variableNodes?: VariableTreeNode[];
  scenes?: Scene[];
}

/**
 * Toolbar with 2 insert buttons for text areas:
 * $ Variable | <> Code templates
 *
 * Uses position:fixed dropdown panels that escape any overflow:hidden.
 */
export function TextInsertToolbar({ targetRef, value, onChange, vars, imageAssets = [], variableNodes, scenes = [] }: Props) {
  const t = useT();
  const [active, setActive] = useState<PanelType | null>(null);
  const [template, setTemplate] = useState<TemplateType | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback((panel: PanelType) => {
    if (active === panel) { setActive(null); setTemplate(null); return; }
    if (toolbarRef.current) {
      const rect = toolbarRef.current.getBoundingClientRect();
      const left = Math.min(rect.right - 260, window.innerWidth - 268);
      setPos({ top: rect.bottom + 2, left: Math.max(4, left) });
    }
    setActive(panel);
    setTemplate(null);
  }, [active]);

  // Close on outside click
  useEffect(() => {
    if (!active) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        toolbarRef.current && !toolbarRef.current.contains(target) &&
        panelRef.current && !panelRef.current.contains(target)
      ) {
        setActive(null);
        setTemplate(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [active]);

  // Close on scroll (but not when scrolling inside the panel itself)
  useEffect(() => {
    if (!active) return;
    const handler = (e: Event) => {
      if (panelRef.current && panelRef.current.contains(e.target as Node)) return;
      setActive(null);
      setTemplate(null);
    };
    document.addEventListener('scroll', handler, true);
    return () => document.removeEventListener('scroll', handler, true);
  }, [active]);

  const insertAtCursor = useCallback((text: string) => {
    const el = targetRef.current;
    if (el) {
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      const newValue = value.slice(0, start) + text + value.slice(end);
      onChange(newValue);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + text.length;
        el.focus();
      });
    } else {
      onChange(value + text);
    }
    setActive(null);
    setTemplate(null);
  }, [targetRef, value, onChange]);

  if (vars.length === 0) return null;

  const btnCls = (p: PanelType) =>
    `px-1.5 py-0.5 text-xs border rounded cursor-pointer transition-colors leading-none ${
      active === p
        ? 'text-indigo-400 bg-slate-700 border-indigo-500'
        : 'text-slate-500 hover:text-indigo-400 bg-slate-800 border-slate-600 hover:border-indigo-500'
    }`;

  return (
    <>
      <div ref={toolbarRef} className="flex gap-0.5">
        <button type="button" className={`${btnCls('var')} font-mono`} title={t.insertToolbar.varTitle} onClick={() => toggle('var')}>$</button>
        <button type="button" className={`${btnCls('code')} font-mono`} title={t.insertToolbar.codeTitle} onClick={() => toggle('code')}>&lt;&gt;</button>
      </div>

      {active && pos && (
        <div
          ref={panelRef}
          className="fixed z-[9999] bg-slate-800 border border-slate-600 rounded shadow-lg overflow-hidden"
          style={{ top: pos.top, left: pos.left, width: 260 }}
        >
          {active === 'var' && <VarPanel vars={vars} variableNodes={variableNodes} onInsert={text => insertAtCursor(`$${text}`)} />}
          {active === 'code' && !template && (
            <TemplateMenu onSelect={setTemplate} />
          )}
          {active === 'code' && template === 'tooltip' && <TooltipPanel imageAssets={imageAssets} onInsert={insertAtCursor} onBack={() => setTemplate(null)} />}
          {active === 'code' && template === 'expr' && <ExprPanel vars={vars} variableNodes={variableNodes} onInsert={insertAtCursor} onBack={() => setTemplate(null)} />}
          {active === 'code' && template === 'cond' && <CondPanel vars={vars} variableNodes={variableNodes} onInsert={insertAtCursor} onBack={() => setTemplate(null)} />}
          {active === 'code' && template === 'link' && <LinkPanel scenes={scenes} onInsert={insertAtCursor} onBack={() => setTemplate(null)} />}
        </div>
      )}
    </>
  );
}

// ─── Template menu ───────────────────────────────────────────────────────────

const TEMPLATES: { type: TemplateType; icon: string; labelKey: 'tooltip' | 'expr' | 'cond' | 'link' }[] = [
  { type: 'tooltip', icon: 'Aa', labelKey: 'tooltip' },
  { type: 'expr',    icon: '{=}', labelKey: 'expr' },
  { type: 'cond',    icon: 'if', labelKey: 'cond' },
  { type: 'link',    icon: '→', labelKey: 'link' },
];

function TemplateMenu({ onSelect }: { onSelect: (t: TemplateType) => void }) {
  const t = useT();
  const labels: Record<string, string> = {
    tooltip: t.insertToolbar.tooltipTitle,
    expr: t.insertToolbar.exprTitle,
    cond: t.insertToolbar.condTitle,
    link: t.insertToolbar.linkTitle,
  };

  return (
    <div className="py-1">
      {TEMPLATES.map(tmpl => (
        <button
          key={tmpl.type}
          type="button"
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white cursor-pointer transition-colors"
          onClick={() => onSelect(tmpl.type)}
        >
          <span className="font-mono text-slate-500 w-6 text-center shrink-0">{tmpl.icon}</span>
          <span>{labels[tmpl.labelKey]}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Back button helper ──────────────────────────────────────────────────────

function PanelHeader({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-1 px-2 py-1 border-b border-slate-700">
      <button
        type="button"
        className="text-xs text-slate-500 hover:text-slate-300 cursor-pointer transition-colors"
        onClick={onBack}
      >
        ←
      </button>
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  );
}

// ─── Variable picker (hierarchical tree) ─────────────────────────────────────

function VarPanel({ vars, variableNodes, onInsert }: { vars: Variable[]; variableNodes?: VariableTreeNode[]; onInsert: (name: string) => void }) {
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const filterRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => filterRef.current?.focus(), 0); }, []);
  const nodes = variableNodes ?? [];

  const toggleGroup = (id: string) => {
    setExpanded(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const handleSelect = (id: string) => {
    const path = variableNodes ? getVariablePath(id, variableNodes) : (vars.find(v => v.id === id)?.name ?? '???');
    onInsert(path);
  };

  return (
    <div className="flex flex-col" style={{ maxHeight: 280 }}>
      <input
        ref={filterRef}
        className="text-xs bg-slate-900 text-white px-2 py-1 outline-none border-b border-slate-700 rounded-t"
        placeholder="Filter..."
        value={filter}
        onChange={e => setFilter(e.target.value)}
      />
      <div className="overflow-y-auto flex-1 py-1">
        {nodes.length > 0 ? (
          <PickerTree
            nodes={nodes}
            depth={0}
            expanded={expanded}
            onToggleGroup={toggleGroup}
            onSelect={handleSelect}
            selectedId=""
            filterText={filter.toLowerCase()}
            allNodes={nodes}
          />
        ) : (
          vars.map(v => (
            <div
              key={v.id}
              className="flex items-center gap-1.5 px-2 py-0.5 cursor-pointer hover:bg-slate-800 text-slate-300"
              style={{ paddingLeft: 8 }}
              onClick={() => handleSelect(v.id)}
            >
              <span className="text-xs font-mono truncate flex-1">${v.name}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function TooltipPanel({ imageAssets, onInsert, onBack }: { imageAssets: Asset[]; onInsert: (text: string) => void; onBack: () => void }) {
  const t = useT();
  const [visibleText, setVisibleText] = useState('');
  const [tipContent, setTipContent] = useState('');
  const [imgSrc, setImgSrc] = useState('');

  const hasText = tipContent.trim().length > 0;
  const hasImg = imgSrc.trim().length > 0;
  const canInsert = visibleText.trim().length > 0 && (hasText || hasImg);

  const insert = () => {
    if (!canInsert) return;
    let inner = '';
    if (hasImg) inner += `<img src="${imgSrc}" class="tg-tip-img" />`;
    if (hasText) inner += tipContent;
    onInsert(`<span class="tg-tip">${visibleText}<span class="tg-tip-text">${inner}</span></span>`);
  };

  return (
    <div className="flex flex-col">
      <PanelHeader label={t.insertToolbar.tooltipTitle} onBack={onBack} />
      <div className="p-2.5 flex flex-col gap-1.5">
        <label className="text-xs text-slate-400">{t.insertToolbar.tooltipText}</label>
        <input
          className="bg-slate-900 text-xs text-white px-2 py-1 rounded border border-slate-600 outline-none focus:border-indigo-500"
          value={visibleText}
          onChange={e => setVisibleText(e.target.value)}
          autoFocus
        />
        <label className="text-xs text-slate-400">{t.insertToolbar.tooltipContent}</label>
        <input
          className="bg-slate-900 text-xs text-white px-2 py-1 rounded border border-slate-600 outline-none focus:border-indigo-500"
          placeholder={t.insertToolbar.condElseOptional}
          value={tipContent}
          onChange={e => setTipContent(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') insert(); }}
        />

        <label className="text-xs text-slate-400">{t.insertToolbar.tooltipImage}</label>
        <select
          className="bg-slate-900 text-xs text-white px-1 py-1 rounded border border-slate-600 outline-none cursor-pointer"
          value={imgSrc}
          onChange={e => setImgSrc(e.target.value)}
        >
          <option value="">— {t.insertToolbar.tooltipNoImage} —</option>
          {imageAssets.map(a => (
            <option key={a.id} value={a.relativePath}>{a.name}</option>
          ))}
        </select>
        {!imgSrc && (
          <input
            className="bg-slate-900 text-xs text-white px-2 py-1 rounded border border-slate-600 outline-none focus:border-indigo-500 font-mono"
            placeholder="assets/img.png or https://..."
            value={imgSrc}
            onChange={e => setImgSrc(e.target.value)}
          />
        )}

        <button
          type="button"
          className="self-end px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-500 cursor-pointer disabled:opacity-40 disabled:cursor-default"
          disabled={!canInsert}
          onClick={insert}
        >
          {t.insertToolbar.insert}
        </button>
      </div>
    </div>
  );
}

// ─── Expression ──────────────────────────────────────────────────────────────

function ExprPanel({ vars, variableNodes, onInsert, onBack }: { vars: Variable[]; variableNodes?: VariableTreeNode[]; onInsert: (text: string) => void; onBack: () => void }) {
  const t = useT();
  const [expr, setExpr] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const insert = () => {
    if (!expr.trim()) return;
    onInsert(`<<= ${expr.trim()}>>`);
  };

  const insertVarById = (id: string) => {
    const el = inputRef.current;
    const path = variableNodes ? getVariablePath(id, variableNodes) : (vars.find(v => v.id === id)?.name ?? '???');
    const varText = `$${path}`;
    if (el) {
      const start = el.selectionStart ?? expr.length;
      const end = el.selectionEnd ?? expr.length;
      const newExpr = expr.slice(0, start) + varText + expr.slice(end);
      setExpr(newExpr);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + varText.length;
        el.focus();
      });
    } else {
      setExpr(expr + varText);
    }
  };

  return (
    <div className="flex flex-col">
      <PanelHeader label={t.insertToolbar.exprTitle} onBack={onBack} />
      <div className="p-2.5 flex flex-col gap-1.5">
        <label className="text-xs text-slate-400">{t.insertToolbar.exprLabel}</label>
        <div className="flex gap-1 items-center">
          <input
            ref={inputRef}
            className="flex-1 min-w-0 bg-slate-900 text-xs text-white px-2 py-1 rounded border border-slate-600 outline-none focus:border-indigo-500 font-mono"
            placeholder={t.insertToolbar.exprPlaceholder}
            value={expr}
            onChange={e => setExpr(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') insert(); }}
            autoFocus
          />
          <InlineVarPicker vars={vars} variableNodes={variableNodes} onSelect={insertVarById} />
        </div>
        <button
          type="button"
          className="self-end px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-500 cursor-pointer disabled:opacity-40 disabled:cursor-default"
          disabled={!expr.trim()}
          onClick={insert}
        >
          {t.insertToolbar.insert}
        </button>
      </div>
    </div>
  );
}

/** Small `$` button that opens a hierarchical variable picker inline */
function InlineVarPicker({ vars, variableNodes, onSelect }: { vars: Variable[]; variableNodes?: VariableTreeNode[]; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const nodes = variableNodes ?? [];

  const openDrop = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 2, left: Math.min(rect.left, window.innerWidth - 220) });
    }
    setOpen(true);
    setFilter('');
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node) &&
          dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => { if (open) setTimeout(() => filterRef.current?.focus(), 0); }, [open]);

  const toggleGroup = (id: string) => {
    setExpanded(prev => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s; });
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="px-1.5 py-0.5 text-xs text-slate-500 hover:text-indigo-400 bg-slate-700 border border-slate-600 hover:border-indigo-500 rounded cursor-pointer transition-colors leading-none font-mono"
        onClick={() => open ? setOpen(false) : openDrop()}
      >
        $
      </button>
      {open && pos && (
        <div
          ref={dropRef}
          className="fixed z-[10000] bg-slate-900 border border-slate-600 rounded shadow-xl flex flex-col"
          style={{ top: pos.top, left: pos.left, width: 220, maxHeight: 260 }}
        >
          <input
            ref={filterRef}
            className="text-xs bg-slate-800 text-white px-2 py-1 outline-none border-b border-slate-700 rounded-t"
            placeholder="Filter..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}
          />
          <div className="overflow-y-auto flex-1 py-1">
            {nodes.length > 0 ? (
              <PickerTree
                nodes={nodes}
                depth={0}
                expanded={expanded}
                onToggleGroup={toggleGroup}
                onSelect={id => { onSelect(id); setOpen(false); }}
                selectedId=""
                filterText={filter.toLowerCase()}
                allNodes={nodes}
              />
            ) : (
              vars.map(v => (
                <div key={v.id} className="px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-800 cursor-pointer font-mono"
                  onClick={() => { onSelect(v.id); setOpen(false); }}>
                  ${v.name}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Inline condition ────────────────────────────────────────────────────────

const OPERATORS = [
  { value: '==', label: '==' },
  { value: '!=', label: '!=' },
  { value: '>',  label: '>' },
  { value: '<',  label: '<' },
  { value: '>=', label: '>=' },
  { value: '<=', label: '<=' },
];

function CondPanel({ vars, variableNodes, onInsert, onBack }: { vars: Variable[]; variableNodes?: VariableTreeNode[]; onInsert: (text: string) => void; onBack: () => void }) {
  const t = useT();
  const [varId, setVarId] = useState('');
  const [op, setOp] = useState('==');
  const [condValue, setCondValue] = useState('');
  const [ifTrue, setIfTrue] = useState('');
  const [ifFalse, setIfFalse] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerExpanded, setPickerExpanded] = useState<Set<string>>(new Set());
  const [pickerFilter, setPickerFilter] = useState('');
  const pickerBtnRef = useRef<HTMLButtonElement>(null);
  const pickerDropRef = useRef<HTMLDivElement>(null);
  const pickerFilterRef = useRef<HTMLInputElement>(null);
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null);

  const nodes = variableNodes ?? [];
  const selectedVar = vars.find(v => v.id === varId);
  const selectedPath = varId && variableNodes ? getVariablePath(varId, variableNodes) : (selectedVar?.name ?? '');

  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (pickerBtnRef.current && !pickerBtnRef.current.contains(target) &&
          pickerDropRef.current && !pickerDropRef.current.contains(target)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pickerOpen]);

  useEffect(() => { if (pickerOpen) setTimeout(() => pickerFilterRef.current?.focus(), 0); }, [pickerOpen]);

  const openPicker = () => {
    if (pickerBtnRef.current) {
      const rect = pickerBtnRef.current.getBoundingClientRect();
      setPickerPos({ top: rect.bottom + 2, left: Math.min(rect.left, window.innerWidth - 220) });
    }
    setPickerOpen(true);
    setPickerFilter('');
  };

  const togglePickerGroup = (id: string) => {
    setPickerExpanded(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const insert = () => {
    if (!selectedVar || !ifTrue.trim()) return;
    const path = variableNodes ? getVariablePath(selectedVar.id, variableNodes) : selectedVar.name;
    const varName = `$${path}`;
    const isRef = condValue.startsWith('$');
    const isNum = selectedVar.varType === 'number' && !isNaN(Number(condValue));
    const val = (!isRef && !isNum) ? `"${condValue}"` : condValue;

    let code = `<<if ${varName} ${op} ${val}>>${ifTrue}`;
    if (ifFalse.trim()) {
      code += `<<else>>${ifFalse}`;
    }
    code += `<</if>>`;
    onInsert(code);
  };

  return (
    <div className="flex flex-col">
      <PanelHeader label={t.insertToolbar.condTitle} onBack={onBack} />
      <div className="p-2.5 flex flex-col gap-1.5">
        {/* Condition row */}
        <div className="flex gap-1 items-center">
          <button
            ref={pickerBtnRef}
            type="button"
            className="flex-1 min-w-0 bg-slate-900 text-xs text-white rounded px-2 py-1 border border-slate-600 cursor-pointer text-left truncate"
            onClick={() => pickerOpen ? setPickerOpen(false) : openPicker()}
          >
            {selectedPath ? <span className="font-mono">${selectedPath}</span> : <span className="text-slate-500">— {t.insertToolbar.condVariable} —</span>}
          </button>
          <select
            className="bg-slate-900 text-xs text-white px-1 py-1 rounded border border-slate-600 outline-none cursor-pointer"
            value={op}
            onChange={e => setOp(e.target.value)}
          >
            {OPERATORS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <input
            className="w-20 bg-slate-900 text-xs text-white px-2 py-1 rounded border border-slate-600 outline-none focus:border-indigo-500 font-mono"
            placeholder={t.insertToolbar.condValue}
            value={condValue}
            onChange={e => setCondValue(e.target.value)}
          />
        </div>

        {/* Hierarchical variable picker dropdown */}
        {pickerOpen && pickerPos && (
          <div
            ref={pickerDropRef}
            className="fixed z-[10000] bg-slate-900 border border-slate-600 rounded shadow-xl flex flex-col"
            style={{ top: pickerPos.top, left: pickerPos.left, width: 220, maxHeight: 280 }}
          >
            <input
              ref={pickerFilterRef}
              className="text-xs bg-slate-800 text-white px-2 py-1 outline-none border-b border-slate-700 rounded-t"
              placeholder="Filter..."
              value={pickerFilter}
              onChange={e => setPickerFilter(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') setPickerOpen(false); }}
            />
            <div className="overflow-y-auto flex-1 py-1">
              {nodes.length > 0 ? (
                <PickerTree
                  nodes={nodes}
                  depth={0}
                  expanded={pickerExpanded}
                  onToggleGroup={togglePickerGroup}
                  onSelect={(id) => { setVarId(id); setPickerOpen(false); }}
                  selectedId={varId}
                  filterText={pickerFilter.toLowerCase()}
                  allNodes={nodes}
                />
              ) : (
                vars.map(v => (
                  <div
                    key={v.id}
                    className={`flex items-center gap-1.5 px-2 py-0.5 cursor-pointer transition-colors ${v.id === varId ? 'bg-indigo-600/30 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
                    style={{ paddingLeft: 8 }}
                    onClick={() => { setVarId(v.id); setPickerOpen(false); }}
                  >
                    <span className="text-xs font-mono truncate flex-1">${v.name}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* If true */}
        <label className="text-xs text-slate-400">{t.insertToolbar.condIfTrue}</label>
        <input
          className="bg-slate-900 text-xs text-white px-2 py-1 rounded border border-slate-600 outline-none focus:border-indigo-500"
          value={ifTrue}
          onChange={e => setIfTrue(e.target.value)}
          autoFocus
        />

        {/* Else */}
        <label className="text-xs text-slate-400">{t.insertToolbar.condElse}</label>
        <input
          className="bg-slate-900 text-xs text-white px-2 py-1 rounded border border-slate-600 outline-none focus:border-indigo-500"
          placeholder={t.insertToolbar.condElseOptional}
          value={ifFalse}
          onChange={e => setIfFalse(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') insert(); }}
        />

        <button
          type="button"
          className="self-end px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-500 cursor-pointer disabled:opacity-40 disabled:cursor-default"
          disabled={!selectedVar || !ifTrue.trim()}
          onClick={insert}
        >
          {t.insertToolbar.insert}
        </button>
      </div>
    </div>
  );
}

// ─── Link ────────────────────────────────────────────────────────────────────

function LinkPanel({ scenes, onInsert, onBack }: { scenes: Scene[]; onInsert: (text: string) => void; onBack: () => void }) {
  const t = useT();
  const [label, setLabel] = useState('');
  const [target, setTarget] = useState('');
  const [sceneFilter, setSceneFilter] = useState('');

  const filtered = sceneFilter
    ? scenes.filter(s => s.name.toLowerCase().includes(sceneFilter.toLowerCase()))
    : scenes;

  const insert = () => {
    if (!label.trim() || !target.trim()) return;
    onInsert(`<<link "${label}" "${target}">><</link>>`);
  };

  return (
    <div className="flex flex-col">
      <PanelHeader label={t.insertToolbar.linkTitle} onBack={onBack} />
      <div className="p-2.5 flex flex-col gap-1.5">
        <label className="text-xs text-slate-400">{t.insertToolbar.linkLabel}</label>
        <input
          className="bg-slate-900 text-xs text-white px-2 py-1 rounded border border-slate-600 outline-none focus:border-indigo-500"
          value={label}
          onChange={e => setLabel(e.target.value)}
          autoFocus
        />
        <label className="text-xs text-slate-400">{t.insertToolbar.linkTarget}</label>
        {/* Scene picker with filter */}
        <input
          className="bg-slate-900 text-xs text-white px-2 py-1 rounded border border-slate-600 outline-none focus:border-indigo-500 font-mono"
          placeholder={t.insertToolbar.linkTargetPlaceholder}
          value={target || sceneFilter}
          onChange={e => { setSceneFilter(e.target.value); setTarget(''); }}
          onKeyDown={e => { if (e.key === 'Enter') insert(); }}
        />
        <div className="max-h-28 overflow-y-auto rounded border border-slate-700 bg-slate-900">
          {filtered.map(s => (
            <button
              key={s.id ?? s.name}
              type="button"
              className={`w-full text-left px-2 py-1 text-xs font-mono cursor-pointer transition-colors ${
                target === s.name ? 'bg-indigo-600/30 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
              onClick={() => { setTarget(s.name); setSceneFilter(''); }}
            >
              {s.name}
            </button>
          ))}
          {filtered.length === 0 && (
            <span className="block px-2 py-1 text-xs text-slate-500 italic">—</span>
          )}
        </div>
        <button
          type="button"
          className="self-end px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-500 cursor-pointer disabled:opacity-40 disabled:cursor-default"
          disabled={!label.trim() || !target.trim()}
          onClick={insert}
        >
          {t.insertToolbar.insert}
        </button>
      </div>
    </div>
  );
}
