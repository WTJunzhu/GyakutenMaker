import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  applyNodeChanges,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEditorStore } from "../store/editorStore";
import { deriveEdges } from "./deriveEdges";
import { CaseFlowNode } from "./CaseFlowNode";
import { nodeSummary } from "./nodeSummary";
import { NODE_META } from "../types/case";

const nodeTypes = { caseNode: CaseFlowNode };

function CanvasInner() {
  const caseData = useEditorStore((s) => s.caseData);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const selectNode = useEditorStore((s) => s.selectNode);
  const setNodePos = useEditorStore((s) => s.setNodePos);
  const connect = useEditorStore((s) => s.connect);

  const nodes: Node[] = useMemo(() => {
    if (!caseData) return [];
    return Object.entries(caseData.nodes).map(([id, node]) => ({
      id,
      type: "caseNode",
      position: node._editor ?? { x: 100, y: 100 },
      selected: id === selectedNodeId,
      data: {
        label: id,
        nodeType: node.type,
        summary: nodeSummary(node),
        isEntry: id === caseData.entry,
      },
    }));
  }, [caseData, selectedNodeId]);

  const edges: Edge[] = useMemo(
    () => (caseData ? deriveEdges(caseData) : []),
    [caseData],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // 只关心拖拽结束后的位置持久化
      for (const c of changes) {
        if (c.type === "position" && c.position && !c.dragging) {
          setNodePos(c.id, Math.round(c.position.x), Math.round(c.position.y));
        }
      }
      applyNodeChanges(changes, nodes);
    },
    [nodes, setNodePos],
  );

  const onConnect = useCallback(
    (conn: Connection) => {
      if (conn.source && conn.target) connect(conn.source, conn.target);
    },
    [connect],
  );

  if (!caseData) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100%", color: "#666" }}>
        请先「新建案件」或「导入 case.json」
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onConnect={onConnect}
      onNodeClick={(_, n) => selectNode(n.id)}
      onPaneClick={() => selectNode(null)}
      fitView
      style={{ background: "#12121a" }}
    >
      <Background color="#2a2a38" gap={20} />
      <Controls />
      <MiniMap
        nodeColor={(n) => NODE_META[(n.data?.nodeType as keyof typeof NODE_META) ?? "dialogue"]?.color ?? "#555"}
        maskColor="rgba(0,0,0,0.6)"
        style={{ background: "#1a1a24" }}
      />
    </ReactFlow>
  );
}

export function FlowCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
