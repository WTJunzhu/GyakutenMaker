// Vite 开发插件：提供一键预览后端能力。
//
// 端点：
//   POST /api/preview   body = { caseData: CaseData }
//     1) 校验 case.json 基本合法性
//     2) 写入 <projectDir>/game/aa/case.json
//     3) 删除 game/ 下所有 .rpyc 缓存
//     4) 启动 Ren'Py（分离进程），返回是否已有实例、启动结果
//   GET  /api/preview/config  返回当前解析到的路径（供前端展示/诊断）
//
// 说明：这是开发期的轻量方案（零额外依赖），后续迁 Tauri 时
// 只需把这段逻辑换成 Rust command，前端调用保持不变。

import type { Plugin, Connect } from "vite";
import { spawn, execSync } from "node:child_process";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadPreviewConfig } from "./config";

function readBody(req: Connect.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function sendJson(res: any, status: number, obj: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(obj));
}

export function previewPlugin(): Plugin {
  return {
    name: "aa-preview-backend",
    configureServer(server) {
      const cfg = loadPreviewConfig();

      server.middlewares.use("/api/preview/config", (_req, res) => {
        sendJson(res, 200, {
          ...cfg,
          sdkExists: existsSync(join(cfg.sdkDir, "renpy.py")),
          projectExists: existsSync(join(cfg.projectDir, "game")),
          pythonExists: existsSync(cfg.pythonBin),
        });
      });

      server.middlewares.use("/api/preview", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
          return;
        }
        try {
          const body = await readBody(req);
          const parsed = JSON.parse(body || "{}");
          const caseData = parsed.caseData;

          if (!caseData || !caseData.nodes || !caseData.entry) {
            sendJson(res, 400, {
              ok: false,
              error: "case 数据非法：缺少 nodes / entry",
            });
            return;
          }
          if (!caseData.nodes[caseData.entry]) {
            sendJson(res, 400, {
              ok: false,
              error: `入口节点 "${caseData.entry}" 不存在`,
            });
            return;
          }

          // 路径存在性检查
          const renpyPy = join(cfg.sdkDir, "renpy.py");
          if (!existsSync(renpyPy)) {
            sendJson(res, 500, {
              ok: false,
              error: `找不到 Ren'Py SDK: ${renpyPy}（用 AA_RENPY_SDK 环境变量覆盖）`,
            });
            return;
          }
          if (!existsSync(join(cfg.projectDir, "game"))) {
            sendJson(res, 500, {
              ok: false,
              error: `找不到测试项目: ${cfg.projectDir}（用 AA_TEST_PROJECT 覆盖）`,
            });
            return;
          }

          // 1) 写 case.json
          const aaDir = join(cfg.projectDir, "game", "aa");
          if (!existsSync(aaDir)) mkdirSync(aaDir, { recursive: true });
          const casePath = join(aaDir, "case.json");
          writeFileSync(casePath, JSON.stringify(caseData, null, 4), "utf-8");

          // 2) 清 .rpyc 缓存（改数据后必须清，否则可能读旧编译产物）
          try {
            execSync(`find "${join(cfg.projectDir, "game")}" -name "*.rpyc" -delete`);
          } catch {
            // 缓存清理失败不致命，继续
          }

          // 3) 启动 Ren'Py（分离进程，不阻塞 dev server）
          const python = existsSync(cfg.pythonBin) ? cfg.pythonBin : "python3";
          const child = spawn(python, [renpyPy, cfg.projectDir, "run"], {
            detached: true,
            stdio: "ignore",
          });
          child.unref();

          sendJson(res, 200, {
            ok: true,
            casePath,
            message: "已写入 case.json 并启动 Ren'Py 预览",
          });
        } catch (e) {
          sendJson(res, 500, { ok: false, error: (e as Error).message });
        }
      });
    },
  };
}
