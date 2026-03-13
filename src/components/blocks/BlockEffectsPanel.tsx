import { useProjectStore } from '../../store/projectStore';
import { useT } from '../../i18n';
import type { BlockDelay, BlockTypewriter } from '../../types';

interface Props {
  delay?: BlockDelay;
  typewriter?: BlockTypewriter;
  onDelayChange: (v: BlockDelay | undefined) => void;
  /** Pass undefined to hide the typewriter section entirely */
  onTypewriterChange?: (v: BlockTypewriter | undefined) => void;
}

const INPUT_CLS = 'w-16 bg-slate-800 text-slate-200 text-xs rounded px-2 py-0.5 border border-slate-600 outline-none focus:border-indigo-500';

export function BlockEffectsPanel({ delay, typewriter, onDelayChange, onTypewriterChange }: Props) {
  const t = useT();
  const { saveSnapshot } = useProjectStore();

  const hasDelay = !!delay;
  const hasAnim  = delay?.animation === true;
  const hasTw    = !!typewriter;

  return (
    <div className="border-t border-slate-700/60 pt-2 mt-1 flex flex-col gap-1">

      {/* ── Delay ─────────────────────────────────────────────────────────── */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={hasDelay}
          onChange={e => onDelayChange(e.target.checked ? { delay: 1 } : undefined)}
          className="accent-indigo-500 cursor-pointer"
        />
        <span className="text-xs text-slate-400">⏱ {t.blockEffects.delayLabel}</span>
      </label>

      {hasDelay && (
        <div className="flex flex-col gap-1 pl-4">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">{t.blockEffects.delaySeconds}</span>
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={delay!.delay}
              onFocus={saveSnapshot}
              onChange={e => onDelayChange({ ...delay!, delay: Math.max(0.1, parseFloat(e.target.value) || 0.1) })}
              className={INPUT_CLS}
            />
            <span className="text-xs text-slate-500">{t.blockEffects.delaySuffix}</span>
          </div>

          {/* Animation toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hasAnim}
              onChange={e => {
                if (e.target.checked) {
                  onDelayChange({ ...delay!, animation: true, animDuration: 0.4, animOffsetX: 0, animOffsetY: 0 });
                } else {
                  const { animation: _a, animDuration: _d, animFade: _f, animOffsetX: _x, animOffsetY: _y, ...rest } = delay!;
                  onDelayChange(rest);
                }
              }}
              className="accent-indigo-500 cursor-pointer"
            />
            <span className="text-xs text-slate-400">{t.blockEffects.animationLabel}</span>
          </label>

          {hasAnim && (
            <div className="flex flex-col gap-1 pl-4">
              {/* Fade toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={delay!.animFade !== false}
                  onChange={e => onDelayChange({ ...delay!, animFade: e.target.checked })}
                  className="accent-indigo-500 cursor-pointer"
                />
                <span className="text-xs text-slate-400">{t.blockEffects.animFadeLabel}</span>
              </label>
              {/* Duration */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">{t.blockEffects.animDuration}</span>
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={delay!.animDuration ?? 0.4}
                  onFocus={saveSnapshot}
                  onChange={e => onDelayChange({ ...delay!, animDuration: Math.max(0.1, parseFloat(e.target.value) || 0.1) })}
                  className={INPUT_CLS}
                />
                <span className="text-xs text-slate-500">{t.blockEffects.animDurationSuffix}</span>
              </div>
              {/* X / Y offsets */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{t.blockEffects.animOffsetX}</span>
                <input
                  type="number"
                  step={1}
                  value={delay!.animOffsetX ?? 0}
                  onFocus={saveSnapshot}
                  onChange={e => onDelayChange({ ...delay!, animOffsetX: parseInt(e.target.value) || 0 })}
                  className={INPUT_CLS}
                />
                <span className="text-xs text-slate-500">{t.blockEffects.animOffsetY}</span>
                <input
                  type="number"
                  step={1}
                  value={delay!.animOffsetY ?? 0}
                  onFocus={saveSnapshot}
                  onChange={e => onDelayChange({ ...delay!, animOffsetY: parseInt(e.target.value) || 0 })}
                  className={INPUT_CLS}
                />
                <span className="text-xs text-slate-500">{t.blockEffects.animOffsetSuffix}</span>
              </div>
              <span className="text-xs text-slate-600 italic">{t.blockEffects.animOffsetHint}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Typewriter ────────────────────────────────────────────────────── */}
      {onTypewriterChange !== undefined && (
        <>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hasTw}
              onChange={e => onTypewriterChange(e.target.checked ? { speed: 40 } : undefined)}
              className="accent-indigo-500 cursor-pointer"
            />
            <span className="text-xs text-slate-400">✍ {t.blockEffects.typewriterLabel}</span>
          </label>

          {hasTw && (
            <div className="flex items-center gap-1.5 pl-4">
              <span className="text-xs text-slate-500">{t.blockEffects.typewriterSpeed}</span>
              <input
                type="number"
                min={1}
                step={1}
                value={typewriter!.speed}
                onFocus={saveSnapshot}
                onChange={e => onTypewriterChange({ speed: Math.max(1, parseInt(e.target.value) || 1) })}
                className={INPUT_CLS}
              />
              <span className="text-xs text-slate-500">{t.blockEffects.typewriterSpeedSuffix}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
