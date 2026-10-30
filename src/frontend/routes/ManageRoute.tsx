import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { ManageClaim } from "@/shared/contract";
import { formatRelativeTime } from "@/shared/format";
import { useClaimActions, useClaimRepo, useMyClaims } from "@/frontend/api/hooks";
import { Button } from "@/frontend/components/common/Button";
import { EmptyState } from "@/frontend/components/feedback/EmptyState";
import { ErrorNotice } from "@/frontend/components/feedback/ErrorNotice";
import { Skeleton } from "@/frontend/components/feedback/Skeleton";
import { Panel } from "@/frontend/components/panel/Panel";
import { NameplateBanner } from "@/frontend/components/panel/NameplateBanner";
import { Trans } from "@/frontend/i18n/Trans";
import { LanguagePreference } from "@/frontend/i18n/LanguagePreference";
import { errorMessage } from "@/frontend/i18n/errorMessage";
import { useI18n } from "@/frontend/i18n/LocaleProvider";
import { SIGN_IN_URL, fetchSession, signOut, type SessionInfo } from "@/frontend/lib/auth";
import { buttonClassName } from "@/frontend/lib/button";

/**
 * 登录失败的原因码 → 内联文案（交互规范 §8.4：登录失败用内联错误，不用 Toast）。
 *
 * 原因码只在 URL 上，从不进界面 —— 用户看到的是这句话，不是 `?auth=state`。
 * 表里存的是**简体中文原句**，也就是词典的 msgid；渲染时过一遍 `t()`。
 */
const AUTH_ERROR: Record<string, string> = {
  unconfigured: "站点的 GitHub 登录还没有配置好。这不是你的问题，请稍后再来。",
  denied: "你在 GitHub 上取消了授权，所以这次没有完成登录。",
  state: "这次登录请求已经过期了。重新点一次登录即可。",
  exchange: "没能和 GitHub 完成这次登录。稍后再试一次。",
  profile: "拿到了授权，但没读到你的 GitHub 资料。稍后再试一次。",
  "personal-only": "本站只支持个人账户。组织账户没法登录，也不会被收录。",
};

/**
 * F2 · 我的管理。
 *
 * 登录之后列出**我认领的仓库**，可以隐藏 / 恢复。认领不创建收录权 ——
 * 只有已经核实、还在龛里的仓库才认领得上；认领之后隐藏是一条只影响展示的
 * 开关，不动 GitHub 上的任何东西。
 */
export function ManageRoute() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const reason = params.get("auth");
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetchSession(controller.signal).then((value) => {
      setSession(value);
      setLoaded(true);
    });
    return () => controller.abort();
  }, []);

  const error = reason && reason !== "ok" ? (AUTH_ERROR[reason] ?? null) : null;

  return (
    <div className="mx-auto max-w-page px-4 py-8 sm:px-6">
      <Panel variant="panel" edge="gold" cut="lg" grain as="section" aria-label={t("我的管理")}>
        <div className="cut-frame__inner flex flex-col gap-6 p-8">
          <NameplateBanner mark="◈" headingLevel={1} className="self-start">
            {t("我的管理")}
          </NameplateBanner>

          {error ? (
            <div
              role="alert"
              className="rounded-sm border border-hairline-soft bg-surface-inset p-4 text-sm leading-relaxed text-fg-secondary"
            >
              <p className="text-fg-primary">{t("没有完成登录。")}</p>
              <p className="mt-1">{t(error)}</p>
            </div>
          ) : null}

          {!loaded ? (
            <p className="text-sm text-fg-muted">{t("正在确认登录状态…")}</p>
          ) : session ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm leading-relaxed text-fg-secondary">
                  <Trans
                    text={t("已登录为 @{login}。")}
                    nodes={{
                      login: (
                        <span className="font-mono text-fg-primary">{session.login}</span>
                      ),
                    }}
                  />
                </p>
                <button
                  type="button"
                  onClick={() => {
                    void signOut().then(() => setSession(null));
                  }}
                  className={buttonClassName("secondary", "sm")}
                >
                  {t("撤销登录")}
                </button>
              </div>

              <ClaimsSection />

              {/* 语言偏好属于账号，不属于仓库；放在认领之后，不与主任务抢位置。 */}
              <div className="border-t border-hairline-soft pt-6">
                <LanguagePreference />
              </div>

              <p className="text-2xs leading-relaxed text-fg-muted">
                {/* 整句一条 msgid，链接做占位节点：句号跟译文走，否则英语页会
                    以一个中文句号收尾。 */}
                <Trans
                  text={t(
                    "认领只是证明这个仓库是你名下的，它不会让仓库入龛。想让它彻底消失，也可以直接把 GitHub 上的主题去掉，或者走{link}。",
                  )}
                  nodes={{
                    link: (
                      <Link to="/takedown" className="ml-1">
                        {t("下架申请")}
                      </Link>
                    ),
                  }}
                />
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm leading-relaxed text-fg-secondary">
                {t(
                  "用 GitHub 登录后，你可以证明某个已收录的仓库是你名下的。本站只读取你的公开身份，不申请任何仓库读写权限。",
                )}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <a href={SIGN_IN_URL} className={buttonClassName("primary", "md")}>
                  {t("用 GitHub 登录")}
                </a>
                <Link to="/takedown" className="text-xs">
                  {t("无法登录？提交下架申请")}
                </Link>
              </div>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

/**
 * 列表与认领表单共用一个查询：认领成功之后要立刻刷新列表，所以它们必须
 * 拿到同一个 `refetch`。
 */
function ClaimsSection() {
  const { envelope, isLoading, refetch } = useMyClaims();

  return (
    <div className="flex flex-col gap-6">
      <ClaimList envelope={envelope} isLoading={isLoading} refetch={refetch} />
      <div className="border-t border-hairline-soft pt-6">
        <ClaimForm onClaimed={refetch} />
      </div>
    </div>
  );
}

interface ClaimListProps {
  envelope: ReturnType<typeof useMyClaims>["envelope"];
  isLoading: boolean;
  refetch: () => void;
}

function ClaimList({ envelope, isLoading, refetch }: ClaimListProps) {
  const { t, locale } = useI18n();

  if (!envelope) {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        <p className="sr-only">
          {isLoading ? t("正在读取你的认领…") : t("正在读取…")}
        </p>
        <Skeleton variant="row" />
        <Skeleton variant="row" />
      </div>
    );
  }

  if (envelope.error) {
    return (
      <ErrorNotice
        message={errorMessage(envelope.error, locale) ?? ""}
        onRetry={refetch}
      />
    );
  }

  const claims = envelope.data?.claims ?? [];
  if (claims.length === 0) {
    return (
      <EmptyState
        title={t("还没有认领任何仓库。")}
        description={t("在自己的已收录仓库上认领之后，可以在这里把它隐藏起来。")}
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {claims.map((claim) => (
        <ClaimRow key={claim.fullName} claim={claim} onChanged={refetch} />
      ))}
    </ul>
  );
}

function ClaimRow({ claim, onChanged }: { claim: ManageClaim; onChanged: () => void }) {
  const { t, locale } = useI18n();
  const { pending, error, setHidden } = useClaimActions(claim.fullName);

  const toggle = async () => {
    if (await setHidden(!claim.hidden)) onChanged();
  };

  return (
    <li className="flex flex-col gap-2 rounded-sm border border-hairline-soft px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="break-words font-mono text-sm text-fg-primary">{claim.fullName}</span>
          <span className="text-2xs text-fg-muted">
            {claim.hidden ? t("已隐藏") : claim.manageable ? t("展示中") : t("已不在龛里")}
            {claim.verifiedAt
              ? t(" · 核实于 {time}", {
                  time: formatRelativeTime(claim.verifiedAt, locale) ?? claim.verifiedAt,
                })
              : ""}
          </span>
        </div>
        <Button
          size="sm"
          variant={claim.hidden ? "secondary" : "ghost"}
          loading={pending}
          disabled={!claim.manageable && !claim.hidden}
          onClick={() => void toggle()}
        >
          {claim.hidden ? t("恢复展示") : t("隐藏")}
        </Button>
      </div>

      {!claim.manageable && !claim.hidden ? (
        <p className="text-2xs leading-relaxed text-fg-muted">
          {t(
            "它已经不在龛里了（主题被拿掉、转为私有，或账户变成了组织）。认领记录还在，但没有可以恢复的东西。",
          )}
        </p>
      ) : null}

      {error ? (
        <p className="text-xs text-fg-primary">{errorMessage(error, locale)}</p>
      ) : null}
    </li>
  );
}

function ClaimForm({ onClaimed }: { onClaimed: () => void }) {
  const { t, locale } = useI18n();
  const [value, setValue] = useState("");
  const { pending, error, claim } = useClaimRepo();
  const [done, setDone] = useState(false);

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const fullName = value.trim();
        if (fullName.length === 0) return;
        setDone(false);
        void claim(fullName).then((ok) => {
          if (ok) {
            setDone(true);
            setValue("");
            onClaimed();
          }
        });
      }}
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="claim-repo" className="display-cn text-base text-fg-primary">
          {t("认领一个仓库")}
        </label>
        <p className="text-sm leading-relaxed text-fg-secondary">
          {t("输入你自己名下的已收录仓库（owner/name）。")}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-sm border border-hairline bg-surface-inset px-4 py-2.5 focus-within:border-gold-soft">
          <input
            id="claim-repo"
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
        <Button variant="primary" type="submit" loading={pending} className="sm:min-w-28">
          {t("认领")}
        </Button>
      </div>

      {error ? <ErrorNotice message={errorMessage(error, locale) ?? ""} /> : null}
      {done ? (
        <p className="text-xs text-fg-secondary">
          {t("认领成功。它已经出现在上面的列表里。")}
        </p>
      ) : null}
    </form>
  );
}
