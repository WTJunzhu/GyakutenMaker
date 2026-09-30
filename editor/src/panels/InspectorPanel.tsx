import { useMemo, useState } from "react";
import { useEditorStore } from "../store/editorStore";
import { validateCase } from "../analysis/validate";
import type { Issue } from "../analysis/validate";
import { buildRefIndex } from "../analysis/references";
import type { RefKind } from "../analysis/references";

const KIND_LABEL: Record<RefKind, string> = {
  evidence: "证物",
  character: "角色",
  background: "背景",
};

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: "6px 14px",
  border: "none",
  background: active ? "#2c3440" : "transparent",
  color: active ? "#e8eef5" : "#8a97a6",
  cursor: "pointer",
  fontSize: 13,
  borderRadius: "4px 4px 0 0",
});

/** 校验问题列表 */
function IssueList({ issues }: { issues: Issue[] }) {
  const selectNode = useEditorStore((s) => s.selectNode);
  if (issues.length === 0) {
    return <div style={{ padding: 12, color: "#4caf50", fontSize: 13 }}>✓ 未发现问题</div>;
  }
  return (
    <div style={{ overflowY: "auto", flex: 1 }}>
      {issues.map((it, i) => (
        <div
          key={i}
          onClick={() => it.nodeId && selectNode(it.nodeId)}
          style={{
            padding: "6px 12px",
            fontSize: 12.5,
            display: "flex",
            gap: 8,
            alignItems: "baseline",
            cursor: it.nodeId ? "pointer" : "default",
            borderBottom: "1px solid #232a34",
          }}
        >
          <span style={{ color: it.level === "error" ? "#e74c3c" : "#f39c12" }}>
            {it.level === "error" ? "✖" : "⚠"}
          </span>
          {it.nodeId && (
            <code style={{ color: "#6fa8dc", flexShrink: 0 }}>{it.nodeId}</code>
          )}
          <span style={{ color: "#c3ccd6" }}>{it.message}</span>
        </div>
      ))}
    </div>
  );
}

/** 引用追踪：选一个资源，看它在哪获得、在哪使用 */
function RefTracker() {
  const caseData = useEditorStore((s) => s.caseData);
  const selectNode = useEditorStore((s) => s.selectNode);
  const [kind, setKind] = useState<RefKind>("evidence");
  const [id, setId] = useState("");

  const assets = caseData?.assets;
  const options = useMemo(() => {
    if (!assets) return [];
    const map =
      kind === "evidence"
        ? assets.evidence
        : kind === "character"
          ? assets.characters
          : assets.backgrounds;
    return Object.values(map).map((d) => ({ id: d.id, name: d.name }));
  }, [assets, kind]);

  const sites = useMemo(() => {
    if (!caseData || !id) return [];
    return buildRefIndex(caseData).byId[kind][id] ?? [];
  }, [caseData, kind, id]);

  const defines = sites.filter((s) => s.role === "define");
  const uses = sites.filter((s) => s.role === "use");

  return (
    <div style={{ padding: 10, overflowY: "auto", flex: 1 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <select
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as RefKind);
            setId("");
          }}
          style={selectCss}
        >
          {(Object.keys(KIND_LABEL) as RefKind[]).map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
        <select value={id} onChange={(e) => setId(e.target.value)} style={{ ...selectCss, flex: 1 }}>
          <option value="">— 选择要追踪的{KIND_LABEL[kind]} —</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} ({o.id})
            </option>
          ))}
        </select>
      </div>

      {!id ? (
        <div style={{ color: "#6b7785", fontSize: 12.5 }}>
          选择一个{KIND_LABEL[kind]}，查看它在流程中的所有出现位置。
        </div>
      ) : (
        <>
          {kind === "evidence" ? (
            <>
              <RefGroup
                title="获得处"
                hint="玩家在这里拿到它"
                sites={defines}
                empty="⚠ 流程中从未获得 —— 举证将无法通过"
                emptyColor="#e74c3c"
                onPick={selectNode}
              />
              <RefGroup
                title="使用处"
                sites={uses}
                empty="暂无使用"
                emptyColor="#6b7785"
                onPick={selectNode}
              />
            </>
          ) : (
            <RefGroup
              title="出现处"
              sites={sites}
              empty="暂无引用"
              emptyColor="#6b7785"
              onPick={selectNode}
            />
          )}
        </>
      )}
    </div>
  );
}

function RefGroup({
  title,
  hint,
  sites,
  empty,
  emptyColor,
  onPick,
}: {
  title: string;
  hint?: string;
  sites: { nodeId: string; path: string }[];
  empty: string;
  emptyColor: string;
  onPick: (id: string) => void;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: "#8a97a6", marginBottom: 4 }}>
        {title}
        {hint && <span style={{ color: "#5c6774" }}>（{hint}）</span>}
        <span style={{ color: "#5c6774" }}> · {sites.length}</span>
      </div>
      {sites.length === 0 ? (
        <div style={{ fontSize: 12.5, color: emptyColor, paddingLeft: 6 }}>{empty}</div>
      ) : (
        sites.map((s, i) => (
          <div
            key={i}
            onClick={() => onPick(s.nodeId)}
            style={{
              fontSize: 12.5,
              padding: "3px 6px",
              cursor: "pointer",
              color: "#c3ccd6",
              display: "flex",
              gap: 8,
            }}
          >
            <code style={{ color: "#6fa8dc" }}>{s.nodeId}</code>
            <span style={{ color: "#8a97a6" }}>{s.path}</span>
          </div>
        ))
      )}
    </div>
  );
}

const selectCss: React.CSSProperties = {
  background: "#1b2129",
  color: "#e8eef5",
  border: "1px solid #333c49",
  borderRadius: 4,
  padding: "4px 6px",
  fontSize: 12.5,
};

export function InspectorPanel() {
  const caseData = useEditorStore((s) => s.caseData);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"issues" | "refs">("issues");

  const issues = useMemo(() => (caseData ? validateCase(caseData) : []), [caseData]);
  const errors = issues.filter((i) => i.level === "error").length;
  const warns = issues.length - errors;

  if (!caseData) return null;

  return (
    <div
      style={{
        borderTop: "1px solid #2a323d",
        background: "#171c23",
        display: "flex",
        flexDirection: "column",
        height: open ? 260 : 34,
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 8px", height: 34 }}>
        <button onClick={() => setOpen(!open)} style={{ ...tabStyle(false), padding: "4px 8px" }}>
          {open ? "▼" : "▲"}
        </button>
        <button onClick={() => { setOpen(true); setTab("issues"); }} style={tabStyle(open && tab === "issues")}>
          检查
          {errors > 0 && <span style={{ color: "#e74c3c" }}> ✖{errors}</span>}
          {warns > 0 && <span style={{ color: "#f39c12" }}> ⚠{warns}</span>}
          {issues.length === 0 && <span style={{ color: "#4caf50" }}> ✓</span>}
        </button>
        <button onClick={() => { setOpen(true); setTab("refs"); }} style={tabStyle(open && tab === "refs")}>
          引用追踪
        </button>
      </div>
      {open && (tab === "issues" ? <IssueList issues={issues} /> : <RefTracker />)}
    </div>
  );
}
