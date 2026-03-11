import { useEffect, useRef, useCallback, memo } from 'react';
import type { MouseEvent } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type EdgeProps,
  type OnNodeDrag,
  type NodeMouseHandler,
  BackgroundVariant,
  BaseEdge,
  getSmoothStepPath,
  EdgeLabelRenderer,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import type { GraphData, GraphScene, GraphEdge } from '../../utils/buildGraphData';

// ─── Layout constants ─────────────────────────────────────────────────────────

const NODE_W = 210;
const NODE_H = 58;

// ─── Dagre auto-layout ────────────────────────────────────────────────────────

function runDagre(scenes: GraphScene[], edges: GraphEdge[]): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 110, marginx: 40, marginy: 40 });

  const ids = new Set(scenes.map(s => s.id));
  scenes.forEach(s => g.setNode(s.id, { width: NODE_W, height: NODE_H }));
  edges
    .filter(e => ids.has(e.sourceId) && ids.has(e.targetId))
    .forEach(e => g.setEdge(e.sourceId, e.targetId));

  dagre.layout(g);

  const result = new Map<string, { x: number; y: number }>();
  scenes.forEach(s => {
    const n = g.node(s.id);
    if (n) result.set(s.id, { x: n.x - NODE_W / 2, y: n.y - NODE_H / 2 });
  });
  return result;
}

// ─── Custom scene node ────────────────────────────────────────────────────────

type SceneNodeData = {
  label:    string;
  isStart:  boolean;
  isActive: boolean;
};

const SceneNode = memo(({ data }: { data: SceneNodeData }) => {
  const border = data.isActive
    ? '2px solid #cba6f7'
    : data.isStart
    ? '2px solid #a6e3a1'
    : '1px solid #585b70';

  const bg = data.isActive ? '#3b3552' : '#313244';

  return (
    <>
      <Handle type="target" position={Position.Left}  style={{ background: '#585b70', border: 'none' }} />
      <div
        style={{
          background:   bg,
          border,
          borderRadius: 8,
          padding:      '10px 14px',
          width:        NODE_W,
          color:        '#cdd6f4',
          fontSize:     13,
          fontFamily:   'system-ui, -apple-system, sans-serif',
          fontWeight:   data.isStart || data.isActive ? 600 : 400,
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
          cursor:       'pointer',
          userSelect:   'none',
          boxSizing:    'border-box',
        }}
        title={data.label}
      >
        {data.isStart && (
          <span style={{ color: '#a6e3a1', marginRight: 6, fontSize: 11 }}>▶</span>
        )}
        {data.label}
      </div>
      <Handle type="source" position={Position.Right} style={{ background: '#585b70', border: 'none' }} />
    </>
  );
});
SceneNode.displayName = 'SceneNode';

const nodeTypes = { scene: SceneNode };

// ─── Custom scene edge ────────────────────────────────────────────────────────

const MAX_LABEL = 30;

// Two arrow marker IDs — defined as SVG defs outside ReactFlow
const ARROW_NORMAL   = 'tc-arrow-normal';
const ARROW_SELECTED = 'tc-arrow-selected';

function SceneEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  label,
}: EdgeProps) {
  const { setEdges } = useReactFlow();

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  const isSelected  = Boolean(selected);
  const stroke      = isSelected ? '#cba6f7' : '#585b70';
  const strokeWidth = isSelected ? 2.5       : 1.5;
  const markerId    = isSelected ? ARROW_SELECTED : ARROW_NORMAL;

  // Click on label → select this edge (deselect all others)
  const handleLabelClick = useCallback((e: MouseEvent) => {
    e.stopPropagation(); // prevent ReactFlow pane from deselecting everything
    setEdges(eds => eds.map(edge => ({ ...edge, selected: edge.id === id })));
  }, [id, setEdges]);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{ stroke, strokeWidth, transition: 'stroke 0.15s, stroke-width 0.15s' }}
        markerEnd={`url(#${markerId})`}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            onClick={handleLabelClick}
            style={{
              position:      'absolute',
              transform:     `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              background:    isSelected ? 'rgba(203,166,247,0.18)' : 'rgba(30,30,46,0.88)',
              color:         isSelected ? '#cba6f7'                 : '#6c7086',
              fontSize:      11,
              fontFamily:    'system-ui, sans-serif',
              padding:       '2px 6px',
              borderRadius:  4,
              border:        isSelected ? '1px solid #cba6f7' : '1px solid #313244',
              pointerEvents: 'all',   // was 'none' — now clickable
              cursor:        'pointer',
              whiteSpace:    'nowrap',
              userSelect:    'none',
              transition:    'color 0.15s, border-color 0.15s, background 0.15s',
            }}
          >
            {String(label)}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
SceneEdge.displayName = 'SceneEdge';

const edgeTypes = { scene: SceneEdge };

// ─── Converters ───────────────────────────────────────────────────────────────

function toFlowNodes(data: GraphData): Node[] {
  const dagrePos = runDagre(data.scenes, data.edges);
  return data.scenes.map(s => ({
    id:       s.id,
    type:     'scene',
    position: s.graphPosition ?? dagrePos.get(s.id) ?? { x: 0, y: 0 },
    data: {
      label:    s.name,
      isStart:  s.isStart,
      isActive: s.id === data.activeSceneId,
    } satisfies SceneNodeData,
  }));
}

function toFlowEdges(data: GraphData): Edge[] {
  return data.edges.map(e => ({
    id:     e.edgeId,
    source: e.sourceId,
    target: e.targetId,
    label:  e.label.length > MAX_LABEL ? e.label.slice(0, MAX_LABEL) + '…' : e.label,
    type:   'scene',
  }));
}

// ─── Graph view ───────────────────────────────────────────────────────────────

export function SceneGraphView() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const isDragging = useRef(false);

  // Receive graph data from main window via IPC
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onGraphProject) return;
    api.onGraphProject((raw: unknown) => {
      if (isDragging.current) return;
      const data = raw as GraphData;
      setNodes(toFlowNodes(data));
      setEdges(toFlowEdges(data));
    });
    // Signal main process that we're ready to receive the initial snapshot
    api.graphReady?.();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onNodeDragStart: OnNodeDrag = useCallback(() => {
    isDragging.current = true;
  }, []);

  const onNodeDragStop: OnNodeDrag = useCallback((_evt, node) => {
    isDragging.current = false;
    window.electronAPI?.graphMove?.(node.id, node.position.x, node.position.y);
  }, []);

  const onNodeClick: NodeMouseHandler = useCallback((_evt, node) => {
    window.electronAPI?.graphNavigate?.(node.id);
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#1e1e2e' }}>

      {/* Arrow marker definitions — referenced by custom edge as url(#id) */}
      <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <defs>
          <marker
            id={ARROW_NORMAL}
            viewBox="0 0 10 10"
            refX="9" refY="5"
            markerWidth="6" markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#585b70" />
          </marker>
          <marker
            id={ARROW_SELECTED}
            viewBox="0 0 10 10"
            refX="9" refY="5"
            markerWidth="6" markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#cba6f7" />
          </marker>
        </defs>
      </svg>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        edgesFocusable
        fitView
        fitViewOptions={{ padding: 0.15 }}
        colorMode="dark"
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="#313244"
          gap={20}
          size={1.5}
        />
        <Controls
          style={{
            background: '#181825',
            border: '1px solid #313244',
            borderRadius: 6,
          }}
        />
        <MiniMap
          nodeColor={n =>
            (n.data as SceneNodeData)?.isActive  ? '#cba6f7' :
            (n.data as SceneNodeData)?.isStart   ? '#a6e3a1' : '#45475a'
          }
          style={{
            background: '#181825',
            border: '1px solid #313244',
            borderRadius: 6,
          }}
          maskColor="rgba(30,30,46,0.6)"
        />
      </ReactFlow>
    </div>
  );
}
