import { useState } from "react";
import type { CollectionState } from "@/shared/contract";
import { collectionStateLabel } from "@/shared/ids";
import { formatRelativeTime } from "@/shared/format";
import { useCollectionStatus } from "@/frontend/api/hooks";
import { Button } from "@/frontend/components/common/Button";
import { TopicList } from "@/frontend/components/common/TopicList";
import { UnknownValue } from "@/frontend/components/feedback/FieldValue";
import { ErrorNotice } from "@/frontend/components/feedback/ErrorNotice";
import { Panel } from "@/frontend/components/panel/Panel";
import { NameplateBanner } from "@/frontend/components/panel/NameplateBanner";
import { Trans } from "@/frontend/i18n/Trans";
import { errorMessage } from "@/frontend/i18n/errorMessage";
import { useI18n } from "@/frontend/i18n/LocaleProvider";
import { track } from "@/frontend/lib/analytics";
import { cx } from "@/frontend/lib/cx";
import { REPO_TOPICS } from "@/frontend/lib/env";

/** 如何入龛 —— 说明页 + 收录状态检查器。 */
export function HowRoute() {
  const { t } = useI18n();
  return (
    <div className="mx-auto flex max-w-page flex-col gap-8 px-4 py-8 sm:px-6">
      <Panel variant="panel" edge="gold" cut="lg" grain as="section" aria-label={t("如何入龛")}>
        <div className="cut-frame__inner p-8">
          <NameplateBanner mark="◈" headingLevel={1} className="mb-6 self-start">
            {t("如何入龛")}
          </NameplateBanner>

          <div className="flex flex-col gap-6">
            <Section title={t("一、自己来")}>
              {/* 整句是一条 msgid：加粗与主题列表都是句子里的占位，
                  这样译文可以按自己的语序摆放它们，而不是照中文的语序拼。 */}
              <p>
                <Trans
                  text={t(
                    "在你的任意一个**公开**仓库上加上 {topics} 主题（Settings → Topics），本站就会把它收录进来；核实之后，只有符合榜单条件的仓库才会出现在那个榜单上。主题是公开的、任何人都能看见，所以你随时可以把它拿掉。",
                  )}
                  nodes={{ topics: <TopicList /> }}
                />
              </p>
              <TopicCopy />
            </Section>

            <Section title={t("二、只是被看了一眼")}>
              <p>
                <Trans
                  text={t(
                    "查一个用户名是**预览**，不是发布：它不会收录任何仓库，也不会把结果发到任何地方。分享图只有你自己点开，发不发也由你决定。",
                  )}
                />
              </p>
            </Section>

            <Section title={t("三、只读")}>
              <p>
                {t(
                  "本站只读取公开仓库的元数据：最后一次推送时间、Star 数、Fork 数、语言。不读取仓库里的任何文件，不扫描密钥，不修改、归档、删除或同步任何仓库。",
                )}
              </p>
            </Section>

            <Section title={t("四、随时可以拿走")}>
              <p>
                {t(
                  "把主题拿掉，仓库就会从榜单上消失。如果你已经认领了它，也可以直接把它隐藏 —— 即使主题还在，它也不会再出现。",
                )}
              </p>
            </Section>

            <Section title={t("五、本站记什么")}>
              <p>
                {t(
                  "本站只做匿名计数：不保存 IP、浏览器标识、Cookie 或任何用户 ID，也不接第三方统计。计数只到「某一天、某类事件发生了几次」。你的用户名与仓库名不会进入统计。浏览器开启 Do Not Track 或 Global Privacy Control 时，本站不发送任何计数。",
                )}
              </p>
            </Section>
          </div>
        </div>
      </Panel>

      <StatusChecker />
    </div>
  );
}

/**
 * 收录状态检查器。
 *
 * 五态里最容易写错的是 `unconfirmed`：它说的是「这次没能确认」，**不是**
 * 「没有主题」。两者的文案分开写，并且 `unconfirmed` 自带重试 —— 把一个
 * 暂时读不到的结果说成「去改设置」，会让人去修一个没坏的东西。
 */
function StatusChecker() {
  const { t, locale } = useI18n();
  const [value, setValue] = useState("");
  const { envelope, isLoading, check } = useCollectionStatus();
  const data = envelope?.data ?? null;
  const error = envelope?.error ?? null;

  const submit = () => {
    const fullName = value.trim();
    if (fullName.length === 0) return;
    check(fullName);
  };

  return (
    <Panel variant="panel" cut="md" as="section" aria-label={t("收录状态")}>
      <div className="cut-frame__inner flex flex-col gap-5 p-8">
        <div className="flex flex-col gap-2">
          <h2 className="display-cn text-base text-fg-primary">{t("查一下收录状态")}</h2>
          <p className="text-sm leading-relaxed text-fg-secondary">
            {t("输入一个仓库（owner/name），看看它现在在不在龛里，以及为什么。")}
          </p>
        </div>

        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-center"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <label htmlFor="status-repo" className="sr-only">
            {t("仓库名")}
          </label>
          <div className="flex flex-1 items-center gap-2 rounded-sm border border-hairline bg-surface-inset px-4 py-2.5 focus-within:border-gold-soft">
            <input
              id="status-repo"
              name="repo"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="owner/name"
              className="w-full bg-transparent font-mono text-base text-fg-primary outline-none placeholder:text-fg-muted sm:text-sm"
            />
          </div>
          <Button variant="primary" type="submit" loading={isLoading} className="sm:min-w-28">
            {t("查询")}
          </Button>
        </form>

        {error ? (
          <ErrorNotice
            message={errorMessage(error, locale) ?? ""}
            hint={
              error.code === "rate_limited"
                ? t("上一次查得有点密，等一会儿再试。")
                : undefined
            }
          />
        ) : null}

        {data ? (
          <StatusResult
            state={data.state}
            fullName={data.fullName}
            matchedTopic={data.matchedTopic}
            verifiedAt={data.verifiedAt}
            readAt={envelope?.readAt ?? null}
            onRetry={() => check(data.fullName)}
          />
        ) : null}
      </div>
    </Panel>
  );
}

interface StatusResultProps {
  state: CollectionState;
  fullName: string;
  matchedTopic: string | null;
  verifiedAt: string | null;
  readAt: string | null;
  onRetry: () => void;
}

function StatusResult({
  state,
  fullName,
  matchedTopic,
  verifiedAt,
  readAt,
  onRetry,
}: StatusResultProps) {
  const { t, locale } = useI18n();
  const copy = collectionStateLabel(state, locale);

  return (
    <div
      className={cx(
        "flex flex-col gap-3 rounded-sm border px-5 py-4",
        state === "unconfirmed" ? "border-gold-soft/45" : "border-hairline-soft",
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="display-cn text-base text-fg-primary">{copy.label}</span>
        <span className="font-mono text-xs text-fg-secondary">{fullName}</span>
      </div>
      <p className="text-sm leading-relaxed text-fg-secondary">{copy.description}</p>

      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-2xs text-fg-muted">
        <div className="flex items-center gap-1.5">
          <dt>{t("命中的主题")}</dt>
          <dd className="font-mono text-data-secondary">{matchedTopic ?? "—"}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt>{t("最近核实")}</dt>
          <dd className="text-data-secondary">
            {verifiedAt === null
              ? t("还没有核实记录")
              : (formatRelativeTime(verifiedAt, locale) ?? verifiedAt)}
          </dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt>{t("本次查询")}</dt>
          <dd className="text-data-secondary">
            {readAt === null ? (
              <UnknownValue label={t("查询时间")} />
            ) : (
              (formatRelativeTime(readAt, locale) ?? readAt)
            )}
          </dd>
        </div>
      </dl>

      {state === "unconfirmed" ? (
        <div>
          <Button size="sm" variant="secondary" onClick={onRetry}>
            {t("再查一次")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="display-cn mb-2 text-base text-fg-primary">{title}</h2>
      <div className="text-sm leading-relaxed text-fg-secondary [&_code]:font-mono [&_code]:text-data-emphasis">
        {children}
      </div>
    </section>
  );
}

/**
 * 「复制主题」。
 *
 * 复制的是配置里的 **slug 本身**，不是页面上那句「repo-vessel 或 urn-of-repos」——
 * GitHub 的 Settings → Topics 一次只收一个主题。
 *
 * 只有复制成功才计数：这一项指标问的是「有多少人真的把主题带走了」，
 * 点了一下但剪贴板没写进去不算。
 */
function TopicCopy() {
  const { t } = useI18n();
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (topic: string) => {
    try {
      await navigator.clipboard.writeText(topic);
      setCopied(topic);
      track("topic_copy", `topic=${topic}`);
    } catch {
      /* 复制失败不计数，也不把按钮改成「已复制」。 */
      setCopied(null);
    }
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-2xs text-fg-muted">{t("复制主题：")}</span>
      {REPO_TOPICS.map((topic) => (
        <Button
          key={topic}
          size="sm"
          variant="secondary"
          className="font-mono"
          onClick={() => void copy(topic)}
        >
          {copied === topic ? t("{topic} · 已复制", { topic }) : topic}
        </Button>
      ))}
    </div>
  );
}
