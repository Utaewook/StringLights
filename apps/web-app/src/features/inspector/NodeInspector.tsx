import React, { useState } from 'react';
import { useModelStore } from '../../store/modelStore';
import { computeStats, formatBytes, tensorByteSize } from '../../utils/tensorStats';
import { ChevronDown } from 'lucide-react';

interface AccordionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function Accordion({ title, isOpen, onToggle, children }: AccordionProps) {
  return (
    <div className="inspector-section">
      <h3 
        className={`accordion-header ${isOpen ? 'accordion-open' : ''}`} 
        onClick={onToggle}
      >
        {title}
        <ChevronDown size={14} className="accordion-icon" />
      </h3>
      {isOpen && <div className="accordion-content">{children}</div>}
    </div>
  );
}

export default function NodeInspector() {
  const selectedNode     = useModelStore((s) => s.selectedNode);
  const inferenceOutputs = useModelStore((s) => s.inferenceOutputs);
  const inferenceStats   = useModelStore((s) => s.inferenceStats);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    attributes: true,
    inputs: true,
    outputs: true,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!selectedNode) {
    return (
      <div className="node-inspector empty-inspector">
        <div className="empty-state">
          <div className="empty-icon-wrap">◎</div>
          <p>Click a graph node<br />to view details</p>
        </div>
      </div>
    );
  }

  const { name, opType, inputs, outputs, attributes } = selectedNode;

  const renderInferenceData = (tensorKey: string) => {
    const tensor = inferenceOutputs[tensorKey];
    if (!tensor) {
      return (
        <div key={tensorKey} className="io-item" style={{ padding: '0', opacity: 0.6 }}>
          <span className="io-name">{tensorKey}</span>
          <span className="empty-section">No data</span>
        </div>
      );
    }

    const stats = inferenceStats[tensorKey] || computeStats(tensor);
    const bytes = tensorByteSize(tensor.shape, tensor.type);

    return (
      <div className="tensor-data-block" key={tensorKey} style={{ marginBottom: '8px' }}>
        <div className="io-item" style={{ padding: '0 0 6px 0', borderBottom: '1px dashed rgba(255,255,255,0.08)' }}>
          <span className="io-name" style={{ color: 'var(--accent-color)' }}>{tensorKey}</span>
          <span className="io-shape">[{tensor.shape.join(', ')}]</span>
          <span className="io-dtype">{tensor.type}</span>
        </div>
        
        <table className="property-table" style={{ marginTop: '4px' }}>
          <tbody>
            <tr><td className="prop-key">Size</td><td className="prop-value">{formatBytes(bytes)}</td></tr>
            <tr><td className="prop-key">Min</td><td className="prop-value">{stats.min.toPrecision(5)}</td></tr>
            <tr><td className="prop-key">Max</td><td className="prop-value">{stats.max.toPrecision(5)}</td></tr>
            <tr><td className="prop-key">Mean</td><td className="prop-value">{stats.mean.toPrecision(5)}</td></tr>
            <tr><td className="prop-key">Std</td><td className="prop-value">{stats.std.toPrecision(5)}</td></tr>
            {(stats.hasNaN || stats.hasInf) && (
              <tr>
                <td className="prop-key stat-warning">⚠ Integrity</td>
                <td className="prop-value stat-warning">
                  {stats.hasNaN ? 'Contains NaN ' : ''}
                  {stats.hasInf ? 'Contains Inf' : ''}
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
        <div className="inspector-title">{name || 'Unnamed Node'}</div>
        <div className="inspector-subtitle">{opType}</div>
      </div>

      <Accordion 
        title="Node Attributes" 
        isOpen={openSections.attributes} 
        onToggle={() => toggleSection('attributes')}
      >
        {attributes && Object.keys(attributes).length > 0 ? (
          <table className="property-table" style={{ marginTop: 0 }}>
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
          <div className="empty-section">No attributes available</div>
        )}
      </Accordion>

      <Accordion 
        title="Input Inference Data" 
        isOpen={openSections.inputs} 
        onToggle={() => toggleSection('inputs')}
      >
        {inputs.length > 0 ? (
          inputs.map(renderInferenceData)
        ) : (
          <div className="empty-section">No inputs</div>
        )}
      </Accordion>

      <Accordion 
        title="Output Inference Data" 
        isOpen={openSections.outputs} 
        onToggle={() => toggleSection('outputs')}
      >
        {outputs.length > 0 ? (
          outputs.map(renderInferenceData)
        ) : (
          <div className="empty-section">No outputs</div>
        )}
      </Accordion>
    </div>
  );
}
