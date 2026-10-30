/**
 * 一次 Cron 运行的预算。
 *
 * 这些数字是「一轮跑得完」与「不把配额打穿」之间的交易，不是正确性的一部分：
 * 改大只是跑得更久，改小只是多跑几轮。写在一处，测试钉住，免得哪天散落成
 * `run.ts` 里的字面量。
 *
 * 上游的真实限制：搜索 30 次/分钟、核心接口 5 000 次/小时（认证后）。
 * 一次运行 ≤ 8 次搜索 + 40 次仓库读取，每六小时一轮 —— 两个数都远低于上限。
 */

/** 每轮最多发多少次搜索请求。 */
export const SEARCH_BUDGET = 8;

/** 一个主题最多翻到第几页。GitHub 搜索本身也只返回前 1 000 条。 */
export const MAX_SEARCH_PAGES = 10;

/** 每页条数 —— GitHub 的上限。 */
export const SEARCH_PAGE_SIZE = 100;

/** 每轮最多复核多少个已收录仓库。 */
export const VERIFY_BUDGET = 40;

/** 复核失败多少次之后不再把它当「已核实」展示。 */
export const MAX_VERIFY_FAILURES = 6;

/** 复核的并发数。与 Fork 上游补读同一个节奏 —— 远低于二级限流的门槛。 */
export const VERIFY_CONCURRENCY = 8;
