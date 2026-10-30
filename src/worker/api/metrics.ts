/**
 * `POST /api/metrics/event` —— 浏览器埋点。
 *
 * 这是本站**唯一一个不回信封的 `/api` 写接口**：它是一次计数，不是一次
 * 数据读取。成功回 `204`，没有 body；失败按常规错误信封回 4xx。
 *
 * 四道校验，顺序固定：
 *   1. 方法必须是 POST；
 *   2. `Origin` 若有就必须等于本站 origin；
 *   3. body ≤ 512 字节、是对象；
 *   4. `event` 在客户端白名单里，`dim` 命中该事件的受控词表。
 *
 * **D1 写失败也是 204。** 埋点失败不该在浏览器控制台留下一个红请求，
 * 更不该让用户看到错误。指标缺席时报告显示「未采集」，不会补零。
 */

import { isClientMetricEvent, isValidMetricDim } from "@/shared/metrics";
import { recordMetric } from "@/worker/db/metrics-store";
import type { Env, ExecutionContextLike } from "@/worker/env";
import { jsonError, makeError } from "./respond";

/** 一个事件的请求体只有两个短字段；512 字节已经非常宽松。 */
const MAX_BODY_BYTES = 512;

function noContent(topics: readonly string[]): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "cache-control": "no-store",
      "x-repo-topics": topics.join(","),
    },
  });
}

export async function handleMetricEvent(
  env: Env,
  request: Request,
  topics: readonly string[],
  ctx?: ExecutionContextLike,
): Promise<Response> {
  if (request.method.toUpperCase() !== "POST") {
    return jsonError(
      makeError("client_unsupported", { message: "这个接口只支持 POST。" }),
      { topics, status: 405 },
    );
  }

  const origin = request.headers.get("origin");
  if (origin !== null && origin !== new URL(request.url).origin) {
    return jsonError(makeError("invalid_payload", { message: "这个请求不是本站发起的。" }), {
      topics,
      status: 403,
    });
  }

  const text = await request.text();
  /* 按字节量，不按字符 —— 一个汉字是 3 字节，长度 ≠ 体积。 */
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    return jsonError(makeError("payload_too_large"), { topics, status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    return jsonError(makeError("invalid_payload"), { topics, status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return jsonError(makeError("invalid_payload"), { topics, status: 400 });
  }

  const { event, dim } = body as { event?: unknown; dim?: unknown };
  if (!isClientMetricEvent(event)) {
    return jsonError(makeError("invalid_payload", { message: "不认识这个事件。" }), {
      topics,
      status: 400,
    });
  }
  if (typeof dim !== "string" || !isValidMetricDim(event, dim)) {
    return jsonError(makeError("invalid_payload", { message: "事件的维度不对。" }), {
      topics,
      status: 400,
    });
  }

  /* 指标是旁路：写入交给 waitUntil，失败由 `recordMetric` 吞掉。 */
  await recordMetric(env, event, dim, 1, ctx);

  return noContent(topics);
}
