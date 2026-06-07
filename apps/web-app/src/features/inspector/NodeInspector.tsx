
import { useModelStore } from '../../store/modelStore';
import { computeStats, formatBytes, tensorByteSize } from '../../utils/tensorStats';

export default function NodeInspector() {
  const selectedNode     = useModelStore((s) => s.selectedNode);
  const inferenceOutputs = useModelStore((s) => s.inferenceOutputs);
  const modelMeta        = useModelStore((s) => s.modelMeta);

  if (!selectedNode) {
    return (
      <div className="node-inspector empty-inspector">
        <div className="empty-state">
          <div className="empty-icon-wrap">◎</div>
          <p>그래프 노드를 클릭하면<br />상세 정보가 표시됩니다</p>
        </div>
      </div>
    );
  }

  const { name, opType, inputs, outputs } = selectedNode;

  // Find any inference output data for this node's outputs
  const availableOutputs = outputs.filter((o) => o in inferenceOutputs);

  // Helper: render a tensor name with shape if available
  const renderTensorRow = (tensorName: string) => {
    const result = inferenceOutputs[tensorName];
    const shapeStr = result
      ? `[${result.shape.join(', ')}]`
      : modelMeta?.outputNames.includes(tensorName)
      ? ''
      : '';

    return (
      <div className="io-item" key={tensorName}>
        <span className="io-name">{tensorName}</span>
        {result && <span className="io-shape">{shapeStr}</span>}
        {result && <span className="io-dtype">{result.type}</span>}
      </div>
    );
  };

  return (
    <div className="node-inspector">
      {/* Header */}
      <div className="inspector-header">
        <div className="inspector-title">{name || 'Unnamed Node'}</div>
        <div className="inspector-subtitle">{opType}</div>
      </div>

      {/* Inputs */}
      <div className="inspector-section">
        <h3>Inputs</h3>
        {inputs.length > 0 ? (
          <div className="io-list">{inputs.map(renderTensorRow)}</div>
        ) : (
          <div className="empty-section">입력 없음</div>
        )}
      </div>

      {/* Outputs */}
      <div className="inspector-section">
        <h3>Outputs</h3>
        {outputs.length > 0 ? (
          <div className="io-list">{outputs.map(renderTensorRow)}</div>
        ) : (
          <div className="empty-section">출력 없음</div>
        )}
      </div>

      {/* Tensor Statistics — shown when inference data is available */}
      {availableOutputs.map((tensorKey) => {
        const tensor = inferenceOutputs[tensorKey];
        const stats  = computeStats(tensor);
        const bytes  = tensorByteSize(tensor.shape, tensor.type);

        return (
          <div className="inspector-section" key={tensorKey}>
            <h3>
              통계 · <span className="inspector-tensor-name">{tensorKey}</span>
            </h3>

            <div className="stat-meta-row">
              <span className="stat-meta-label">Shape</span>
              <span className="stat-meta-value">[{tensor.shape.join(', ')}]</span>
            </div>
            <div className="stat-meta-row">
              <span className="stat-meta-label">Dtype</span>
              <span className="stat-meta-value">{tensor.type}</span>
            </div>
            <div className="stat-meta-row">
              <span className="stat-meta-label">Size</span>
              <span className="stat-meta-value">{formatBytes(bytes)}</span>
            </div>

            <table className="property-table">
              <tbody>
                <tr>
                  <td className="prop-key">Min</td>
                  <td className="prop-value">{stats.min.toPrecision(5)}</td>
                </tr>
                <tr>
                  <td className="prop-key">Max</td>
                  <td className="prop-value">{stats.max.toPrecision(5)}</td>
                </tr>
                <tr>
                  <td className="prop-key">Mean</td>
                  <td className="prop-value">{stats.mean.toPrecision(5)}</td>
                </tr>
                <tr>
                  <td className="prop-key">Std</td>
                  <td className="prop-value">{stats.std.toPrecision(5)}</td>
                </tr>
                {(stats.hasNaN || stats.hasInf) && (
                  <tr>
                    <td className="prop-key stat-warning">⚠ 무결성</td>
                    <td className="prop-value stat-warning">
                      {stats.hasNaN ? 'NaN 포함 ' : ''}
                      {stats.hasInf ? 'Inf 포함' : ''}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
