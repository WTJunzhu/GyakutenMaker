// 一键预览配置
//
// 预览 = 把编辑器当前 case.json 写入 Ren'Py 测试项目 → 清缓存 → 启动 Ren'Py。
// 这些路径可通过环境变量覆盖（在 editor/ 下建 .env.local）：
//   AA_RENPY_SDK   Ren'Py SDK 根目录（含 renpy.py）
//   AA_TEST_PROJECT 可运行的测试项目根目录（含 game/aa/case.json）
//
// 注意：本文件在 Node 侧（Vite 插件）被读取，不进浏览器 bundle。

import { homedir } from "node:os";
import { join } from "node:path";

const HOME = homedir();

export interface PreviewConfig {
  /** Ren'Py SDK 根目录（含 renpy.py） */
  sdkDir: string;
  /** 测试项目根目录（含 game/ 与 game/aa/） */
  projectDir: string;
  /** SDK 内置 python 解释器（跨平台，避免依赖系统 python） */
  pythonBin: string;
}

export function loadPreviewConfig(): PreviewConfig {
  const sdkDir =
    process.env.AA_RENPY_SDK || join(HOME, "Projects", "renpy-8.5.3-sdk");
  const projectDir =
    process.env.AA_TEST_PROJECT || join(HOME, "Projects", "GyakutenMaker-AATest");
  const pythonBin = join(sdkDir, "lib", "py3-mac-universal", "python");

  return { sdkDir, projectDir, pythonBin };
}
