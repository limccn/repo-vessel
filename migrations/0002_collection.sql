-- M3 入龛：收录、认领、下架申请，以及收集中断后的游标。
--
-- 四张表都是**只新增**，不改 `repo_cache`。缓存仍然是旁路：这四张表丢了，
-- 榜单会回 failed、Cron 会直接返回，站点其余部分照常工作。
--
-- 三处刻意的设计：
--   * `full_name` 一律小写 —— GitHub 的 owner / repo 都不区分大小写，
--     用小写全名做主键，同一个仓库不会收成两条。
--   * `hidden_by` 在 `collected_repo` 上 —— 匿名下架也要能隐藏，而它没有认领记录。
--   * `takedown_request` 只存 HMAC 过的 IP —— 够限流，不够反查人。

CREATE TABLE IF NOT EXISTS collected_repo (
  full_name       TEXT PRIMARY KEY,
  owner           TEXT NOT NULL,
  name            TEXT NOT NULL,
  owner_type      TEXT,
  is_private      INTEGER,
  is_fork         INTEGER,
  archived        INTEGER,
  star_count      INTEGER,
  fork_count      INTEGER,
  pushed_at       TEXT,
  created_at      TEXT,
  description     TEXT,
  language        TEXT,
  topics_json     TEXT,
  enrolled_topic  TEXT,
  -- pending | verified | unverified | delisted
  verify_state    TEXT NOT NULL,
  verify_failures INTEGER NOT NULL DEFAULT 0,
  verified_at     TEXT,
  first_seen_at   TEXT NOT NULL,
  last_seen_at    TEXT NOT NULL,
  -- private | org | no-topic | hidden
  delisted_reason TEXT,
  delisted_at     TEXT,
  -- NULL | 'owner' | 'takedown'
  hidden_by       TEXT
);

-- 榜单查询的唯一入口：已核实、未隐藏，再按 pushed_at 切片。
CREATE INDEX IF NOT EXISTS idx_collected_board
  ON collected_repo (verify_state, hidden_by, pushed_at);

CREATE TABLE IF NOT EXISTS repo_claim (
  full_name  TEXT PRIMARY KEY,
  login      TEXT NOT NULL,
  claimed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_claim_login ON repo_claim (login);

CREATE TABLE IF NOT EXISTS takedown_request (
  ticket     TEXT PRIMARY KEY,
  full_name  TEXT NOT NULL,
  reason     TEXT,
  -- received | actioned | rejected
  status     TEXT NOT NULL,
  ip_hash    TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_takedown_ip ON takedown_request (ip_hash, created_at);

-- Cron 的断点。游标不进 `repo_cache`：缓存是旁路，而游标是收集中枢自己的状态。
CREATE TABLE IF NOT EXISTS collection_state (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
