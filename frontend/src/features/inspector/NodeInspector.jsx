import React from 'react';
import useModelStore from '../../store/modelStore';

const NodeInspector = () => {
    const { selectedNode, selectedDataset, selectedModel } = useModelStore();

    if (!selectedNode && !selectedDataset) {
        return (
            <div className="inspector-placeholder">
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔍</div>
                <p>Select a node or dataset to inspect</p>
            </div>
        );
    }

    if (selectedDataset) {
        const { name, type, created_at, dynamic_axes } = selectedDataset;
        const date = created_at ? new Date(created_at * 1000) : null;
        const datePart = date ? date.toLocaleDateString() : 'Unknown';
        const timePart = date ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';

        return (
            <div className="node-inspector dataset-inspector">
                <div className="inspector-header">
                    <div className="inspector-title">{name}</div>
                    <div className="inspector-subtitle">Dataset • {type}</div>
                </div>

                <div className="inspector-section">
                    <h3>General Info</h3>
                    <table className="property-table">
                        <tbody>
                            <tr>
                                <td className="prop-key">Created At</td>
                                <td className="prop-value">
                                    {datePart}<br />{timePart}
                                </td>
                            </tr>
                            <tr>
                                <td className="prop-key">Source Type</td>
                                <td className="prop-value">{type}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {dynamic_axes && Object.keys(dynamic_axes).length > 0 && (
                    <div className="inspector-section">
                        <h3>Dynamic Axes Config</h3>
                        <table className="property-table">
                            <tbody>
                                {Object.entries(dynamic_axes).map(([axis, size]) => (
                                    <tr key={axis}>
                                        <td className="prop-key">{axis}</td>
                                        <td className="prop-value">{size}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    }

    // Node Inspection logic
    const { label, op_type, attributes, inputs, outputs } = selectedNode;
    const meta = selectedModel?.meta || {};
    const tensorShapes = meta.tensor_shapes || {};

    const renderTensor = (name) => {
        const shape = tensorShapes[name];
        const shapeStr = Array.isArray(shape)
            ? `[${shape.map(s => s === null || s === undefined ? '?' : s).join(', ')}]`
            : '';

        return (
            <div className="io-item">
                <span className="io-name">{name}</span>
                {shapeStr && <span className="io-shape">{shapeStr}</span>}
            </div>
        );
    };

    return (
        <div className="node-inspector">
            <div className="inspector-header">
                <div className="inspector-title">{label || 'Unnamed Node'}</div>
                <div className="inspector-subtitle">{op_type}</div>
            </div>

            <div className="inspector-section">
                <h3>Attributes</h3>
                {attributes && Object.keys(attributes).length > 0 ? (
                    <table className="property-table">
                        <tbody>
                            {Object.entries(attributes).map(([key, value]) => (
                                <tr key={key}>
                                    <td className="prop-key">{key}</td>
                                    <td className="prop-value">{JSON.stringify(value)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="empty-section">No attributes</div>
                )}
            </div>

            <div className="inspector-section">
                <h3>Inputs</h3>
                {inputs && inputs.length > 0 ? (
                    <ul className="io-list">
                        {inputs.map((input, idx) => (
                            <li key={idx}>
                                {renderTensor(input)}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="empty-section">No inputs</div>
                )}
            </div>

            <div className="inspector-section">
                <h3>Outputs</h3>
                {outputs && outputs.length > 0 ? (
                    <ul className="io-list">
                        {outputs.map((output, idx) => (
                            <li key={idx}>
                                {renderTensor(output)}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="empty-section">No outputs</div>
                )}
            </div>
        </div>
    );
};

export default NodeInspector;
