import type { ApiError } from "@/shared/contract";
import { getActiveLocale, t, type Locale } from "@/shared/i18n";

/**
 * 错误文案的本地化。
 *
 * 服务端下发的 `message` 是**简体中文原句**，而它本身就是词典的 msgid ——
 * 所以这里不需要第二张「错误码 → 文案」表：`t(error.message)` 命中就是译文，
 * 没命中就原样返回。错误码仍然在信封里（`error.code`），调用方要按码分支时
 * 照样拿得到。
 *
 * 缺译时显示中文原句而不是吞掉 —— 看得见的问题好过一个空白的错误框。
 */
export function errorMessage(
  error: ApiError | null | undefined,
  locale: Locale = getActiveLocale(),
): string | null {
  if (!error) return null;
  return t(error.message, undefined, locale);
}
