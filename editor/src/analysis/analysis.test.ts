import { describe, it, expect } from "vitest";
import type { CaseData } from "../types/case";
import { buildRefIndex, refsOf, renameRefs, sceneToBgId } from "./references";
import { validateCase } from "./validate";

/** 构造最小案件，nodes 由调用方给定 */
function makeCase(partial: Partial<CaseData>): CaseData {
  return {
    version: "1.0",
    id: "t",
    title: "t",
    entry: "start",
    nodes: {},
    assets: { evidence: {}, characters: {}, backgrounds: {} },
    ...partial,
  };
}

describe("sceneToBgId", () => {
  it("解析 'bg xxx' 形式", () => {
    expect(sceneToBgId("bg apartment")).toBe("apartment");
  });
  it("无前缀时原样返回", () => {
    expect(sceneToBgId("apartment")).toBe("apartment");
  });
  it("空值返回 undefined", () => {
    expect(sceneToBgId(undefined)).toBeUndefined();
  });
});

describe("buildRefIndex", () => {
  const data = makeCase({
    nodes: {
      start: {
        type: "dialogue",
        scene: "bg courtroom",
        lines: [{ character: "phoenix", text: "异议！" }, { text: "旁白" }],
        next: "get",
      },
      get: { type: "get_evidence", evidence_ids: ["knife"], next: "t" },
      t: {
        type: "testimony",
        witness: "sahwit",
        stmts: ["a"],
        present_handlers: { "1": { correct_evidence: ["knife"] } },
      },
    },
  });

  it("收集角色引用（含对话行与证人）", () => {
    const idx = buildRefIndex(data);
    expect(refsOf(idx, "character", "phoenix")).toHaveLength(1);
    expect(refsOf(idx, "character", "sahwit")).toHaveLength(1);
  });

  it("旁白行（无 character）不产生引用", () => {
    const idx = buildRefIndex(data);
    const chars = idx.sites.filter((s) => s.kind === "character");
    expect(chars).toHaveLength(2);
  });

  it("背景从 scene 解析", () => {
    const idx = buildRefIndex(data);
    expect(refsOf(idx, "background", "courtroom")).toHaveLength(1);
  });

  it("区分证物的获得处(define)与使用处(use)", () => {
    const idx = buildRefIndex(data);
    const sites = refsOf(idx, "evidence", "knife");
    expect(sites).toHaveLength(2);
    expect(sites.filter((s) => s.role === "define")).toHaveLength(1);
    expect(sites.filter((s) => s.role === "use")).toHaveLength(1);
  });
});

describe("renameRefs", () => {
  it("改写所有引用点且不修改入参", () => {
    const nodes = {
      a: {
        type: "dialogue" as const,
        lines: [{ character: "old", text: "x" }],
      },
      b: { type: "testimony" as const, witness: "old", stmts: ["s"] },
    };
    const { nodes: out, count } = renameRefs(nodes, "character", "old", "new");
    expect(count).toBe(2);
    expect(out.a.lines![0].character).toBe("new");
    expect(out.b.witness).toBe("new");
    // 原对象不变
    expect(nodes.a.lines[0].character).toBe("old");
  });

  it("背景重命名保持 'bg xxx' 格式", () => {
    const nodes = { a: { type: "dialogue" as const, scene: "bg old" } };
    const { nodes: out } = renameRefs(nodes, "background", "old", "new");
    expect(out.a.scene).toBe("bg new");
  });
});

describe("validateCase — 结构类", () => {
  it("入口不存在报 error", () => {
    const issues = validateCase(makeCase({ entry: "nope", nodes: {} }));
    expect(issues.some((i) => i.code === "entry-missing" && i.level === "error")).toBe(true);
  });

  it("断链报 error", () => {
    const data = makeCase({
      nodes: { start: { type: "dialogue", next: "ghost" } },
    });
    const issues = validateCase(data);
    expect(issues.some((i) => i.code === "broken-link")).toBe(true);
  });

  it("不可达节点报 warning", () => {
    const data = makeCase({
      nodes: {
        start: { type: "dialogue" },
        lonely: { type: "dialogue" },
      },
    });
    const issues = validateCase(data);
    expect(
      issues.some((i) => i.code === "unreachable" && i.nodeId === "lonely"),
    ).toBe(true);
  });

  it("举证未设正确证物报 warning", () => {
    const data = makeCase({
      nodes: {
        start: {
          type: "testimony",
          stmts: ["a"],
          present_handlers: { "1": { correct_evidence: [] } },
        },
      },
    });
    const issues = validateCase(data);
    expect(issues.some((i) => i.code === "present-no-answer")).toBe(true);
  });

  it("循环流程不会死循环", () => {
    const data = makeCase({
      nodes: {
        start: { type: "dialogue", next: "b" },
        b: { type: "dialogue", next: "start" },
      },
    });
    expect(() => validateCase(data)).not.toThrow();
  });
});

describe("validateCase — 引用类（卡关检测）", () => {
  it("引用不存在的资源报 error", () => {
    const data = makeCase({
      nodes: { start: { type: "dialogue", lines: [{ character: "ghost", text: "x" }] } },
    });
    const issues = validateCase(data);
    expect(issues.some((i) => i.code === "missing-asset")).toBe(true);
  });

  it("举证用到但流程中从未获得的证物报 error（卡关）", () => {
    const data = makeCase({
      assets: {
        evidence: { knife: { id: "knife", name: "刀" } },
        characters: {},
        backgrounds: {},
      },
      nodes: {
        start: {
          type: "testimony",
          stmts: ["a"],
          present_handlers: { "1": { correct_evidence: ["knife"] } },
        },
      },
    });
    const issues = validateCase(data);
    expect(
      issues.some((i) => i.code === "evidence-never-obtained" && i.level === "error"),
    ).toBe(true);
  });

  it("先获得再使用则不报错", () => {
    const data = makeCase({
      assets: {
        evidence: { knife: { id: "knife", name: "刀" } },
        characters: {},
        backgrounds: {},
      },
      nodes: {
        start: { type: "get_evidence", evidence_ids: ["knife"], next: "t" },
        t: {
          type: "testimony",
          stmts: ["a"],
          present_handlers: { "1": { correct_evidence: ["knife"] } },
        },
      },
    });
    const issues = validateCase(data);
    expect(issues.some((i) => i.code.startsWith("evidence-"))).toBe(false);
  });

  it("只有部分分支能获得证物时报 warning", () => {
    const data = makeCase({
      assets: {
        evidence: { knife: { id: "knife", name: "刀" } },
        characters: {},
        backgrounds: {},
      },
      nodes: {
        start: {
          type: "choice",
          options: [{ text: "拿", next: "get" }, { text: "不拿", next: "t" }],
        },
        get: { type: "get_evidence", evidence_ids: ["knife"], next: "t" },
        t: {
          type: "testimony",
          stmts: ["a"],
          present_handlers: { "1": { correct_evidence: ["knife"] } },
        },
      },
    });
    const issues = validateCase(data);
    expect(issues.some((i) => i.code === "evidence-maybe-missing")).toBe(true);
  });

  it("定义但未使用的资源报 warning", () => {
    const data = makeCase({
      assets: {
        evidence: { unused: { id: "unused", name: "没人用" } },
        characters: {},
        backgrounds: {},
      },
      nodes: { start: { type: "dialogue" } },
    });
    const issues = validateCase(data);
    expect(issues.some((i) => i.code === "asset-unused")).toBe(true);
  });
});
