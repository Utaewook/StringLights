
import { useModelStore } from '../../store/modelStore';
import GraphCanvas from '../common/GraphCanvas';

export default function MainWorkspace() {
  const modelMeta = useModelStore((s) => s.modelMeta);

  return (
    <div className="workspace">
      {modelMeta ? (
        <GraphCanvas />
      ) : (
        <div className="workspace-empty">
          <div className="watermark-glow" />
          <h1 className="workspace-title">String Lights</h1>
          <p className="workspace-hint">Upload an ONNX model via the Explorer panel</p>
        </div>
      )}
    </div>
  );
}
