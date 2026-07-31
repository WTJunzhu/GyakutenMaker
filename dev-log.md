# GyakutenMaker 开发日志

> 说明：本项目早期曾尝试用 TypeScript + React 自研引擎（`packages/core` / `packages/player`），
> 后已废弃并转向 **Ren'Py 运行时 + 数据驱动解释器** 方案（详见 `project-plan.md`）。
> 下方"历史归档"记录了废弃方案，仅作背景参考，相关代码已不在仓库中。

---

## 2026-07-31 阶段1 数据驱动地基完成

### 新增文件

- `game/aa/case.json` — 案件流程节点数据（对话/证言/搜证/NPC对话/set_flag），为唯一流程事实来源
- `renpy/common/00aa_runtime.rpy` — 数据驱动流程解释器：读 `case.json`，用官方 Ren'Py API 驱动所有交互
  - `aa_run_case(filepath, entry)` label — 入口点，供 `.rpy` call
  - `_aa_rt.dispatch(node)` — 按节点类型分派
  - `exec_dialogue / exec_testimony / exec_investigation / exec_talk / exec_get_evidence / exec_set_flag / exec_choice / exec_penalty` — 各类型处理器

### 改造文件

- `game/test_case.rpy` — 精简为 3 步：加载 JSON → 注册角色 → `call aa_run_case("aa/case.json")`，流程全部来自 case.json

### 里程碑 M1 达成条件

**"完全不碰 .rpy 代码，仅手改 `case.json` 即可改变游戏流程"** — 已满足。

验证方式：直接编辑 `game/aa/case.json` 的节点台词/顺序/hotspot，无需修改任何 `.rpy` 文件。

---

## 2026-07-31 运行时现状审计（阶段0）

- 对现有 Ren'Py 运行时（`renpy/common/00aa_*.rpy`）做源码级静态审计。
- **关键发现**：`00aa_statements.rpy` 中带 `block="script"` 的语句（`begin_testimony`/`press`/`present`/`investigate`/`examine`/`talk`/`topic`）块执行逻辑存在架构性错误——调用了不存在的 `renpy.execute()`，且误把 `next` handler 的 label-name 参数当节点列表遍历。
- 详见 `runtime-audit.md`。
- 结论：非块 `execute_*` 函数（`penalty`/`get_evidence`/`set_flag`/…）、`00aa_core.rpy` 数据类、`00aa_screens.rpy` UI、`00aa_text.rpy` 嘟嘟声均可复用；块执行机制需在阶段1 用数据驱动解释器重写替换。
- 下一步：进入阶段1（`case.json` Schema + `00aa_runtime.rpy` 解释器）。

---

## 历史归档（已废弃的 TS/React 自研引擎方案）

<details>
<summary>2026-05-22 首次开发（已废弃，仅作背景）</summary>

### 项目初始化（已废弃）

- 曾创建 Monorepo 结构（pnpm workspaces）
- `packages/core` — 引擎核心（TypeScript）——已废弃
- `packages/player` — 播放器 UI（React + Vite + TypeScript）——已废弃

### 曾定义的数据格式（types.ts）

- `Scene` / `DialogueNode` / `TitleNode` / `TestimonyDisplayNode` / `TestimonyNode`
  / `InvestigationNode` / `InvestigationHotspot` / `InvestigationNPC` / `ChoiceNode` / `PsycheLockNode`

### 曾实现的引擎能力（engine.ts）

- 状态机管理、事件系统、证言系统、搜证系统、NPC 多级交互、标题卡片、证言逐条播放、动态证物发现

### 曾实现的播放器 UI（packages/player）

- GameScreen / DialogueBox / TitleCard / TestimonyDisplay / TestimonyPanel
  / EvidencePanel / ChoicePanel / HealthBar / InvestigationScene / PlayerCharacter
  / Hotspot / InvestigationDialogue / NPCDialogue

> 上述 TS/React 组件与引擎均已废弃，现由 Ren'Py 运行时承担。其数据模型思路（节点类型划分、
> 证言/搜证/交互状态机）对阶段1 的 `case.json` Schema 设计仍有参考价值。

</details>
