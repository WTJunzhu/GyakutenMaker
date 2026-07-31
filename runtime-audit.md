# 运行时现状审计（阶段0 收尾第一步产出）

> 日期：2026-07-31
> 方法：源码级静态验证（本仓库自带完整 Ren'Py SDK 源码，可直接查证引擎契约，比 GUI 实跑更确定）
> 结论一句话：**现有 `00aa_statements.rpy` 的「块执行」逻辑存在架构性错误，凡带 `block="script"` 的语句都跑不通。虚拟机需要按 Ren'Py 正确契约重写块执行部分，之后才能被阶段1 的解释器安全复用。**

---

## 一、为什么改用源码级验证，而非启动 GUI 实跑

原计划：编译并启动 Ren'Py，跑 `game/test_case.rpy` 观察表现。探明环境后放弃该路径：

1. 本仓库是**完整 Ren'Py SDK 源码**，运行需 Python 3.12（系统为 3.9.6）+ Cython 编译整套 C 扩展（SDL2 / ffmpeg / freetype / harfbuzz / fribidi / assimp 均未安装）。从源码编译在 macOS 上耗时且易错。
2. 即便跑起来，GUI 需人眼观察、鼠标点击验证「对话是否正确显示并等待点击」，自动化 agent 无法可靠判读。
3. 本仓库**自带引擎全部源码**，Step 8/9/10 遗留「问题分支」的核心疑问（`renpy.execute()` 能否在自定义语句里显示对话）可 100% 静态查证。

因此改走静态路线，结论更硬。

---

## 二、核心发现：`renpy.execute()` 不存在，块执行模型用错了契约

### 证据 1 — `renpy.execute()` 这个 API 根本不存在

- `renpy/exports/` 全包无 `execute` 导出（`grep` 无结果）。
- `renpy/__init__.py` 无顶层 `execute` 名字；只有 `renpy.execution` **子模块** 与内部 `Node.execute()` **方法**。
- 但 `renpy/common/00aa_statements.rpy` 有 **6 处** `renpy.execute(node)` 调用：
  - 第 465 行 `next_begin_testimony`
  - 第 482、496 行 `press` / `present` 子块
  - 第 613 行 `next_investigate`（examine 块）
  - 第 710、720 行 `next_talk`（present / topic 块）

执行到任意一处即 `AttributeError: module 'renpy' has no attribute 'execute'`。

### 证据 2 — `next` handler 的第二个参数被当成了节点列表（实为 label name）

`renpy/ast.py:2319` `UserStatement.get_next()` 决定了传给 `next` 的第二个参数：

```python
def get_next(self):
    if self.code_block and len(self.code_block):
        rv = self.call("next", self.code_block[0].name)   # 传的是「block 首语句的 name」（label 元组）
    else:
        rv = self.call("next")
```

即：`block="script"` 时，`next(parsed, block)` 收到的 `block` 是 **block 首语句的 name（一个 label 标识）**，**不是节点列表**。

但 AA 代码把它当列表遍历，例如 `next_begin_testimony`：

```python
def next_begin_testimony(parsed, block):
    for node in block:          # block 是 name 元组，不是节点列表 → 遍历错误
        renpy.execute(node)     # 且该函数不存在
```

### 证据 3 — 官方正确契约：`next` 应「返回 name 转交控制权」，而非「自己执行节点」

`renpy/statements.py:113-123` 的 `register()` 文档 + `sphinx/source/cds.rst:316-332`：

> `block="script"` 时，`next` 应返回 `code_block[0].name`（或 `Lexer.renpy_block()` 的返回值），把控制权**转交进 block**。当 block 内语句执行完，控制权自动回到该自定义语句之后。返回 `None` 则跳过 block 直接执行下一句。

也就是说：block 里的 `say`/`stmt` 等语句应由 **Ren'Py 主执行循环原生执行**，绝不该由 handler 手动 `execute` 每个节点。现有代码用了一套引擎不支持的"手动解释"模型。

---

## 三、影响面

| 语句 | 注册 | 块执行状态 |
|------|------|-----------|
| `begin_testimony` / `cross_examination` | `block="script"` | ❌ 块执行错误 |
| `press` / `present` | `block="script"` | ❌ 块执行错误 |
| `investigate` / `examine` | `block="script"` | ❌ 块执行错误 |
| `talk` / `topic` | `block="script"` | ❌ 块执行错误 |
| `penalty` / `get_evidence` / `remove_evidence` / `set_flag` / `stmt` / `add_stmt` / `move` / `end_*` | 无 block（普通语句） | ✅ execute 逻辑本身可用 |
| 文本层 `00aa_text.rpy`（嘟嘟声/Character 回调） | — | ✅ 架构正确，使用标准 Character callback，不依赖 renpy.execute |

- `dev-steps.md` 将 Step 6-10 标为 `✅ 已完成`，但从代码看**块执行从未真正跑通**。git 历史近 8 个 commit 全是 "Fix registration" 类修补，佐证此结论。
- 非块语句与文本层的 `execute_*` 函数**逻辑本身可复用**——阶段1 解释器可直接调用。问题只集中在「block 内子语句如何被执行」这一机制上。

---

## 四、修复方向（供阶段1 设计参考，本步不改代码）

现有那套「手动遍历 block 节点并 `renpy.execute`」的思路，与阶段1「数据驱动解释器」的目标其实高度契合——**因为数据驱动方案下，流程本就不再依赖 `.rpy` 的 block 语法**。因此有两条路：

- **路线 A（推荐，直接对齐阶段1）**：不再依赖 `block="script"` 的手动执行。把证言/搜证/询问的「子步骤」从「`.rpy` block 内的节点」改为「`case.json` 里的数据数组」，由新的 `00aa_runtime.rpy` 解释器读 JSON、用 `renpy.call_screen` / `renpy.say` 等**官方 API** 逐项驱动。现有非块 `execute_*` 与文本层原样复用。
- **路线 B（仅修复现有 .rpy 语法）**：严格按官方契约重写 `next` handler——用 `renpy.say()` 主动显示对话、或返回 `code_block[0].name` 交还控制权。成本高且与阶段1 目标不完全一致，不推荐。

**建议：跳过路线 B，直接进入阶段1，用数据驱动解释器一次性替换掉这套有问题的块执行。** 现有可复用资产 = 全部非块 `execute_*` 函数（`penalty`/`get_evidence`/`set_flag`/…）、`CourtRecord` 数据类、`00aa_screens.rpy` 的 UI、`00aa_text.rpy` 的嘟嘟声。

---

## 五、结论

1. **现有 `execute_*` 能否被阶段1 解释器安全复用？**
   - 非块语句 execute 函数（`penalty` / `get_evidence` / `set_flag` / `move` / `stmt` 等）+ 文本层：✅ **可直接复用**。
   - 带 block 的语句其「块执行机制」：❌ **不可复用，需用官方 API 重写**（且正好并入阶段1 解释器一并解决）。
2. **阶段0「验证 renpy.execute() 隐患」任务**：已查清，隐患属实且比预期严重（是架构错误而非小 bug）。
3. **下一步建议**：直接进入阶段1，设计 `case.json` 流程节点 Schema + 编写 `00aa_runtime.rpy` 解释器，用数据驱动替换问题块执行；解释器分派到现有非块 `execute_*` 函数。预计 2~3 天可达 M1（不碰 .rpy、仅改 JSON 即可改变流程）。
