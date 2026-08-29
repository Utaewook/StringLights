import React, { useEffect, useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Node,
  type Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './GraphCanvas.css';

import { useModelStore }    from '../../store/modelStore';
import { useUIStore }        from '../../store/uiStore';
import { usePlaybackStore }  from '../../store/playbackStore';
import { getLayoutedElements } from '../../utils/graphLayout';
import type { OnnxNode } from '../../types';

// ─── Custom Node — defined outside component to prevent re-registration ──────

interface CustomNodeData {
  label: string;
  opType: string;
  fullNode: OnnxNode;
  isHighlighted: boolean;
  stepNonce: number;
}

function CustomNode({ data }: { data: CustomNodeData }) {
  const { isHighlighted, stepNonce, opType, label } = data;
  const highlightClass = isHighlighted
    ? stepNonce % 2 === 0 ? 'highlighted-node' : 'highlighted-node-alt'
    : '';

  return (
    <div className={`custom-node-body ${highlightClass}`}>
      <Handle type="target" position={Position.Left} />
      <div className="node-op-type">{opType}</div>
      <div className="node-name">{label}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { custom: CustomNode };

// ─── Palette ─────────────────────────────────────────────────────────────────

/**
 * ReactFlow takes edge, grid and minimap colours as props, not as CSS — so these
 * few values cannot live in the stylesheet with the rest of the canvas. Resolve
 * them from the design-system tokens instead of hardcoding hex, and re-resolve
 * whenever the theme changes; hardcoded colours here were what made the canvas
 * illegible in light mode.
 */
function readCanvasPalette() {
  const cs = getComputedStyle(document.documentElement);
  const token = (name: string) => cs.getPropertyValue(name).trim();

  return {
    grid:     token('--border'),
    edge:     token('--muted-foreground'),
    node:     token('--muted-foreground'),
    nodeHot:  token('--ds-warning'),
    mask:     `color-mix(in oklch, ${token('--background')} 75%, transparent)`,
  };
}

// ─── GraphCanvas ─────────────────────────────────────────────────────────────

export default function GraphCanvas() {
  const modelMeta    = useModelStore((s) => s.modelMeta);
  const setSelectedNode = useModelStore((s) => s.setSelectedNode);
  const setRightPanelOpen = useUIStore((s) => s.setRightPanelOpen);
  const theme = useUIStore((s) => s.theme);
  const { activeNodeNames, stepNonce } = usePlaybackStore();

  const palette = useMemo(readCanvasPalette, [theme]);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Build graph from model metadata
  useEffect(() => {
    if (!modelMeta || modelMeta.nodes.length === 0) return;

    const rawNodes: Node[] = modelMeta.nodes.map((node, idx) => ({
      id:   `node-${idx}`,
      type: 'custom',
      data: {
        label:    node.name,
        opType:   node.opType,
        fullNode: node,
        isHighlighted: false,
        stepNonce: 0,
      },
      position: { x: 0, y: 0 },
    }));

    // Map: output tensor name → node id
    const tensorProducer = new Map<string, string>();
    modelMeta.nodes.forEach((node, idx) => {
      node.outputs.forEach((out) => tensorProducer.set(out, `node-${idx}`));
    });

    const rawEdges: Edge[] = [];
    modelMeta.nodes.forEach((node, idx) => {
      const targetId = `node-${idx}`;
      node.inputs.forEach((inp) => {
        const sourceId = tensorProducer.get(inp);
        if (sourceId && sourceId !== targetId) {
          rawEdges.push({
            id:       `e-${sourceId}-${targetId}-${inp}`,
            source:   sourceId,
            target:   targetId,
            animated: true,
            style:    { stroke: palette.edge, strokeWidth: 1.5 },
            markerEnd: { type: MarkerType.ArrowClosed, color: palette.edge },
          });
        }
      });
    });

    const { nodes: ln, edges: le } = getLayoutedElements(rawNodes, rawEdges, 'LR');
    setNodes(ln);
    setEdges(le);
  }, [modelMeta, setNodes, setEdges, palette.edge]);

  // Update highlight state when playback advances
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          isHighlighted: activeNodeNames.has(node.data.label),
          stepNonce,
        },
      }))
    );
  }, [activeNodeNames, stepNonce, setNodes]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNode(node.data.fullNode as OnnxNode);
      setRightPanelOpen(true);
    },
    [setSelectedNode, setRightPanelOpen]
  );

  if (!modelMeta) return null;

  return (
    <div className="graph-canvas-wrapper">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.05}
        attributionPosition="bottom-right"
      >
        <Background color={palette.grid} gap={20} size={1} />
        <Controls className="flow-controls" showInteractive={false} />
        <MiniMap
          className="flow-minimap"
          nodeColor={(n) => (n.data?.isHighlighted ? palette.nodeHot : palette.node)}
          maskColor={palette.mask}
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  );
}
