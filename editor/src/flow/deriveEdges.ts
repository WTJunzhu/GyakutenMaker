import type { CaseData } from "../types/case";
import type { Edge } from "@xyflow/react";

/**
 * 从 case.json 派生出画布连线：
 *  - 每个节点的 next → 一条边
 *  - choice 节点的每个 option.next → 一条带标签的边
 */
export function deriveEdges(data: CaseData): Edge[] {
  const edges: Edge[] = [];
  for (const [id, node] of Object.entries(data.nodes)) {
    if (node.next && data.nodes[node.next]) {
      edges.push({
        id: `${id}->${node.next}`,
        source: id,
        target: node.next,
        animated: false,
      });
    }
    if (node.type === "choice" && node.options) {
      node.options.forEach((opt, i) => {
        if (opt.next && data.nodes[opt.next]) {
          edges.push({
            id: `${id}-opt${i}->${opt.next}`,
            source: id,
            target: opt.next,
            label: opt.text || `选项${i + 1}`,
            animated: true,
          });
        }
      });
    }
  }
  return edges;
}
