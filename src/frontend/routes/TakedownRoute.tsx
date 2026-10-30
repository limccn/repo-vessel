import { useState } from "react";
import type { TakedownPayload, TakedownStatusPayload } from "@/shared/contract";
import { clipboardMessage, takedownStatusLabel } from "@/shared/ids";
import { formatRelativeTime } from "@/shared/format";
import { useTakedownStatus, useTakedownSubmit } from "@/frontend/api/hooks";
import { Button } from "@/frontend/components/common/Button";
import { ErrorNotice } from "@/frontend/components/feedback/ErrorNotice";
import { Panel } from "@/frontend/components/panel/Panel";
import { NameplateBanner } from "@/frontend/components/panel/NameplateBanner";
import { Trans } from "@/frontend/i18n/Trans";
import { errorMessage } from "@/frontend/i18n/errorMessage";
import { useI18n } from "@/frontend/i18n/LocaleProvider";

/**
 * 下架申请 —— 唯一一条**不需要 GitHub 登录**的出口。
 *
 * 提交成功之后给出工单号与承诺时限。工单号不发给任何人、不发邮件 ——
 * 页面让用户自己抄下来，凭它可以查状态。没有回信渠道就不收邮箱。
 */
export function TakedownRoute() {
  const { t } = useI18n();
  return (
    <div className="mx-auto flex max-w-page flex-col gap-8 px-4 py-8 sm:px-6">
      <Panel variant="panel" edge="gold" cut="lg" grain as="section" aria-label={t("下架申请")}>
        <div className="cut-frame__inner p-8">
          <NameplateBanner mark="◈" headingLevel={1} className="mb-6 self-start">
            {t("下架申请")}
          </NameplateBanner>
          <div className="flex flex-col gap-4 text-sm leading-relaxed text-fg-secondary">
            <p>
              {t(
                "你的仓库出现在了榜单上，但你不想让它在这里？不需要 GitHub 登录，也不需要任何账号。",
              )}
            </p>
            <p>
              {t(
                "提交仓库地址和一句说明即可。我们会核实，然后把这条记录从榜单上撤下来，并且不会把它加回任何榜单。",
              )}
            </p>
          </div>
        </div>
      </Panel>

      <TakedownForm />
      <TakedownLookup />
    </div>
  );
}

function TakedownForm() {
  const { t, locale } = useI18n();
  const [repo, setRepo] = useState("");
  const [reason, setReason] = useState("");
  const { pending, error, payload, submit } = useTakedownSubmit();

  if (payload) {
    return <TicketCard payload={payload} />;
  }

  return (
    <Panel variant="panel" cut="md" as="section" aria-label={t("提交下架申请")}>
      <form
        className="cut-frame__inner flex flex-col gap-5 p-8"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(repo, reason);
        }}
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="takedown-repo" className="display-cn text-base text-fg-primary">
            {t("仓库")}
          </label>
          <div className="flex items-center gap-2 rounded-sm border border-hairline bg-surface-inset px-4 py-2.5 focus-within:border-gold-soft">
            <input
              id="takedown-repo"
              name="repo"
              type="text"
              required
              autoComplete="off"
              spellCheck={false}
              value={repo}
              onChange={(event) => setRepo(event.target.value)}
              placeholder="owner/name"
              className="w-full bg-transparent font-mono text-base text-fg-primary outline-none placeholder:text-fg-muted sm:text-sm"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="takedown-reason" className="text-sm text-fg-primary">
            {t("说明（可不填）")}
          </label>
          <textarea
            id="takedown-reason"
            name="reason"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("一句说明就好。")}
            className="w-full rounded-sm border border-hairline bg-surface-inset px-4 py-3 text-base leading-relaxed text-fg-primary outline-none placeholder:text-fg-muted focus:border-gold-soft sm:text-sm"
          />
          <p className="text-2xs text-fg-muted">
            {t("不会收集你的邮箱 —— 本站没有回信渠道，收了只会让你以为会有回信。")}
          </p>
        </div>

        {error ? <ErrorNotice message={errorMessage(error, locale) ?? ""} /> : null}

        <div>
          <Button variant="primary" type="submit" loading={pending}>
            {t("提交申请")}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function TicketCard({ payload }: { payload: TakedownPayload }) {
  const { t, locale } = useI18n();
  const [copied, setCopied] = useState(false);

  const copyTicket = async () => {
    try {
      await navigator.clipboard.writeText(payload.ticket);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Panel variant="panel" cut="md" as="section" aria-label={t("下架工单")}>
      <div className="cut-frame__inner flex flex-col gap-4 p-8">
        <p className="display-cn text-base text-fg-primary">{t("申请已收到。")}</p>
        <p className="text-sm leading-relaxed text-fg-secondary">
          <Trans
            text={t(
              "我们会在这个时限内看一遍：{hours} 小时。把工单号抄下来，凭它可以查状态。",
            )}
            nodes={{
              hours: (
                <strong className="text-fg-primary">{payload.slaHours}</strong>
              ),
            }}
          />
        </p>

        <div className="flex flex-wrap items-center gap-3 rounded-sm border border-hairline-soft bg-surface-inset px-4 py-3">
          <span className="text-2xs text-fg-muted">{t("工单号")}</span>
          <code className="break-all font-mono text-sm text-data-emphasis">{payload.ticket}</code>
          <Button size="sm" variant="ghost" onClick={() => void copyTicket()}>
            {copied ? t("已复制") : t("复制")}
          </Button>
        </div>

        {copied ? null : <p className="sr-only">{clipboardMessage(locale)}</p>}
        <p className="text-2xs text-fg-muted">
          {t("提交于 {time}。提交不会立刻隐藏仓库 —— 核实之后才会处理。", {
            time: formatRelativeTime(payload.createdAt, locale) ?? payload.createdAt,
          })}
        </p>
      </div>
    </Panel>
  );
}

function TakedownLookup() {
  const { t, locale } = useI18n();
  const [ticket, setTicket] = useState("");
  const { envelope, isLoading, lookup } = useTakedownStatus();
  const data = envelope?.data ?? null;
  const error = envelope?.error ?? null;

  return (
    <Panel variant="panel" cut="md" as="section" aria-label={t("查询工单")}>
      <form
        className="cut-frame__inner flex flex-col gap-4 p-8"
        onSubmit={(event) => {
          event.preventDefault();
          const value = ticket.trim();
          if (value.length === 0) return;
          lookup(value);
        }}
      >
        <h2 className="display-cn text-base text-fg-primary">{t("查一下工单")}</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label htmlFor="takedown-ticket" className="sr-only">
            {t("工单号")}
          </label>
          <div className="flex flex-1 items-center gap-2 rounded-sm border border-hairline bg-surface-inset px-4 py-2.5 focus-within:border-gold-soft">
            <input
              id="takedown-ticket"
              name="ticket"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={ticket}
              onChange={(event) => setTicket(event.target.value)}
              placeholder={t("下架时拿到的工单号")}
              className="w-full bg-transparent font-mono text-base text-fg-primary outline-none placeholder:text-fg-muted sm:text-sm"
            />
          </div>
          <Button variant="secondary" type="submit" loading={isLoading} className="sm:min-w-28">
            {t("查询")}
          </Button>
        </div>

        {error ? <ErrorNotice message={errorMessage(error, locale) ?? ""} /> : null}
        {data ? <TicketStatusView payload={data} /> : null}
      </form>
    </Panel>
  );
}

function TicketStatusView({ payload }: { payload: TakedownStatusPayload }) {
  const { t, locale } = useI18n();
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
      <div className="flex items-center gap-2">
        <dt className="text-fg-muted">{t("状态")}</dt>
        <dd className="text-fg-primary">{takedownStatusLabel(payload.status, locale)}</dd>
      </div>
      <div className="flex items-center gap-2">
        <dt className="text-fg-muted">{t("提交于")}</dt>
        <dd className="text-fg-secondary">
          {formatRelativeTime(payload.createdAt, locale) ?? payload.createdAt}
        </dd>
      </div>
      <div className="flex items-center gap-2">
        <dt className="text-fg-muted">{t("更新于")}</dt>
        <dd className="text-fg-secondary">
          {formatRelativeTime(payload.updatedAt, locale) ?? payload.updatedAt}
        </dd>
      </div>
    </dl>
  );
}
