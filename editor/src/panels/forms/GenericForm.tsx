import { useEffect, useState } from "react";
import { useEditorStore } from "../../store/editorStore";
import type { CaseNode } from "../../types/case";

// 这些字段由通用区域（PropertyPanel）管理，不在 JSON 编辑器里重复暴露
const MANAGED = new Set(["type", "next", "_editor"]);

/**
 * 非 dialogue 节点的临时表单：以 JSON 方式编辑该节点的类型专属字段。
 * 后续会为 testimony / investigation / talk / choice 分别做可视化表单。
 */
export function GenericForm({ nodeId, node }: { nodeId: string; node: CaseNode }) {
  const updateNode = useEditorStore((s) => s.updateNode);

  const extract = (n: CaseNode) => {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(n)) if (!MANAGED.has(k)) obj[k] = v;
    return JSON.stringify(obj, null, 2);
  };

  const [text, setText] = useState(() => extract(node));
  const [err, setErr] = useState<string | null>(null);

  // 切换节点时重置
  useEffect(() => {
    setText(extract(node));
    setErr(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId]);

  const apply = () => {
    try {
      const parsed = JSON.parse(text);
      // 先清掉旧的类型专属字段，再写入新的
      const cleaned: Partial<CaseNode> = {};
      for (const k of Object.keys(node)) {
        if (!MANAGED.has(k)) (cleaned as Record<string, unknown>)[k] = undefined;
      }
      updateNode(nodeId, { ...cleaned, ...parsed });
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div>
      <label style={{ display: "block", fontSize: 12, color: "#999", marginBottom: 6 }}>
        类型专属字段 (JSON) — 可视化表单开发中
      </label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={14}
        spellCheck={false}
        style={{
          width: "100%",
          boxSizing: "border-box",
          background: "#0e0e14",
          border: `1px solid ${err ? "#c0392b" : "#333"}`,
          borderRadius: 4,
          color: "#9fe",
          fontFamily: "monospace",
          fontSize: 12,
          padding: 8,
          resize: "vertical",
        }}
      />
      {err && <div style={{ color: "#e74c3c", fontSize: 12, marginTop: 4 }}>{err}</div>}
      <button
        onClick={apply}
        style={{
          marginTop: 8,
          width: "100%",
          background: "#2980b9",
          border: "none",
          borderRadius: 4,
          color: "#fff",
          padding: 8,
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        应用修改
      </button>
    </div>
  );
}
