import { useState } from 'react';

import { EmojiIcon } from './EmojiIcons';
// Style names are always English (they go directly into image generation prompts)
const PRESET_STYLES = [
  'Anime',
  'Realistic',
  'Watercolor',
  'Oil Painting',
  'Digital Art',
  'Pixel Art',
  'Comic',
  'Sketch',
  'Cinematic',
  'Fantasy',
];

interface Props {
  value: string[];           // all selected styles (preset + custom)
  onChange: (v: string[]) => void;
  label: string;
  customPlaceholder: string;
  addBtn: string;
}

export function StyleChipsEditor({ value, onChange, label, customPlaceholder, addBtn }: Props) {
  const [customInput, setCustomInput] = useState('');

  const toggle = (style: string) => {
    if (value.includes(style)) {
      onChange(value.filter(s => s !== style));
    } else {
      onChange([...value, style]);
    }
  };

  const addCustom = () => {
    const trimmed = customInput.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setCustomInput('');
  };

  const customStyles = value.filter(s => !PRESET_STYLES.includes(s));

  return (
    <div className="flex items-start gap-2">
      <label className="text-xs text-slate-400 w-20 shrink-0 pt-1">{label}</label>
      <div className="flex-1 flex flex-col gap-1.5">
        {/* Preset chips */}
        <div className="flex flex-wrap gap-1">
          {PRESET_STYLES.map(style => (
            <button
              key={style}
              type="button"
              onClick={() => toggle(style)}
              className={`px-2 py-0.5 text-[10px] rounded border cursor-pointer transition-colors ${
                value.includes(style)
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-500'
              }`}
            >
              {style}
            </button>
          ))}
        </div>

        {/* Custom chips + input */}
        <div className="flex items-center gap-1 flex-wrap">
          {customStyles.map(style => (
            <span
              key={style}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded bg-indigo-700/60 border border-indigo-600 text-indigo-200"
            >
              {style}
              <button
                type="button"
                className="text-indigo-400 hover:text-white leading-none cursor-pointer"
                onClick={() => onChange(value.filter(s => s !== style))}
              >
                <EmojiIcon name="close" size={20} />
              </button>
            </span>
          ))}
          <input
            className="bg-slate-800 text-xs text-white rounded px-2 py-0.5 outline-none border border-slate-600 focus:border-indigo-500 w-32"
            placeholder={customPlaceholder}
            value={customInput}
            onChange={e => setCustomInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
          />
          <button
            type="button"
            className="px-2 py-0.5 text-xs rounded bg-slate-700 hover:bg-slate-600 text-slate-300 cursor-pointer border border-slate-600"
            onClick={addCustom}
          >
            {addBtn}
          </button>
        </div>
      </div>
    </div>
  );
}
