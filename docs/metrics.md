# 测量

> 面向维护者。回答四个问题：**记什么**、**怎么记**、**怎么读**、**不能拿来做什么**。
>
> 产品口径的出处是 v4.1 §17 的七项指标；实现落在 `migrations/0003_metrics.sql`、
> `src/shared/metrics.ts`、`src/worker/db/metrics-store.ts` 与 `scripts/metrics-report.mjs`。
> 一处改动要四处对齐，尤其别让本文件与 `/how` 第五节的隐私说明说两套话。

---

## 一、四条原则

1. **指标是旁路。** 采集失败不改变主流程的响应：`/api/metrics/event` 在写库失败时仍回
   `204`；`handleInspect` 等主路径用 `ctx.waitUntil` 把写入推到响应之后。没有 D1 时，
   整个站点照常工作，只是没有数字。
2. **未知 ≠ 零。** 窗口内没有行，报告写「未采集」；有分母没有分子，才是 `0`。
   缺表、DNT、脚本被拦，都不该变成一行漂亮的零。
3. **匿名。** 不存 IP、User-Agent、Cookie、用户 ID；不接第三方统计；没有一行能还原成
   某个人。用户名与仓库名从不进入统计。
4. **近似值。** 同一事件同一维度一天只有一行，刷接口只会把那一行刷高；被广告拦截器
   拦掉的客户端请求也不会出现在这里。报告里每一页都带着这句话。

---

## 二、七项指标

窗口默认 **30 个 UTC 日**。分子与分母都取自**同一窗口**，不跨窗口拼。

| # | 指标 | 分子 | 分母 | 采集点 |
|---|---|---|---|---|
| 1 | 查询发起率 | `inspect_read` 总数 | `page_view` 中 `route=home` | 服务端 `handleInspect` · 客户端落地页 |
| 2 | 查询成功率 | `inspect_read` 中 `complete` + `partial` | `inspect_read` 总数 | 服务端 `handleInspect` |
| 3 | 分享卡生成率 | `share_card` 中 `ok` | `page_view` 中 `route=inspect` | 客户端 `SharePanel` |
| 4 | 分享链接访问量 | `userpage_view` 中 `src=share` | ——（绝对量） | 服务端 `handleUserPage` |
| 5 | 主题复制次数 | `topic_copy` 总数 | ——（绝对量） | 客户端 `HowRoute` |
| 6 | 认领与隐藏成功率 | `claim_action` 中 `claim:ok` / `hide:ok` / `restore:ok` | 同前缀的全部尝试 | 服务端 `handleClaim` |
| 7 | 误收录与下架处理时间 | `takedown_submit` 总数；已关闭工单的 `updated_at - created_at` 中位数 / P90 | —— | 服务端 `handleTakedownSubmit` · `takedown_request` |

**第 3 项的分母是鉴定页访问，不是画卡次数。** 卡在页面打开时自动画；拿 `ok + failed`
当分母，会漏掉「看了鉴定页但没有走到分享区」的人。

**第 6 项按动作分开报。** 认领、隐藏、恢复是三条不同的路径，合并成一个「成功率」
只会掩盖哪一条在漏。GET 请求不计数 —— 查看状态不是一次尝试。

**第 2 项的失败按 `failed:<code>` 分列。** `failed:invalid_username` 计入失败（用户确实
没拿到结果），但它不是上游故障；限流与输错不能合并成一个数。

### 辅助：状态核实失败率

`collect_run` 的 `unconfirmed` 增量 ÷（`verified_reads` + `unconfirmed`），由 Cron 每轮写入。
它只用于解释榜单为什么收缩，不对外展示。**限流的那一轮不记失败** —— 读不到是站点的问题，
不是仓库的问题。

### 三态

| 状态 | 什么时候 | 报告里的字 |
|---|---|---|
| 未采集 | 窗口内一行都没有，或 `metrics_daily` 表不存在 | `未采集` |
| 分母为零 | 采集正常，但没有人走到分母那一步 | `—（分母为 0）` |
| 有值 | 分子分母都有 | `42.0%` 或绝对数 |

样本总量低于 **100 次事件**时，报告头部标注「样本不足，不下结论」。这不是装饰：
6 次事件里的 50% 没有任何解释力。

---

## 三、事件与维度

事件名与维度校验在 `src/shared/metrics.ts`，SPA 与 Worker 共用一份。`dim` 是**受控维度**，
不是自由文本；字符集只到 `[a-z0-9:=.,_|-]`，长度不超过 64。

| 事件 | 谁记 | 维度 | 含义 |
|---|---|---|---|
| `page_view` | 客户端 | `route=<类别>,src=<来源>` | 一次页面访问。路由只到类别（`home` / `inspect` / `board` / …），**不含路径参数** |
| `share_card` | 客户端 | `ok` / `failed` | 分享卡画成功 / 画失败 |
| `topic_copy` | 客户端 | `topic=<slug>` | 主题**复制成功**才计；点一下但剪贴板没写进去不算 |
| `inspect_read` | 服务端 | `complete` / `partial` / `failed:<code>` | 一次鉴定读取的结果 |
| `claim_action` | 服务端 | `claim|hide|restore:ok|not_owner|is_org|not_public|not_enrolled|error:<code>` | 认领 / 隐藏 / 恢复的一次尝试 |
| `takedown_submit` | 服务端 | `received` | 工单写入成功 |
| `userpage_view` | 服务端 | `src=share|direct|crawler` | 一次 `/u/:username` 文档请求；爬虫优先判定，单列 |
| `collect_run` | 服务端 | `searches|discovered|verified_reads|delisted|unconfirmed` | Cron 本轮的增量，不是累计值 |

**来源分类**：`?from=share` 优先于 referrer（微信会剥掉 referrer）；外站 referrer 记
`external`；同站记 `internal`；没有 referrer 记 `direct`。分享链接由
`profileUrl()` 自动带上 `?from=share`。

**服务端 UA 只读不存。** `classifyUserPageRequest()` 用它把爬虫从「人来过」里分出去，
分类完就丢弃。

---

## 四、存储

`migrations/0003_metrics.sql`：

```sql
CREATE TABLE IF NOT EXISTS metrics_daily (
  day   TEXT NOT NULL,              -- YYYY-MM-DD，UTC
  event TEXT NOT NULL,              -- 事件名
  dim   TEXT NOT NULL DEFAULT '',   -- 受控维度
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, event, dim)
);
```

写入只有一句 upsert：

```sql
INSERT INTO metrics_daily (day, event, dim, count) VALUES (?, ?, ?, ?)
ON CONFLICT(day, event, dim) DO UPDATE SET count = count + excluded.count
```

- **按「日 × 事件 × 维度」聚合。** 一天最多几十行，表不随流量线性增长。
- **主键就是聚合键。** 重复提交只是 `count + 1`。
- **不做清理。** 留两年也只是几万行；趋势比空间值钱。
- **不加 `ip_hash`。** 指标不需要「同一个来源」；没有这一列，「能不能反查人」这个问题
  就不存在。
- **不建事件流表。** 需要明细时先问「这个明细会不会变成画像」，再谈加不加。
- **`amount === 0` 不写行。** 所以 Cron 的零值维度是**缺行**，不是 `0`；报告把
  `collect_run` 有行视为「跑过」，缺的维度按 0 读。负数或非整数会抛错 —— 那是代码错误，
  不是流量问题。

`takedown_request` 不新增列：工单关闭时 runbook 写入 `updated_at`，`actioned` / `rejected`
状态下的 `updated_at - created_at` 就是处理时长。

---

## 五、写入路径

**端点**：`POST /api/metrics/event`

```json
{ "event": "page_view", "dim": "route=home,src=direct" }
```

- 只接受 `CLIENT_METRIC_EVENTS` 三种；服务端事件（`inspect_read` 等）从这里发会被 `400` 拒掉。
- `Origin` 与本站不一致 → `403`；正文超过 512 字节 → `413`；非法 JSON / 维度 → `400`。
- 通过校验后**无论 D1 是否写得进去都回 `204`**，响应带 `Cache-Control: no-store` 与
  `x-repo-topics`。客户端不需要、也不应该知道一次计数是否落库。
- 客户端先试 `navigator.sendBeacon`，失败再退回带 `keepalive` 的 `fetch`；这两条都失败
  就静默放弃。
- `Do Not Track: 1` 或 `Global Privacy Control: true` 时，客户端**一条都不发**。

**服务端写入**统一走 `recordMetric(env, event, dim, amount, ctx?)`：没有 DB 直接返回；
传了 `ctx` 就 `ctx.waitUntil`；失败只警告一次（每个 isolate），不影响响应。

| 位置 | 记什么 |
|---|---|
| `handleInspect` | 成功读 → `completeness`；失败 → `failed:<code>`；用户名非法 → `failed:invalid_username` |
| `handleClaim` | 四种检查的拒绝原因、`claim:ok`、`hide:ok`、`restore:ok`；GET 不记 |
| `handleTakedownSubmit` | 写入成功才记 `received` |
| `handleUserPage` | 合法用户名才记 `src=...` |
| `runCollection` | 本轮五个增量（0 不写行） |

---

## 六、生成报告

```bash
npm run metrics                                  # 生产库 · 30 天 · Markdown 到 stdout
npm run metrics -- --days 7 --out docs/metrics-report.md
npm run metrics -- --config wrangler.prod.jsonc  # 生产配置（不入库的那一份）
npm run metrics -- --local                       # 本地 .wrangler 状态，联调用
npm run metrics -- --json                        # 结构化输出，给脚本读
```

- 只读：两条 `SELECT`，一条查 `metrics_daily`，一条查窗口内的 `takedown_request`。
- 读取走 `npx wrangler d1 execute DB --json`，不需要新 secret、新接口。
- **SQL 只做筛选，聚合在 Node 里算。** 「缺行」与「值为 0」只有在拿到原始分组之后才分得清。
- `metrics_daily` 不存在 → 整页写「未采集（迁移未应用）」，**退出码 0**；报告生成失败
  才用非零退出码。
- 报告不写进 CI，也不自动提交。要不要留一份快照，由维护者决定。

---

## 七、隐私边界

这一段与 `/how` 第五节说的是同一件事，改一处就要改另一处。

- 存的只有：UTC 日期、事件名、受控维度、次数。
- 不存：IP、User-Agent、Cookie、会话、用户 ID、Referer 原文、页面路径参数。
- 不接第三方统计脚本，不设统计 Cookie。
- 浏览器声明 DNT / GPC 时，本站不发任何客户端计数。
- 服务端不会因为「同一个人来了两次」而多存一行 —— 聚合键里没有任何身份。
- 下架工单的限流字段是 `HMAC(ip, SESSION_SECRET)`，那是工单表，不是指标表；两者不关联。

**站点做不到的事也要说清楚：** Cloudflare 平台自身的访问日志不受本站控制；广告拦截器、
企业代理会让一部分计数根本到不了服务端。所以这份报告是**方向**，不是审计。

---

## 八、怎么读第一份报告

先看样本量。低于 100 次事件时，只回答「有没有人在用」，不回答「比例是多少」。

样本够了之后，按这个顺序看：

1. **查询成功率**。低于预期先查上游：`failed:rate_limited` 与 `failed:upstream_unavailable`
   是配额和网络，`failed:account_not_found` 是输入。三种失败对应三种修法。
2. **查询发起率**。首页访问多、查询少 —— 说明首屏没说清「输入用户名能得到什么」。
3. **分享卡生成率**。鉴定页访问多、`ok` 少 —— 先查 canvas 与字体，再看用户是否根本没滚到分享区。
4. **分享链接访问量与主题复制次数**。两项都是绝对量：传播有没有发生，引导有没有被用。
5. **认领 / 隐藏 / 恢复成功率**。哪一条低，就去看那一条的拒绝原因分布。
6. **误收录与处理时间**。工单多说明收录规则需要收紧；处理时长超过 24 小时，先补人，再谈自动化。

指标只回答「哪里在漏」，不回答「该做哪个功能」。路线图里 M4 之后的候选方向
（分支比较、卡片模板、i18n、详情抽屉）**都还没有被决定** —— 报告是输入，不是裁决。
