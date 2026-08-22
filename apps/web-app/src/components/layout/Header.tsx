import { Sparkles, PanelLeft, PanelRight, Cpu, ShieldAlert, Sun, Moon } from 'lucide-react';
import { useUIStore }  from '../../store/uiStore';
import { useModelStore } from '../../store/modelStore';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

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
          <Sparkles className="brand-icon" size={18} />
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
