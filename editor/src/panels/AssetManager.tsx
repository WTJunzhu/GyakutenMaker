import { useState } from "react";
import { useEditorStore } from "../store/editorStore";
import type { EvidenceDef, CharacterDef, BackgroundDef } from "../types/case";

type Tab = "evidence" | "characters" | "backgrounds";

const TAB_META: Record<Tab, { label: string; color: string }> = {
  evidence: { label: "证物", color: "#2ecc40" },
  characters: { label: "角色", color: "#4a90d9" },
  backgrounds: { label: "背景", color: "#16a085" },
};

/**
 * 资源管理面板（模态）。集中增删证物/角色/背景，供节点引用下拉使用。
 * schema 对齐运行时 evidence.json / characters.json / locations.json。
 */
export function AssetManager({ onClose }: { onClose: () => void }) {
  const caseData = useEditorStore((s) => s.caseData);
  const upsertEvidence = useEditorStore((s) => s.upsertEvidence);
  const deleteEvidence = useEditorStore((s) => s.deleteEvidence);
  const upsertCharacter = useEditorStore((s) => s.upsertCharacter);
  const deleteCharacter = useEditorStore((s) => s.deleteCharacter);
  const upsertBackground = useEditorStore((s) => s.upsertBackground);
  const deleteBackground = useEditorStore((s) => s.deleteBackground);
  const [tab, setTab] = useState<Tab>("evidence");

  if (!caseData) return null;
  const assets = caseData.assets ?? { evidence: {}, characters: {}, backgrounds: {} };

  const evidence = Object.values(assets.evidence);
  const characters = Object.values(assets.characters);
  const backgrounds = Object.values(assets.backgrounds);

  const newId = (prefix: string, existing: Record<string, unknown>) => {
    let i = 1;
    while (existing[`${prefix}_${i}`]) i += 1;
    return `${prefix}_${i}`;
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={header}>
          <strong style={{ color: "#ffcc00" }}>资源管理</strong>
          <button style={closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Tab 切换 */}
        <div style={{ display: "flex", gap: 6, padding: "8px 12px", borderBottom: "1px solid #2a2a38" }}>
          {(Object.keys(TAB_META) as Tab[]).map((t) => {
            const count =
              t === "evidence" ? evidence.length : t === "characters" ? characters.length : backgrounds.length;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  ...tabBtn,
                  background: tab === t ? TAB_META[t].color : "#2a2a38",
                  color: tab === t ? "#fff" : "#ccc",
                }}
              >
                {TAB_META[t].label} ({count})
              </button>
            );
          })}
        </div>

        <div style={body}>
          {tab === "evidence" && (
            <EvidenceList
              items={evidence}
              onSave={(def, oldId) => {
                if (!upsertEvidence(def, oldId)) alert("ID 已存在或为空");
              }}
              onDelete={deleteEvidence}
              onAdd={() =>
                upsertEvidence({ id: newId("evidence", assets.evidence), name: "新证物" })
              }
            />
          )}
          {tab === "characters" && (
            <CharacterList
              items={characters}
              onSave={(def, oldId) => {
                if (!upsertCharacter(def, oldId)) alert("ID 已存在或为空");
              }}
              onDelete={deleteCharacter}
              onAdd={() =>
                upsertCharacter({ id: newId("char", assets.characters), name: "新角色" })
              }
            />
          )}
          {tab === "backgrounds" && (
            <BackgroundList
              items={backgrounds}
              onSave={(def, oldId) => {
                if (!upsertBackground(def, oldId)) alert("ID 已存在或为空");
              }}
              onDelete={deleteBackground}
              onAdd={() =>
                upsertBackground({ id: newId("bg", assets.backgrounds), name: "新背景" })
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** 证物列表 */
function EvidenceList({
  items,
  onSave,
  onDelete,
  onAdd,
}: {
  items: EvidenceDef[];
  onSave: (def: EvidenceDef, oldId: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div>
      {items.map((ev) => (
        <div key={ev.id} style={card}>
          <div style={row}>
            <LabeledInput label="ID" value={ev.id} onBlur={(v) => onSave({ ...ev, id: v }, ev.id)} />
            <LabeledInput label="名称" value={ev.name} onBlur={(v) => onSave({ ...ev, name: v }, ev.id)} />
          </div>
          <LabeledTextarea
            label="描述"
            value={ev.description ?? ""}
            onBlur={(v) => onSave({ ...ev, description: v || undefined }, ev.id)}
          />
          <LabeledInput
            label="图标路径 (icon)"
            value={ev.icon ?? ""}
            placeholder="images/evidence/xxx.png"
            onBlur={(v) => onSave({ ...ev, icon: v || undefined }, ev.id)}
          />
          <button style={delBtn} onClick={() => onDelete(ev.id)}>
            删除
          </button>
        </div>
      ))}
      <button style={addBtn} onClick={onAdd}>
        + 添加证物
      </button>
    </div>
  );
}

/** 角色列表 */
function CharacterList({
  items,
  onSave,
  onDelete,
  onAdd,
}: {
  items: CharacterDef[];
  onSave: (def: CharacterDef, oldId: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div>
      {items.map((ch) => (
        <div key={ch.id} style={card}>
          <div style={row}>
            <LabeledInput label="ID" value={ch.id} onBlur={(v) => onSave({ ...ch, id: v }, ch.id)} />
            <LabeledInput label="名称" value={ch.name} onBlur={(v) => onSave({ ...ch, name: v }, ch.id)} />
          </div>
          <div style={row}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>名字颜色</label>
              <input
                type="color"
                value={ch.color ?? "#ffffff"}
                onChange={(e) => onSave({ ...ch, color: e.target.value }, ch.id)}
                style={{ width: "100%", height: 30, background: "#0e0e14", border: "1px solid #333", borderRadius: 4 }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>站位</label>
              <select
                value={ch.position ?? ""}
                onChange={(e) =>
                  onSave({ ...ch, position: (e.target.value || undefined) as CharacterDef["position"] }, ch.id)
                }
                style={inp}
              >
                <option value="">未设</option>
                <option value="left">左 left</option>
                <option value="center">中 center</option>
                <option value="right">右 right</option>
              </select>
            </div>
          </div>
          <LabeledInput
            label="打字音 (beep_sfx)"
            value={ch.beep_sfx ?? ""}
            placeholder="preset:defense"
            onBlur={(v) => onSave({ ...ch, beep_sfx: v || undefined }, ch.id)}
          />
          <button style={delBtn} onClick={() => onDelete(ch.id)}>
            删除
          </button>
        </div>
      ))}
      <button style={addBtn} onClick={onAdd}>
        + 添加角色
      </button>
    </div>
  );
}

/** 背景列表 */
function BackgroundList({
  items,
  onSave,
  onDelete,
  onAdd,
}: {
  items: BackgroundDef[];
  onSave: (def: BackgroundDef, oldId: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div>
      {items.map((bg) => (
        <div key={bg.id} style={card}>
          <div style={row}>
            <LabeledInput label="ID" value={bg.id} onBlur={(v) => onSave({ ...bg, id: v }, bg.id)} />
            <LabeledInput label="名称" value={bg.name} onBlur={(v) => onSave({ ...bg, name: v }, bg.id)} />
          </div>
          <LabeledInput
            label="图片路径 (image)"
            value={bg.image ?? ""}
            placeholder="images/bg/xxx.png"
            onBlur={(v) => onSave({ ...bg, image: v || undefined }, bg.id)}
          />
          <button style={delBtn} onClick={() => onDelete(bg.id)}>
            删除
          </button>
        </div>
      ))}
      <button style={addBtn} onClick={onAdd}>
        + 添加背景
      </button>
    </div>
  );
}

/** 失焦提交的受控输入 */
function LabeledInput({
  label,
  value,
  placeholder,
  onBlur,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onBlur: (v: string) => void;
}) {
  return (
    <div style={{ flex: 1 }}>
      <label style={lbl}>{label}</label>
      <input
        key={value}
        defaultValue={value}
        placeholder={placeholder}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v !== value) onBlur(v);
        }}
        style={inp}
      />
    </div>
  );
}

function LabeledTextarea({
  label,
  value,
  onBlur,
}: {
  label: string;
  value: string;
  onBlur: (v: string) => void;
}) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      <textarea
        key={value}
        defaultValue={value}
        rows={2}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v !== value) onBlur(v);
        }}
        style={{ ...inp, resize: "vertical" }}
      />
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "grid",
  placeItems: "center",
  zIndex: 2000,
};
const modal: React.CSSProperties = {
  width: 560,
  maxWidth: "90vw",
  maxHeight: "85vh",
  display: "flex",
  flexDirection: "column",
  background: "#16161e",
  border: "1px solid #333",
  borderRadius: 10,
  overflow: "hidden",
  color: "#eee",
};
const header: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 12px",
  borderBottom: "1px solid #2a2a38",
};
const closeBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#888",
  cursor: "pointer",
  fontSize: 16,
};
const body: React.CSSProperties = { padding: 12, overflowY: "auto" };
const tabBtn: React.CSSProperties = {
  border: "none",
  borderRadius: 4,
  padding: "6px 12px",
  cursor: "pointer",
  fontSize: 13,
};
const card: React.CSSProperties = {
  border: "1px solid #2a2a38",
  borderRadius: 6,
  padding: 10,
  marginBottom: 10,
  background: "#12121a",
};
const row: React.CSSProperties = { display: "flex", gap: 8, marginBottom: 6 };
const lbl: React.CSSProperties = { display: "block", fontSize: 11, color: "#999", marginBottom: 3 };
const inp: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "#0e0e14",
  border: "1px solid #333",
  borderRadius: 4,
  color: "#eee",
  padding: "6px 8px",
  fontSize: 13,
};
const addBtn: React.CSSProperties = {
  width: "100%",
  background: "#2a2a38",
  border: "1px dashed #555",
  borderRadius: 4,
  color: "#ccc",
  padding: 8,
  cursor: "pointer",
  fontSize: 13,
};
const delBtn: React.CSSProperties = {
  background: "#c0392b",
  border: "none",
  borderRadius: 4,
  color: "#fff",
  padding: "4px 12px",
  cursor: "pointer",
  fontSize: 12,
  marginTop: 4,
};
