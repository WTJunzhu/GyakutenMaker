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

## 2026-08-28 (三) 阶段2 收尾：节点标题与元数据 → 阶段2 完成

- 讨论节点系统设计（见 `node-system-design.md`）：确认节点系统不单独立阶段，
  拆散后贴合路线图——引用追踪/校验属阶段3，跟素材库一起做；现在只做零成本地基。
- **节点元数据 `_meta`（阶段2 收尾）**：
  - `types/case.ts` 新增 `NodeMeta`（title / note / tags / group / story_time / status），
    以 `_meta` 命名空间存于 case.json，运行时忽略（与 `_editor` 同策略，向后兼容）。
  - `PropertyPanel` 顶部新增「节点标题」输入框 + 「作者备注」+ 「创作状态」下拉。
  - `CaseFlowNode` 画布卡片：优先显示标题，id 降为灰色副标题，顶部增加状态徽标
    （草稿/进行中/完成）。`FlowCanvas` 传递 title/nodeId/status/hasTitle。
  - 意义：节点多了以后靠 id 认不出，标题让"打开/编辑/未来搜索导航"有了人类可读的锚。
- `tsc -b` + 生产构建 + 浏览器实测（新建→填标题→卡片显示标题+id 副标题+状态徽标）均通过，控制台无报错。

### 阶段2 完成盘点

对照 project-plan 阶段2（编辑器 MVP）：脚手架 ✅、三大区 ✅、节点模板化 ✅、
一键预览 ✅、工程读写 ✅（导入/导出 JSON + 节点标题使其可读）。**阶段2 收尾完成，可进入阶段3。**
阶段3 首选：内置素材库 + 证物/角色引用下拉，并在此基础上做引用追踪与一致性校验。

---

## 2026-08-28 (四) 阶段3 起步：资源集中定义 + 引用下拉

- **资源数据模型**：`types/case.ts` 新增 `EvidenceDef` / `CharacterDef` / `BackgroundDef` /
  `CaseAssets`，`CaseData.assets` 集中存放证物/角色/背景，schema 对齐运行时
  `game/aa/{evidence,characters,locations}.json`。
- **store 资源 CRUD**：`upsert/delete` × 证物/角色/背景，改 id 时删旧 key 写新 key、冲突返回失败。
  `loadCase` 兼容旧 case.json——无 `assets` 时 `backfillAssets` 扫描全节点（lines/witness/
  hotspots/press/present handlers 等）反向收集已用 id 生成占位定义，让下拉立刻可用。
- **资源管理面板 `AssetManager`**（工具栏「资源管理」按钮弹出模态）：三 Tab（证物/角色/背景），
  可视化增删改；角色带名字颜色取色器、站位下拉、打字音字段；输入框失焦提交。
- **引用下拉 `AssetSelect`**：从 `case.assets` 读选项，显示「名称 (id)」，值存 id。
  - 对话行角色（`LineListEditor`，全局生效）、`get_evidence` 证物（新 `GetEvidenceForm`）、
    证言 witness 与举证 correct_evidence、搜证热点 get_evidence、对话/搜证 scene 背景，
    全部由手敲 id 改为下拉选择。
  - 背景 `scene` 用 `asScene` 模式按 `"bg <id>"` 存取，对齐运行时字段格式。
  - 安全网：引用了资源库里不存在的 id 时下拉显示「⚠ …未在资源库，请去资源管理添加」。
- 意义：杜绝 id 拼写错误，作者从"记忆 + 手敲 id"变为"下拉里挑"，向剪映式所见即所选靠拢一步。
- `tsc -b` + 生产构建（361KB）均通过；浏览器实测资源增删与下拉联动正常、控制台无报错。
- **待续**：资源→运行时桥接（assets 拆写回三个 JSON + 角色 `define` 动态注册）、内置素材库、
  改 id 时同步更新引用节点（引用追踪 + 一致性校验）。

---

## 2026-09-30 阶段3 (二)：资源→运行时桥接打通

编辑器里定义的资源现在能在 Ren'Py 预览中真实生效，阶段3 Step 1–2 闭环。

- **`_aa.load_assets(assets)`**：直接读 `case.json` 的 `assets` 块注册证物/角色/背景。
  不拆分成三个 JSON 文件——case.json 自包含，预览链路无需改动。幂等，且与旧的
  `load_evidence`/`load_profiles` 路径并存（只注册尚不存在的条目）。
- **角色动态注册**：`setattr(store, id, aa_make_character(id))`，彻底去掉手写
  `define phoenix = aa_make_character("phoenix")` 的要求。`_get_char` 同时改为惰性创建，
  store 无该属性时从 profile 表按需构建，双重保障。
- **`aa_run_case`** 加载 case 后自动调用 `aa_load_assets`。
- **`_apply_scene`** 支持从 `_background_defs` 解析背景图路径；无图时显示带标签的占位色块，
  预览时能看出背景切换（素材未就绪阶段的过渡方案）。

### 踩坑记录：Ren'Py 的 `isinstance` 陷阱（本次根因）

初次验证 `load_assets` 注册数量全为 0。探针打出 `type='dict'` 但 `isinstance(assets, dict)`
为 **False** —— Ren'Py 为支持 rollback，会把 `python:` 块中加载的 JSON 数据包装成
`RevertableDict` / `RevertableList`，**它们不是内建 `dict`/`list` 的实例**。
于是 `_values()` 里的 `isinstance` 分支全部判假，返回空列表。

改用鸭子类型（`hasattr(section, "values")` → 否则尝试 `list(section)`）后立即正常。
排查发现 `Profile.__init__` 解析 `sprites` 多帧动画时有同类问题（`RevertableList` 会被
错误地再包一层导致嵌套），一并改为判断 `isinstance(path, str)`。

> 教训：在 Ren'Py 的 `python:` 块里处理外部数据，**不要用 `isinstance` 判断 dict/list**。

### 验证方法（含一个自动化陷阱）

Ren'Py 启动后停在主菜单，`label start` 不会自动执行，所以纯后台运行永远跑不到被测代码——
这是前一轮"证物注册失败"误判的原因之一（另一原因是同步命令被取消，测试项目里跑的还是旧代码）。
解决：临时加 `label splashscreen`（启动即执行）作为探针入口，用写文件而非
`renpy.exports.log` 输出（后者需配置 `config.log` 才落盘）。

- 探针结果：`ev=1 prof=2 bg=2`，`ev_ids=['thinker']`、`prof_ids=['judge','phoenix']`、
  `bg_ids=['apartment','courtroom']`，且 `char_attr_ok=['phoenix','judge']` 证明角色动态注册成功。
- 回归：恢复测试项目原状（旧式外部 JSON + `define` 角色）后 lint **零错误零警告**，向后兼容。
- 临时探针文件与调试代码已全部清除。

---

## 2026-09-30 (二) 阶段3 (三)：引用追踪 + 一致性校验

让编辑器能主动发现「会导致卡关」的问题，而不只是画得好看。

### 新增 `src/analysis/`

- **`references.ts` — 统一引用遍历器**。核心设计是 `visitNodeRefs` 只写一次，
  让**收集索引 / 重命名传播 / 一致性校验**三件事复用同一份遍历。
  之前 `backfillAssets` 自己写了一套扫描，若再为校验和重命名各写一套，
  三处迟早因漏掉某个字段而不一致 —— 现在 `backfillAssets` 也改为复用它。
  遍历时区分 `define`（证物的获得处）与 `use`（使用处）两种语义角色，
  这是「伏笔回收」能力的基础。
- **`validate.ts` — 一致性校验**：
  - 结构类：入口缺失、断链、不可达、死胡同、举证未设正确证物、证言为空、选项过少
  - 引用类：引用了不存在的资源、**证物用了但流程中从未获得**（卡关，error）、
    资源定义后从未使用
  - 证物可得性用**不动点迭代求交集**（must-have 分析）：只有在所有到达路径上
    都已获得的证物才算必然持有。因此「某条分支忘了发证物」会作为
    `evidence-maybe-missing` warning 报出，而不是漏报。

### 编辑器体验

- **`InspectorPanel`**：底部可折叠面板。
  - 「检查」Tab 列出全部问题，点击即定位到对应节点；标签页上直接显示 `✖N ⚠N` 计数
  - 「引用追踪」Tab 选一个资源，即可看到它的**获得处**与**使用处**；
    证物若无获得处会直接红字警告「流程中从未获得 —— 举证将无法通过」
- **改资源 id 时同步改写所有引用**（`renameRefs`），不再留下孤儿引用。
  三个 `upsertXxx` 原本是三段同构代码，一并抽成泛型 `upsertAsset`。
- 删除资源前检查引用数并二次确认。

### 验证

- **引入 vitest** 并写了 19 个单测覆盖引用索引、重命名传播、各类校验规则
  （含卡关检测的 error/warning 分级、循环流程不死循环），全部通过。
  这些是纯函数算法，单测比手点浏览器可靠得多。
  - 注：vitest 5 要求 Vite 6+，与本项目 Vite 5 不兼容，锁定 `vitest@^2.1.9`。
- 真实 `game/aa/case.json`（10 节点、36 个引用点）跑校验：**0 error**，
  只有 `ending` 节点的 dead-end 提示 —— 结局节点本就无后继，属合理边界报告。
- `tsc -b` + 生产构建（214 模块）通过；浏览器实测面板渲染、Tab 切换、
  问题列表与引用追踪下拉均正常，控制台零报错。

---

## 2026-09-30 (三) 阶段3 (四)：占位素材 — 零素材也能出成品

M3 判定标准是「零素材玩家可用内置素材库做出完整一小节」。经典立绘/音效涉及
版权与素材准备，先把**占位**这层做扎实：素材未就绪时不再是一片空白，而是
「配色块 + 名称标签」，作者能看清"谁在说话、在哪个场景、拿的什么证物"。

### 统一占位生成器

- `_aa.make_placeholder(kind, key, name, size)`：同一 id 恒定映射到同一配色
  （`hash(id) % palette`），作者可凭颜色区分对象；标签写明【背景】/【立绘】/
  【证物】+ 名称，一眼看出缺哪类素材。
- `resolve_background` / `resolve_sprite` / `resolve_evidence_icon`：
  真实素材优先（`renpy.exports.loadable` 校验路径），否则回退占位。
  暴露为 store 级 `aa_resolve_*` 别名，供 runtime 与 screens 共用。
- runtime 原本自己写了一份背景占位逻辑，改为转发到 `resolve_background`，
  消除重复实现。

### 补齐两处从未实现的消费点

排查时发现 `Profile.get_sprite` / `Evidence.get_icon` **定义了但没有任何调用方** ——
也就是立绘和证物图标此前根本没被显示过。一并补上：

- **角色立绘**：`_say_line` 说话时自动 `_show_speaker`，按角色 `position`
  分配站位 tag（`aa_sprite_left` 等），切换说话者时替换同位置立绘而非堆叠。
- **证物面板**：法庭记录的每个证物加上图标（此前只有文字）。

### 验证（重点：排除静默失败）

`_show_speaker` 内部有 `try/except`（立绘只是演出增强，不该打断对话），
但这意味着它失败时会静默 —— 所以不能只看"没报错"就认为成功。用严格探针取证：

```
_show_speaker called ok
showing tags = ['aa_sprite_left', 'black']
raw show ok, pos=left
```

`showing tags` 里出现 `aa_sprite_left` 是决定性证据：立绘确实被显示到了
master 层，且站位正确解析为 phoenix 定义的 `left`。

- 运行期探针确认三类占位图均成功构造（`MultiBox`，即 Composite 的内部类型）
- 实跑案件无 `errors.txt`；恢复测试项目原状后回归 lint 零错误
- 临时探针文件已清除

### 踩坑

在 `init python in _aa` 命名空间里，裸 `Composite` / `Solid` / `Text` **不可见**，
必须写 `store.Composite` 等全限定名（core 里既有代码用的是 `renpy.text.text.Text`，
同源问题）。这与之前记录的 `isinstance` 陷阱一样，都属于 Ren'Py 命名空间的坑。

---

## 2026-10-01 文字速度调研（结论：无需研究，但有两处待接线）

起因：`00aa_text.rpy` 的 `_aa_text_tags` 里列了 `aa_speed` / `aa_shake` / `aa_big`，
且注释称「自定义 TextTag 需引擎级支持，须修改 `renpy.text.text.Text`」。
核对 Ren'Py 8.5.3 源码后，**这个判断是错的** —— 速度控制原生就支持。

### 引擎已具备的能力（无需改引擎）

| 层级 | 手段 | 源码位置 | 作用范围 |
|---|---|---|---|
| 句内局部 | `{cps=30}`、`{cps=*0.5}`（倍率） | `text.py:1552` | 一句话里的任意片段 |
| 角色专属 | `Character(slow_cps=...)` / `what_slow_cps` 样式 | `text.py:760` | 某角色所有台词 |
| 全局默认 | `config.default_text_cps` / `preferences.text_cps` | `preferences.py:112` | 整个游戏 |
| 玩家偏好 | 设置菜单文字速度滑条 | 同上 | 玩家自行调整 |

配套节奏标签同样原生：`{w=0.5}` `{p=0.5}` `{nw}` `{fast}`（`text.py:1401` / `1411`）。
逆转裁判式顿挫感（「**証**…**言**…**の**…**矛盾**」）用 `{cps=5}` + `{w=0.3}` 即可做出。

### 项目里的两处**未接线**（属实现工作，不是研究）

- 全局 `config.default_text_cps` 未设置，目前用引擎默认值
- `make_aa_character` 只透传了 `color` 和打字音 callback，**没透传 `slow_cps`** ——
  角色定义里即使写速度字段也不生效

### 做不到的

文字级抖动（`aa_shake`）无原生支持：`config.custom_text_tags` 的机制是
**文本替换**（展开成内置标签组合），不是自定义渲染。要做只能靠整框 Transform 抖动
或自定义 Displacement，代价较大 —— 归入阶段 4 的演出配置一并考虑。

### 结论

用户决定**不列为研究项**。已在 `project-plan.md` 阶段 3 附记现状；
`00aa_text.rpy` 中那句错误注释应在动工时一并更正。

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
