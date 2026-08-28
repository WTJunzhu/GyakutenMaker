import { create } from "zustand";
import type { CaseData, CaseNode, NodeType } from "../types/case";
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
};

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

  loadCase: (data) => set({ caseData: data, selectedNodeId: null, dirty: false }),

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
}));
