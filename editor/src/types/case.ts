// case.json 数据模型 —— 与 renpy/common/00aa_runtime.rpy 解释器严格对齐。
// 这是编辑器与运行时之间的「单一事实来源」契约。

/** 一句对话行 */
export interface DialogueLine {
  character?: string; // 角色 id，省略则为旁白
  text: string;
}

/** 所有节点类型 */
export type NodeType =
  | "dialogue"
  | "get_evidence"
  | "set_flag"
  | "penalty"
  | "testimony"
  | "investigation"
  | "talk"
  | "choice";

/** 举证/追问处理器 */
export interface PresentHandler {
  correct_evidence?: string[];
  on_correct?: {
    lines?: DialogueLine[];
    penalty?: number;
    next?: string;
  };
}

export interface PressHandler {
  lines?: DialogueLine[];
}

/** 搜证热点 */
export interface Hotspot {
  id: string;
  name?: string;
  x?: number;
  y?: number;
  size_w?: number;
  size_h?: number;
  radius?: number;
  lines?: DialogueLine[];
  get_evidence?: string;
}

/** 对话主题（talk 节点） */
export interface TalkTopic {
  name: string;
  lines?: DialogueLine[];
}

export interface TalkPresentHandler {
  evidence_id: string;
  lines?: DialogueLine[];
}

/** 选项（choice 节点） */
export interface ChoiceOption {
  text: string;
  next?: string;
}

/** 节点创作进度状态 */
export type NodeStatus = "draft" | "wip" | "done";

/**
 * 节点元数据（编辑器专用，运行时忽略，以 _meta 命名空间存于 case.json）。
 * 承载"组织与检索"所需信息。详见 node-system-design.md 第 4.1 节。
 */
export interface NodeMeta {
  /** 人类可读标题：列表/搜索/画布优先显示，比 id 友好 */
  title?: string;
  /** 作者备注（只给作者看，不入游戏） */
  note?: string;
  /** 自由标签，可用于筛选（如「关键证据」「伏笔」） */
  tags?: string[];
  /** 所属分组/环节 id */
  group?: string;
  /** 剧情时序权重（用于时间线视图/时间筛选） */
  story_time?: number;
  /** 创作进度状态 */
  status?: NodeStatus;
}

/**
 * 一个流程节点。字段随 type 不同而不同（松散并集）。
 * 运行时按 type 分派，多余字段忽略；编辑器按 type 展示对应表单。
 */
export interface CaseNode {
  type: NodeType;
  next?: string;

  // 编辑器专用：画布坐标（运行时忽略）。存于 case.json 的 _editor 命名空间。
  _editor?: { x: number; y: number };

  // 编辑器专用：节点元数据（组织/检索用，运行时忽略）。详见 node-system-design.md。
  _meta?: NodeMeta;

  // dialogue
  scene?: string;
  bgm?: string;
  show_health_bar?: boolean;
  hide_health_bar?: boolean;
  lines?: DialogueLine[];

  // get_evidence
  evidence_ids?: string[];

  // set_flag
  key?: string;
  value?: boolean | string | number;

  // penalty
  amount?: number;

  // testimony
  title?: string;
  witness?: string;
  stmts?: string[];
  press_handlers?: Record<string, PressHandler>;
  present_handlers?: Record<string, PresentHandler> | TalkPresentHandler[];

  // investigation
  location_id?: string;
  intro_lines?: DialogueLine[];
  hotspots?: Hotspot[];

  // talk
  npc_id?: string;
  topics?: TalkTopic[];

  // choice
  prompt?: string;
  options?: ChoiceOption[];
}

/** 整个案件文件 */
export interface CaseData {
  version: string;
  id: string;
  title: string;
  author?: string;
  entry: string;
  nodes: Record<string, CaseNode>;
}

/** 节点类型 → 中文显示名 & 主题色 */
export const NODE_META: Record<NodeType, { label: string; color: string }> = {
  dialogue: { label: "对话", color: "#4a90d9" },
  get_evidence: { label: "获得证据", color: "#2ecc40" },
  set_flag: { label: "设置标记", color: "#9b59b6" },
  penalty: { label: "扣血惩罚", color: "#e74c3c" },
  testimony: { label: "证言询问", color: "#f39c12" },
  investigation: { label: "搜证调查", color: "#16a085" },
  talk: { label: "对话探索", color: "#e67e22" },
  choice: { label: "分支选择", color: "#8e44ad" },
};
