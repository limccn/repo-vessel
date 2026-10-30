#!/usr/bin/env node
/**
 * 测量报告 —— 只读，不新增接口、不新增 secret。
 *
 *   npm run metrics -- --local                     # 本地 .wrangler 状态，联调用
 *   npm run metrics -- --config wrangler.prod.jsonc  # 生产库（需要 wrangler 登录态）
 *   npm run metrics -- --days 7 --out docs/metrics-report.md
 *   npm run metrics -- --json                      # 给脚本读的结构化输出
 *
 * 三态是这份报告的全部理由：
 *   - **未采集**：窗口内一行都没有（或 `metrics_daily` 表不存在）。不是 0。
 *   - **0**：有分母、没有分子。这是真的零。
 *   - **样本不足**：事件总数低于 100 时明确标注，不拿小数当结论。
 *
 * SQL 只做筛选，聚合与百分比都在 Node 里算 —— 「缺行」与「值为 0」只有在
 * 拿到原始分组之后才分得清。
 */

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WRANGLER = ["--yes", "wrangler@4.156.0"];
/* 用 binding 而不是 database_name：它在任何一份配置里都叫 DB，而
   database_name 在冒烟用的临时配置里可能不同。 */
const DATABASE = "DB";
const INSUFFICIENT_SAMPLE = 100;
const DEFAULT_DAYS = 30;

/* -------------------------------------------------------------------------- */
/* 参数                                                                        */
/* -------------------------------------------------------------------------- */

const HELP = `测量报告（只读）

用法：npm run metrics -- [选项]

  --days <n>      统计窗口，默认 ${DEFAULT_DAYS} 个 UTC 日
  --local         读本地 .wrangler 状态（不加则读远端）
  --config <path> 传给 wrangler 的配置文件，生产用 wrangler.prod.jsonc
  --out <path>    把 Markdown 写进文件（默认打印到 stdout）
  --json          输出结构化 JSON，不输出 Markdown
  --help          这份说明
`;

function parseArgs(argv) {
  const options = {
    days: DEFAULT_DAYS,
    local: false,
    config: null,
    out: null,
    json: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--local":
        options.local = true;
        break;
      case "--remote":
        options.local = false;
        break;
      case "--json":
        options.json = true;
        break;
      case "--help":
        options.help = true;
        break;
      case "--days": {
        const value = Number(argv[index + 1]);
        index += 1;
        if (!Number.isInteger(value) || value < 1 || value > 730) {
          fail("--days 需要 1–730 之间的整数。");
        }
        options.days = value;
        break;
      }
      case "--config":
        options.config = argv[index + 1] ?? null;
        index += 1;
        if (options.config === null) fail("--config 后面要跟一个路径。");
        break;
      case "--out":
        options.out = argv[index + 1] ?? null;
        index += 1;
        if (options.out === null) fail("--out 后面要跟一个路径。");
        break;
      default:
        fail(`不认识的参数：${arg}\n\n${HELP}`);
    }
  }

  return options;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

/* -------------------------------------------------------------------------- */
/* 读 D1                                                                       */
/* -------------------------------------------------------------------------- */

function parseOutput(stdout) {
  const text = stdout.trim();
  if (text.length === 0) return { rows: [], error: null };

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* wrangler 偶尔会在 JSON 前面打一行提示；截取最外层的数组再试一次。 */
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start === -1 || end <= start) {
      throw new Error(`wrangler 的输出不是 JSON：\n${text.slice(0, 500)}`);
    }
    parsed = JSON.parse(text.slice(start, end + 1));
  }

  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  /* SQL 出错时 wrangler 以退出码 0 返回 `{"error":{"text":…}}` —— 不看这里，
     一张不存在的表会被当成「零行」。 */
  if (first && typeof first === "object" && first.error) {
    const error = first.error;
    return {
      rows: [],
      error: String(error.text ?? error.message ?? error),
    };
  }

  return { rows: Array.isArray(first?.results) ? first.results : [], error: null };
}

/** Windows 上 `npx` 是 `.cmd`，只能经 shell 启动；shell 又不会替我们加引号。 */
function shellArg(value) {
  return /[\s"]/.test(value) ? `"${value.replaceAll('"', '\\"')}"` : value;
}

function runQuery(sql, options) {
  const args = [...WRANGLER, "d1", "execute", DATABASE, "--json"];
  args.push(options.local ? "--local" : "--remote");
  if (options.config) args.push("--config", options.config);
  args.push("--command", sql);

  const windows = process.platform === "win32";
  /* Windows 上 `npx` 是 `.cmd`，必须经 cmd.exe 启动。参数由我们自己加引号，
     并把整条命令行按 verbatim 交给 cmd —— `shell: true` 会重新拼参数
     （Node DEP0190），SQL 里的空格会被拆成好几个词。 */
  const spawnOptions = { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 };
  const result = windows
    ? spawnSync(process.env.ComSpec ?? "cmd.exe", [
        `/d /s /c "${["npx", ...args.map(shellArg)].join(" ")}"`,
      ], { ...spawnOptions, windowsVerbatimArguments: true })
    : spawnSync("npx", args, spawnOptions);

  if (result.error) throw result.error;

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (result.status !== 0) {
    /* 表不存在是「未采集」，不是命令失败：与 Worker 端的降级姿态一致。 */
    if (/no such table/i.test(output)) return { missing: true, rows: [] };
    const hint =
      !options.local && !options.config
        ? "\n（生产库通常要带上 --config wrangler.prod.jsonc —— 仓库里的 wrangler.jsonc 用的是占位 resource id。）"
        : "";
    throw new Error(
      `wrangler d1 execute 失败（退出码 ${result.status}）：\n${output.trim().slice(0, 2000)}${hint}`,
    );
  }

  const parsed = parseOutput(result.stdout ?? "");
  if (parsed.error !== null) {
    if (/no such table/i.test(parsed.error)) return { missing: true, rows: [] };
    throw new Error(`wrangler d1 execute 报错：\n${parsed.error.slice(0, 2000)}`);
  }

  return { missing: false, rows: parsed.rows };
}

/* -------------------------------------------------------------------------- */
/* 聚合                                                                        */
/* -------------------------------------------------------------------------- */

function utcDay(at) {
  return at.toISOString().slice(0, 10);
}

function addDays(day, delta) {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return utcDay(date);
}

function buildWindow(days) {
  const until = utcDay(new Date());
  return { days, since: addDays(until, -(days - 1)), until };
}

/**
 * 窗口内的事件 → 聚合表。键是 `${event}\u0000${dim}`，值是次数的和。
 * `0` 也保留：某个维度写过却被加过 0，与「没写过」不是一回事。
 */
function aggregate(rows) {
  const groups = new Map();
  for (const row of rows) {
    const event = String(row.event ?? "");
    const dim = String(row.dim ?? "");
    const count = Number(row.count ?? 0);
    if (event.length === 0 || !Number.isFinite(count)) continue;
    const key = `${event}\u0000${dim}`;
    groups.set(key, (groups.get(key) ?? 0) + count);
  }
  return groups;
}

function countOf(groups, event, dim) {
  return groups.get(`${event}\u0000${dim}`) ?? 0;
}

function sumEvent(groups, event) {
  let total = 0;
  for (const [key, value] of groups) {
    if (key.startsWith(`${event}\u0000`)) total += value;
  }
  return total;
}

function sumDimsWithPrefix(groups, event, prefix) {
  let total = 0;
  for (const [key, value] of groups) {
    const [keyEvent, dim] = key.split("\u0000");
    if (keyEvent === event && dim.startsWith(prefix)) total += value;
  }
  return total;
}

/* -------------------------------------------------------------------------- */
/* 指标                                                                        */
/* -------------------------------------------------------------------------- */

/** 一个比例的三种状态：未采集 / 分母为零 / 有值。 */
function ratio(numerator, denominator, collected) {
  if (!collected) return { state: "uncollected", value: null, numerator, denominator };
  if (denominator === 0) return { state: "no-denominator", value: null, numerator, denominator };
  return { state: "ok", value: numerator / denominator, numerator, denominator };
}

function absolute(count, collected) {
  return { state: collected ? "ok" : "uncollected", value: collected ? count : null };
}

function computeMetrics(groups, collected) {
  const inspectTotal = sumEvent(groups, "inspect_read");
  const inspectOk =
    countOf(groups, "inspect_read", "complete") + countOf(groups, "inspect_read", "partial");

  const claimAttempts = sumDimsWithPrefix(groups, "claim_action", "claim:");
  const claimOk = countOf(groups, "claim_action", "claim:ok");
  const hideAttempts = sumDimsWithPrefix(groups, "claim_action", "hide:");
  const hideOk = countOf(groups, "claim_action", "hide:ok");
  const restoreAttempts = sumDimsWithPrefix(groups, "claim_action", "restore:");
  const restoreOk = countOf(groups, "claim_action", "restore:ok");

  const verifiedReads = countOf(groups, "collect_run", "verified_reads");
  const unconfirmed = countOf(groups, "collect_run", "unconfirmed");

  return {
    inspectStart: ratio(inspectTotal, countOf(groups, "page_view", "route=home,src=direct") +
      countOf(groups, "page_view", "route=home,src=internal") +
      countOf(groups, "page_view", "route=home,src=external") +
      countOf(groups, "page_view", "route=home,src=share"), collected),
    inspectSuccess: ratio(inspectOk, inspectTotal, collected),
    /* 分母是「看过鉴定页的人次」，不是「画过的卡」：卡是自动画的，用 ok+failed
       当分母会把「没走到分享区就离开」的人漏掉。 */
    shareCard: ratio(countOf(groups, "share_card", "ok"), countOf(groups, "page_view", "route=inspect,src=direct") +
      countOf(groups, "page_view", "route=inspect,src=internal") +
      countOf(groups, "page_view", "route=inspect,src=external") +
      countOf(groups, "page_view", "route=inspect,src=share"), collected),
    shareVisits: absolute(countOf(groups, "userpage_view", "src=share"), collected),
    topicCopy: absolute(sumEvent(groups, "topic_copy"), collected),
    claimSuccess: ratio(claimOk, claimAttempts, collected),
    hideSuccess: ratio(hideOk, hideAttempts, collected),
    restoreSuccess: ratio(restoreOk, restoreAttempts, collected),
    takedowns: absolute(sumEvent(groups, "takedown_submit"), collected),
    verifyFailureRate: ratio(unconfirmed, verifiedReads + unconfirmed, collected),
  };
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

/** 关闭的工单才有处理时长：`received` 的 `updated_at` 只是提交时刻。 */
function takedownDurations(rows) {
  const closed = rows.filter((row) => row.status !== "received");
  const hours = [];
  for (const row of closed) {
    const created = Date.parse(String(row.created_at ?? ""));
    const updated = Date.parse(String(row.updated_at ?? ""));
    if (!Number.isFinite(created) || !Number.isFinite(updated) || updated < created) continue;
    hours.push((updated - created) / 3_600_000);
  }
  return { closed: closed.length, medianHours: median(hours), p90Hours: percentile(hours, 0.9) };
}

/* -------------------------------------------------------------------------- */
/* Markdown                                                                    */
/* -------------------------------------------------------------------------- */

function percent(metric) {
  if (metric.state === "uncollected") return "未采集";
  if (metric.state === "no-denominator") return "—（分母为 0）";
  return `${((metric.value ?? 0) * 100).toFixed(1)}%`;
}

function fraction(metric) {
  return `${metric.numerator ?? "—"} / ${metric.denominator ?? "—"}`;
}

function absoluteText(metric) {
  return metric.state === "uncollected" ? "未采集" : String(metric.value ?? 0);
}

/** 失败按 `failed:<code>` 分列 —— 限流与输错不是同一种失败，不能合并成一个数。 */
function failureBreakdown(groups, collected) {
  if (!collected) return "未采集";
  const parts = eventRows(groups)
    .filter(({ event, dim }) => event === "inspect_read" && dim.startsWith("failed:"))
    .map(({ dim, count }) => `${dim} ${count}`);
  return parts.length > 0 ? parts.join(" · ") : "无";
}

function formatHours(value) {
  if (value === null) return "—";
  return value >= 1 ? `${value.toFixed(1)} 小时` : `${Math.round(value * 60)} 分钟`;
}

function renderMarkdown({ window, options, collected, missingTable, sample, metrics, groups, takedownRows }) {
  const lines = [];
  const source = options.local
    ? `本地（${options.config ?? "wrangler.jsonc"}）`
    : `远端（${options.config ?? "wrangler.jsonc"}）`;

  lines.push("# 码之灵龛 · 测量报告", "");
  lines.push(`- 窗口：${window.since} → ${window.until}（${window.days} 个 UTC 日）`);
  lines.push(`- 数据源：D1（binding \`${DATABASE}\`）· ${source}`);
  lines.push(`- 样本量：${collected ? `${sample} 次事件` : "未采集"}`);
  if (missingTable) lines.push("- **`metrics_daily` 表不存在 —— 迁移 0003 还没应用。**");
  lines.push("");

  if (!collected) {
    lines.push("> 窗口内没有任何计数。指标是**未采集**，不是 0 —— 等流量进来再看。");
    lines.push("");
  } else if (sample < INSUFFICIENT_SAMPLE) {
    lines.push(
      `> 样本不足（${sample} < ${INSUFFICIENT_SAMPLE} 次事件），不下结论。下面的百分比只是当前窗口的读数。`,
    );
    lines.push("");
  } else {
    lines.push("> 指标是匿名计数的近似值：同一事件同一维度一天只有一行，刷接口只会把那一行刷高。");
    lines.push("");
  }

  lines.push("## 七项指标", "");
  lines.push("| # | 指标 | 值 | 分子 / 分母 |");
  lines.push("|---|---|---|---|");
  lines.push(`| 1 | 查询发起率 | ${percent(metrics.inspectStart)} | ${fraction(metrics.inspectStart)} |`);
  lines.push(`| 2 | 查询成功率 | ${percent(metrics.inspectSuccess)} | ${fraction(metrics.inspectSuccess)} |`);
  lines.push(`| 3 | 分享卡生成率 | ${percent(metrics.shareCard)} | ${fraction(metrics.shareCard)} |`);
  lines.push(`| 4 | 分享链接访问量 | ${absoluteText(metrics.shareVisits)} | src=share 的文档请求 |`);
  lines.push(`| 5 | 主题复制次数 | ${absoluteText(metrics.topicCopy)} | 复制成功才计 |`);
  lines.push(`| 6 | 认领成功率 | ${percent(metrics.claimSuccess)} | ${fraction(metrics.claimSuccess)} |`);
  lines.push(`| 6 | 隐藏成功率 | ${percent(metrics.hideSuccess)} | ${fraction(metrics.hideSuccess)} |`);
  lines.push(`| 6 | 恢复成功率 | ${percent(metrics.restoreSuccess)} | ${fraction(metrics.restoreSuccess)} |`);
  lines.push(`| 7 | 误收录投诉（工单） | ${absoluteText(metrics.takedowns)} | 窗口内提交数 |`);

  const durations = takedownDurations(takedownRows);
  lines.push(
    `| 7 | 工单处理时长 | 中位 ${formatHours(durations.medianHours)} · P90 ${formatHours(durations.p90Hours)} | ` +
      `已关闭 ${durations.closed} 张 |`,
  );
  lines.push("");

  lines.push("> 分享卡生成率的分母是**鉴定页访问**（`route=inspect`），不是画卡次数 —— 卡是打开页面时自动画的。");
  lines.push("");

  lines.push("## 辅助", "");
  lines.push(
    `- 状态核实失败率：${percent(metrics.verifyFailureRate)}（${fraction(metrics.verifyFailureRate)}）`,
  );
  lines.push(`- 查询失败构成：${failureBreakdown(groups, collected)}`);
  lines.push(
    `- Cron 窗口内：搜索 ${collected ? countOf(groups, "collect_run", "searches") : "未采集"} 页 · ` +
      `发现 ${collected ? countOf(groups, "collect_run", "discovered") : "未采集"} 条 · ` +
      `复核 ${collected ? countOf(groups, "collect_run", "verified_reads") : "未采集"} 条 · ` +
      `下架 ${collected ? countOf(groups, "collect_run", "delisted") : "未采集"} 条`,
  );
  lines.push("");

  if (collected) {
    lines.push("## 事件明细", "");
    lines.push("| 事件 | 维度 | 次数 |");
    lines.push("|---|---|---|");
    for (const { event, dim, count } of eventRows(groups)) {
      lines.push(`| \`${event}\` | \`${dim || "（无）"}\` | ${count} |`);
    }
    lines.push("");
  }

  if (takedownRows.length > 0) {
    lines.push("## 窗口内的下架工单", "");
    lines.push("| 工单 | 状态 | 提交 | 更新 |");
    lines.push("|---|---|---|---|");
    for (const row of takedownRows) {
      lines.push(
        `| \`${String(row.ticket).slice(0, 8)}…\` | ${row.status} | ${row.created_at} | ${row.updated_at} |`,
      );
    }
    lines.push("");
  }

  lines.push("---", "");
  lines.push(
    "口径见 `docs/metrics.md`。报告由 `npm run metrics` 生成，不写进 CI，也不自动提交。",
  );
  lines.push("");

  return lines.join("\n");
}

function eventRows(groups) {
  return [...groups.entries()]
    .map(([key, count]) => {
      const [event, dim] = key.split("\u0000");
      return { event, dim, count };
    })
    .sort((a, b) => a.event.localeCompare(b.event) || a.dim.localeCompare(b.dim));
}

/* -------------------------------------------------------------------------- */
/* main                                                                        */
/* -------------------------------------------------------------------------- */

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(HELP);
    return;
  }

  const window = buildWindow(options.days);

  const metricsResult = runQuery(
    "SELECT day, event, dim, count FROM metrics_daily " +
      `WHERE day >= '${window.since}' ORDER BY day, event, dim`,
    options,
  );
  const takedownResult = runQuery(
    "SELECT ticket, status, created_at, updated_at FROM takedown_request " +
      `WHERE created_at >= '${window.since}T00:00:00.000Z' ORDER BY created_at`,
    options,
  );

  const groups = aggregate(metricsResult.rows);
  const collected = !metricsResult.missing && groups.size > 0;
  const sample = [...groups.values()].reduce((total, value) => total + value, 0);
  const metrics = computeMetrics(groups, collected);
  const takedownRows = takedownResult.missing ? [] : takedownResult.rows;

  if (options.json) {
    const payload = {
      window,
      source: {
        database: DATABASE,
        local: options.local,
        config: options.config,
      },
      collected,
      missingTable: metricsResult.missing,
      sample,
      insufficientSample: sample < INSUFFICIENT_SAMPLE,
      metrics,
      takedowns: {
        submitted: metrics.takedowns.value,
        ...takedownDurations(takedownRows),
      },
      events: eventRows(groups),
    };
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }

  const markdown = renderMarkdown({
    window,
    options,
    collected,
    missingTable: metricsResult.missing,
    sample,
    metrics,
    groups,
    takedownRows,
  });

  if (options.out) {
    const target = resolve(process.cwd(), options.out);
    writeFileSync(target, `${markdown}\n`, "utf8");
    console.error(`已写入 ${target}`);
  } else {
    process.stdout.write(`${markdown}\n`);
  }
}

try {
  main();
} catch (error) {
  console.error(`测量报告生成失败：${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
