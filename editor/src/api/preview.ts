import type { CaseData } from "../types/case";

export interface PreviewResult {
  ok: boolean;
  message?: string;
  error?: string;
  casePath?: string;
}

/** 调用 dev server 的预览端点：写 case.json → 清缓存 → 启动 Ren'Py */
export async function requestPreview(caseData: CaseData): Promise<PreviewResult> {
  try {
    const res = await fetch("/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseData }),
    });
    return (await res.json()) as PreviewResult;
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
