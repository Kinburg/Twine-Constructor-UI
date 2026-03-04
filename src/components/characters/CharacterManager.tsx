import { useState, useEffect, useRef } from 'react';
import { useProjectStore, flattenVariables, flattenAssets } from '../../store/projectStore';
import type { Character, AvatarConfig, AvatarMode, ImageBoundMapping, Variable, Asset } from '../../types';

const DEFAULT_COLORS = [
  { nameColor: '#7dd3fc', bgColor: '#0c2340', borderColor: '#0ea5e9' },
  { nameColor: '#f9a8d4', bgColor: '#2d0a1e', borderColor: '#ec4899' },
  { nameColor: '#86efac', bgColor: '#052e16', borderColor: '#22c55e' },
  { nameColor: '#fde047', bgColor: '#1a1000', borderColor: '#eab308' },
  { nameColor: '#c4b5fd', bgColor: '#1e0a3c', borderColor: '#a855f7' },
];

let colorIdx = 0;
function nextColor() {
  const c = DEFAULT_COLORS[colorIdx % DEFAULT_COLORS.length];
  colorIdx++;
  return c;
}

function defaultAvatarConfig(): AvatarConfig {
  return { mode: 'static', src: '', variableId: '', mapping: [], defaultSrc: '' };
}

function newChar(): Omit<Character, 'id'> {
  const c = nextColor();
  return {
    name: 'Персонаж',
    nameColor: c.nameColor,
    bgColor: c.bgColor,
    borderColor: c.borderColor,
    avatarConfig: defaultAvatarConfig(),
  };
}

export function CharacterManager() {
  const { project, addCharacter, updateCharacter, deleteCharacter } = useProjectStore();
  const { characters } = project;
  const vars = flattenVariables(project.variableNodes);
  const imgAssets = flattenAssets(project.assetNodes).filter(a => a.assetType === 'image');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const prevLengthRef = useRef(characters.length);

  // Auto-expand the latest added character.
  useEffect(() => {
    if (characters.length > prevLengthRef.current && characters.length > 0) {
      const newest = characters[characters.length - 1];
      setExpandedId(newest.id);
    }
    prevLengthRef.current = characters.length;
  }, [characters.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="p-2 flex flex-col gap-1">
      {characters.map(char => (
        <CharacterCard
          key={char.id}
          char={char}
          vars={vars}
          imgAssets={imgAssets}
          expanded={expandedId === char.id}
          onToggle={() => setExpandedId(expandedId === char.id ? null : char.id)}
          onUpdate={patch => updateCharacter(char.id, patch)}
          onDelete={() => {
            if (confirm(`Удалить персонажа "${char.name}"?`)) {
              deleteCharacter(char.id);
              if (expandedId === char.id) setExpandedId(null);
            }
          }}
        />
      ))}

      {characters.length === 0 && (
        <p className="text-xs text-slate-600 italic px-2 py-1">Нет персонажей</p>
      )}

      <button
        className="mt-1 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 rounded px-2 py-1.5 text-left transition-colors cursor-pointer"
        onClick={() => addCharacter(newChar())}
      >
        + Добавить персонажа
      </button>
    </div>
  );
}

function CharacterCard({
  char,
  vars,
  imgAssets,
  expanded,
  onToggle,
  onUpdate,
  onDelete,
}: {
  char: Character;
  vars: Variable[];
  imgAssets: Asset[];
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (patch: Partial<Character>) => void;
  onDelete: () => void;
}) {
  const nameInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (expanded) {
      const id = requestAnimationFrame(() => nameInputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [expanded]);

  const avatarCfg: AvatarConfig = char.avatarConfig ?? defaultAvatarConfig();

  return (
    <div className="rounded border border-slate-700 overflow-hidden">
      {/* Header row */}
      <div
        className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-slate-800 transition-colors"
        onClick={onToggle}
      >
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ background: char.borderColor }}
        />
        <span className="flex-1 text-xs text-white truncate" style={{ color: char.nameColor }}>
          {char.name || 'Без имени'}
        </span>
        <button
          className="text-slate-600 hover:text-red-400 text-xs cursor-pointer"
          onClick={e => { e.stopPropagation(); onDelete(); }}
        >
          🗑️
        </button>
        <span className="text-slate-500 text-xs">{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded form */}
      {expanded && (
        <div
          className="px-3 py-2 flex flex-col gap-2 border-t border-slate-700"
          style={{ background: char.bgColor, borderLeft: `3px solid ${char.borderColor}` }}
        >
          <Field label="Имя">
            <input
              ref={nameInputRef}
              className="w-full bg-slate-800 text-xs text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500"
              value={char.name}
              onChange={e => onUpdate({ name: e.target.value })}
            />
          </Field>
          <Field label="Цвет имени">
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-8 h-7 rounded cursor-pointer bg-transparent border-0"
                value={char.nameColor}
                onChange={e => onUpdate({ nameColor: e.target.value })}
              />
              <span className="text-xs font-mono" style={{ color: char.nameColor }}>{char.nameColor}</span>
            </div>
          </Field>
          <Field label="Фон диалога">
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-8 h-7 rounded cursor-pointer bg-transparent border-0"
                value={char.bgColor}
                onChange={e => onUpdate({ bgColor: e.target.value })}
              />
              <span className="text-xs font-mono text-slate-300">{char.bgColor}</span>
            </div>
          </Field>
          <Field label="Акцент">
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-8 h-7 rounded cursor-pointer bg-transparent border-0"
                value={char.borderColor}
                onChange={e => onUpdate({ borderColor: e.target.value })}
              />
              <span className="text-xs font-mono text-slate-300">{char.borderColor}</span>
            </div>
          </Field>

          {/* Avatar settings */}
          <AvatarEditor
            cfg={avatarCfg}
            vars={vars}
            imgAssets={imgAssets}
            onChange={cfg => onUpdate({ avatarConfig: cfg })}
          />

          {/* Live preview */}
          <div
            className="mt-1 rounded p-2"
            style={{
              background: char.bgColor,
              borderLeft: `4px solid ${char.borderColor}`,
            }}
          >
            <span className="text-xs font-bold block" style={{ color: char.nameColor }}>
              {char.name || 'Имя'}
            </span>
            <p className="text-xs text-slate-300 italic m-0">Пример реплики персонажа.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Avatar editor ─────────────────────────────────────────────────────────────

function AvatarEditor({
  cfg,
  vars,
  imgAssets,
  onChange,
}: {
  cfg: AvatarConfig;
  vars: Variable[];
  imgAssets: Asset[];
  onChange: (c: AvatarConfig) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {/* Mode toggle */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 w-20 shrink-0">Аватар:</label>
        <div className="flex gap-1">
          <button
            className={`text-xs px-2 py-1 rounded border transition-colors cursor-pointer ${
              cfg.mode === 'static'
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-500'
            }`}
            onClick={() => onChange({ ...cfg, mode: 'static' })}
          >
            🔗 Статич.
          </button>
          <button
            className={`text-xs px-2 py-1 rounded border transition-colors cursor-pointer ${
              cfg.mode === 'bound'
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-500'
            }`}
            onClick={() => onChange({ ...cfg, mode: 'bound' })}
          >
            📊 Динамич.
          </button>
        </div>
      </div>

      {/* Static mode: asset picker + manual URL */}
      {cfg.mode === 'static' && (
        <Field label="Картинка">
          <AvatarImagePicker
            imgAssets={imgAssets}
            value={cfg.src}
            onChange={src => onChange({ ...cfg, src })}
          />
        </Field>
      )}

      {/* Bound mode: variable + mappings + default */}
      {cfg.mode === 'bound' && (
        <div className="flex flex-col gap-1.5">
          {/* Variable selector */}
          <Field label="Переменная">
            <select
              className="w-full bg-slate-800 text-xs text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
              value={cfg.variableId}
              onChange={e => onChange({ ...cfg, variableId: e.target.value })}
            >
              <option value="">— выбрать —</option>
              {vars.map(v => (
                <option key={v.id} value={v.id}>${v.name} ({v.varType})</option>
              ))}
            </select>
          </Field>

          {/* Mappings */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Соответствия (значение → файл):</span>
              <button
                className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer"
                onClick={() => onChange({
                  ...cfg,
                  mapping: [
                    ...cfg.mapping,
                    {
                      id: crypto.randomUUID(),
                      matchType: 'exact',
                      value: '',
                      rangeMin: '',
                      rangeMax: '',
                      src: '',
                    } satisfies ImageBoundMapping,
                  ],
                })}
              >
                + Добавить
              </button>
            </div>

            {cfg.mapping.map((m, i) => (
              <MappingEntry
                key={m.id ?? i}
                m={m}
                imgAssets={imgAssets}
                onChange={patch => onChange({
                  ...cfg,
                  mapping: cfg.mapping.map((x, j) => j === i ? { ...x, ...patch } : x),
                })}
                onDelete={() => onChange({
                  ...cfg,
                  mapping: cfg.mapping.filter((_, j) => j !== i),
                })}
              />
            ))}

            {cfg.mapping.length === 0 && (
              <p className="text-xs text-slate-600 italic">Добавьте хотя бы одно соответствие.</p>
            )}

            {/* Default image */}
            <div className="flex flex-col gap-1 mt-0.5">
              <span className="text-xs text-slate-400">По умолч. (нет совпадений):</span>
              <AvatarImagePicker
                imgAssets={imgAssets}
                value={cfg.defaultSrc}
                onChange={defaultSrc => onChange({ ...cfg, defaultSrc })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Mapping entry row ─────────────────────────────────────────────────────────

function MappingEntry({
  m,
  imgAssets,
  onChange,
  onDelete,
}: {
  m: ImageBoundMapping;
  imgAssets: Asset[];
  onChange: (patch: Partial<ImageBoundMapping>) => void;
  onDelete: () => void;
}) {
  const mt = m.matchType ?? 'exact';
  return (
    <div className="flex flex-col gap-1 border border-slate-700/60 rounded p-1.5">
      {/* Mode toggle + delete */}
      <div className="flex items-center gap-1">
        <select
          className="flex-1 bg-slate-800 text-xs text-white rounded px-1.5 py-0.5 outline-none border border-slate-600 focus:border-indigo-500 cursor-pointer"
          value={mt}
          onChange={e => onChange({ matchType: e.target.value as 'exact' | 'range' })}
        >
          <option value="exact">Точное значение</option>
          <option value="range">Диапазон</option>
        </select>
        <button
          className="text-slate-600 hover:text-red-400 text-xs cursor-pointer shrink-0 ml-1"
          onClick={onDelete}
        >
          ✕
        </button>
      </div>

      {/* Exact value */}
      {mt === 'exact' && (
        <div className="flex gap-1 items-center">
          <span className="text-xs text-slate-500 shrink-0 w-10">Знач.:</span>
          <input
            className="flex-1 bg-slate-800 text-xs text-white rounded px-1.5 py-1 outline-none border border-slate-600 font-mono"
            placeholder="happy"
            value={m.value}
            onChange={e => onChange({ value: e.target.value })}
          />
        </div>
      )}

      {/* Range values */}
      {mt === 'range' && (
        <div className="flex gap-1 items-center">
          <span className="text-xs text-slate-500 shrink-0 w-6">От:</span>
          <input
            className="flex-1 bg-slate-800 text-xs text-white rounded px-1.5 py-1 outline-none border border-slate-600 font-mono"
            placeholder="0"
            value={m.rangeMin ?? ''}
            onChange={e => onChange({ rangeMin: e.target.value })}
          />
          <span className="text-xs text-slate-500 shrink-0">До:</span>
          <input
            className="flex-1 bg-slate-800 text-xs text-white rounded px-1.5 py-1 outline-none border border-slate-600 font-mono"
            placeholder="20"
            value={m.rangeMax ?? ''}
            onChange={e => onChange({ rangeMax: e.target.value })}
          />
        </div>
      )}

      {/* Image picker */}
      <div className="flex gap-1 items-start">
        <span className="text-xs text-slate-500 shrink-0 pt-1.5 w-10">Файл:</span>
        <AvatarImagePicker
          imgAssets={imgAssets}
          value={m.src}
          onChange={src => onChange({ src })}
        />
      </div>
    </div>
  );
}

// ─── Asset image picker ────────────────────────────────────────────────────────

/** Dropdown from uploaded image assets + manual URL/path input (like PanelEditor's AssetImagePicker). */
function AvatarImagePicker({
  imgAssets,
  value,
  onChange,
}: {
  imgAssets: Asset[];
  value: string;
  onChange: (src: string) => void;
}) {
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
        placeholder="assets/img.png или https://..."
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

// ─── Field helper ──────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <label className="text-xs text-slate-400 w-20 shrink-0 pt-1">{label}:</label>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
