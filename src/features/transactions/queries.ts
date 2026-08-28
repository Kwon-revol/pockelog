import "server-only";

import { decodeCursor } from "@/features/transactions/cursor";
import { getLedgerPeriod } from "@/features/transactions/period";
import {
  buildCursorFilter,
  getCreatorProfileSource,
  sanitizeSearchTerm,
  toTransactionPage,
  type TransactionRow,
} from "@/features/transactions/query-utils";
import {
  normalizeTransactionFilters,
  transactionIdSchema,
} from "@/features/transactions/schemas";
import { resolveTransactionContext } from "@/features/transactions/supabase-gateway";
import type {
  CategoryOption,
  LedgerPageData,
  TransactionCursor,
  TransactionFilters,
  TransactionPage,
  TransactionListItem,
  TransactionSummary,
} from "@/features/transactions/types";
import { createServerClient } from "@/shared/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createServerClient>>;
type SearchParams = Record<string, string | string[] | undefined>;

export class TransactionAuthenticationError extends Error {}
export class TransactionQueryError extends Error {}

async function listTransactions(
  supabase: ServerClient,
  ledgerId: string,
  filters: TransactionFilters,
  cursor: TransactionCursor | null,
  currentUserId: string,
  ownerId: string,
  ledgerKind: "personal" | "shared",
): Promise<TransactionPage> {
  const ascending = filters.sort === "oldest";
  let query = supabase
    .from("transactions")
    .select("id,type,occurred_on,description,amount,memo,created_by,created_at,category:categories!transactions_category_id_fkey(id,name,color,type)")
    .eq("ledger_id", ledgerId)
    .gte("occurred_on", filters.startOn)
    .lt("occurred_on", filters.endExclusive)
    .is("deleted_at", null)
    .order("occurred_on", { ascending })
    .order("created_at", { ascending })
    .order("id", { ascending })
    .limit(51);

  if (filters.type !== "all") query = query.eq("type", filters.type);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.query) {
    const term = sanitizeSearchTerm(filters.query);
    if (term) query = query.or(`description.ilike.%${term}%,memo.ilike.%${term}%`);
  }
  if (cursor) query = query.or(buildCursorFilter(cursor, filters.sort));

  const { data, error } = await query;
  if (error) throw new TransactionQueryError("거래 목록을 불러오지 못했습니다.");
  const rows = (data ?? []) as unknown as TransactionRow[];
  const creatorIds = [...new Set(rows.map((row) => row.created_by))];
  const creatorNames = new Map<string, string>();
  if (creatorIds.length > 0) {
    const profileResult = getCreatorProfileSource(ledgerKind) === "rpc"
      ? await supabase.rpc(
        "get_transaction_creator_profiles",
        { target_ledger_id: ledgerId, target_user_ids: creatorIds },
      )
      : await supabase.from("profiles").select("id,display_name").in("id", creatorIds);
    const { data: profiles, error: profileError } = profileResult;
    if (profileError) throw new TransactionQueryError("작성자 정보를 불러오지 못했습니다.");
    for (const profile of profiles ?? []) creatorNames.set(profile.id, profile.display_name);
  }
  return toTransactionPage(rows, { currentUserId, ownerId, creatorNames });
}

async function getSummary(
  supabase: ServerClient,
  ledgerId: string,
  filters: TransactionFilters,
): Promise<TransactionSummary> {
  const { data, error } = await supabase.rpc("get_transaction_summary", {
    target_ledger_id: ledgerId,
    start_on: filters.startOn,
    end_exclusive: filters.endExclusive,
  });
  if (error) throw new TransactionQueryError("기간 합계를 불러오지 못했습니다.");
  const row = data?.[0];
  return {
    incomeTotal: Number(row?.income_total ?? 0),
    expenseTotal: Number(row?.expense_total ?? 0),
    balance: Number(row?.balance ?? 0),
  };
}

async function getLedger(
  supabase: ServerClient,
  ledgerId: string,
) {
  const { data, error } = await supabase
    .from("ledgers")
    .select("id,name,period_start_day,owner_id,kind")
    .eq("id", ledgerId)
    .maybeSingle();
  if (error || !data) throw new TransactionQueryError("기본 장부를 불러오지 못했습니다.");
  return { id: data.id, name: data.name, periodStartDay: data.period_start_day, ownerId: data.owner_id, kind: data.kind };
}

async function getCategories(
  supabase: ServerClient,
  ledgerId: string,
): Promise<CategoryOption[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id,name,color,type")
    .eq("ledger_id", ledgerId)
    .eq("is_active", true)
    .order("type")
    .order("sort_order");
  if (error) throw new TransactionQueryError("분류를 불러오지 못했습니다.");
  return (data ?? []) as CategoryOption[];
}

function singleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function getInitialEditorItem(
  supabase: ServerClient,
  rawTransactionId: string | string[] | undefined,
  ledgerId: string,
  currentUserId: string,
  ownerId: string,
): Promise<TransactionListItem | null> {
  const parsedId = transactionIdSchema.safeParse(singleSearchParam(rawTransactionId));
  if (!parsedId.success) return null;

  const { data, error } = await supabase
    .from("transactions")
    .select("id,type,occurred_on,description,amount,memo,created_by,created_at,category:categories!transactions_category_id_fkey(id,name,color,type)")
    .eq("id", parsedId.data)
    .eq("ledger_id", ledgerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) return null;

  const item = toTransactionPage([data as unknown as TransactionRow], {
    currentUserId,
    ownerId,
    creatorNames: new Map(),
  }).items[0];
  return item?.canManage ? item : null;
}

export async function getLedgerPageData(
  searchParams: SearchParams,
  now = new Date(),
): Promise<LedgerPageData> {
  const supabase = await createServerClient();
  const context = await resolveTransactionContext(supabase);
  if (!context) throw new TransactionAuthenticationError("로그인이 필요합니다.");

  const ledger = await getLedger(supabase, context.ledgerId);
  const filters = normalizeTransactionFilters(
    searchParams,
    getLedgerPeriod(now, ledger.periodStartDay),
  );
  const [categories, page, summary, initialEditorItem] = await Promise.all([
    getCategories(supabase, ledger.id),
    listTransactions(supabase, ledger.id, filters, null, context.userId, ledger.ownerId, ledger.kind),
    getSummary(supabase, ledger.id, filters),
    getInitialEditorItem(supabase, searchParams.edit, ledger.id, context.userId, ledger.ownerId),
  ]);
  return {
    ledger: { id: ledger.id, name: ledger.name, periodStartDay: ledger.periodStartDay, kind: ledger.kind },
    categories,
    filters,
    page,
    summary,
    initialEditorItem,
  };
}

export async function getTransactionPageForCurrentUser(
  filters: TransactionFilters,
  encodedCursor: string,
) {
  const cursor = decodeCursor(encodedCursor);
  if (!cursor) throw new TransactionQueryError("잘못된 커서입니다.");
  const supabase = await createServerClient();
  const context = await resolveTransactionContext(supabase);
  if (!context) throw new TransactionAuthenticationError("로그인이 필요합니다.");
  const ledger = await getLedger(supabase, context.ledgerId);
  return listTransactions(supabase, context.ledgerId, filters, cursor, context.userId, ledger.ownerId, ledger.kind);
}

export async function getInitialTransactionPageForCurrentUser(
  filters: TransactionFilters,
) {
  const supabase = await createServerClient();
  const context = await resolveTransactionContext(supabase);
  if (!context) throw new TransactionAuthenticationError("로그인이 필요합니다.");
  const ledger = await getLedger(supabase, context.ledgerId);
  return listTransactions(supabase, context.ledgerId, filters, null, context.userId, ledger.ownerId, ledger.kind);
}
