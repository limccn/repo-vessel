/**
 * 灵龛充能等级 —— 从「带主题的公开仓库数」派生的纯函数。
 *
 * 客户端与服务端调用**同一组**函数，所以两边不可能对同一个账号的等级有分歧。
 * 阈值全部来自 `src/shared/thresholds.ts` —— 那里是全站唯一的一份数字。
 *
 * 第一条规则，也是这里最重要的一条：**未知 ≠ 0**。
 *
 * `count === null`（或字段缺席）时等级是未知的，绝不退化成「未启封」——
 * 那等于宣称「一个仓库都没有」，而我们并不知道。未知就是未知。
 */

import { THRESHOLDS } from "./thresholds";
import { type TierId } from "./ids";

/**
 * 一个等级所处的「档位」。
 *
 * 计量条量的是**当前档** `[floor, nextFloor)`，不是「离下一档还差多远」。
 * 量到下一档的边界上，条正好是空的 —— 而视觉系统禁止空的计量条。量当前档
 * 则在档底是 1/4、在档顶是满格，条永远不空。
 */
export interface TierBand {
  /** 本档下界（含）。 */
  floor: number;
  /** 下一档下界（不含）。`null` = 已是最高档，没有下一档。 */
  nextFloor: number | null;
}

/**
 * 算出数量对应的等级。
 *
 * `null` = 未知。`undefined` 也算未知 —— 一个还没下发这个字段的 Worker 不应该
 * 被读成「0 个仓库」。
 */
export function tierFor(count: number | null | undefined): TierId | null {
  if (count == null || !Number.isFinite(count)) return null;
  if (count >= THRESHOLDS.tierIVMinRepos) return "iv";
  if (count >= THRESHOLDS.tierIIIMinRepos) return "iii";
  if (count >= THRESHOLDS.tierIIMinRepos) return "ii";
  if (count >= THRESHOLDS.tierIMinRepos) return "i";
  return "unsealed";
}

/** 一个等级所占的档位。 */
export function tierBand(tier: TierId): TierBand {
  switch (tier) {
    case "unsealed":
      return { floor: 0, nextFloor: THRESHOLDS.tierIMinRepos };
    case "i":
      return {
        floor: THRESHOLDS.tierIMinRepos,
        nextFloor: THRESHOLDS.tierIIMinRepos,
      };
    case "ii":
      return {
        floor: THRESHOLDS.tierIIMinRepos,
        nextFloor: THRESHOLDS.tierIIIMinRepos,
      };
    case "iii":
      return {
        floor: THRESHOLDS.tierIIIMinRepos,
        nextFloor: THRESHOLDS.tierIVMinRepos,
      };
    case "iv":
      return { floor: THRESHOLDS.tierIVMinRepos, nextFloor: null };
  }
}

/**
 * 充能比例 —— 计量条填到当前档的顶。
 *
 * - 数量未知 → `null`（不画条）。
 * - 未启封 → `null`（没什么可填的）。
 * - Ⅳ 阶 → `null`（没有下一档，这一档读作「充能完毕」，不是一条满格）。
 * - 其余 → `(count - floor + 1) / 档宽`，夹在 `[0, 1]`。
 *
 * `+1` 是因为档位是闭下界：刚进 Ⅰ 阶（1 个）就已经往这条阶走了 1/4，
 * 而不是 0 —— 条永远不空。
 */
export function tierChargeRatio(count: number | null | undefined): number | null {
  if (count == null || !Number.isFinite(count)) return null;

  const tier = tierFor(count);
  if (tier === null || tier === "unsealed" || tier === "iv") return null;

  const { floor, nextFloor } = tierBand(tier);
  if (nextFloor === null) return null;

  const size = nextFloor - floor;
  if (size <= 0) return null;

  return Math.max(0, Math.min(1, (count - floor + 1) / size));
}

/**
 * 下一阶是哪个。
 *
 * `null` = 已是最高档（Ⅳ 阶），没有下一阶。
 *
 * 界面上那句「再收 N 个仓库升到 X 阶」里的 **X** 由它给出 —— 条量的是当前档，
 * 剩下的距离与目标档位都由**文字**承担。
 */
export function nextTier(tier: TierId): TierId | null {
  switch (tier) {
    case "unsealed":
      return "i";
    case "i":
      return "ii";
    case "ii":
      return "iii";
    case "iii":
      return "iv";
    case "iv":
      return null;
  }
}

/**
 * 距离下一阶还差几个仓库。
 *
 * `null` = 未知，或者已经是最高档（没有下一阶）。数字由文字承担，条只是辅助。
 */
export function reposToNextTier(count: number | null | undefined): number | null {
  if (count == null || !Number.isFinite(count)) return null;

  const tier = tierFor(count);
  if (tier === null || tier === "iv") return null;

  const { nextFloor } = tierBand(tier);
  if (nextFloor === null) return null;

  return nextFloor - count;
}
