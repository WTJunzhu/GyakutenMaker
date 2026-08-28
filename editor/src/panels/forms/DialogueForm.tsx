import { useEditorStore } from "../../store/editorStore";
import type { CaseNode, DialogueLine } from "../../types/case";
import { Field, inputStyle } from "../PropertyPanel";

/** dialogue 节点专属表单：可视化编辑对话行列表 */
export function DialogueForm({ nodeId, node }: { nodeId: string; node: CaseNode }) {
  const updateNode = useEditorStore((s) => s.updateNode);
  const lines = node.lines ?? [];

  const setLines = (next: DialogueLine[]) => updateNode(nodeId, { lines: next });

  return (
    <div>
      <Field label="场景 (scene，可选，如 bg courtroom)">
        <input
          value={node.scene ?? ""}
          onChange={(e) => updateNode(nodeId, { scene: e.target.value || undefined })}
          style={inputStyle}
        />
      </Field>

      <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
        <label style={{ fontSize: 12, color: "#999" }}>
          <input
            type="checkbox"
            checked={!!node.show_health_bar}
            onChange={(e) => updateNode(nodeId, { show_health_bar: e.target.checked || undefined })}
          />{" "}
          显示血条
        </label>
        <label style={{ fontSize: 12, color: "#999" }}>
          <input
            type="checkbox"
            checked={!!node.hide_health_bar}
            onChange={(e) => updateNode(nodeId, { hide_health_bar: e.target.checked || undefined })}
          />{" "}
          隐藏血条
        </label>
      </div>

      <label style={{ display: "block", fontSize: 12, color: "#999", marginBottom: 6 }}>
        对话行 ({lines.length})
      </label>

      {lines.map((line, i) => (
        <div
          key={i}
          style={{
            border: "1px solid #2a2a38",
            borderRadius: 6,
            padding: 8,
            marginBottom: 8,
            background: "#0e0e14",
          }}
        >
          <input
            placeholder="角色 id（留空=旁白）"
            value={line.character ?? ""}
            onChange={(e) => {
              const next = [...lines];
              next[i] = { ...line, character: e.target.value || undefined };
              setLines(next);
            }}
            style={{ ...inputStyle, marginBottom: 6 }}
          />
          <textarea
            placeholder="台词文本"
            value={line.text}
            onChange={(e) => {
              const next = [...lines];
              next[i] = { ...line, text: e.target.value };
              setLines(next);
            }}
            rows={2}
            style={{ ...inputStyle, resize: "vertical" }}
          />
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <button
              onClick={() => setLines(lines.filter((_, j) => j !== i))}
              style={miniBtn}
            >
              删除
            </button>
            {i > 0 && (
              <button
                onClick={() => {
                  const next = [...lines];
                  [next[i - 1], next[i]] = [next[i], next[i - 1]];
                  setLines(next);
                }}
                style={miniBtn}
              >
                ↑
              </button>
            )}
          </div>
        </div>
      ))}

      <button
        onClick={() => setLines([...lines, { text: "" }])}
        style={{ ...miniBtn, width: "100%", padding: 8 }}
      >
        + 添加对话行
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
