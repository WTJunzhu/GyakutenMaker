import { useRef } from "react";
import { useEditorStore } from "../store/editorStore";
import { NODE_META, type CaseData, type NodeType } from "../types/case";

const ADD_TYPES = Object.keys(NODE_META) as NodeType[];

export function Toolbar() {
  const caseData = useEditorStore((s) => s.caseData);
  const dirty = useEditorStore((s) => s.dirty);
  const newCase = useEditorStore((s) => s.newCase);
  const loadCase = useEditorStore((s) => s.loadCase);
  const addNode = useEditorStore((s) => s.addNode);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as CaseData;
        if (!data.nodes || !data.entry) throw new Error("缺少 nodes / entry 字段");
        // 给没有画布坐标的节点补默认布局
        let i = 0;
        for (const node of Object.values(data.nodes)) {
          if (!node._editor) {
            node._editor = { x: 120 + (i % 4) * 240, y: 100 + Math.floor(i / 4) * 160 };
          }
          i += 1;
        }
        loadCase(data);
      } catch (e) {
        alert("导入失败: " + (e as Error).message);
      }
    };
    reader.readAsText(file);
  };

  const handleExport = () => {
    if (!caseData) return;
    const blob = new Blob([JSON.stringify(caseData, null, 4)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "case.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={barStyle}>
      <strong style={{ color: "#ffcc00", marginRight: 12 }}>逆转裁判制作器</strong>

      <button style={btn} onClick={newCase}>
        新建案件
      </button>
      <button style={btn} onClick={() => fileRef.current?.click()}>
        导入 case.json
      </button>
      <button style={btn} onClick={handleExport} disabled={!caseData}>
        导出 case.json
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImport(f);
          e.target.value = "";
        }}
      />

      {caseData && (
        <>
          <div style={{ width: 1, height: 24, background: "#333", margin: "0 8px" }} />
          <span style={{ color: "#888", fontSize: 12 }}>添加节点:</span>
          {ADD_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => addNode(t, 200 + Math.random() * 200, 200 + Math.random() * 150)}
              style={{ ...btn, background: NODE_META[t].color, color: "#fff", padding: "4px 8px" }}
            >
              {NODE_META[t].label}
            </button>
          ))}
        </>
      )}

      <div style={{ flex: 1 }} />
      {caseData && (
        <span style={{ color: dirty ? "#f39c12" : "#2ecc40", fontSize: 12 }}>
          {caseData.title} {dirty ? "• 未保存" : "• 已同步"}
        </span>
      )}
    </div>
  );
}

const barStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  background: "#16161e",
  borderBottom: "1px solid #2a2a38",
  flexWrap: "wrap",
};

const btn: React.CSSProperties = {
  background: "#2a2a38",
  border: "none",
  borderRadius: 4,
  color: "#eee",
  padding: "6px 10px",
  cursor: "pointer",
  fontSize: 13,
};
