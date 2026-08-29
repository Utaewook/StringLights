import { useState } from 'react';
import { MousePointerClick, TriangleAlert } from 'lucide-react';
import { useModelStore } from '../../store/modelStore';
import { computeStats, formatBytes, tensorByteSize } from '../../utils/tensorStats';
import { AccordionItem } from '../../components/ui/Accordion';
import './NodeInspector.css';

/** Significant digits for tensor statistics. */
const STAT_PRECISION = 5;

export default function NodeInspector() {
  const selectedNode     = useModelStore((s) => s.selectedNode);
  const inferenceOutputs = useModelStore((s) => s.inferenceOutputs);
  const inferenceStats   = useModelStore((s) => s.inferenceStats);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    attributes: true,
    inputs: true,
    outputs: true,
  });

  const toggleSection = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  if (!selectedNode) {
    return (
      <div className="node-inspector empty-inspector">
        <div className="empty-state">
          <MousePointerClick aria-hidden />
          <p>Select a node to see its details</p>
        </div>
      </div>
    );
  }

  const { name, opType, inputs, outputs, attributes } = selectedNode;

  const renderInferenceData = (tensorKey: string) => {
    const tensor = inferenceOutputs[tensorKey];

    if (!tensor) {
      return (
        <div className="io-item" key={tensorKey}>
          <span className="io-name io-name-missing">{tensorKey}</span>
          <span className="empty-section">No data</span>
        </div>
      );
    }

    const stats = inferenceStats[tensorKey] || computeStats(tensor);
    const bytes = tensorByteSize(tensor.shape, tensor.type);
    const hasIntegrityIssue = stats.hasNaN || stats.hasInf;

    return (
      <div className="tensor-data-block" key={tensorKey}>
        <div className="io-item">
          <span className="io-name">{tensorKey}</span>
          <span className="io-shape">[{tensor.shape.join(', ')}]</span>
          <span className="io-dtype">{tensor.type}</span>
        </div>

        <table className="ds-table property-table">
          <tbody>
            <tr><td className="prop-key">Size</td><td className="prop-value">{formatBytes(bytes)}</td></tr>
            <tr><td className="prop-key">Min</td><td className="prop-value">{stats.min.toPrecision(STAT_PRECISION)}</td></tr>
            <tr><td className="prop-key">Max</td><td className="prop-value">{stats.max.toPrecision(STAT_PRECISION)}</td></tr>
            <tr><td className="prop-key">Mean</td><td className="prop-value">{stats.mean.toPrecision(STAT_PRECISION)}</td></tr>
            <tr><td className="prop-key">Std</td><td className="prop-value">{stats.std.toPrecision(STAT_PRECISION)}</td></tr>
            {hasIntegrityIssue && (
              <tr className="stat-warning-row">
                <td className="prop-key">
                  <span className="stat-warning-key">
                    <TriangleAlert aria-hidden />
                    Integrity
                  </span>
                </td>
                <td className="prop-value">
                  {[stats.hasNaN && 'Contains NaN', stats.hasInf && 'Contains Inf']
                    .filter(Boolean)
                    .join(' · ')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="node-inspector">
      <div className="inspector-header">
        <div className="inspector-title">{name || 'Unnamed node'}</div>
        <div className="inspector-subtitle">{opType}</div>
      </div>

      <div className="inspector-sections">
        <AccordionItem
          title="Node attributes"
          isOpen={openSections.attributes}
          onToggle={() => toggleSection('attributes')}
        >
          {attributes && Object.keys(attributes).length > 0 ? (
            <table className="ds-table property-table">
              <tbody>
                {Object.entries(attributes).map(([k, v]) => (
                  <tr key={k}>
                    <td className="prop-key">{k}</td>
                    <td className="prop-value">{Array.isArray(v) ? `[${v.join(', ')}]` : String(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-section">No attributes</div>
          )}
        </AccordionItem>

        <AccordionItem
          title="Input inference data"
          isOpen={openSections.inputs}
          onToggle={() => toggleSection('inputs')}
        >
          {inputs.length > 0
            ? inputs.map(renderInferenceData)
            : <div className="empty-section">No inputs</div>}
        </AccordionItem>

        <AccordionItem
          title="Output inference data"
          isOpen={openSections.outputs}
          onToggle={() => toggleSection('outputs')}
        >
          {outputs.length > 0
            ? outputs.map(renderInferenceData)
            : <div className="empty-section">No outputs</div>}
        </AccordionItem>
      </div>
    </div>
  );
}
