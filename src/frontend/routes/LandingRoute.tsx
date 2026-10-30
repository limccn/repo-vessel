import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { siteCopy } from "@/shared/copy";
import { tierCopy } from "@/shared/ids";
import { tierFor } from "@/shared/tier";
import { Panel } from "@/frontend/components/panel/Panel";
import { NameplateBanner } from "@/frontend/components/panel/NameplateBanner";
import { Button } from "@/frontend/components/common/Button";
import { Sigil } from "@/frontend/components/card/Sigil";
import { UnknownValue } from "@/frontend/components/feedback/FieldValue";
import { TierMark } from "@/frontend/components/hud/TierMark";
import { PanelHeader } from "@/frontend/components/panel/PanelHeader";
import { mockShelfEnvelopes } from "@/frontend/mock/fixtures";
import { useI18n } from "@/frontend/i18n/LocaleProvider";
import { formatDuration } from "@/shared/format";

/* 假数据是数据，不是文案 —— 它不随界面语言变，所以留在模块级只解析一次。 */
const SHELF = mockShelfEnvelopes();

/** 首页 —— Dota 主菜单的第一屏：铭牌 + 一个输入框 + 别人的灵龛。 */
export function LandingRoute() {
  const { t, locale } = useI18n();
  const copy = siteCopy(locale);
  const navigate = useNavigate();
  const [username, setUsername] = useState("");

  const submit = () => {
    const login = username.trim();
    if (login.length === 0) return;
    navigate(`/u/${encodeURIComponent(login)}`);
  };

  return (
    <div className="mx-auto max-w-page px-4 py-10 sm:px-6">
      <Panel variant="panel" edge="gold" cut="xl" grain bevel brackets as="section" aria-label={t("灵龛鉴定")}>
        <div className="cut-frame__inner flex flex-col gap-8 p-8 sm:p-12">
          <NameplateBanner mark="◈" className="self-start">
            {t("灵龛鉴定")}
          </NameplateBanner>

          {/* 口号是品牌的声音，`h1` 是这一页要你做的事。所以口号在上，h1 在下 ——
              两句诗围着中间一段功能说明，读起来是乱的。
              口号不截断，让它按宽度自己换行（换语言时也不会被切掉）。

              字号取 **20px**（字阶里的 H2 一级），不是正文的 16px：交互规范 §M1.2
              把口号写成「Display 文本」，而视觉系统 §5.2 的 Display（38px）只留给
              落地页主标题 —— 一屏里两个 38px 会互相抢。20px 是 Display 之下最近的一级，
              够读成一句品牌语，又不会跟主标题平起平坐。

              宽度与 `h1` 同为 `max-w-2xl`：字阶是 38px，14 个汉字要 585px，
              `max-w-xl`（576px）差 9px 就会把「沉睡。」孤零零地甩到第二行。 */}
          <p className="display-cn max-w-2xl text-xl leading-relaxed text-fg-secondary">
            {copy.slogan}
          </p>

          <div className="flex flex-col gap-4">
            {/* 不用硬换行 —— 那是中文的行宽决定，不是排版决定。按宽度换行，
                换成别的语言时它自己会换到合适的地方。

                移动端降到 30px（`text-3xl`）—— 视觉系统 §5.2：Display 一级是
                38px，移动端 30px。38px 在 390px 的屏幕上会把标题挤成三行。 */}
            <h1
              tabIndex={-1}
              className="display-cn max-w-2xl text-3xl leading-tight text-fg-primary sm:text-4xl"
            >
              {t("看看你的仓库里哪些还在沉睡。")}
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-fg-secondary">
              {t(
                "输入一个 GitHub 用户名，本站只读取公开仓库的元数据：最后一次推送是什么时候、有多少人给它点过 Star、哪些是 Fork、从哪里出发。不会读取仓库里的任何代码，也不会改动你的任何仓库。",
              )}
            </p>
          </div>

          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-center"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <label htmlFor="username" className="sr-only">
              {t("GitHub 用户名")}
            </label>
            <div className="flex flex-1 items-center gap-2 rounded-sm border border-hairline bg-surface-inset px-4 py-2.5 focus-within:border-gold-soft">
              <span aria-hidden="true" className="font-mono text-sm text-fg-muted">
                @
              </span>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t("你的 GitHub 用户名")}
                /* iOS Safari 会在聚焦时放大字号小于 16px 的输入框，整个页面
                   跟着横向错位。所以窄屏用 `text-base`（16px），`sm` 以上
                   才回到 14px。 */
                className="w-full bg-transparent font-mono text-base text-fg-primary outline-none placeholder:text-fg-muted sm:text-sm"
              />
            </div>
            {/* 最小宽度，不是固定宽度 —— 按钮上的字变长时按钮跟着长，
                而不是把字切掉。 */}
            <Button variant="primary" type="submit" className="sm:min-w-40">
              {t("开始鉴定")}
            </Button>
          </form>
        </div>
      </Panel>

      <Panel variant="panel" cut="md" as="section" aria-labelledby="shelf-heading" className="mt-8">
        <PanelHeader
          id="shelf-heading"
          title={t("围观中的灵龛")}
          subtitle={t("这些灵龛正在被打开。你的也可以。")}
        />
        <div className="cut-frame__inner grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
          {SHELF.map((envelope) => {
            const data = envelope.data;
            if (!data) return null;
            const tier = tierFor(data.enrolledCount);
            return (
              <button
                key={data.account.login}
                type="button"
                onClick={() => navigate(`/u/${encodeURIComponent(data.account.login)}`)}
                className="motion-card-hover flex items-center gap-3 rounded-sm border border-hairline bg-surface-inset p-4 text-left transition-colors hover:border-gold-soft"
              >
                <span className="flex flex-none items-center justify-center rounded-sm border border-hairline-soft bg-surface-panel p-1.5">
                  <Sigil name={data.account.login} size={36} />
                </span>
                <span className="min-w-0 flex-1">
                  {/* 用户名是等宽标识符 —— 截断它是对的（那是数据，不是文案）。 */}
                  <span className="block truncate font-mono text-sm text-fg-primary">
                    @{data.account.login}
                  </span>
                  {/* 文案不截断 —— 让它按宽度换行。 */}
                  <span className="mt-1 block text-2xs text-fg-muted">
                    {t("最长沉睡")}{" "}
                    {data.stats.longestDormantDays === null ? (
                      <UnknownValue label={t("最长沉睡天数")} />
                    ) : (
                      formatDuration(data.stats.longestDormantDays, locale)
                    )}
                  </span>
                  <span className="mt-1 block">
                    {tier === null ? (
                      <UnknownValue label={tierCopy(locale).label} />
                    ) : (
                      <TierMark tier={tier} size="sm" />
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
