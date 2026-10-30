# 运维手册

> 面向维护者。回答三个问题：**怎么发布**、**Cron 在做什么**、**收到一张下架工单怎么办**。
>
> 它不是设计文档。规则与理由在 `docs/roadmap.md` 与本目录的交互 / 视觉规范里；这里只有命令。

所有命令都在仓库根目录执行。`wrangler.prod.jsonc` 是维护者本地的生产配置（不入库），
下面凡是 `--remote` 的命令都要带上它。

---

## 一、发布

```bash
# 1. 迁移先行 —— 没有表，榜单会回 failed（而不是空榜）
npx --yes wrangler@4.156.0 d1 migrations apply repo-vessel --remote --config wrangler.prod.jsonc

# 2. 再发代码
npx --yes wrangler@4.156.0 deploy --config wrangler.prod.jsonc
```

顺序不能反。但反了也不是灾难：**缺表时榜单返回 `failed`、Cron 直接返回、站点其余部分照常工作** ——
这是刻意的降级，不是意外。

`wrangler@` 版本要显式带上：`package.json` 没有钉 wrangler，缓存里的旧版本会拒绝启动
（`compatibility_date: 2026-10-30` 太新）。

### 改配置时的锁步要求

`wrangler.jsonc` 是给「Deploy to Cloudflare」按钮用的无域名模板（没有 `routes`、
`workers_dev: true`）；`wrangler.prod.jsonc` 是生产配置（自定义域名、`workers_dev: false`）。
两者必须同时改：`main`、Worker 名、D1 `database_name`、`REPO_TOPICS`、两条 `rules`、
`run_worker_first`、`triggers.crons`。`routes` / `workers_dev` 是**刻意不同**的一组：CI 的发布前
补丁会把生产域名注入 `wrangler.jsonc` 并关掉 workers.dev，锚点找不到就报错退出。
少一项的表现是部署警告、名字不匹配报错，或者——最糟的一种——Cron 在生产上根本不触发。

### 回滚

```bash
npx --yes wrangler@4.156.0 rollback <version-id> --config wrangler.prod.jsonc
npx --yes wrangler@4.156.0 tail --config wrangler.prod.jsonc   # 观察日志
```

**不要回滚数据。** 认领与下架记录一旦产生就应保留，它们是所有者的意愿。

---

## 二、Cron

`triggers.crons` 里只有一行：`17 */6 * * *`。每六小时一次，每次预算：

| 项 | 上限 | 常量 |
|---|---|---|
| 搜索页 | 8 | `SEARCH_BUDGET`（`src/worker/collect/budget.ts`） |
| 复核仓库 | 40 | `VERIFY_BUDGET` |
| 并发 | 8 | `VERIFY_CONCURRENCY` |
| 下架阈值 | 连续 6 次失败 | `MAX_VERIFY_FAILURES` |

轮次是可续的：游标存在 `collection_state` 的 `cursor` 键上，进程被打断也从上次那一页接着翻。

```bash
# 看这一轮做了什么
npx --yes wrangler@4.156.0 tail --config wrangler.prod.jsonc --format pretty | grep '^collect:'

# 游标现在在哪（page / cycle / 上次摘要）
npx --yes wrangler@4.156.0 d1 execute repo-vessel --remote --config wrangler.prod.jsonc \
  --command "SELECT value FROM collection_state WHERE key = 'cursor'"
```

日志里的一行大概长这样：

```
collect: 搜索 8 页、发现 412 条；复核 37 条（下架 3、未确认 4）
```

**「发现得多、核实得少」是正常的**：一次运行只复核 40 个，剩下的排队等下一轮。
**「unconfirmed 很高」通常意味着限流**，不是仓库出了问题 —— 见 §四。

---

## 三、下架工单

提交是匿名的，页面只给用户一个工单号。**提交不会自动隐藏仓库** —— 处理要人来做。

### 1. 看有哪些待处理

```bash
npx --yes wrangler@4.156.0 d1 execute repo-vessel --remote --config wrangler.prod.jsonc \
  --command "SELECT ticket, full_name, reason, created_at FROM takedown_request WHERE status = 'received' ORDER BY created_at"
```

承诺时限是 **24 小时**（写在 `src/worker/api/takedown.ts` 的 `SLA_HOURS`，也写进载荷给用户看）。

### 2. 核实归属

下架申请与认领是两条独立的路径：认领靠 GitHub 登录**证明**归属，下架申请靠说明**主张**归属。
没有登录的那一条只能靠人判断。判断不了就回复「拒绝」，不要含糊地处理成「已处理」。

### 3. 处理

```bash
# 下架（隐藏优先于主题：即使它重新带上主题也不会回到榜单）
npx --yes wrangler@4.156.0 d1 execute repo-vessel --remote --config wrangler.prod.jsonc \
  --command "UPDATE collected_repo SET verify_state = 'delisted', delisted_reason = 'hidden', hidden_by = 'takedown', delisted_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), last_seen_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE full_name = '<owner/name>'"

# 清掉榜单缓存（下一次读取会重建，不含这条）
npx --yes wrangler@4.156.0 d1 execute repo-vessel --remote --config wrangler.prod.jsonc \
  --command "DELETE FROM repo_cache WHERE cache_key IN ('board:longest-sleep','board:embers','board:forks')"

# 关掉工单
npx --yes wrangler@4.156.0 d1 execute repo-vessel --remote --config wrangler.prod.jsonc \
  --command "UPDATE takedown_request SET status = 'actioned', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE ticket = '<ticket>'"
```

`full_name` 一律小写。仓库没有出现在 `collected_repo` 里时，前两条是空操作 ——
那就只关工单，并在回复里说明「它本来就不在龛里」。

**分享图缓存会自己过期**（`caches.default`，6 小时），没有命令行可以清。如果要立刻失效，
部署一次即换新 isolate；或者接受最多 6 小时的延迟 —— 那张图是快照，它不改变数据。

### 4. 误下架的恢复

```bash
npx --yes wrangler@4.156.0 d1 execute repo-vessel --remote --config wrangler.prod.jsonc \
  --command "UPDATE collected_repo SET verify_state = 'unverified', delisted_reason = NULL, delisted_at = NULL, hidden_by = NULL, verify_failures = 0 WHERE full_name = '<owner/name>'"
```

写 `unverified` 而不是 `verified`：**恢复的是「重新排队」，不是「我说它合格」**。
下一轮 Cron 会去 GitHub 看一眼，通过了才回到榜单。

---

## 四、常见故障

| 症状 | 先看 | 通常是什么 |
|---|---|---|
| 三个榜单全是 `failed` | `wrangler d1 migrations apply` 跑过没有 | 0002 没应用 |
| 榜单一直是空 | `SELECT COUNT(*) FROM collected_repo` | Cron 没触发（`wrangler.prod.jsonc` 少了 `triggers`），或 `GITHUB_API_TOKEN` 没设 |
| `unconfirmed` 特别多 | `wrangler tail` 里的 `rate_limited` | 读配额被别的东西占了；等一小时 |
| 某个仓库反复 `unverified` | `verify_failures` 列 | 连续的读失败；到 6 次会下架。确认它仍公开就手动清零 |
| 认领一直 401 | `SESSION_SECRET` 是否设置 | 缺密钥时登录**失败关闭**，没有后门 |
| 匿名下架提交 503 | `takedown_request` 表 | 表不存在，或 D1 绑定丢了 |
| 测量报告全是「未采集」 | `d1 migrations apply` 跑过没有；有没有流量 | 0003 没应用，或窗口内真的没有事件。两者报告会分开写 |

---

## 五、测量

口径与事件表在 `docs/metrics.md`；这里只有命令。生产报告要读远端 D1，因此带
`--config wrangler.prod.jsonc`（与部署同一份配置）：

```bash
# 最近 30 天，Markdown 到 stdout
npm run metrics -- --config wrangler.prod.jsonc

# 最近 7 天，存一份快照
npm run metrics -- --config wrangler.prod.jsonc --days 7 --out docs/metrics-report.md

# 结构化输出，给别的脚本读
npm run metrics -- --config wrangler.prod.jsonc --json
```

- `migrations/0003_metrics.sql` 由 §一 的 `d1 migrations apply` 一起应用。**没应用也不会坏事**：
  `/api/metrics/event` 仍回 `204`，报告写「未采集（迁移未应用）」并**退出码 0**。
- 报告只读：两条 `SELECT`（`metrics_daily`、窗口内 `takedown_request`），不需要新 secret。
- 低于 100 次事件时报告会标注「样本不足，不下结论」——照它说的做。
- 工单处理时长取 `updated_at - created_at`，**关闭工单时一定要写 `updated_at`**（§三 的命令已经写了）。

```bash
# 直接看最近几行原始计数
npx --yes wrangler@4.156.0 d1 execute repo-vessel --remote --config wrangler.prod.jsonc \
  --command "SELECT day, event, dim, count FROM metrics_daily ORDER BY day DESC, event LIMIT 20"
```

指标是旁路：它不参与任何读路径，回滚代码不需要回滚表。

---

## 六、本地开发

```bash
npx --yes wrangler@4.156.0 d1 migrations apply repo-vessel --local   # 本地表
npx --yes wrangler@4.156.0 dev --port 8787 --local                   # Worker + 静态产物
npm run dev                                                          # 只跑 SPA（Vite）
```

本地 Cron 不会自己跑；要触发 `scheduled`，用 `--test-scheduled` 启动后请求
`http://localhost:8787/__scheduled?cron=17+*/6+*+*+*`。但**它需要 `GITHUB_API_TOKEN`**，
放在 `.dev.vars` 里（该文件不入库）。

冒烟三连：

```bash
curl -s http://localhost:8787/api/board/longest-sleep          # complete + entries
curl -s -X POST http://localhost:8787/api/takedown -H 'content-type: application/json' -d '{"repo":"a/b"}'
curl -s http://localhost:8787/api/takedown/<ticket>            # received
```
