
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
        <button className="icon-btn" onClick={toggleLeftPanel} title="Explorer 패널 토글">
          <PanelLeft size={18} />
        </button>
        <div className="brand-section">
          <Sparkles className="brand-icon" size={22} />
          <span className="brand-title">StringLights</span>
          <span className="brand-version-badge">v2</span>
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
            <span>WASM 모드 동작 중 - 성능 저하 가능</span>
          </div>
        )}
        {engineProvider === 'webgpu' && (
          <div className="status-badge status-success">
            <Cpu size={14} />
            <span>WebGPU 가속 구동 중</span>
          </div>
        )}
        <button className="icon-btn" onClick={toggleRightPanel} title="Inspector 패널 토글">
          <PanelRight size={18} />
        </button>
      </div>
    </header>
  );
}
