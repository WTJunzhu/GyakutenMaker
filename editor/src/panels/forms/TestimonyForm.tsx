import { useState } from "react";
import { useEditorStore } from "../../store/editorStore";
import type {
  CaseNode,
  PressHandler,
  PresentHandler,
  DialogueLine,
} from "../../types/case";
import { Field, inputStyle } from "../PropertyPanel";
import { LineListEditor } from "./LineListEditor";

/**
 * testimony 节点可视化表单 —— 逆转裁判核心玩法。
 *
 * 数据结构（对齐运行时 exec_testimony）：
 *   stmts: string[]                        证言逐句
 *   press_handlers: { "1-based序号": { lines } }      追问某句 → 台词
 *   present_handlers: { "1-based序号": {               对某句举证
 *       correct_evidence: string[],
 *       on_correct: { lines, penalty?, next? }
 *   }}
 *
 * UI：每条证言一张卡片，可展开编辑「追问」与「举证」。
 */
export function TestimonyForm({ nodeId, node }: { nodeId: string; node: CaseNode }) {
  const updateNode = useEditorStore((s) => s.updateNode);
  const caseData = useEditorStore((s) => s.caseData);
  const [expanded, setExpanded] = useState<number | null>(null);

  const stmts = node.stmts ?? [];
  const pressH = (node.press_handlers ?? {}) as Record<string, PressHandler>;
  const presentH = (node.present_handlers ?? {}) as Record<string, PresentHandler>;

  const nodeIds = caseData ? Object.keys(caseData.nodes).filter((id) => id !== nodeId) : [];

  const setStmts = (next: string[]) => updateNode(nodeId, { stmts: next });

  const setPress = (next: Record<string, PressHandler>) =>
    updateNode(nodeId, { press_handlers: next });
  const setPresent = (next: Record<string, PresentHandler>) =>
    updateNode(nodeId, { present_handlers: next });

  /** 删除一条证言后，同步平移所有 1-based handler 的 key */
  const removeStmt = (idx: number) => {
    setStmts(stmts.filter((_, j) => j !== idx));
    const shift = <T,>(h: Record<string, T>): Record<string, T> => {
      const out: Record<string, T> = {};
      for (const [k, v] of Object.entries(h)) {
        const n = parseInt(k, 10);
        if (isNaN(n)) { out[k] = v; continue; }
        if (n - 1 === idx) continue; // 删掉该句的 handler
        out[n - 1 > idx ? String(n - 1) : k] = v;
      }
      return out;
    };
    setPress(shift(pressH));
    setPresent(shift(presentH));
  };

  return (
    <div>
      <Field label="证言标题">
        <input
          value={node.title ?? ""}
          onChange={(e) => updateNode(nodeId, { title: e.target.value })}
          style={inputStyle}
        />
      </Field>
      <Field label="证人 id（可选）">
        <input
          value={node.witness ?? ""}
          onChange={(e) => updateNode(nodeId, { witness: e.target.value || undefined })}
          style={inputStyle}
        />
      </Field>

      <label style={{ display: "block", fontSize: 12, color: "#999", margin: "10px 0 6px" }}>
        证言逐句 ({stmts.length}) — 点「追问 / 举证」展开配置
      </label>

      {stmts.map((stmt, i) => {
        const seq = String(i + 1); // 1-based key
        const hasPress = !!pressH[seq];
        const hasPresent = !!presentH[seq];
        const isOpen = expanded === i;

        return (
          <div
            key={i}
            style={{
              border: `1px solid ${isOpen ? "#f39c12" : "#2a2a38"}`,
              borderRadius: 6,
              marginBottom: 8,
              background: "#12121a",
            }}
          >
            <div style={{ padding: 8 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                <span style={{ color: "#f39c12", fontSize: 12, paddingTop: 6 }}>#{i + 1}</span>
                <textarea
                  value={stmt}
                  onChange={(e) => {
                    const next = [...stmts];
                    next[i] = e.target.value;
                    setStmts(next);
                  }}
                  rows={2}
                  style={{ ...inputStyle, resize: "vertical", flex: 1 }}
                />
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                <button
                  onClick={() => setExpanded(isOpen ? null : i)}
                  style={{ ...tag, background: hasPress ? "#2980b9" : "#2a2a38" }}
                >
                  追问{hasPress ? " ●" : ""}
                </button>
                <button
                  onClick={() => setExpanded(isOpen ? null : i)}
                  style={{ ...tag, background: hasPresent ? "#c0392b" : "#2a2a38" }}
                >
                  举证{hasPresent ? " ●" : ""}
                </button>
                <button onClick={() => removeStmt(i)} style={tag}>
                  删除
                </button>
                {i > 0 && (
                  <button
                    onClick={() => {
                      const next = [...stmts];
                      [next[i - 1], next[i]] = [next[i], next[i - 1]];
                      setStmts(next);
                    }}
                    style={tag}
                  >
                    ↑
                  </button>
                )}
              </div>
            </div>

            {isOpen && (
              <div style={{ borderTop: "1px solid #2a2a38", padding: 8 }}>
                {/* 追问 */}
                <PressEditor
                  seq={seq}
                  handler={pressH[seq]}
                  onChange={(h) => {
                    const next = { ...pressH };
                    if (h) next[seq] = h;
                    else delete next[seq];
                    setPress(next);
                  }}
                />
                {/* 举证 */}
                <PresentEditor
                  seq={seq}
                  handler={presentH[seq]}
                  nodeIds={nodeIds}
                  onChange={(h) => {
                    const next = { ...presentH };
                    if (h) next[seq] = h;
                    else delete next[seq];
                    setPresent(next);
                  }}
                />
              </div>
            )}
          </div>
        );
      })}

      <button
        onClick={() => setStmts([...stmts, "新证言"])}
        style={{ ...tag, width: "100%", padding: 8, background: "#f39c12", color: "#000" }}
      >
        + 添加证言
      </button>
    </div>
  );
}

/** 追问编辑：勾选启用后编辑触发的台词 */
function PressEditor({
  seq,
  handler,
  onChange,
}: {
  seq: string;
  handler?: PressHandler;
  onChange: (h: PressHandler | null) => void;
}) {
  const enabled = !!handler;
  return (
    <div style={sub}>
      <label style={subTitle}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked ? { lines: [{ text: "" }] } : null)}
        />{" "}
        追问第 {seq} 句（玩家「质问」时触发）
      </label>
      {enabled && (
        <LineListEditor
          lines={handler!.lines ?? []}
          onChange={(lines: DialogueLine[]) => onChange({ ...handler, lines })}
        />
      )}
    </div>
  );
}

/** 举证编辑：正确证据（逗号分隔）+ 举证成功后的台词/扣血/跳转 */
function PresentEditor({
  seq,
  handler,
  nodeIds,
  onChange,
}: {
  seq: string;
  handler?: PresentHandler;
  nodeIds: string[];
  onChange: (h: PresentHandler | null) => void;
}) {
  const enabled = !!handler;
  const oc = handler?.on_correct ?? {};
  return (
    <div style={sub}>
      <label style={subTitle}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) =>
            onChange(
              e.target.checked
                ? { correct_evidence: [], on_correct: { lines: [{ text: "" }] } }
                : null,
            )
          }
        />{" "}
        对第 {seq} 句举证（出示证据揭穿矛盾）
      </label>

      {enabled && (
        <>
          <label style={{ display: "block", fontSize: 12, color: "#999", margin: "6px 0 4px" }}>
            正确证据 id（多个用逗号分隔）
          </label>
          <input
            value={(handler!.correct_evidence ?? []).join(", ")}
            placeholder="如 thinker, autopsy_report"
            onChange={(e) =>
              onChange({
                ...handler,
                correct_evidence: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            style={inputStyle}
          />

          <label style={{ display: "block", fontSize: 12, color: "#999", margin: "8px 0 4px" }}>
            举证成功台词
          </label>
          <LineListEditor
            lines={oc.lines ?? []}
            onChange={(lines) =>
              onChange({ ...handler, on_correct: { ...oc, lines } })
            }
          />

          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#999" }}>成功扣血</span>
            <input
              type="number"
              min={0}
              value={oc.penalty ?? 0}
              onChange={(e) =>
                onChange({
                  ...handler,
                  on_correct: { ...oc, penalty: Number(e.target.value) || undefined },
                })
              }
              style={{ ...inputStyle, width: 70 }}
            />
            <span style={{ fontSize: 12, color: "#999" }}>成功后跳转</span>
            <select
              value={oc.next ?? ""}
              onChange={(e) =>
                onChange({
                  ...handler,
                  on_correct: { ...oc, next: e.target.value || undefined },
                })
              }
              style={{ ...inputStyle, flex: 1 }}
            >
              <option value="">（默认 next）</option>
              {nodeIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </div>
        </>
      )}
    </div>
  );
}

const tag: React.CSSProperties = {
  background: "#2a2a38",
  border: "none",
  borderRadius: 4,
  color: "#eee",
  padding: "4px 10px",
  cursor: "pointer",
  fontSize: 12,
};

const sub: React.CSSProperties = {
  marginTop: 8,
  padding: 8,
  background: "#0e0e14",
  borderRadius: 6,
  border: "1px solid #222",
};

const subTitle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "#ccc",
  marginBottom: 6,
};
