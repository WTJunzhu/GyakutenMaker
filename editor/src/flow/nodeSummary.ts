import type { CaseNode } from "../types/case";

/** 生成节点卡片上的一行摘要文本 */
export function nodeSummary(node: CaseNode): string {
  switch (node.type) {
    case "dialogue": {
      const first = node.lines?.[0]?.text ?? "";
      const n = node.lines?.length ?? 0;
      return n > 1 ? `${first}  …(${n}句)` : first;
    }
    case "get_evidence":
      return `证据: ${(node.evidence_ids ?? []).join(", ") || "（空）"}`;
    case "set_flag":
      return `${node.key} = ${String(node.value)}`;
    case "penalty":
      return `扣 ${node.amount ?? 1} 血`;
    case "testimony":
      return `${node.title ?? ""}  (${node.stmts?.length ?? 0} 条证言)`;
    case "investigation":
      return `${node.location_id ?? ""}  (${node.hotspots?.length ?? 0} 热点)`;
    case "talk":
      return `${node.npc_id ?? ""}  (${node.topics?.length ?? 0} 话题)`;
    case "choice":
      return `${node.prompt ?? ""}  (${node.options?.length ?? 0} 选项)`;
    default:
      return "";
  }
}
