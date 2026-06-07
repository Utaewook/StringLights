
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
          <p className="workspace-hint">좌측 Explorer 패널에서 ONNX 모델을 업로드하세요</p>
        </div>
      )}
    </div>
  );
}
