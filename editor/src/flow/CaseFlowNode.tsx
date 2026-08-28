import { Handle, Position, type NodeProps } from "@xyflow/react";
import { NODE_META, type NodeType, type NodeStatus } from "../types/case";

const STATUS_META: Record<NodeStatus, { label: string; color: string }> = {
  draft: { label: "草稿", color: "#7f8c8d" },
  wip: { label: "进行中", color: "#e67e22" },
  done: { label: "完成", color: "#2ecc40" },
};

/** 自定义节点：顶部色条 + 类型标签 + 节点标题 + id 副标题 + 摘要 */
export function CaseFlowNode({ data, selected }: NodeProps) {
  const nodeType = data.nodeType as NodeType;
  const meta = NODE_META[nodeType];
  const isEntry = data.isEntry as boolean;
  const hasTitle = data.hasTitle as boolean;
  const nodeId = data.nodeId as string;
  const status = data.status as NodeStatus | undefined;

  return (
    <div
      style={{
        minWidth: 160,
        maxWidth: 220,
        borderRadius: 8,
        background: "#1e1e28",
        border: selected ? "2px solid #ffcc00" : "1px solid #3a3a48",
        boxShadow: selected ? "0 0 0 2px rgba(255,204,0,0.3)" : "0 2px 6px rgba(0,0,0,0.4)",
        overflow: "hidden",
        color: "#eee",
        fontSize: 12,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: "#888" }} />
      <div
        style={{
          background: meta.color,
          padding: "4px 8px",
          fontWeight: 600,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>{meta.label}</span>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {status && (
            <span
              style={{
                fontSize: 10,
                background: STATUS_META[status].color,
                color: "#fff",
                borderRadius: 3,
                padding: "0 4px",
              }}
            >
              {STATUS_META[status].label}
            </span>
          )}
          {isEntry && (
            <span
              style={{
                fontSize: 10,
                background: "#ffcc00",
                color: "#000",
                borderRadius: 3,
                padding: "0 4px",
              }}
            >
              入口
            </span>
          )}
        </div>
      </div>
      <div style={{ padding: "6px 8px" }}>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>{data.label as string}</div>
        {hasTitle && (
          <div style={{ color: "#666", fontSize: 10, marginBottom: 2 }}>{nodeId}</div>
        )}
        <div style={{ color: "#999", fontSize: 11, whiteSpace: "pre-wrap" }}>
          {data.summary as string}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: "#888" }} />
    </div>
  );
}
