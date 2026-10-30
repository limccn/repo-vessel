/**
 * 三态字段的构造。
 *
 * 「有值 / 未知 / 不适用」是三种不同的事实，类型把它们分开，构造器把它们分开。
 * 未知永远是 `{ kind: "unknown" }`，绝不退化成 0、空串或「—」。
 *
 * 这里放纯函数，组件放在 `components/feedback/FieldValue.tsx` —— 一个文件只出一类东西。
 */

import type { FieldState, UnknownReason } from "@/shared/contract";

/** 一个可空字段 → 三态。`null` 走未知态，原因可指定。 */
export function fieldOf(
  value: string | null,
  reason: UnknownReason = "not-provided",
): FieldState {
  return value === null ? { kind: "unknown", reason } : { kind: "value", value };
}

/** 明确不适用的字段。 */
export function naField(): FieldState {
  return { kind: "na" };
}
