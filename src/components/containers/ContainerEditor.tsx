import { useState } from 'react';
import { charToVarPrefix } from '../../store/projectStore';
import type { ContainerDefinition, ContainerMode, ContainerItemSlot, ItemDefinition } from '../../types';
import { useT } from '../../i18n';
import { useProjectStore } from '../../store/projectStore';


const ITEM_CATEGORY_ICONS: Record<string, string> = {
  wearable:   '👕',
  consumable: '🧪',
  misc:       '📦',
};

interface Props {
  mode: 'create' | 'edit';
  containerId?: string;
  initial: Omit<ContainerDefinition, 'id' | 'varIds'>;
  takenNames: string[];
  takenVarNames: string[];
  onSave: (data: Omit<ContainerDefinition, 'id' | 'varIds'>) => void;
  onClose: () => void;
}

export function ContainerEditor({
  mode, initial, takenNames, takenVarNames, onSave, onClose,
}: Props) {
  const t = useT();
  const { project } = useProjectStore();
  const items = project.items ?? [];

  const [name, setName]         = useState(initial.name);
  const [varName, setVarName]   = useState(initial.varName);
  const [varNameTouched, setVarNameTouched] = useState(mode === 'edit');
  const [containerMode, setContainerMode] = useState<ContainerMode>(initial.mode);
  const [stock, setStock]       = useState<ContainerItemSlot[]>(initial.initialItems);

  const handleNameChange = (v: string) => {
    setName(v);
    if (!varNameTouched) setVarName(charToVarPrefix(v));
  };

  const handleVarNameChange = (v: string) => {
    setVarNameTouched(true);
    setVarName(v.toLowerCase().replace(/[^a-z0-9_]/g, ''));
  };

  const trimmedName    = name.trim();
  const trimmedVarName = varName.trim().replace(/^[\d_]+/, '').replace(/_+$/g, '');

  const nameError = trimmedName === ''
    ? t.containers.nameEmpty
    : takenNames.includes(trimmedName)
      ? t.containers.nameTaken
      : null;

  const varNameError = trimmedVarName === ''
    ? t.containers.varNameEmpty
    : !/^[a-z][a-z0-9_]*$/.test(trimmedVarName)
      ? t.containers.varNameInvalid
      : takenVarNames.includes(trimmedVarName)
        ? t.containers.varNameTaken
        : null;

  const addSlot = () => {
    if (items.length === 0) return;
    const newSlot: ContainerItemSlot = {
      id: crypto.randomUUID(),
      itemVarName: items[0].varName,
      quantity: 1,
    };
    setStock(prev => [...prev, newSlot]);
  };

  const updateSlot = (id: string, patch: Partial<ContainerItemSlot>) => {
    setStock(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  };

  const removeSlot = (id: string) => {
    setStock(prev => prev.filter(s => s.id !== id));
  };

  const handleSave = () => {
    if (nameError || varNameError) return;
    onSave({
      name: trimmedName,
      varName: trimmedVarName,
      mode: containerMode,
      initialItems: stock,
    });
    onClose();
  };

  const MODES: ContainerMode[] = ['shop', 'chest', 'loot'];
  const modeLabel: Record<ContainerMode, string> = {
    shop:  t.containers.modeShop,
    chest: t.containers.modeChest,
    loot:  t.containers.modeLoot,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative bg-slate-800 border border-slate-600 rounded-lg shadow-2xl w-[480px] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 shrink-0">
          <h2 className="text-sm font-semibold text-white">
            {mode === 'create' ? t.containers.createTitle : t.containers.editTitle}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors cursor-pointer text-base leading-none"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-3">
          {/* Name */}
          <Field label={t.containers.fieldName}>
            <div className="flex flex-col gap-1">
              <input
                autoFocus
                className={`w-full bg-slate-700 text-xs text-white rounded px-2 py-1 outline-none border ${nameError ? 'border-red-500 focus:border-red-400' : 'border-slate-600 focus:border-indigo-500'}`}
                value={name}
                onChange={e => handleNameChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
              />
              {nameError && <span className="text-xs text-red-400">{nameError}</span>}
            </div>
          </Field>

          {/* Variable name */}
          <Field label={t.containers.fieldVarName}>
            <div className="flex flex-col gap-1">
              <input
                className={`w-full text-xs rounded px-2 py-1 outline-none border font-mono ${
                  mode === 'edit'
                    ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                    : varNameError
                      ? 'bg-slate-700 text-white border-red-500 focus:border-red-400'
                      : 'bg-slate-700 text-white border-slate-600 focus:border-indigo-500'
                }`}
                value={varName}
                onChange={e => handleVarNameChange(e.target.value)}
                readOnly={mode === 'edit'}
              />
              {mode !== 'edit' && (varNameError
                ? <span className="text-xs text-red-400">{varNameError}</span>
                : <span className="text-[10px] text-slate-500">{t.containers.varNameHint}</span>
              )}
            </div>
          </Field>

          {/* Mode */}
          <Field label={t.containers.fieldMode}>
            <div className="flex gap-1">
              {MODES.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setContainerMode(m)}
                  className={`flex-1 text-xs rounded px-2 py-1.5 transition-colors cursor-pointer border ${
                    containerMode === m
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {modeLabel[m]}
                </button>
              ))}
            </div>
          </Field>

          {/* Stock */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">{t.containers.stockSection}</span>
            </div>

            <div className="flex flex-col gap-1 rounded border border-slate-700 p-2">
              {items.length === 0 ? (
                <p className="text-xs text-slate-600 italic py-1">{t.containers.noItemsDefined}</p>
              ) : stock.length === 0 ? (
                <p className="text-xs text-slate-600 italic py-1">{t.containers.stockEmpty}</p>
              ) : (
                <>
                  {/* Header row */}
                  <div className="grid gap-1 text-[10px] text-slate-500 px-0.5" style={{ gridTemplateColumns: '1fr 52px 60px 20px' }}>
                    <span>{t.containers.stockItem}</span>
                    <span className="text-center">{t.containers.stockQty}</span>
                    {containerMode === 'shop' && <span className="text-center">{t.containers.stockPrice}</span>}
                  </div>

                  {stock.map(slot => (
                    <StockRow
                      key={slot.id}
                      slot={slot}
                      items={items}
                      showPrice={containerMode === 'shop'}
                      onChange={patch => updateSlot(slot.id, patch)}
                      onDelete={() => removeSlot(slot.id)}
                    />
                  ))}
                </>
              )}

              {items.length > 0 && (
                <button
                  type="button"
                  className="text-xs text-slate-500 hover:text-indigo-400 hover:bg-slate-800 rounded px-2 py-1 transition-colors cursor-pointer border border-dashed border-slate-700 hover:border-indigo-600 mt-0.5"
                  onClick={addSlot}
                >
                  {t.containers.stockAdd}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-700 shrink-0">
          <button
            onClick={handleSave}
            disabled={!!nameError || !!varNameError}
            className="w-full py-1.5 text-xs rounded transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-500 disabled:hover:bg-indigo-600 text-white"
          >
            {t.containers.save}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Stock row ─────────────────────────────────────────────────────────────────

function StockRow({
  slot,
  items,
  showPrice,
  onChange,
  onDelete,
}: {
  slot: ContainerItemSlot;
  items: ItemDefinition[];
  showPrice: boolean;
  onChange: (patch: Partial<ContainerItemSlot>) => void;
  onDelete: () => void;
}) {
  const t = useT();
  const isInfinite = slot.quantity === -1;

  return (
    <div className="grid gap-1 items-center" style={{ gridTemplateColumns: '1fr 52px 60px 20px' }}>
      {/* Item picker */}
      <select
        className="bg-slate-700 text-xs text-white rounded px-1.5 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer min-w-0"
        value={slot.itemVarName}
        onChange={e => onChange({ itemVarName: e.target.value })}
      >
        {items.map(it => (
          <option key={it.id} value={it.varName}>
            {ITEM_CATEGORY_ICONS[it.category] ?? '📦'} {it.name}
          </option>
        ))}
      </select>

      {/* Qty + infinite toggle */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          title={t.containers.stockInfinite}
          className={`text-xs px-1 rounded transition-colors cursor-pointer shrink-0 ${
            isInfinite ? 'text-indigo-400 bg-indigo-900/50' : 'text-slate-500 hover:text-slate-300'
          }`}
          onClick={() => onChange({ quantity: isInfinite ? 1 : -1 })}
        >
          ∞
        </button>
        <input
          type="number"
          min={1}
          disabled={isInfinite}
          className="w-full bg-slate-700 text-xs text-white rounded px-1 py-1 outline-none border border-slate-600 focus:border-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
          value={isInfinite ? '' : slot.quantity}
          placeholder={isInfinite ? '∞' : ''}
          onChange={e => onChange({ quantity: Math.max(1, parseInt(e.target.value) || 1) })}
        />
      </div>

      {/* Price (shop only) */}
      {showPrice ? (
        <input
          type="number"
          min={0}
          className="w-full bg-slate-700 text-xs text-white rounded px-1.5 py-1 outline-none border border-slate-600 focus:border-indigo-500"
          value={slot.price ?? 0}
          onChange={e => onChange({ price: Math.max(0, parseInt(e.target.value) || 0) })}
        />
      ) : (
        <div />
      )}

      {/* Delete */}
      <button
        type="button"
        className="text-slate-600 hover:text-red-400 transition-colors cursor-pointer text-xs"
        onClick={onDelete}
      >
        ✕
      </button>
    </div>
  );
}

// ─── Field helper ──────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <label className="text-xs text-slate-400 w-24 shrink-0 pt-1">{label}:</label>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
