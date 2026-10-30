-- M1 · 读取缓存
--
-- 这张表只做缓存，不是事实来源：删掉它，功能仍然正确，只是更慢、更费 GitHub 配额。
--
-- payload 存的是**组装后的信封**，不是原始 GitHub 响应 —— `dormantDays` 是相对
-- `readAt` 算出来的天数，两者必须来自同一时刻，否则界面上的「数据截至 X」会是假的。
--
-- failed 的信封不写入：把一次失败缓存住，等于把故障延长一个 TTL。

CREATE TABLE IF NOT EXISTS repo_cache (
  cache_key  TEXT PRIMARY KEY,
  payload    TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_repo_cache_fetched_at ON repo_cache (fetched_at);
