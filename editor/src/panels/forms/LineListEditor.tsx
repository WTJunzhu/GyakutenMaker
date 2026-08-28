import type { DialogueLine } from "../../types/case";
import { AssetSelect } from "./AssetSelect";

const box: React.CSSProperties = {
  border: "1px solid #2a2a38",
  borderRadius: 6,
  padding: 8,
  marginBottom: 8,
  background: "#0e0e14",
};

const input: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "#0e0e14",
  border: "1px solid #333",
  borderRadius: 4,
  color: "#eee",
  padding: "6px 8px",
  fontSize: 13,
};

const miniBtn: React.CSSProperties = {
  background: "#2a2a38",
  border: "none",
  borderRadius: 4,
  color: "#ccc",
  padding: "4px 10px",
  cursor: "pointer",
  fontSize: 12,
};

/**
 * 可复用的对话行列表编辑器。
 * 被 dialogue / testimony(追问·举证台词) / investigation(热点台词) 共用。
 */
export function LineListEditor({
  lines,
  onChange,
  label,
}: {
  lines: DialogueLine[];
  onChange: (next: DialogueLine[]) => void;
  label?: string;
}) {
  return (
    <div>
      {label && (
        <label style={{ display: "block", fontSize: 12, color: "#999", marginBottom: 6 }}>
          {label} ({lines.length})
        </label>
      )}

      {lines.map((line, i) => (
        <div key={i} style={box}>
          <AssetSelect
            kind="characters"
            value={line.character}
            emptyLabel="旁白（无角色）"
            onChange={(v) => {
              const next = [...lines];
              next[i] = { ...line, character: v };
              onChange(next);
            }}
            style={{ ...input, marginBottom: 6 }}
          />
          <textarea
            placeholder="台词文本"
            value={line.text}
            onChange={(e) => {
              const next = [...lines];
              next[i] = { ...line, text: e.target.value };
              onChange(next);
            }}
            rows={2}
            style={{ ...input, resize: "vertical" }}
          />
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <button onClick={() => onChange(lines.filter((_, j) => j !== i))} style={miniBtn}>
              删除
            </button>
            {i > 0 && (
              <button
                onClick={() => {
                  const next = [...lines];
                  [next[i - 1], next[i]] = [next[i], next[i - 1]];
                  onChange(next);
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
        onClick={() => onChange([...lines, { text: "" }])}
        style={{ ...miniBtn, width: "100%", padding: 8 }}
      >
        + 添加对话行
      </button>
    </div>
  );
}
