-- M4 测量：按「日 × 事件 × 维度」聚合的计数。
--
-- 三条设计：
--   * **不落单条事件。** 一天最多几十行，没有一行能还原成某个人。
--   * **主键就是聚合键。** 重复提交只会把 count 加一，不会写坏。
--   * **没有 ip_hash / user_agent / 会话列。** 指标不需要「同一个来源」，
--     需要限流的是下架工单，那张表自己存 HMAC。
--
-- 事件名与维度由 `src/shared/metrics.ts` 定义；读取见 `docs/metrics.md`。

CREATE TABLE IF NOT EXISTS metrics_daily (
  day   TEXT NOT NULL,              -- YYYY-MM-DD，UTC
  event TEXT NOT NULL,              -- page_view | inspect_read | claim_action | …
  dim   TEXT NOT NULL DEFAULT '',   -- 受控维度；'' 表示没有维度
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, event, dim)
);
