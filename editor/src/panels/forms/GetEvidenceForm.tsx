import { useEditorStore } from "../../store/editorStore";
import type { CaseNode } from "../../types/case";
import { inputStyle } from "../PropertyPanel";
import { AssetSelect } from "./AssetSelect";

/** get_evidence 节点表单：可视化选择要获得的证物（下拉选择，可多个） */
export function GetEvidenceForm({ nodeId, node }: { nodeId: string; node: CaseNode }) {
  const updateNode = useEditorStore((s) => s.updateNode);
  const ids = node.evidence_ids ?? [];

  return (
    <div>
      <label style={{ display: "block", fontSize: 12, color: "#999", marginBottom: 6 }}>
        获得的证物 ({ids.length})
      </label>

      {ids.map((id, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <AssetSelect
            kind="evidence"
            value={id}
            allowEmpty={false}
            onChange={(v) => {
              const next = [...ids];
              next[i] = v ?? "";
              updateNode(nodeId, { evidence_ids: next });
            }}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            onClick={() => updateNode(nodeId, { evidence_ids: ids.filter((_, j) => j !== i) })}
            style={miniBtn}
          >
            删除
          </button>
        </div>
      ))}

      <button
        onClick={() => updateNode(nodeId, { evidence_ids: [...ids, ""] })}
        style={{ ...miniBtn, width: "100%", padding: 8 }}
      >
        + 添加证物
      </button>
    </div>
  );
}

const miniBtn: React.CSSProperties = {
  background: "#2a2a38",
  border: "none",
  borderRadius: 4,
  color: "#ccc",
  padding: "4px 10px",
  cursor: "pointer",
  fontSize: 12,
};
