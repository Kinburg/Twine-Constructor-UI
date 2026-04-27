import type { CellDateTime, DateTimeDisplayMode, VariableTreeNode } from '../../types';
import { useT } from '../../i18n';
import { VariablePicker } from './VariablePicker';

const PRESET_FORMATS = [
  'HH:mm',
  'DD.MM.YYYY',
  'DD.MM.YYYY HH:mm',
  'dddd',
  'dddd, HH:mm',
  'dddd, DD.MM',
  'dddd, DD.MM.YYYY HH:mm',
  'MMMM YYYY',
] as const;

const DISPLAY_MODES: DateTimeDisplayMode[] = ['text', 'clock', 'digital', 'calendar', 'clock-calendar', 'digital-calendar'];

const BTN = 'px-2 py-1 rounded text-xs cursor-pointer border transition-colors';
const BTN_ON  = 'bg-indigo-600 border-indigo-500 text-white';
const BTN_OFF = 'bg-slate-800 border-slate-600 text-slate-300 hover:border-indigo-500 hover:text-white';

interface Props {
  c: CellDateTime;
  nodes: VariableTreeNode[];
  onChange: (patch: Partial<CellDateTime>) => void;
  Field: React.FC<{ label: string; children: React.ReactNode }>;
  placeholder?: string;
}

export function DateTimeCellEditor({ c, nodes, onChange, Field, placeholder }: Props) {
  const t = useT();
  const cm = t.cellModal;

  const mode: DateTimeDisplayMode = c.displayMode ?? 'text';

  const presetLabels: Record<typeof PRESET_FORMATS[number], string> = {
    'HH:mm':                   cm.fmtTime,
    'DD.MM.YYYY':              cm.fmtDate,
    'DD.MM.YYYY HH:mm':        cm.fmtDateTime,
    'dddd':                    cm.fmtWeekday,
    'dddd, HH:mm':             cm.fmtWeekdayTime,
    'dddd, DD.MM':             cm.fmtWeekdayDate,
    'dddd, DD.MM.YYYY HH:mm':  cm.fmtWeekdayFull,
    'MMMM YYYY':               cm.fmtMonthYear,
  };

  const modeLabels: Record<DateTimeDisplayMode, string> = {
    'text':           cm.displayModeText,
    'clock':          cm.displayModeClock,
    'digital':        cm.displayModeDigital,
    'calendar':       cm.displayModeCalendar,
    'clock-calendar':   cm.displayModeClockCalendar,
    'digital-calendar': cm.displayModeDigitalCalendar,
  };

  const isKnownPreset = (PRESET_FORMATS as readonly string[]).includes(c.format);
  const isCustom = !isKnownPreset && c.format !== '';

  return (
    <>
      <Field label={cm.variableLabel}>
        <VariablePicker
          value={c.variableId}
          onChange={id => onChange({ variableId: id })}
          nodes={nodes}
          placeholder={placeholder ?? cm.selectVariable}
          filter={v => v.varType === 'datetime'}
          className="flex-1"
        />
      </Field>

      <Field label={cm.displayModeLabel}>
        <div className="flex flex-wrap gap-1">
          {DISPLAY_MODES.map(m => (
            <button key={m} className={`${BTN} ${mode === m ? BTN_ON : BTN_OFF}`} onClick={() => onChange({ displayMode: m })}>
              {modeLabels[m]}
            </button>
          ))}
        </div>
      </Field>

      {mode === 'text' && (
        <Field label={cm.fmtCustom.replace('…', '').trim()}>
          <div className="flex flex-col gap-1.5 flex-1">
            <div className="flex flex-wrap gap-1">
              {PRESET_FORMATS.map(fmt => (
                <button
                  key={fmt}
                  className={`${BTN} ${!isCustom && c.format === fmt ? BTN_ON : BTN_OFF}`}
                  onClick={() => onChange({ format: fmt })}
                >
                  {presetLabels[fmt]}
                </button>
              ))}
              <button
                className={`${BTN} ${isCustom ? BTN_ON : BTN_OFF}`}
                onClick={() => { if (!isCustom) onChange({ format: '' }); }}
              >
                {cm.fmtCustom}
              </button>
            </div>
            {isCustom && (
              <input
                className="bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600 focus:border-indigo-500 font-mono"
                placeholder="DD.MM.YYYY HH:mm"
                value={c.format}
                onChange={e => onChange({ format: e.target.value })}
              />
            )}
          </div>
        </Field>
      )}

      {mode === 'text' && (
        <>
          <Field label={cm.prefix}>
            <input
              className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600"
              value={c.prefix ?? ''}
              onChange={e => onChange({ prefix: e.target.value })}
            />
          </Field>
          <Field label={cm.suffix}>
            <input
              className="flex-1 bg-slate-800 text-sm text-white rounded px-2 py-1 outline-none border border-slate-600"
              value={c.suffix ?? ''}
              onChange={e => onChange({ suffix: e.target.value })}
            />
          </Field>
        </>
      )}
    </>
  );
}
