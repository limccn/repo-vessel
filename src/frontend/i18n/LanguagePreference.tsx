/**
 * 语言偏好控件 —— 只有登录之后才有意义，所以它住在 `/manage` 里，不在页头。
 *
 * 三个选项，不是四个：中文的简／繁不交给用户选。用户说「中文」，浏览器在
 * 繁体地区就给他繁体，在简体地区就给他简体 —— 多数人认的是「中文」，不是
 * `zh-Hans` / `zh-Hant` 这两个标签。
 *
 * 与页头那个旧控件一样，**每一段都是真实按钮**，`aria-pressed` 说明当前选中的
 * 是哪一种（选中态同时改边框与字重，不靠颜色单独表达），可及名称用语言自己
 * 的写法（ENGLISH / 中文 / 日本語），触控目标 40px 起。
 *
 * 点击立即生效；同时把偏好写进签名会话 Cookie，换设备才跟得过去。写失败只
 * 提示「没保存」，不回滚界面 —— 本次浏览已经是新语言了。
 */

import { useState } from "react";
import {
  LOCALE_NAMES,
  LOCALE_PREFERENCE_LABELS,
  LOCALE_PREFERENCES,
  preferenceForLocale,
  resolveLocalePreference,
  type LocalePreference,
} from "@/shared/i18n";
import { useI18n } from "@/frontend/i18n/LocaleProvider";
import { saveLocalePreference } from "@/frontend/lib/auth";
import { cx } from "@/frontend/lib/cx";

export function LanguagePreference() {
  const { t, locale, setLocale } = useI18n();
  const current = preferenceForLocale(locale);
  const [failed, setFailed] = useState(false);

  const choose = (preference: LocalePreference) => {
    setFailed(false);
    setLocale(resolveLocalePreference(preference, navigator.languages ?? []));
    void saveLocalePreference(preference).then((ok) => {
      if (!ok) setFailed(true);
    });
  };

  return (
    <section aria-labelledby="language-preference-heading" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2
          id="language-preference-heading"
          className="display-cn text-base text-fg-primary"
        >
          {t("语言偏好")}
        </h2>
        <p className="text-sm leading-relaxed text-fg-secondary">
          {t("中文会按浏览器的地区自动选用简体或繁体。")}
        </p>
      </div>

      <div
        role="group"
        aria-label={t("语言偏好")}
        className="inline-flex flex-none items-center gap-0.5 self-start rounded-sm border border-hairline-soft bg-surface-panel/70 p-0.5"
      >
        {LOCALE_PREFERENCES.map((item) => {
          const active = item === current;
          return (
            <button
              key={item}
              type="button"
              onClick={() => choose(item)}
              aria-pressed={active}
              className={cx(
                "inline-flex min-h-10 min-w-16 items-center justify-center rounded-xs px-3 text-xs",
                "transition-colors duration-[var(--motion-duration-fast)]",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
                active
                  ? "border border-hairline bg-surface-overlay font-semibold text-fg-primary"
                  : "border border-transparent text-fg-muted hover:text-fg-primary",
              )}
            >
              {LOCALE_PREFERENCE_LABELS[item]}
            </button>
          );
        })}
      </div>

      <p className="text-2xs text-fg-muted">
        {t("当前显示：{language}", { language: LOCALE_NAMES[locale] })}
      </p>

      {failed ? (
        <p role="status" className="text-2xs text-fg-secondary">
          {t("偏好没有保存成功，本次浏览仍然使用新语言。")}
        </p>
      ) : null}
    </section>
  );
}
