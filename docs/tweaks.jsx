// Purl — Tweaks panel
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "cyan",
  "density": "comfortable"
}/*EDITMODE-END*/;

const ACCENTS = [
  { value: 'cyan',    label: 'Cyan',    color: '#7cf5e5' },
  { value: 'magenta', label: 'Magenta', color: '#e47bff' },
  { value: 'green',   label: 'Green',   color: '#88ffb1' },
  { value: 'amber',   label: 'Amber',   color: '#ffd06a' },
  { value: 'violet',  label: 'Violet',  color: '#a78bfa' }
];

function applyAccent(a) {
  document.body.classList.remove('accent-cyan','accent-magenta','accent-green','accent-amber','accent-violet');
  if (a && a !== 'cyan') document.body.classList.add('accent-' + a);
}
function applyDensity(d) {
  document.body.classList.remove('density-compact','density-comfortable');
  if (d === 'compact') document.body.classList.add('density-compact');
}

// apply on load
applyAccent(TWEAK_DEFAULTS.accent);
applyDensity(TWEAK_DEFAULTS.density);

function PurlTweaks() {
  const { useTweaks, TweaksPanel, TweakSection } = window;
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  React.useEffect(() => { applyAccent(tweaks.accent); }, [tweaks.accent]);
  React.useEffect(() => { applyDensity(tweaks.density); }, [tweaks.density]);

  return (
    <TweaksPanel title="Tweaks">
      <TweakSection title="Accent">
        <div style={{
          display:'grid',
          gridTemplateColumns:'repeat(5, 1fr)',
          gap:8
        }}>
          {ACCENTS.map(a => {
            const active = tweaks.accent === a.value;
            return (
              <button
                key={a.value}
                onClick={() => setTweak('accent', a.value)}
                title={a.label}
                style={{
                  height: 44,
                  borderRadius: 8,
                  border: active ? `2px solid ${a.color}` : '1px solid rgba(255,255,255,0.10)',
                  background: active
                    ? `linear-gradient(135deg, ${a.color}33, ${a.color}11)`
                    : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                  position: 'relative'
                }}
              >
                <span style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: a.color,
                  boxShadow: active ? `0 0 12px ${a.color}` : 'none'
                }} />
              </button>
            );
          })}
        </div>
      </TweakSection>

      <TweakSection title="Density">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 6 }}>
          {['comfortable','compact'].map(d => {
            const active = tweaks.density === d;
            return (
              <button
                key={d}
                onClick={() => setTweak('density', d)}
                style={{
                  padding: '10px 12px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 12,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.10)',
                  background: active ? '#7cf5e5' : 'rgba(255,255,255,0.03)',
                  color: active ? '#06080f' : '#a4adcf',
                  cursor: 'pointer'
                }}
              >
                {d}
              </button>
            );
          })}
        </div>
      </TweakSection>
    </TweaksPanel>
  );
}

ReactDOM.createRoot(document.getElementById('purl-tweaks-root')).render(<PurlTweaks />);
