// 引用索引 —— 节点对资源（证物/角色/背景）的引用关系。
//
// 核心设计：所有「引用点」的遍历只写一次（visitRefs），
// 收集索引、重命名传播、一致性校验三者复用同一遍历，
// 避免三处各写一遍扫描逻辑导致遗漏字段而不一致。
//
// 详见 node-system-design.md 第 5 节「引用追踪」。

import type { CaseData, CaseNode, DialogueLine } from "../types/case";

export type RefKind = "evidence" | "character" | "background";

/** 引用的语义角色：define=在此产生/获得，use=在此被使用 */
export type RefRole = "define" | "use";

/** 一处具体的引用 */
export interface RefSite {
  kind: RefKind;
  /** 被引用的资源 id */
  id: string;
  /** 引用发生在哪个节点 */
  nodeId: string;
  /** 人类可读的位置描述，如「对话第 2 行」 */
  path: string;
  role: RefRole;
}

/** 遍历回调；返回字符串表示把该引用改写为新值（用于重命名传播） */
type Visitor = (
  kind: RefKind,
  id: string,
  path: string,
  role: RefRole,
) => string | void;

/** scene 字段形如 "bg apartment"，取出背景 id */
export function sceneToBgId(scene?: string): string | undefined {
  if (!scene) return undefined;
  const parts = scene.trim().split(/\s+/);
  if (parts.length === 2 && parts[0] === "bg") return parts[1];
  return scene;
}

function bgIdToScene(id: string): string {
  return `bg ${id}`;
}

/**
 * 遍历单个节点的所有资源引用点。
 *
 * visit 返回新 id 时会**就地改写** node，因此调用方若不想改动原数据，
 * 需先自行深拷贝。
 */
export function visitNodeRefs(node: CaseNode, nodeId: string, visit: Visitor): void {
  const chr = (id: string | undefined, path: string, set: (v: string) => void) => {
    if (!id) return;
    const next = visit("character", id, path, "use");
    if (typeof next === "string") set(next);
  };
  const ev = (
    id: string | undefined,
    path: string,
    role: RefRole,
    set: (v: string) => void,
  ) => {
    if (!id) return;
    const next = visit("evidence", id, path, role);
    if (typeof next === "string") set(next);
  };
  const lines = (arr: DialogueLine[] | undefined, label: string) => {
    arr?.forEach((l, i) => {
      chr(l.character, `${label}第 ${i + 1} 行`, (v) => (l.character = v));
    });
  };

  // 背景（dialogue / investigation 的 scene）
  const bgId = sceneToBgId(node.scene);
  if (bgId) {
    const next = visit("background", bgId, "场景背景", "use");
    if (typeof next === "string") node.scene = bgIdToScene(next);
  }

  lines(node.lines, "对话");
  lines(node.intro_lines, "进入台词");

  chr(node.witness, "证人", (v) => (node.witness = v));
  chr(node.npc_id, "NPC", (v) => (node.npc_id = v));

  // get_evidence：证物的「获得处」
  node.evidence_ids?.forEach((id, i) => {
    ev(id, `获得证物 #${i + 1}`, "define", (v) => {
      node.evidence_ids![i] = v;
    });
  });

  // 证言：追问 / 举证
  for (const [k, h] of Object.entries(node.press_handlers ?? {})) {
    lines(h.lines, `第 ${k} 条证言追问`);
  }
  const ph = node.present_handlers;
  if (ph && !Array.isArray(ph)) {
    for (const [k, h] of Object.entries(ph)) {
      h.correct_evidence?.forEach((id, i) => {
        ev(id, `第 ${k} 条证言举证证物 #${i + 1}`, "use", (v) => {
          h.correct_evidence![i] = v;
        });
      });
      lines(h.on_correct?.lines, `第 ${k} 条证言举证成功`);
    }
  } else if (Array.isArray(ph)) {
    // talk 节点的 present_handlers 是数组形态
    ph.forEach((h, i) => {
      ev(h.evidence_id, `出示证物 #${i + 1}`, "use", (v) => (h.evidence_id = v));
      lines(h.lines, `出示证物 #${i + 1} 回应`);
    });
  }

  // 搜证热点：证物的另一个「获得处」
  node.hotspots?.forEach((hs, i) => {
    const label = hs.name || hs.id || `#${i + 1}`;
    lines(hs.lines, `热点「${label}」`);
    ev(hs.get_evidence, `热点「${label}」获得证物`, "define", (v) => {
      hs.get_evidence = v;
    });
  });

  // talk 主题
  node.topics?.forEach((t, i) => lines(t.lines, `话题「${t.name || i + 1}」`));

  void nodeId;
}

/** 全案引用索引 */
export interface RefIndex {
  /** 所有引用点 */
  sites: RefSite[];
  /** kind → id → 引用点 */
  byId: Record<RefKind, Record<string, RefSite[]>>;
}

export function buildRefIndex(data: CaseData): RefIndex {
  const sites: RefSite[] = [];
  for (const [nodeId, node] of Object.entries(data.nodes)) {
    visitNodeRefs(node, nodeId, (kind, id, path, role) => {
      sites.push({ kind, id, nodeId, path, role });
    });
  }
  const byId: RefIndex["byId"] = { evidence: {}, character: {}, background: {} };
  for (const s of sites) {
    (byId[s.kind][s.id] ??= []).push(s);
  }
  return { sites, byId };
}

/** 查询某个资源的所有引用点 */
export function refsOf(index: RefIndex, kind: RefKind, id: string): RefSite[] {
  return index.byId[kind][id] ?? [];
}

/**
 * 把所有对 `oldId` 的引用改写为 `newId`，返回改写后的 nodes 与影响处数。
 * 不修改入参（内部深拷贝）。
 */
export function renameRefs(
  nodes: Record<string, CaseNode>,
  kind: RefKind,
  oldId: string,
  newId: string,
): { nodes: Record<string, CaseNode>; count: number } {
  const copy = structuredClone(nodes);
  let count = 0;
  for (const [nodeId, node] of Object.entries(copy)) {
    visitNodeRefs(node, nodeId, (k, id) => {
      if (k === kind && id === oldId) {
        count += 1;
        return newId;
      }
    });
  }
  return { nodes: copy, count };
}
