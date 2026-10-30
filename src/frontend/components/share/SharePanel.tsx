import { useEffect, useState } from "react";
import { ACHIEVEMENTS, earnedAchievements } from "@/shared/achievements";
import { canvasUnavailableNotice, type TierId } from "@/shared/ids";
import { Button } from "@/frontend/components/common/Button";
import { Toast } from "@/frontend/components/chrome/Toast";
import { Panel } from "@/frontend/components/panel/Panel";
import { useI18n } from "@/frontend/i18n/LocaleProvider";
import { track } from "@/frontend/lib/analytics";
import { buttonClassName } from "@/frontend/lib/button";
import { buildShareText, profileHost, profileUrl, twitterIntentUrl } from "@/frontend/lib/share";
import { createShareCard, type ShareCardInput } from "@/frontend/lib/shareCard";

export interface SharePanelProps {
  login: string;
  tier: TierId | null;
  enrolledCount: number | null;
  /** 页面上的同一份事实。缺省时不出现图片按钮，分享退回纯文字。 */
  card?: ShareCardInput | null;
}

/**
 * 分享面板 —— **先预览，再分享**。
 *
 * - 文案先摆出来，用户看清楚之后才可能发出去。
 * - 「发推」是一个真实的 `<a>`：点开的是 Twitter / X 的撰写窗口，发不发由
 *   用户在那边决定。本站不调用任何第三方写接口，也不自动发布。
 * - 朋友圈没有网页分享接口：复制文案 + 下载徽章，再粘贴。
 * - 数量未知时不出文案（不把未知写成 0），只提供复制链接。
 *
 * 面板整体跟着界面语言走：文案、链接里的 `?lang=`、以及画布上的那张图。
 * 语言一切换，图必须重画 —— 一张写着旧语言的图配着新语言的按钮，比没有图更糟。
 * 提示与错误在状态里存 **msgid**，渲染时才查表：切换语言后已经弹出的提示也会
 * 跟着换，不会留在上一种语言里。
 */
export function SharePanel({ login, tier, enrolledCount, card = null }: SharePanelProps) {
  const { t, locale } = useI18n();
  const earned = earnedAchievements(enrolledCount);
  const text = buildShareText({ login, tier, enrolledCount, achievements: earned }, locale);
  const link = profileUrl(login, locale);
  const topBadge =
    earned && earned.length > 0
      ? ACHIEVEMENTS.find((def) => def.id === earned[earned.length - 1])
      : null;

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* 图片在面板出现时画一次，不是点了才画。
     一来「系统分享」必须在用户手势里同步调用 `navigator.share`，先 await 一张图
     会把手势用光；二来画不出来这件事应当早点知道，而不是等用户点了一个按钮。 */
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  const [canvasFailed, setCanvasFailed] = useState(false);

  useEffect(() => {
    if (!card) return;
    let cancelled = false;
    let objectUrl: string | null = null;

    void createShareCard(card, locale, profileHost())
      .then((blob) => {
        if (cancelled) return;
        if (blob === null) {
          setCanvasFailed(true);
          track("share_card", "failed");
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        /* 成功要清掉上一次的失败标记 —— 换了语言重画成功后，「画不出来」
           那句话不该还挂在图上。 */
        setCanvasFailed(false);
        setImage({ blob, url: objectUrl });
        track("share_card", "ok");
      })
      .catch(() => {
        /* 画布抛错与画布不可用是同一件事：这次分享没有图。 */
        if (cancelled) return;
        setCanvasFailed(true);
        track("share_card", "failed");
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [card, locale]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  /* 系统分享只在浏览器真的支持「分享文件」时出现 —— 不支持就干脆不画这个按钮，
     不做点了没反应的东西。 */
  const canShareFile =
    image !== null &&
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [new File([image.blob], "repovessel.png", { type: "image/png" })] });

  const shareImage = async () => {
    if (image === null) return;
    const file = new File([image.blob], `repovessel-${login}.png`, { type: "image/png" });
    try {
      await navigator.share({ files: [file] });
    } catch {
      /* 用户取消也走这里。取消不是错误，不弹提示。 */
    }
  };

  const copy = async (value: string, done: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setError(null);
      setNotice(done);
    } catch {
      setNotice(null);
      setError("复制失败，请手动选中上面的文字。");
    }
  };

  return (
    <Panel
      variant="raised"
      cut="sm"
      as="section"
      aria-label={t("分享")}
      className="motion-panel-enter outline-none"
      id="share-panel"
      tabIndex={-1}
    >
      <div className="cut-frame__inner flex flex-col gap-3 p-6">
        <p className="display-cn text-sm text-fg-primary">{t("把这份鉴定带走")}</p>

        {text ? (
          <>
            <p className="text-xs leading-relaxed text-fg-secondary">
              {t("分享前先看一眼文案。发到哪里、发不发，都由你决定。")}
            </p>
            <blockquote className="whitespace-pre-line rounded-sm border border-hairline-soft bg-surface-inset p-3 text-xs leading-relaxed text-fg-secondary">
              {text}
            </blockquote>
          </>
        ) : (
          <p className="text-xs leading-relaxed text-fg-secondary">
            {t("这次没有读到带主题的仓库数，文案里不写数量。你可以先复制页面链接。")}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {text ? (
            <a
              href={twitterIntentUrl(text)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClassName("primary", "sm")}
            >
              {t("发推")}
              <span className="sr-only">{t("（在新窗口打开 Twitter 撰写窗口）")}</span>
            </a>
          ) : null}
          {text ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void copy(text, "已复制分享文案")}
            >
              {t("复制文案")}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void copy(link, "已复制页面链接")}
          >
            {t("复制链接")}
          </Button>
          {image ? (
            <a
              href={image.url}
              download={`repovessel-${login}.png`}
              className={buttonClassName("secondary", "sm")}
            >
              {t("保存图片")}
            </a>
          ) : null}
          {canShareFile ? (
            <Button size="sm" variant="secondary" onClick={() => void shareImage()}>
              {t("系统分享")}
            </Button>
          ) : null}
          {topBadge ? (
            <a
              href={topBadge.badgeSrc}
              download={topBadge.downloadName}
              className={buttonClassName("secondary", "sm")}
            >
              {t("下载徽章")}
            </a>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="text-2xs text-fg-secondary">
            {t(error)}
          </p>
        ) : null}

        {canvasFailed ? (
          <p className="text-2xs leading-relaxed text-fg-muted">
            {canvasUnavailableNotice(locale)}
          </p>
        ) : null}

        <p className="text-2xs leading-relaxed text-fg-muted">
          {image
            ? t("朋友圈没有网页分享接口：保存这张图，连着文案一起粘贴过去。")
            : t("朋友圈没有网页分享接口：复制文案、下载徽章，再粘贴到朋友圈即可。")}
        </p>
      </div>

      {notice ? <Toast>{t(notice)}</Toast> : null}
    </Panel>
  );
}
