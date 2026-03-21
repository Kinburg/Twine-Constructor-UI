import { useState, useEffect, useRef, useCallback } from 'react';
import type { Variable, Asset } from '../../types';
import { useT } from '../../i18n';

type PanelType = 'var' | 'tooltip' | 'expr' | 'cond';

interface Props {
  targetRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  value: string;
  onChange: (v: string) => void;
  vars: Variable[];
  imageAssets?: Asset[];
}

/**
 * Toolbar with 4 insert buttons for text areas:
 * $ Variable | Aa Tooltip | {=} Expression | if Condition
 *
 * Uses position:fixed dropdown panels that escape any overflow:hidden.
 */
export function TextInsertToolbar({ targetRef, value, onChange, vars, imageAssets = [] }: Props) {
  const t = useT();
  const [active, setActive] = useState<PanelType | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback((panel: PanelType) => {
    if (active === panel) { setActive(null); return; }
    if (toolbarRef.current) {
      const rect = toolbarRef.current.getBoundingClientRect();
      const left = Math.min(rect.left, window.innerWidth - 280);
      setPos({ top: rect.bottom + 2, left });
    }
    setActive(panel);
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
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [active]);

  // Close on scroll
  useEffect(() => {
    if (!active) return;
    const handler = () => setActive(null);
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
        <button type="button" className={`${btnCls('tooltip')} underline decoration-dotted`} title={t.insertToolbar.tooltipTitle} onClick={() => toggle('tooltip')}>Aa</button>
        <button type="button" className={`${btnCls('expr')} font-mono`} title={t.insertToolbar.exprTitle} onClick={() => toggle('expr')}>{'{=}'}</button>
        <button type="button" className={`${btnCls('cond')} font-mono italic`} title={t.insertToolbar.condTitle} onClick={() => toggle('cond')}>if</button>
      </div>

      {active && pos && (
        <div
          ref={panelRef}
          className="fixed z-[9999] bg-slate-800 border border-slate-600 rounded shadow-lg overflow-hidden"
          style={{ top: pos.top, left: pos.left }}
        >
          {active === 'var' && <VarPanel vars={vars} onInsert={name => insertAtCursor(`$${name}`)} />}
          {active === 'tooltip' && <TooltipPanel imageAssets={imageAssets} onInsert={insertAtCursor} />}
          {active === 'expr' && <ExprPanel vars={vars} onInsert={insertAtCursor} />}
          {active === 'cond' && <CondPanel vars={vars} onInsert={insertAtCursor} />}
        </div>
      )}
    </>
  );
}

// ─── Variable picker (same as VarInsertButton dropdown) ──────────────────────

function VarPanel({ vars, onInsert }: { vars: Variable[]; onInsert: (name: string) => void }) {
  const [filter, setFilter] = useState('');
  const filtered = filter
    ? vars.filter(v => v.name.toLowerCase().includes(filter.toLowerCase()))
    : vars;

  return (
    <div className="min-w-36">
      {vars.length > 6 && (
        <input
          className="w-full bg-slate-900 text-xs text-white px-2 py-1 outline-none border-b border-slate-600 font-mono"
          placeholder="filter..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          autoFocus
        />
      )}
      <div className="max-h-40 overflow-y-auto">
        {filtered.map(v => (
          <button key={v.id} type="button"
            className="w-full text-left px-2 py-1 text-xs text-slate-300 hover:bg-slate-700 font-mono cursor-pointer"
            onClick={() => onInsert(v.name)}
          >
            ${v.name}
          </button>
        ))}
        {filtered.length === 0 && (
          <span className="block px-2 py-1 text-xs text-slate-500 italic">—</span>
        )}
      </div>
    </div>
  );
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function TooltipPanel({ imageAssets, onInsert }: { imageAssets: Asset[]; onInsert: (text: string) => void }) {
  const t = useT();
  const [visibleText, setVisibleText] = useState('');
  const [tipContent, setTipContent] = useState('');
  const [imgSrc, setImgSrc] = useState('');

  const hasText = tipContent.trim().length > 0;
  const hasImg = imgSrc.trim().length > 0;
  const canInsert = visibleText.trim().length > 0 && (hasText || hasImg);

  const insert = () => {
    if (!canInsert) return;
    // Build inner content: image (optional) + text (optional)
    let inner = '';
    if (hasImg) inner += `<img src="${imgSrc}" class="tg-tip-img" />`;
    if (hasText) inner += tipContent;
    onInsert(`<span class="tg-tip">${visibleText}<span class="tg-tip-text">${inner}</span></span>`);
  };

  return (
    <div className="p-2.5 flex flex-col gap-1.5 min-w-56">
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

      {/* Image asset picker */}
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
  );
}

// ─── Expression ──────────────────────────────────────────────────────────────

function ExprPanel({ vars, onInsert }: { vars: Variable[]; onInsert: (text: string) => void }) {
  const t = useT();
  const [expr, setExpr] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const insert = () => {
    if (!expr.trim()) return;
    onInsert(`<<= ${expr.trim()}>>`);
  };

  const insertVar = (name: string) => {
    const el = inputRef.current;
    const varText = `$${name}`;
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
    <div className="p-2.5 flex flex-col gap-1.5 min-w-56">
      <label className="text-xs text-slate-400">{t.insertToolbar.exprLabel}</label>
      <input
        ref={inputRef}
        className="w-full bg-slate-900 text-xs text-white px-2 py-1 rounded border border-slate-600 outline-none focus:border-indigo-500 font-mono"
        placeholder={t.insertToolbar.exprPlaceholder}
        value={expr}
        onChange={e => setExpr(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') insert(); }}
        autoFocus
      />
      <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
        {vars.map(v => (
          <button key={v.id} type="button"
            className="px-1.5 py-0.5 text-xs text-slate-400 bg-slate-700 rounded hover:bg-slate-600 hover:text-white cursor-pointer font-mono"
            onClick={() => insertVar(v.name)}
          >
            ${v.name}
          </button>
        ))}
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

function CondPanel({ vars, onInsert }: { vars: Variable[]; onInsert: (text: string) => void }) {
  const t = useT();
  const [varId, setVarId] = useState('');
  const [op, setOp] = useState('==');
  const [condValue, setCondValue] = useState('');
  const [ifTrue, setIfTrue] = useState('');
  const [ifFalse, setIfFalse] = useState('');

  const selectedVar = vars.find(v => v.id === varId);

  const insert = () => {
    if (!selectedVar || !ifTrue.trim()) return;
    const varName = `$${selectedVar.name}`;
    // Quote string values, leave numbers and $varRef unquoted
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
    <div className="p-2.5 flex flex-col gap-1.5 min-w-64">
      {/* Condition row */}
      <div className="flex gap-1 items-center">
        <select
          className="flex-1 bg-slate-900 text-xs text-white px-1 py-1 rounded border border-slate-600 outline-none cursor-pointer"
          value={varId}
          onChange={e => setVarId(e.target.value)}
        >
          <option value="">— {t.insertToolbar.condVariable} —</option>
          {vars.map(v => (
            <option key={v.id} value={v.id}>${v.name}</option>
          ))}
        </select>
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
  );
}
