/**
 * 数据钩子 —— 一个接口一个。
 *
 * 契约（`.trellis/spec/frontend/hook-guidelines.md`）：
 *   - `envelope` 永远来自响应，`completeness` 不从空数组推断；
 *   - `partial` 不是错误 —— 它是带一条提示的数据；
 *   - 首次加载 300 ms 内不亮骨架，避免闪一下；
 *   - 卸载或路径变化时取消在途请求，慢响应不能覆盖新页面。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ApiError,
  BoardId,
  BoardPayload,
  ClaimsPayload,
  ClaimPayload,
  CollectionStatusPayload,
  InspectPayload,
  RepoSummary,
  TakedownPayload,
  TakedownStatusPayload,
} from "@/shared/contract";
import { useLocale } from "@/frontend/i18n/LocaleProvider";
import type { ApiEnvelope } from "./client";
import {
  boardPath,
  claimPath,
  claimsPath,
  collectionStatusPath,
  getEnvelope,
  inspectPath,
  repoPath,
  sendJson,
  takedownPath,
  takedownTicketPath,
} from "./client";

/** 骨架屏延迟：300 ms 内到达的响应不该闪一下骨架。 */
const LOADING_DELAY_MS = 300;

export interface QueryResult<T> {
  /** `null` 表示还没有任何响应（首次加载中）。 */
  envelope: ApiEnvelope<T> | null;
  isLoading: boolean;
  refetch(): void;
}

function useEnvelopeQuery<T>(path: string): QueryResult<T> {
  const [envelope, setEnvelope] = useState<ApiEnvelope<T> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [nonce, setNonce] = useState(0);
  const lastPath = useRef<string | null>(null);
  /* 服务端把称号、榜单名、收录条件这些句子**按语言**放进信封 —— 所以换语言
     就是换了一份数据，不只是换了一遍渲染。把它并进缓存的键里，切换语言时
     重新取一次；否则英语界面里会留着一段上次读到的中文。 */
  const locale = useLocale();

  useEffect(() => {
    // 换人 / 换仓库 / 换语言时先清空：不能让上一份结果停在新地址下面。
    const key = `${path}|${locale}`;
    if (lastPath.current !== key) {
      lastPath.current = key;
      setEnvelope(null);
    }

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      setIsLoading(true);
    }, LOADING_DELAY_MS);

    const settle = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      setIsLoading(false);
    };

    getEnvelope<T>(path, controller.signal, locale)
      .then((result) => {
        if (controller.signal.aborted) return;
        setEnvelope(result);
        settle();
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        settle();
      });

    return () => {
      controller.abort();
      if (timer !== null) clearTimeout(timer);
    };
    /* `locale` 也是依赖：换语言要中止上一个请求、按新语言重取。 */
  }, [path, nonce, locale]);

  const refetch = useCallback(() => setNonce((value) => value + 1), []);

  return { envelope, isLoading, refetch };
}

export function useInspect(username: string): QueryResult<InspectPayload> {
  return useEnvelopeQuery<InspectPayload>(inspectPath(username));
}

export function useRepo(owner: string, name: string): QueryResult<RepoSummary> {
  return useEnvelopeQuery<RepoSummary>(repoPath(owner, name));
}

export function useBoard(id: BoardId): QueryResult<BoardPayload> {
  return useEnvelopeQuery<BoardPayload>(boardPath(id));
}

/** 管理页的列表。只有在确定已登录时才该挂载 —— 未登录它只会拿到 401。 */
export function useMyClaims(): QueryResult<ClaimsPayload> {
  return useEnvelopeQuery<ClaimsPayload>(claimsPath());
}

/* -------------------------------------------------------------------------- */
/* 手动触发的查询与写入                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 收录状态检查器。
 *
 * 它**不在挂载时自动跑**：查什么由用户输入决定。多次输入时后发先至的旧响应
 * 必须被丢掉，否则「查 a 再查 b」会显示 a 的结果。
 */
export interface StatusCheckResult {
  envelope: ApiEnvelope<CollectionStatusPayload> | null;
  isLoading: boolean;
  check(fullName: string): void;
}

export function useCollectionStatus(): StatusCheckResult {
  const [envelope, setEnvelope] = useState<ApiEnvelope<CollectionStatusPayload> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const sequence = useRef(0);

  const check = useCallback((fullName: string) => {
    const ticket = sequence.current + 1;
    sequence.current = ticket;
    setIsLoading(true);
    void getEnvelope<CollectionStatusPayload>(collectionStatusPath(fullName)).then((result) => {
      if (sequence.current !== ticket) return;
      setEnvelope(result);
      setIsLoading(false);
    });
  }, []);

  return { envelope, isLoading, check };
}

export interface ClaimActions {
  pending: boolean;
  error: ApiError | null;
  /** 隐藏 / 恢复。成功返回 `true` —— 调用方据此决定是否刷新列表。 */
  setHidden(hidden: boolean): Promise<boolean>;
  clearError(): void;
}

/** 对一个**已经认领**的仓库隐藏或恢复。 */
export function useClaimActions(fullName: string): ClaimActions {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const setHidden = useCallback(
    async (hidden: boolean): Promise<boolean> => {
      setPending(true);
      setError(null);
      const result = await sendJson<ClaimPayload>(claimPath(fullName), "PATCH", { hidden });
      setPending(false);
      if (result.error) {
        setError(result.error);
        return false;
      }
      return true;
    },
    [fullName],
  );

  return { pending, error, setHidden, clearError: () => setError(null) };
}

export interface ClaimResult {
  pending: boolean;
  error: ApiError | null;
  /** 认领一个仓库。成功返回 `true`。 */
  claim(fullName: string): Promise<boolean>;
}

export function useClaimRepo(): ClaimResult {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const claim = useCallback(async (fullName: string): Promise<boolean> => {
    setPending(true);
    setError(null);
    const result = await sendJson<ClaimPayload>(claimPath(fullName), "POST", {});
    setPending(false);
    if (result.error) {
      setError(result.error);
      return false;
    }
    return true;
  }, []);

  return { pending, error, claim };
}

export interface TakedownResult {
  pending: boolean;
  error: ApiError | null;
  payload: TakedownPayload | null;
  submit(repo: string, reason: string): Promise<void>;
}

export function useTakedownSubmit(): TakedownResult {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [payload, setPayload] = useState<TakedownPayload | null>(null);

  const submit = useCallback(async (repo: string, reason: string) => {
    setPending(true);
    setError(null);
    const result = await sendJson<TakedownPayload>(takedownPath(), "POST", {
      repo,
      reason: reason.trim().length > 0 ? reason.trim() : undefined,
    });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setPayload(result.data);
  }, []);

  return { pending, error, payload, submit };
}

export interface TakedownStatusResult {
  envelope: ApiEnvelope<TakedownStatusPayload> | null;
  isLoading: boolean;
  lookup(ticket: string): void;
}

/** 凭工单号查状态。同样是手动触发 —— 查什么由用户贴进来的号码决定。 */
export function useTakedownStatus(): TakedownStatusResult {
  const [envelope, setEnvelope] = useState<ApiEnvelope<TakedownStatusPayload> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const sequence = useRef(0);

  const lookup = useCallback((ticket: string) => {
    const current = sequence.current + 1;
    sequence.current = current;
    setIsLoading(true);
    void getEnvelope<TakedownStatusPayload>(takedownTicketPath(ticket)).then((result) => {
      if (sequence.current !== current) return;
      setEnvelope(result);
      setIsLoading(false);
    });
  }, []);

  return { envelope, isLoading, lookup };
}
