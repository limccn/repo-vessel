/**
 * `metrics_daily` 的写入。
 *
 * 指标是**旁路**：读不到、写不进、表没建，都不该改变任何主流程的响应。
 * 所以这里把两件事分开：
 *   - `incrementMetric` 是严格的那一层 —— 维度不合法就抛，开发期错误要看得见；
 *   - `recordMetric` 是旁路的那一层 —— 吞掉失败，只警告一次，绝不 await 在
 *     响应路径上（有 `ctx` 就交给 `waitUntil`）。
 *
 * 一天 × 一个事件 × 一个维度只有一行。维度来自 `src/shared/metrics.ts` 的
 * 受控词表，不可能把用户名、仓库名或 IP 写进来。
 */

import type { ExecutionContextLike, D1Like, Env } from "@/worker/env";
import { type MetricEvent, isValidMetricDim } from "@/shared/metrics";

const UPSERT =
  "INSERT INTO metrics_daily (day, event, dim, count) VALUES (?, ?, ?, ?) " +
  "ON CONFLICT(day, event, dim) DO UPDATE SET count = count + excluded.count";

/** UTC 日 —— 与 `readAt` 的时区一致，跨日只按 UTC 切。 */
export function utcDay(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/**
 * 加一笔。`amount` 允许大于 1（Cron 一次写五个增量）。
 *
 * 维度非法时抛错：那是代码写错了，不是用户输入错了；调用方必须经过
 * `recordMetric` 才会被吞掉。
 */
export async function incrementMetric(
  db: D1Like,
  event: MetricEvent,
  dim: string,
  amount = 1,
  at: Date = new Date(),
): Promise<void> {
  if (!isValidMetricDim(event, dim)) {
    throw new Error(`metrics: invalid dim for ${event}: ${dim}`);
  }
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error(`metrics: invalid amount: ${amount}`);
  }
  if (amount === 0) return;

  await db
    .prepare(UPSERT)
    .bind(utcDay(at), event, dim, amount)
    .run();
}

/** 每个 isolate 只警告一次 —— 缺迁移时不该每个请求刷一条日志。 */
let warned = false;

/**
 * 旁路写入。返回的 Promise 可以被 `await`（Cron），也可以忽略（请求路径）。
 * 有 `ctx` 时写进 `waitUntil`，响应不必等 D1。
 */
export function recordMetric(
  env: Env,
  event: MetricEvent,
  dim: string,
  amount = 1,
  ctx?: ExecutionContextLike,
): Promise<void> {
  const db = env.DB;
  if (!db) return Promise.resolve();

  const write = incrementMetric(db, event, dim, amount).catch((error: unknown) => {
    if (!warned) {
      warned = true;
      console.warn("metrics: write failed（指标缺席时报告会显示未采集）", error);
    }
  });

  if (ctx) {
    ctx.waitUntil(write);
    return Promise.resolve();
  }
  return write;
}
