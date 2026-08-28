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

## 2026-08-28 闭环验证 + 调试浮层 + 阶段2 编辑器 MVP

### 闭环验证（M1 确认）

- 在本地 renpy-8.5.3-sdk 中实跑测试项目 `GyakutenMaker-AATest`，数据驱动流程完整跑通，无报错。
- 修复的兼容问题：`renpy.exports.X` API 前缀、`default` 重复定义、`_play_ding` 命名空间、gui.rpy 引号。

### 运行时调试浮层（commit b9c6b42）

- `renpy/common/00aa_runtime.rpy` 新增 `screen aa_debug_overlay`（F9 开关，`config.overlay_screens` 注册）。
- 显示：当前节点 id/type、血量、交互反馈（举证正误✔✘、追问、搜证、话题、选择、取证）。
- 目的：无美术素材时也能确认「点得对不对」，解决语义验证盲区。
- 注意：Ren'Py 文本 `[...]` 是插值语法，字面方括号需转义或避免。

### 阶段2 编辑器 MVP 脚手架（commit 6fcc7bd）

- 新目录 `editor/`：Vite + React18 + TypeScript + React Flow(`@xyflow/react`) + Zustand。
- 三大区：
  - 工具栏 `panels/Toolbar.tsx` — 新建/导入/导出 case.json，添加 8 种节点。
  - 流程画布 `flow/FlowCanvas.tsx` — 自定义节点卡片、拖拽连线（写入 `next`）、缩放、小地图。
  - 属性面板 `panels/PropertyPanel.tsx` — 编辑节点 ID/类型/next；dialogue 有可视化表单，其余暂用 JSON 表单。
- 数据契约 `src/types/case.ts` 严格对齐运行时；`_editor` 命名空间存画布坐标（运行时忽略）。
- 验证：`tsc -b` 通过，dev server(5175) 正常，浏览器实测界面渲染与新建案件功能无报错。

### 待办

- 一键预览（调起 Ren'Py 跑当前 case.json）需 Tauri 外壳 —— 本机暂无 Rust，待安装。
- testimony / investigation / talk / choice 的可视化专属表单。

---

## 2026-08-28 (续) 一键预览 + 证言/搜证可视化表单 → M2 达成

### 一键预览（轻量方案，未装 Rust）

- 不走 Tauri，先在 Vite dev server 挂后端插件 `editor/preview/vitePreviewPlugin.ts`。
- `POST /api/preview`：校验 → 写 `case.json` 到测试项目 → 清 .rpyc → spawn 启动 Ren'Py。
- 路径可用 `AA_RENPY_SDK` / `AA_TEST_PROJECT` 环境变量覆盖；`GET /api/preview/config` 诊断。
- 工具栏「▶ 一键预览」按钮 + 状态提示。端到端验证：写入生效、进程启动、无报错。
- 设计为可平滑迁移：迁 Tauri 时后端换 Rust command，前端 `src/api/preview.ts` 不变。

### 证言/搜证可视化表单

- `LineListEditor.tsx`：抽出可复用对话行编辑器；`DialogueForm` 改为复用它。
- `TestimonyForm.tsx`：证言逐句编辑；每句可展开配置「追问(press)」与「举证(present)」。
  - 举证含：正确证据 id（逗号分隔）、成功台词、扣血、成功后跳转（节点下拉）。
  - 删除证言时自动平移 1-based handler key，避免错位。
- `InvestigationForm.tsx`：搜证热点可视化（id/名称/x/y/半径/宽高/获得证据/调查台词）。
- 接入 `PropertyPanel` 分派；`tsc -b` + 生产构建（208 模块）+ 浏览器实测均通过。

### 里程碑 M2 达成

**「非程序员能在编辑器里做出『一段对话 + 一个搜证点 + 一次举证』并预览」** — 已满足。
dialogue / testimony / investigation 三大核心节点均有可视化表单，配合一键预览闭环。

### 待办（下一步候选）

- talk / choice 的可视化表单（目前仍是 JSON 编辑器）。
- 证物/角色/地点的下拉引用（现在 evidence_id / character 仍需手敲）。
- 实时校验（断裂连线、引用不存在证物、举证未设正确答案）。
- 真·本地工程文件夹读写（现为浏览器上传/下载）。

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
