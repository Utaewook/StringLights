import { PanelLeft, PanelRight, Cpu, ShieldAlert, Sun, Moon } from 'lucide-react';
import { useUIStore }  from '../../store/uiStore';
import { useModelStore } from '../../store/modelStore';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

// The header mark renders at 18px, below the 48px floor where the full three-bulb
// mark stops reading, so both tones use the mini variant. Light mode takes the
// bordered one: the header sits on a near-white surface, and the plate colour
// (#EEF0F4) would otherwise have no edge. Both files are ~1KB and inline as data
// URIs, so switching themes costs no request. See docs/design/direction.md.
import markDark  from '../../assets/icon/amber-night-mini.svg';
import markLight from '../../assets/icon/amber-light-mini-bordered.svg';

export default function Header() {
  const { toggleLeftPanel, toggleRightPanel, engineProvider, theme, toggleTheme } = useUIStore();
  const modelMeta = useModelStore((s) => s.modelMeta);

  const themeLabel = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <header className="app-header">
      {/* Left — brand */}
      <div className="header-left">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleLeftPanel}
          title="Toggle explorer"
          aria-label="Toggle explorer"
        >
          <PanelLeft />
        </Button>
        <div className="brand-section">
          <img
            className="brand-icon"
            src={theme === 'dark' ? markDark : markLight}
            width={18}
            height={18}
            alt=""
          />
          <span className="brand-title">StringLights</span>
        </div>
        <span className="header-badge">Web Inference Hub</span>
      </div>

      {/* Center — loaded file name */}
      <div className="header-center">
        {modelMeta && (
          <span className="header-model-name">
            {modelMeta.nodes.length} nodes · {modelMeta.inputNames.length} input
            {modelMeta.inputNames.length !== 1 ? 's' : ''} · {modelMeta.intermediateOutputNames.length} intermediate outputs
          </span>
        )}
      </div>

      {/* Right — engine badge + toggles */}
      <div className="header-right">
        {engineProvider === 'wasm' && (
          <Badge variant="warning">
            <ShieldAlert />
            {/* Copy fixed by CLAUDE.md §3 — kept verbatim despite the system's
                sentence-case rule. */}
            WASM Mode — Performance May Be Degraded
          </Badge>
        )}
        {engineProvider === 'webgpu' && (
          <Badge variant="success">
            <Cpu />
            WebGPU accelerated
          </Badge>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleTheme}
          title={themeLabel}
          aria-label={themeLabel}
        >
          {theme === 'dark' ? <Sun /> : <Moon />}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleRightPanel}
          title="Toggle inspector"
          aria-label="Toggle inspector"
        >
          <PanelRight />
        </Button>
      </div>
    </header>
  );
}
