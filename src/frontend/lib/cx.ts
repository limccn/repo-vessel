/** 拼接 className。过滤掉假值，避免 `false` 变成 "false" 字面量。 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter((p): p is string => typeof p === "string" && p.length > 0).join(" ");
}
