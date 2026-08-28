import { create } from "zustand";
import type {
  CaseData,
  CaseNode,
  CaseAssets,
  EvidenceDef,
  CharacterDef,
  BackgroundDef,
  NodeType,
} from "../types/case";
import { NODE_META } from "../types/case";

/** 从 case.json 提取的「下一步」连线 —— 用于画布连线渲染 */
export interface FlowEdge {
  source: string;
  target: string;
  label?: string;
}

interface EditorState {
  caseData: CaseData | null;
  selectedNodeId: string | null;
  dirty: boolean;

  loadCase: (data: CaseData) => void;
  newCase: () => void;
  selectNode: (id: string | null) => void;

  addNode: (type: NodeType, x: number, y: number) => string;
  updateNode: (id: string, patch: Partial<CaseNode>) => void;
  renameNode: (oldId: string, newId: string) => boolean;
  deleteNode: (id: string) => void;
  setNodePos: (id: string, x: number, y: number) => void;

  connect: (source: string, target: string) => void;
  setEntry: (id: string) => void;

  // ─── 资源管理 ───────────────────────────────────
  upsertEvidence: (def: EvidenceDef, oldId?: string) => boolean;
  deleteEvidence: (id: string) => void;
  upsertCharacter: (def: CharacterDef, oldId?: string) => boolean;
  deleteCharacter: (id: string) => void;
  upsertBackground: (def: BackgroundDef, oldId?: string) => boolean;
  deleteBackground: (id: string) => void;
}

const EMPTY_CASE: CaseData = {
  version: "1.0",
  id: "new_case",
  title: "未命名案件",
  author: "",
  entry: "start",
  nodes: {
    start: {
      type: "dialogue",
      lines: [{ text: "新案件的第一句话。" }],
      _editor: { x: 250, y: 120 },
    },
  },
  assets: { evidence: {}, characters: {}, backgrounds: {} },
};

/**
 * 兼容旧 case.json：若无 assets，扫描所有节点收集已引用的证物/角色/背景 id，
 * 生成占位定义，使引用下拉立刻有可选项（作者随后可在资源面板补全 name 等）。
 */
function backfillAssets(data: CaseData): CaseAssets {
  const assets: CaseAssets = {
    evidence: { ...(data.assets?.evidence ?? {}) },
    characters: { ...(data.assets?.characters ?? {}) },
    backgrounds: { ...(data.assets?.backgrounds ?? {}) },
  };

  const addEv = (id?: string) => {
    if (id && !assets.evidence[id]) assets.evidence[id] = { id, name: id };
  };
  const addChar = (id?: string) => {
    if (id && !assets.characters[id]) assets.characters[id] = { id, name: id };
  };
  const addBg = (scene?: string) => {
    // scene 形如 "bg apartment"，取背景 id 部分
    if (!scene) return;
    const parts = scene.split(/\s+/);
    const id = parts.length === 2 && parts[0] === "bg" ? parts[1] : scene;
    if (id && !assets.backgrounds[id]) assets.backgrounds[id] = { id, name: id };
  };
  const scanLines = (lines?: { character?: string; text: string }[]) => {
    for (const l of lines ?? []) addChar(l.character);
  };

  for (const node of Object.values(data.nodes)) {
    addBg(node.scene);
    scanLines(node.lines);
    scanLines(node.intro_lines);
    addChar(node.witness);
    addChar(node.npc_id);
    for (const id of node.evidence_ids ?? []) addEv(id);
    // 证言 press/present handlers
    for (const h of Object.values(node.press_handlers ?? {})) scanLines(h.lines);
    const ph = node.present_handlers;
    if (ph && !Array.isArray(ph)) {
      for (const h of Object.values(ph)) {
        for (const id of h.correct_evidence ?? []) addEv(id);
        scanLines(h.on_correct?.lines);
      }
    }
    // 搜证热点
    for (const hs of node.hotspots ?? []) {
      scanLines(hs.lines);
      addEv(hs.get_evidence);
    }
    // talk 主题
    for (const t of node.topics ?? []) scanLines(t.lines);
  }
  return assets;
}

function genId(existing: Record<string, unknown>, type: NodeType): string {
  let i = 1;
  let id = `${type}_${i}`;
  while (existing[id]) {
    i += 1;
    id = `${type}_${i}`;
  }
  return id;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  caseData: null,
  selectedNodeId: null,
  dirty: false,

  loadCase: (data) =>
    set({
      caseData: { ...data, assets: backfillAssets(data) },
      selectedNodeId: null,
      dirty: false,
    }),

  newCase: () =>
    set({ caseData: structuredClone(EMPTY_CASE), selectedNodeId: "start", dirty: false }),

  selectNode: (id) => set({ selectedNodeId: id }),

  addNode: (type, x, y) => {
    const data = get().caseData;
    if (!data) return "";
    const id = genId(data.nodes, type);
    const node: CaseNode = { type, _editor: { x, y } };
    // 各类型的最小合理默认值
    if (type === "dialogue") node.lines = [{ text: `${NODE_META[type].label}内容` }];
    if (type === "get_evidence") node.evidence_ids = [];
    if (type === "set_flag") { node.key = "flag_name"; node.value = true; }
    if (type === "penalty") node.amount = 1;
    if (type === "testimony") { node.title = "证言标题"; node.stmts = ["证言第一句"]; }
    if (type === "investigation") { node.location_id = "scene"; node.hotspots = []; }
    if (type === "talk") { node.npc_id = "npc"; node.topics = []; }
    if (type === "choice") { node.prompt = "请选择："; node.options = []; }

    set({
      caseData: { ...data, nodes: { ...data.nodes, [id]: node } },
      selectedNodeId: id,
      dirty: true,
    });
    return id;
  },

  updateNode: (id, patch) => {
    const data = get().caseData;
    if (!data || !data.nodes[id]) return;
    set({
      caseData: {
        ...data,
        nodes: { ...data.nodes, [id]: { ...data.nodes[id], ...patch } },
      },
      dirty: true,
    });
  },

  renameNode: (oldId, newId) => {
    const data = get().caseData;
    if (!data || !newId || newId === oldId) return false;
    if (data.nodes[newId]) return false; // 冲突

    const nodes: Record<string, CaseNode> = {};
    for (const [k, v] of Object.entries(data.nodes)) {
      nodes[k === oldId ? newId : k] = v;
    }
    // 修正所有指向 oldId 的引用
    for (const node of Object.values(nodes)) {
      if (node.next === oldId) node.next = newId;
      if (node.options) {
        for (const opt of node.options) if (opt.next === oldId) opt.next = newId;
      }
    }
    const entry = data.entry === oldId ? newId : data.entry;

    set({
      caseData: { ...data, nodes, entry },
      selectedNodeId: newId,
      dirty: true,
    });
    return true;
  },

  deleteNode: (id) => {
    const data = get().caseData;
    if (!data) return;
    const nodes = { ...data.nodes };
    delete nodes[id];
    // 清理引用
    for (const node of Object.values(nodes)) {
      if (node.next === id) delete node.next;
      if (node.options) {
        for (const opt of node.options) if (opt.next === id) delete opt.next;
      }
    }
    set({
      caseData: { ...data, nodes },
      selectedNodeId: get().selectedNodeId === id ? null : get().selectedNodeId,
      dirty: true,
    });
  },

  setNodePos: (id, x, y) => {
    const data = get().caseData;
    if (!data || !data.nodes[id]) return;
    set({
      caseData: {
        ...data,
        nodes: { ...data.nodes, [id]: { ...data.nodes[id], _editor: { x, y } } },
      },
      dirty: true,
    });
  },

  connect: (source, target) => {
    const data = get().caseData;
    if (!data || !data.nodes[source]) return;
    // 默认连线写入 next（choice 的分支连线在属性面板里单独管理）
    set({
      caseData: {
        ...data,
        nodes: { ...data.nodes, [source]: { ...data.nodes[source], next: target } },
      },
      dirty: true,
    });
  },

  setEntry: (id) => {
    const data = get().caseData;
    if (!data) return;
    set({ caseData: { ...data, entry: id }, dirty: true });
  },

  // ─── 资源管理 ───────────────────────────────────

  upsertEvidence: (def, oldId) => {
    const data = get().caseData;
    if (!data || !def.id) return false;
    const assets = data.assets ?? { evidence: {}, characters: {}, backgrounds: {} };
    // 改 id 且新 id 已存在 → 冲突
    if (oldId && oldId !== def.id && assets.evidence[def.id]) return false;
    const evidence = { ...assets.evidence };
    if (oldId && oldId !== def.id) delete evidence[oldId];
    evidence[def.id] = def;
    set({ caseData: { ...data, assets: { ...assets, evidence } }, dirty: true });
    return true;
  },
  deleteEvidence: (id) => {
    const data = get().caseData;
    if (!data?.assets) return;
    const evidence = { ...data.assets.evidence };
    delete evidence[id];
    set({ caseData: { ...data, assets: { ...data.assets, evidence } }, dirty: true });
  },

  upsertCharacter: (def, oldId) => {
    const data = get().caseData;
    if (!data || !def.id) return false;
    const assets = data.assets ?? { evidence: {}, characters: {}, backgrounds: {} };
    if (oldId && oldId !== def.id && assets.characters[def.id]) return false;
    const characters = { ...assets.characters };
    if (oldId && oldId !== def.id) delete characters[oldId];
    characters[def.id] = def;
    set({ caseData: { ...data, assets: { ...assets, characters } }, dirty: true });
    return true;
  },
  deleteCharacter: (id) => {
    const data = get().caseData;
    if (!data?.assets) return;
    const characters = { ...data.assets.characters };
    delete characters[id];
    set({ caseData: { ...data, assets: { ...data.assets, characters } }, dirty: true });
  },

  upsertBackground: (def, oldId) => {
    const data = get().caseData;
    if (!data || !def.id) return false;
    const assets = data.assets ?? { evidence: {}, characters: {}, backgrounds: {} };
    if (oldId && oldId !== def.id && assets.backgrounds[def.id]) return false;
    const backgrounds = { ...assets.backgrounds };
    if (oldId && oldId !== def.id) delete backgrounds[oldId];
    backgrounds[def.id] = def;
    set({ caseData: { ...data, assets: { ...assets, backgrounds } }, dirty: true });
    return true;
  },
  deleteBackground: (id) => {
    const data = get().caseData;
    if (!data?.assets) return;
    const backgrounds = { ...data.assets.backgrounds };
    delete backgrounds[id];
    set({ caseData: { ...data, assets: { ...data.assets, backgrounds } }, dirty: true });
  },
}));
