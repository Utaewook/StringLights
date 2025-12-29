import React, { useMemo, useEffect } from 'react';
import ReactFlow, { Background, Controls, Handle, Position, MarkerType, useNodesState, useEdgesState } from 'reactflow';
import 'reactflow/dist/style.css';
import useModelStore from '../store/modelStore';
import useUIStore from '../store/uiStore';
import { getLayoutedElements } from '../utils/graphLayout';

// Custom Node Component to show more details
const CustomNode = ({ data }) => {
    return (
        <div className="custom-node-body" style={{
            padding: '10px',
            border: '1px solid var(--node-border)',
            borderRadius: '5px',
            background: 'var(--node-bg)',
            color: 'var(--node-text)',
            minWidth: '150px',
            fontSize: '12px',
            boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
        }}>
            <Handle type="target" position={Position.Left} style={{ background: 'var(--node-handle)' }} />
            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>{data.op_type}</div>
            <div style={{ color: 'var(--node-text-secondary)' }}>{data.label}</div>
            <Handle type="source" position={Position.Right} style={{ background: 'var(--node-handle)' }} />
        </div>
    );
};

const nodeTypes = {
    custom: CustomNode,
};

const GraphCanvas = () => {
    const { selectedModel, setSelectedNode } = useModelStore();
    const { setRightPanelOpen } = useUIStore();
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    const onNodeClick = (event, node) => {
        setSelectedNode(node.data.fullNode); // Pass the original ONNX structure
        setRightPanelOpen(true);
    };

    useEffect(() => {
        if (!selectedModel) return;

        // Convert ONNX nodes to React Flow nodes/edges
        const newNodes = [];
        const newEdges = [];
        const nodeMap = new Map(); // name -> id

        selectedModel.nodes.forEach((node, index) => {
            const id = `node-${index}`;
            nodeMap.set(node.name, id); // Map unique name to ID if possible, or just use inputs/outputs

            newNodes.push({
                id: id,
                type: 'custom',
                data: {
                    label: node.name,
                    op_type: node.op_type,
                    fullNode: node // Store full data for inspector
                },
                position: { x: 0, y: 0 } // Layout will fix this
            });
        });

        // Create Edges
        // This is naive: connecting standard inputs/outputs
        // In ONNX, edges are implicit via input/output names.
        // We need to map: Output of Node A -> Input of Node B

        // First, map which node produces which output tensor
        const tensorProducer = new Map(); // tensor_name -> node_id
        selectedModel.nodes.forEach((node, index) => {
            const nodeId = `node-${index}`;
            node.outputs.forEach(outputName => {
                tensorProducer.set(outputName, nodeId);
            });
        });

        // Then, for each node, check its inputs to see who produced them
        selectedModel.nodes.forEach((node, index) => {
            const targetId = `node-${index}`;
            node.inputs.forEach(inputName => {
                const sourceId = tensorProducer.get(inputName);
                if (sourceId) {
                    newEdges.push({
                        id: `e-${sourceId}-${targetId}-${inputName}`,
                        source: sourceId,
                        target: targetId,
                        animated: true,
                        style: { stroke: 'var(--text-secondary)', opacity: 0.5 },
                    });
                }
            });
        });

        // Calculate Layout
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
            newNodes,
            newEdges,
            'LR' // Left to Right
        );

        setNodes(layoutedNodes);
        setEdges(layoutedEdges);

    }, [selectedModel, setNodes, setEdges]);

    if (!selectedModel) return null;

    return (
        <div style={{ width: '100%', height: '100%' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                nodeTypes={nodeTypes}
                fitView
                attributionPosition="bottom-right"
            >
                <Background color="#aaa" gap={16} />
                <Controls />
            </ReactFlow>
        </div>
    );
};

export default GraphCanvas;
