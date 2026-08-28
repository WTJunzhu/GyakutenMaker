import { useEditorStore } from "../store/editorStore";
import { NODE_META, type NodeType } from "../types/case";
import { DialogueForm } from "./forms/DialogueForm";
import { TestimonyForm } from "./forms/TestimonyForm";
import { InvestigationForm } from "./forms/InvestigationForm";
import { GenericForm } from "./forms/GenericForm";

const ALL_TYPES = Object.keys(NODE_META) as NodeType[];

export function PropertyPanel() {
  const caseData = useEditorStore((s) => s.caseData);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const updateNode = useEditorStore((s) => s.updateNode);
  const renameNode = useEditorStore((s) => s.renameNode);
  const deleteNode = useEditorStore((s) => s.deleteNode);
  const setEntry = useEditorStore((s) => s.setEntry);

  if (!caseData || !selectedNodeId || !caseData.nodes[selectedNodeId]) {
    return (
      <div style={panelStyle}>
        <div style={{ color: "#666", padding: 12 }}>点击画布中的节点以编辑属性</div>
      </div>
    );
  }

  const node = caseData.nodes[selectedNodeId];
  const isEntry = caseData.entry === selectedNodeId;
  const nodeIds = Object.keys(caseData.nodes);

  return (
    <div style={panelStyle}>
      <div style={{ padding: 12, overflowY: "auto", height: "100%" }}>
        <h3 style={{ margin: "0 0 12px", color: NODE_META[node.type].color }}>
          {NODE_META[node.type].label} 节点
        </h3>

        {/* 节点 ID */}
        <Field label="节点 ID">
          <input
            defaultValue={selectedNodeId}
            key={selectedNodeId}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== selectedNodeId && !renameNode(selectedNodeId, v)) {
                e.target.value = selectedNodeId;
                alert("ID 已存在或非法");
              }
            }}
            style={inputStyle}
          />
        </Field>

        {/* 节点类型切换 */}
        <Field label="类型">
          <select
            value={node.type}
            onChange={(e) => updateNode(selectedNodeId, { type: e.target.value as NodeType })}
            style={inputStyle}
          >
            {ALL_TYPES.map((t) => (
              <option key={t} value={t}>
                {NODE_META[t].label} ({t})
              </option>
            ))}
          </select>
        </Field>

        {/* next 跳转 */}
        <Field label="下一节点 (next)">
          <select
            value={node.next ?? ""}
            onChange={(e) => updateNode(selectedNodeId, { next: e.target.value || undefined })}
            style={inputStyle}
          >
            <option value="">（无 / 结束）</option>
            {nodeIds
              .filter((id) => id !== selectedNodeId)
              .map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
          </select>
        </Field>

        <hr style={{ borderColor: "#333", margin: "12px 0" }} />

        {/* 类型专属表单 */}
        {node.type === "dialogue" ? (
          <DialogueForm nodeId={selectedNodeId} node={node} />
        ) : node.type === "testimony" ? (
          <TestimonyForm nodeId={selectedNodeId} node={node} />
        ) : node.type === "investigation" ? (
          <InvestigationForm nodeId={selectedNodeId} node={node} />
        ) : (
          <GenericForm nodeId={selectedNodeId} node={node} />
        )}

        <hr style={{ borderColor: "#333", margin: "12px 0" }} />

        {/* 操作 */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            disabled={isEntry}
            onClick={() => setEntry(selectedNodeId)}
            style={{ ...btnStyle, opacity: isEntry ? 0.5 : 1 }}
          >
            {isEntry ? "★ 当前入口" : "设为入口"}
          </button>
          <button
            onClick={() => {
              if (confirm(`删除节点 ${selectedNodeId}？`)) deleteNode(selectedNodeId);
            }}
            style={{ ...btnStyle, background: "#c0392b" }}
          >
            删除节点
          </button>
        </div>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: "block", fontSize: 12, color: "#999", marginBottom: 4 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  width: 320,
  minWidth: 320,
  borderLeft: "1px solid #2a2a38",
  background: "#16161e",
  color: "#eee",
  height: "100%",
};

export const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "#0e0e14",
  border: "1px solid #333",
  borderRadius: 4,
  color: "#eee",
  padding: "6px 8px",
  fontSize: 13,
};

const btnStyle: React.CSSProperties = {
  flex: 1,
  background: "#2a2a38",
  border: "none",
  borderRadius: 4,
  color: "#eee",
  padding: "8px",
  cursor: "pointer",
  fontSize: 13,
};
