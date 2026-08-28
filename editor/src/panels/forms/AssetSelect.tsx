import { useEditorStore } from "../../store/editorStore";

type AssetKind = "evidence" | "characters" | "backgrounds";

/**
 * 资源引用下拉：从 case.assets 读取选项，显示「名称 (id)」，值为 id。
 * 替代原先手敲 id 的输入框，杜绝拼写错误。
 * - kind="backgrounds" 且 asScene 时，值按 "bg <id>" 存取（对齐 scene 字段格式）。
 */
export function AssetSelect({
  kind,
  value,
  onChange,
  allowEmpty = true,
  emptyLabel = "（无）",
  asScene = false,
  style,
}: {
  kind: AssetKind;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  allowEmpty?: boolean;
  emptyLabel?: string;
  asScene?: boolean;
  style?: React.CSSProperties;
}) {
  const caseData = useEditorStore((s) => s.caseData);
  const assets = caseData?.assets;
  const map = assets?.[kind] ?? {};
  const items = Object.values(map) as { id: string; name: string }[];

  // scene 模式：value 形如 "bg apartment"，下拉里比对的是 id 部分
  const currentId = asScene && value ? sceneToId(value) : value;
  const known = currentId ? currentId in map : false;

  return (
    <select
      value={known ? currentId : "__custom__"}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "") onChange(undefined);
        else if (v === "__custom__") {
          /* 保持原值不变 */
        } else onChange(asScene ? `bg ${v}` : v);
      }}
      style={style}
    >
      {allowEmpty && <option value="">{emptyLabel}</option>}
      {items.map((it) => (
        <option key={it.id} value={it.id}>
          {it.name} ({it.id})
        </option>
      ))}
      {/* 值存在但资源表里没有 → 显示为未知项，提示去资源管理补充 */}
      {currentId && !known && (
        <option value="__custom__">⚠ {value}（未在资源库，请去资源管理添加）</option>
      )}
    </select>
  );
}

function sceneToId(scene: string): string {
  const parts = scene.split(/\s+/);
  return parts.length === 2 && parts[0] === "bg" ? parts[1] : scene;
}
