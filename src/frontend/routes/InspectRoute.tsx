import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/frontend/layouts/DashboardLayout";
import { HeroGridLayout } from "@/frontend/layouts/HeroGridLayout";
import { Skeleton } from "@/frontend/components/feedback/Skeleton";
import { useInspect } from "@/frontend/api/hooks";
import { useI18n } from "@/frontend/i18n/LocaleProvider";
import { demoOptions, mockInspect } from "@/frontend/mock/fixtures";

/**
 * M2 鉴定结果。
 *
 * 真数据走 `/api/inspect/:username`（`useInspect`）；`?demo=partial` /
 * `?demo=stale` 仍然用假数据 —— 那是原型的状态开关，让「不完整」和「陈旧」
 * 两种提示条能被真的看见，不需要真的把 GitHub 打坏一次。
 */
export function InspectRoute() {
  const { username = "demo" } = useParams();
  const [searchParams] = useSearchParams();
  const isDemo = searchParams.has("demo");

  return isDemo ? <DemoInspect username={username} /> : <LiveInspect username={username} />;
}

function LiveInspect({ username }: { username: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { envelope, isLoading, refetch } = useInspect(username);

  if (!envelope) {
    return (
      <InspectSkeleton
        label={
          isLoading
            ? t("正在读取 {login} 的公开仓库…", { login: username })
            : t("正在读取…")
        }
      />
    );
  }

  return (
    <>
      <DashboardLayout
        envelope={envelope}
        onRetry={refetch}
        onOpenRepos={() => navigate(`/u/${encodeURIComponent(username)}/repos`)}
      />
      <NextNav username={username} />
    </>
  );
}

function DemoInspect({ username }: { username: string }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const search = searchParams.toString();
  const [nonce, setNonce] = useState(0);

  // 重新读取之后回到新鲜且完整的状态：重读不该还挂着「这是 X 天前的数据」。
  const envelope =
    nonce === 0 ? mockInspect(username, demoOptions(search)) : mockInspect(username, {});

  return (
    <>
      <DashboardLayout
        envelope={envelope}
        onRetry={() => setNonce((value) => value + 1)}
        onOpenRepos={() => navigate(`/u/${encodeURIComponent(username)}/repos`)}
      />
      <NextNav username={username} />
    </>
  );
}

function NextNav({ username }: { username: string }) {
  const { t } = useI18n();
  return (
    <nav aria-label={t("后续")} className="mx-auto max-w-page px-4 pb-8 sm:px-6">
      <Link
        to={`/u/${encodeURIComponent(username)}/repos`}
        /* 「Hero Grid」是布局的内部名字，用户不认识；留一条能点得中的
           行内链接，说的就是它要去哪。 */
        className="inline-flex min-h-6 items-center py-1 text-xs text-teal underline decoration-teal/30"
      >
        {t("→ 打开完整的仓库列表")}
      </Link>
    </nav>
  );
}

function InspectSkeleton({ label }: { label: string }) {
  return (
    <div className="mx-auto max-w-page px-4 py-8 sm:px-6" aria-busy="true">
      <p className="sr-only">{label}</p>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <Skeleton variant="card" />
        <div className="flex flex-col gap-4">
          <Skeleton variant="row" />
          <Skeleton variant="row" />
          <Skeleton variant="row" />
        </div>
      </div>
    </div>
  );
}

/** M3 仓库列表。 */
export function ReposRoute() {
  const { username = "demo" } = useParams();
  const [searchParams] = useSearchParams();
  const isDemo = searchParams.has("demo");

  return isDemo ? <DemoRepos username={username} /> : <LiveRepos username={username} />;
}

function LiveRepos({ username }: { username: string }) {
  const { t } = useI18n();
  const { envelope, isLoading, refetch } = useInspect(username);

  if (!envelope) {
    return (
      <InspectSkeleton
        label={
          isLoading
            ? t("正在读取 {login} 的公开仓库…", { login: username })
            : t("正在读取…")
        }
      />
    );
  }

  return <HeroGridLayout envelope={envelope} onRetry={refetch} />;
}

function DemoRepos({ username }: { username: string }) {
  const [searchParams] = useSearchParams();
  const search = searchParams.toString();
  const [nonce, setNonce] = useState(0);

  const envelope =
    nonce === 0 ? mockInspect(username, demoOptions(search)) : mockInspect(username, {});

  return <HeroGridLayout envelope={envelope} onRetry={() => setNonce((value) => value + 1)} />;
}
