// 一致性校验 —— 在预览/导出前发现会导致卡关或崩溃的问题。
//
// 分两类：
//   结构类：断链、孤儿、入口缺失、举证无正确答案
//   引用类：引用了不存在的资源、用到了流程里从未获得的证物（卡关）
//
// 详见 node-system-design.md 第 6 节「一致性校验」。

import type { CaseData, CaseNode } from "../types/case";
import { buildRefIndex } from "./references";

export type IssueLevel = "error" | "warning";

export interface Issue {
  level: IssueLevel;
  /** 问题分类，用于筛选 */
  code: string;
  message: string;
  /** 关联节点，点击可定位 */
  nodeId?: string;
}

/** 节点的所有出边目标（next + choice 各选项） */
export function outTargets(node: CaseNode): string[] {
  const out: string[] = [];
  if (node.next) out.push(node.next);
  for (const opt of node.options ?? []) if (opt.next) out.push(opt.next);
  const ph = node.present_handlers;
  if (ph && !Array.isArray(ph)) {
    for (const h of Object.values(ph)) {
      if (h.on_correct?.next) out.push(h.on_correct.next);
    }
  }
  return out;
}

/** 从 entry 出发可达的节点集合 */
function reachableFrom(data: CaseData, entry: string): Set<string> {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    const node = data.nodes[id];
    if (!node) continue;
    seen.add(id);
    for (const t of outTargets(node)) stack.push(t);
  }
  return seen;
}

/**
 * 计算「到达某节点时，玩家最少已持有哪些证物」。
 *
 * 用不动点迭代求各节点入口处的证物交集（must-have 分析）：
 * 只有在**所有**到达路径上都已获得的证物才算必然持有。
 * 这样「某条分支忘了发证物」也能被发现。
 */
function evidenceBeforeNode(data: CaseData, entry: string): Map<string, Set<string>> {
  // before[n] = 到达 n 之前必然持有的证物；null 表示尚未到达（视作全集，便于求交）
  const before = new Map<string, Set<string> | null>();
  for (const id of Object.keys(data.nodes)) before.set(id, null);
  before.set(entry, new Set());

  // 只计 get_evidence 节点：搜证热点需玩家主动点击，不保证必得。
  const gained = (node: CaseNode): string[] => node.evidence_ids ?? [];

  let changed = true;
  let guard = 0;
  while (changed && guard < 1000) {
    changed = false;
    guard += 1;
    for (const [id, node] of Object.entries(data.nodes)) {
      const cur = before.get(id);
      if (cur === null) continue; // 尚不可达
      const after = new Set(cur);
      for (const e of gained(node)) after.add(e);
      for (const t of outTargets(node)) {
        if (!data.nodes[t]) continue;
        const prev = before.get(t) ?? null;
        if (prev === null) {
          before.set(t, new Set(after));
          changed = true;
        } else {
          // 求交集：只保留所有路径都持有的
          const next = new Set<string>();
          for (const e of prev) if (after.has(e)) next.add(e);
          if (next.size !== prev.size) {
            before.set(t, next);
            changed = true;
          }
        }
      }
    }
  }

  const result = new Map<string, Set<string>>();
  for (const [k, v] of before) result.set(k, v ?? new Set());
  return result;
}

export function validateCase(data: CaseData): Issue[] {
  const issues: Issue[] = [];
  const nodeIds = new Set(Object.keys(data.nodes));
  const assets = data.assets ?? { evidence: {}, characters: {}, backgrounds: {} };

  // ─── 结构类 ───────────────────────────────────

  if (!data.entry || !nodeIds.has(data.entry)) {
    issues.push({
      level: "error",
      code: "entry-missing",
      message: `入口节点「${data.entry || "(未设置)"}」不存在，游戏无法启动`,
    });
  }

  for (const [id, node] of Object.entries(data.nodes)) {
    // 断链：指向不存在的节点
    for (const t of outTargets(node)) {
      if (!nodeIds.has(t)) {
        issues.push({
          level: "error",
          code: "broken-link",
          message: `跳转目标「${t}」不存在`,
          nodeId: id,
        });
      }
    }

    // 死胡同：非结局节点却没有任何出口
    if (outTargets(node).length === 0) {
      issues.push({
        level: "warning",
        code: "dead-end",
        message: "没有任何后续节点，流程将在此结束",
        nodeId: id,
      });
    }

    // 证言：举证处理器没设正确答案
    const ph = node.present_handlers;
    if (ph && !Array.isArray(ph)) {
      for (const [k, h] of Object.entries(ph)) {
        if (!h.correct_evidence?.length) {
          issues.push({
            level: "warning",
            code: "present-no-answer",
            message: `第 ${k} 条证言的举证未设置正确证物，玩家举证永远失败`,
            nodeId: id,
          });
        }
      }
    }

    // 证言至少要有一条证言内容
    if (node.type === "testimony" && !node.stmts?.length) {
      issues.push({
        level: "error",
        code: "testimony-empty",
        message: "证言节点没有任何证言内容",
        nodeId: id,
      });
    }

    // choice 至少两个选项才有意义
    if (node.type === "choice" && (node.options?.length ?? 0) < 2) {
      issues.push({
        level: "warning",
        code: "choice-too-few",
        message: "分支选择少于 2 个选项",
        nodeId: id,
      });
    }
  }

  // 孤儿 / 不可达
  if (data.entry && nodeIds.has(data.entry)) {
    const reachable = reachableFrom(data, data.entry);
    for (const id of nodeIds) {
      if (!reachable.has(id)) {
        issues.push({
          level: "warning",
          code: "unreachable",
          message: "从入口出发无法到达此节点",
          nodeId: id,
        });
      }
    }
  }

  // ─── 引用类 ───────────────────────────────────

  const index = buildRefIndex(data);
  const pool: Record<string, Record<string, unknown>> = {
    evidence: assets.evidence,
    character: assets.characters,
    background: assets.backgrounds,
  };
  const kindLabel: Record<string, string> = {
    evidence: "证物",
    character: "角色",
    background: "背景",
  };

  for (const site of index.sites) {
    if (!pool[site.kind][site.id]) {
      issues.push({
        level: "error",
        code: "missing-asset",
        message: `${site.path}引用了不存在的${kindLabel[site.kind]}「${site.id}」`,
        nodeId: site.nodeId,
      });
    }
  }

  // 证物「用了但没获得」—— 最容易导致卡关的问题
  if (data.entry && nodeIds.has(data.entry)) {
    const held = evidenceBeforeNode(data, data.entry);
    const definedAnywhere = new Set(
      index.sites.filter((s) => s.kind === "evidence" && s.role === "define").map((s) => s.id),
    );

    for (const site of index.sites) {
      if (site.kind !== "evidence" || site.role !== "use") continue;
      if (!pool.evidence[site.id]) continue; // 已由 missing-asset 报告

      if (!definedAnywhere.has(site.id)) {
        issues.push({
          level: "error",
          code: "evidence-never-obtained",
          message: `${site.path}需要证物「${site.id}」，但流程中从未获得它 —— 玩家将无法通过`,
          nodeId: site.nodeId,
        });
      } else if (!held.get(site.nodeId)?.has(site.id)) {
        issues.push({
          level: "warning",
          code: "evidence-maybe-missing",
          message: `${site.path}需要证物「${site.id}」，但并非所有路径都能在此前获得它`,
          nodeId: site.nodeId,
        });
      }
    }
  }

  // 定义了却从未使用的资源（仅提示，不算错）
  for (const kind of ["evidence", "character", "background"] as const) {
    for (const id of Object.keys(pool[kind])) {
      const used = (index.byId[kind][id] ?? []).length > 0;
      if (!used) {
        issues.push({
          level: "warning",
          code: "asset-unused",
          message: `${kindLabel[kind]}「${id}」已定义但从未被使用`,
        });
      }
    }
  }

  return issues;
}
