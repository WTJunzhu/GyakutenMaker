import { useState } from "react";
import { useEditorStore } from "../../store/editorStore";
import type { CaseNode, Hotspot } from "../../types/case";
import { Field, inputStyle } from "../PropertyPanel";
import { LineListEditor } from "./LineListEditor";

/**
 * investigation 节点可视化表单。
 *
 * 数据结构（对齐运行时 exec_investigation）：
 *   scene / location_id
 *   intro_lines: DialogueLine[]
 *   hotspots: [{ id, name, x, y, size_w, size_h, radius, lines, get_evidence }]
 */
export function InvestigationForm({ nodeId, node }: { nodeId: string; node: CaseNode }) {
  const updateNode = useEditorStore((s) => s.updateNode);
  const [expanded, setExpanded] = useState<number | null>(null);

  const hotspots = node.hotspots ?? [];
  const setHotspots = (next: Hotspot[]) => updateNode(nodeId, { hotspots: next });

  const patchHotspot = (i: number, patch: Partial<Hotspot>) => {
    const next = [...hotspots];
    next[i] = { ...next[i], ...patch };
    setHotspots(next);
  };

  return (
    <div>
      <Field label="场景 (scene，如 bg apartment)">
        <input
          value={node.scene ?? ""}
          onChange={(e) => updateNode(nodeId, { scene: e.target.value || undefined })}
          style={inputStyle}
        />
      </Field>
      <Field label="地点 id (location_id)">
        <input
          value={node.location_id ?? ""}
          onChange={(e) => updateNode(nodeId, { location_id: e.target.value || undefined })}
          style={inputStyle}
        />
      </Field>

      <label style={{ display: "block", fontSize: 12, color: "#999", margin: "10px 0 6px" }}>
        进入台词 (intro_lines)
      </label>
      <LineListEditor
        lines={node.intro_lines ?? []}
        onChange={(lines) => updateNode(nodeId, { intro_lines: lines })}
      />

      <label style={{ display: "block", fontSize: 12, color: "#999", margin: "12px 0 6px" }}>
        搜证热点 ({hotspots.length})
      </label>

      {hotspots.map((hs, i) => {
        const isOpen = expanded === i;
        return (
          <div
            key={i}
            style={{
              border: `1px solid ${isOpen ? "#16a085" : "#2a2a38"}`,
              borderRadius: 6,
              marginBottom: 8,
              background: "#12121a",
            }}
          >
            <div
              style={{
                padding: 8,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
              }}
              onClick={() => setExpanded(isOpen ? null : i)}
            >
              <span style={{ color: "#16a085", fontSize: 13 }}>
                🔍 {hs.name || hs.id || `热点${i + 1}`}
                {hs.get_evidence ? `  → ${hs.get_evidence}` : ""}
              </span>
              <span style={{ color: "#666", fontSize: 12 }}>{isOpen ? "▼" : "▶"}</span>
            </div>

            {isOpen && (
              <div style={{ borderTop: "1px solid #2a2a38", padding: 8 }}>
                <Row label="热点 id">
                  <input
                    value={hs.id ?? ""}
                    onChange={(e) => patchHotspot(i, { id: e.target.value })}
                    style={inputStyle}
                  />
                </Row>
                <Row label="显示名">
                  <input
                    value={hs.name ?? ""}
                    onChange={(e) => patchHotspot(i, { name: e.target.value || undefined })}
                    style={inputStyle}
                  />
                </Row>

                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  <NumField label="x" value={hs.x} onChange={(v) => patchHotspot(i, { x: v })} />
                  <NumField label="y" value={hs.y} onChange={(v) => patchHotspot(i, { y: v })} />
                  <NumField
                    label="半径"
                    value={hs.radius}
                    onChange={(v) => patchHotspot(i, { radius: v })}
                  />
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  <NumField
                    label="宽"
                    value={hs.size_w}
                    onChange={(v) => patchHotspot(i, { size_w: v })}
                  />
                  <NumField
                    label="高"
                    value={hs.size_h}
                    onChange={(v) => patchHotspot(i, { size_h: v })}
                  />
                </div>

                <Row label="调查获得证据 id（可选）">
                  <input
                    value={hs.get_evidence ?? ""}
                    placeholder="如 floor_plan"
                    onChange={(e) =>
                      patchHotspot(i, { get_evidence: e.target.value || undefined })
                    }
                    style={inputStyle}
                  />
                </Row>

                <label style={{ display: "block", fontSize: 12, color: "#999", margin: "6px 0" }}>
                  调查台词
                </label>
                <LineListEditor
                  lines={hs.lines ?? []}
                  onChange={(lines) => patchHotspot(i, { lines })}
                />

                <button
                  onClick={() => {
                    setHotspots(hotspots.filter((_, j) => j !== i));
                    setExpanded(null);
                  }}
                  style={{ ...delBtn, marginTop: 8 }}
                >
                  删除此热点
                </button>
              </div>
            )}
          </div>
        );
      })}

      <button
        onClick={() => {
          const id = `hotspot_${hotspots.length + 1}`;
          setHotspots([
            ...hotspots,
            { id, name: "新热点", x: 960, y: 540, size_w: 150, size_h: 150, radius: 120, lines: [] },
          ]);
          setExpanded(hotspots.length);
        }}
        style={{ ...addBtn, width: "100%" }}
      >
        + 添加搜证热点
      </button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label style={{ display: "block", fontSize: 12, color: "#999", marginBottom: 4 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ flex: 1 }}>
      <label style={{ display: "block", fontSize: 11, color: "#777", marginBottom: 2 }}>
        {label}
      </label>
      <input
        type="number"
        value={value ?? 0}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        style={{ ...inputStyle, padding: "4px 6px" }}
      />
    </div>
  );
}

const addBtn: React.CSSProperties = {
  background: "#16a085",
  border: "none",
  borderRadius: 4,
  color: "#fff",
  padding: 8,
  cursor: "pointer",
  fontSize: 13,
};

const delBtn: React.CSSProperties = {
  background: "#c0392b",
  border: "none",
  borderRadius: 4,
  color: "#fff",
  padding: "6px 12px",
  cursor: "pointer",
  fontSize: 12,
};
