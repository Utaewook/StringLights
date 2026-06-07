
import { Sparkles, PanelLeft, PanelRight, Cpu, ShieldAlert } from 'lucide-react';
import { useUIStore }  from '../../store/uiStore';
import { useModelStore } from '../../store/modelStore';

export default function Header() {
  const { toggleLeftPanel, toggleRightPanel, engineProvider } = useUIStore();
  const modelMeta = useModelStore((s) => s.modelMeta);

  return (
    <header className="app-header">
      {/* Left — brand */}
      <div className="header-left">
        <button className="icon-btn" onClick={toggleLeftPanel} title="Toggle Explorer">
          <PanelLeft size={18} />
        </button>
        <div className="brand-section">
          <Sparkles className="brand-icon" size={22} />
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

      {/* Right — engine badge + inspector toggle */}
      <div className="header-right">
        {engineProvider === 'wasm' && (
          <div className="status-badge status-warning">
            <ShieldAlert size={14} />
            <span>WASM Mode — Performance May Be Degraded</span>
          </div>
        )}
        {engineProvider === 'webgpu' && (
          <div className="status-badge status-success">
            <Cpu size={14} />
            <span>WebGPU Accelerated</span>
          </div>
        )}
        <button className="icon-btn" onClick={toggleRightPanel} title="Toggle Inspector">
          <PanelRight size={18} />
        </button>
      </div>
    </header>
  );
}
