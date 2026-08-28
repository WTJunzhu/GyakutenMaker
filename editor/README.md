# 逆转裁判制作器 — 案件编辑器 (Phase 2 MVP)

可视化编辑 `case.json` 的桌面/Web 应用。编辑器只产出数据（JSON），
运行时（`renpy/common/00aa_runtime.rpy`）读数据解释执行。
**单一事实来源 = `case.json`。**

## 技术栈

- Vite + React 18 + TypeScript
- React Flow (`@xyflow/react`) — 节点连线画布
- Zustand — 状态管理
- （后续）Tauri — 桌面外壳 + 本地文件读写

## 开发

```bash
cd editor
pnpm install
pnpm dev        # http://localhost:5175
pnpm build      # 类型检查 + 打包
```

## 三大区

1. **工具栏**（顶部）：新建 / 导入 / 导出 case.json；**一键预览**；添加各类型节点
2. **流程画布**（中间）：拖拽节点、连线（source→target 写入 `next`）、缩放、小地图
3. **属性面板**（右侧）：编辑选中节点的 ID / 类型 / next / 类型专属字段
   - `dialogue` 已有可视化表单（对话行增删改）
   - 其余类型暂用 JSON 编辑器，后续逐个做可视化表单

## 一键预览

点击工具栏「▶ 一键预览」→ 把当前 `case.json` 写入 Ren'Py 测试项目 → 清缓存 → 启动 Ren'Py。

实现：dev server 挂了个轻量后端插件（`preview/vitePreviewPlugin.ts`），零额外依赖。
路径默认指向本机 `~/Projects/renpy-8.5.3-sdk` 与 `~/Projects/GyakutenMaker-AATest`，
可在 `editor/.env.local` 覆盖：

```
AA_RENPY_SDK=/path/to/renpy-sdk
AA_TEST_PROJECT=/path/to/runnable-project
```

诊断端点：`GET /api/preview/config` 返回解析到的路径与存在性。

> 后续迁 Tauri 时，只需把这段后端逻辑换成 Rust command，前端调用（`src/api/preview.ts`）保持不变。

## 数据契约

节点类型与字段定义见 `src/types/case.ts`，严格对齐运行时解释器。
`_editor` 命名空间存画布坐标，运行时忽略。

## 里程碑

- **M2（目标）**：非程序员能做出「一段对话 + 一个搜证点 + 一次举证」并预览。
- 当前进度：脚手架 ✅ / 画布+属性面板 ✅ / 读写 case.json ✅ / 一键预览 ✅
