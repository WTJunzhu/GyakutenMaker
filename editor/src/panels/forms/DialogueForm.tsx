import { useEditorStore } from "../../store/editorStore";
import type { CaseNode } from "../../types/case";
import { Field, inputStyle } from "../PropertyPanel";
import { LineListEditor } from "./LineListEditor";
import { AssetSelect } from "./AssetSelect";

/** dialogue 节点专属表单：可视化编辑对话行列表 */
export function DialogueForm({ nodeId, node }: { nodeId: string; node: CaseNode }) {
  const updateNode = useEditorStore((s) => s.updateNode);
  const lines = node.lines ?? [];

  return (
    <div>
      <Field label="场景背景 (scene)">
        <AssetSelect
          kind="backgrounds"
          asScene
          value={node.scene}
          emptyLabel="（不切换背景）"
          onChange={(v) => updateNode(nodeId, { scene: v })}
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

      <LineListEditor
        lines={lines}
        onChange={(next) => updateNode(nodeId, { lines: next })}
        label="对话行"
      />
    </div>
  );
}
