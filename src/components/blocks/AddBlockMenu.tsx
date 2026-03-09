import { useState, useRef } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useT } from '../../i18n';
import type { Block, BlockType } from '../../types';

const BLOCK_ICONS: Record<BlockType, string> = {
  'text':         '📝',
  'dialogue':     '💬',
  'choice':       '🔀',
  'condition':    '❓',
  'variable-set': '📊',
  'button':       '🔘',
  'input-field':  '✏️',
  'image':        '🖼️',
  'video':        '🎥',
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
  }
}

interface Props {
  sceneId: string;
  /** Override the add handler — used for nested blocks inside conditions */
  onAdd?: (block: Block) => void;
  /** Hide certain block types (e.g. prevent nesting conditions) */
  excludeTypes?: BlockType[];
}

export function AddBlockMenu({ sceneId, onAdd, excludeTypes = [] }: Props) {
  const { addBlock } = useProjectStore();
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const BLOCK_ENTRIES: { type: BlockType; label: string; icon: string; desc: string }[] = [
    { type: 'text',         icon: BLOCK_ICONS['text'],         label: t.addBlock.text.label,        desc: t.addBlock.text.desc },
    { type: 'dialogue',     icon: BLOCK_ICONS['dialogue'],     label: t.addBlock.dialogue.label,    desc: t.addBlock.dialogue.desc },
    { type: 'choice',       icon: BLOCK_ICONS['choice'],       label: t.addBlock.choice.label,      desc: t.addBlock.choice.desc },
    { type: 'condition',    icon: BLOCK_ICONS['condition'],    label: t.addBlock.condition.label,   desc: t.addBlock.condition.desc },
    { type: 'variable-set', icon: BLOCK_ICONS['variable-set'], label: t.addBlock.variableSet.label, desc: t.addBlock.variableSet.desc },
    { type: 'button',       icon: BLOCK_ICONS['button'],       label: t.addBlock.button.label,      desc: t.addBlock.button.desc },
    { type: 'input-field',  icon: BLOCK_ICONS['input-field'],  label: t.addBlock.inputField.label,  desc: t.addBlock.inputField.desc },
    { type: 'image',        icon: BLOCK_ICONS['image'],        label: t.addBlock.image.label,       desc: t.addBlock.image.desc },
    { type: 'video',        icon: BLOCK_ICONS['video'],        label: t.addBlock.video.label,       desc: t.addBlock.video.desc },
  ];

  const add = (type: BlockType) => {
    const block = makeBlock(type);
    if (onAdd) {
      onAdd(block);
    } else {
      addBlock(sceneId, block);
    }
    setOpen(false);
  };

  const visible = BLOCK_ENTRIES.filter(bt => !excludeTypes.includes(bt.type));

  return (
    <div ref={ref} className="mt-1">
      {!open ? (
        <button
          className="w-full py-1.5 border border-dashed border-slate-700 hover:border-indigo-500 text-slate-500 hover:text-indigo-400 rounded text-xs transition-colors cursor-pointer"
          onClick={() => setOpen(true)}
        >
          {t.addBlock.trigger}
        </button>
      ) : (
        <div className="border border-slate-600 rounded bg-slate-800 overflow-hidden">
          <div className="grid grid-cols-2">
            {visible.map(bt => (
              <button
                key={bt.type}
                className="flex items-center gap-2 px-3 py-2 hover:bg-slate-700 text-left transition-colors cursor-pointer border-b border-r border-slate-700"
                onClick={() => add(bt.type)}
              >
                <span className="text-base leading-none">{bt.icon}</span>
                <div>
                  <div className="text-xs text-white font-medium">{bt.label}</div>
                  <div className="text-xs text-slate-400 leading-tight">{bt.desc}</div>
                </div>
              </button>
            ))}
          </div>
          <button
            className="w-full py-1 text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
            onClick={() => setOpen(false)}
          >
            {t.addBlock.cancel}
          </button>
        </div>
      )}
    </div>
  );
}
