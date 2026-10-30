import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { BoardId } from "@/shared/contract";
import { isBoardId } from "@/shared/ids";
import { useBoard } from "@/frontend/api/hooks";
import { MatchPanelLayout } from "@/frontend/layouts/MatchPanelLayout";
import { Skeleton } from "@/frontend/components/feedback/Skeleton";
import { useI18n } from "@/frontend/i18n/LocaleProvider";
import { demoOptions, mockBoard } from "@/frontend/mock/fixtures";

/**
 * M5 榜单。
 *
 * 真数据走 `/api/board/:board`（D1 只读，不打 GitHub）；`?demo=partial` /
 * `?demo=stale` 仍然用假数据 —— 那是原型的状态开关，让「部分榜单」和
 * 「榜单数据为 X 天前」两种状态能被真的看见。
 */
export function BoardRoute() {
  const { board } = useParams();
  const [searchParams] = useSearchParams();
  const isDemo = searchParams.has("demo");

  /* 未知的榜单 id 不猜，退回最长沉睡榜 —— 那是最像「榜单首页」的那一张。 */
  const id: BoardId = isBoardId(board) ? board : "longest-sleep";

  return isDemo ? <DemoBoard id={id} /> : <LiveBoard id={id} />;
}

function LiveBoard({ id }: { id: BoardId }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { envelope, isLoading, refetch } = useBoard(id);

  if (!envelope) {
    return (
      <BoardSkeleton label={isLoading ? t("正在读取榜单…") : t("正在读取…")} />
    );
  }

  return (
    <MatchPanelLayout
      envelope={envelope}
      onSwitch={(next) => navigate(`/b/${next}`)}
      onRetry={refetch}
    />
  );
}

function DemoBoard({ id }: { id: BoardId }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const search = searchParams.toString();
  const [nonce, setNonce] = useState(0);

  // 刷新之后回到新鲜且完整的状态。
  const envelope = nonce === 0 ? mockBoard(id, demoOptions(search)) : mockBoard(id, {});

  return (
    <MatchPanelLayout
      envelope={envelope}
      // 榜单由 URL 决定，所以切换就是换一条路由 ——
      // 高亮的榜单和表里的数据因此永远说的是同一个。
      // `?demo=` 一起带走，演示态不该在切榜时丢掉。
      onSwitch={(next) => navigate(`/b/${next}${search ? `?${search}` : ""}`)}
      onRetry={() => setNonce((n) => n + 1)}
    />
  );
}

function BoardSkeleton({ label }: { label: string }) {
  return (
    <div className="mx-auto max-w-page px-4 py-8 sm:px-6" aria-busy="true">
      <p className="sr-only">{label}</p>
      <div className="flex flex-col gap-4 rounded-sm border border-hairline-soft p-6">
        <Skeleton variant="row" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
      </div>
    </div>
  );
}
