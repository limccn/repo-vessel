import { Link } from "react-router-dom";
import { siteCopy } from "@/shared/copy";
import { useI18n } from "@/frontend/i18n/LocaleProvider";
import { GITHUB_REPO_URL, TWITTER_URL } from "@/frontend/lib/env";

/** 站外链接 —— 新窗口打开，并且把「新窗口」这件事说给读屏。 */
function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block py-1.5 text-fg-secondary hover:text-gold-bright"
    >
      {children}
      <span className="sr-only">{t("（新窗口）")}</span>
    </a>
  );
}

/** 站点页脚。附上产品边界说明 —— 本站只读，不改你的仓库。 */
export function SiteFooter() {
  const { t, locale } = useI18n();
  const copy = siteCopy(locale);

  return (
    <footer className="mt-16 border-t border-hairline-soft px-4 py-8 sm:px-6">
      <div className="mx-auto flex max-w-page flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-md space-y-2">
          <p className="display-cn text-xs text-fg-secondary">
            {copy.siteName}
            {copy.siteNameLatin ? (
              <span className="text-fg-muted"> · {copy.siteNameLatin}</span>
            ) : null}
          </p>
          <p className="text-xs leading-relaxed text-fg-muted">{copy.footer.boundary}</p>
        </div>
        {/* 每一条都带上下内边距：12px 的字高只有 18px，手指点不准，
            而页脚是页面上唯一没有别的可点目标兜底的地方（WCAG 2.5.8）。 */}
        <nav aria-label={t("页脚导航")} className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
          <Link to="/how" className="inline-block py-1.5 text-fg-secondary hover:text-gold-bright">
            {copy.footer.links.how}
          </Link>
          <Link to="/b/longest-sleep" className="inline-block py-1.5 text-fg-secondary hover:text-gold-bright">
            {copy.footer.links.boards}
          </Link>
          <Link to="/takedown" className="inline-block py-1.5 text-fg-secondary hover:text-gold-bright">
            {copy.footer.links.takedown}
          </Link>
          <ExternalLink href={TWITTER_URL}>{copy.footer.links.twitter}</ExternalLink>
          <ExternalLink href={GITHUB_REPO_URL}>{copy.footer.links.github}</ExternalLink>
        </nav>
      </div>
    </footer>
  );
}
