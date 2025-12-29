import React from 'react';
import useModelStore from '../store/modelStore';

const NodeInspector = () => {
    const { selectedNode } = useModelStore();

    if (!selectedNode) {
        return (
            <div className="inspector-placeholder">
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔍</div>
                <p>Select a node to inspect</p>
            </div>
        );
    }

    // Identify if it's a node or something else (though we only click nodes for now)
    const { selectedModel } = useModelStore();
    const { label, op_type, attributes, inputs, outputs } = selectedNode;

    // selectedModel.meta가 null이거나 tensor_shapes가 없을 경우 대비
    const meta = selectedModel?.meta || {};
    const tensorShapes = meta.tensor_shapes || {};
    const initializers = new Set(meta.initializers || []);

    const renderTensor = (name) => {
        const shape = tensorShapes[name];
        const isInitializer = initializers.has(name);

        // shape이 배열이 아닐 경우를 대비
        const shapeStr = Array.isArray(shape)
            ? `${shape.map(s => s === null || s === undefined ? '?' : s).join(' × ')}`
            : '';

        return (
            <div className="io-item">
                <div className="io-row">
                    <span className="io-name">{name}</span>
                    {isInitializer && <span className="initializer-tag">INITIALIZER</span>}
                </div>
                {shapeStr && (
                    <div className="io-shape-badge">
                        {shapeStr}
                    </div>
                )}
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
