import "server-only";

import {
  decodeTrashCursor,
  encodeTrashCursor,
} from "@/features/trash/cursor";
import type { TrashItem, TrashPage } from "@/features/trash/types";
import type { TransactionType } from "@/features/transactions/types";
import { createServerClient } from "@/shared/supabase/server";

type TrashRow = {
  id: string;
  type: TransactionType;
  occurred_on: string;
  description: string;
  amount: number | string;
  memo: string;
  category_name: string;
  category_color: string;
  created_by: string;
  creator_name: string;
  deleted_at: string;
};

type DatabaseError = { code?: string };

export class TrashAuthenticationError extends Error {
  constructor() {
    super("로그인이 필요합니다.");
  }
}

export class TrashAuthorizationError extends Error {
  constructor() {
    super("휴지통을 볼 권한이 없습니다.");
  }
}

export class TrashUnavailableError extends Error {
  constructor() {
    super("휴지통 준비가 아직 끝나지 않았어요.");
  }
}

export class TrashQueryError extends Error {
  constructor() {
    super("휴지통을 불러오지 못했습니다.");
  }
}

function throwDatabaseError(error: DatabaseError | null): never {
  if (error?.code === "42501") throw new TrashAuthorizationError();
  if (error?.code === "42883" || error?.code === "PGRST202" || error?.code === "PGRST205") {
    throw new TrashUnavailableError();
  }
  throw new TrashQueryError();
}

function toTrashItem(row: TrashRow): TrashItem {
  return {
    id: row.id,
    type: row.type,
    occurredOn: row.occurred_on,
    description: row.description,
    amount: Number(row.amount),
    memo: row.memo,
    category: { name: row.category_name, color: row.category_color },
    createdBy: { id: row.created_by, name: row.creator_name },
    deletedAt: row.deleted_at,
  };
}

function toTrashPage(rows: TrashRow[]): TrashPage {
  const hasNextPage = rows.length > 50;
  const items = rows.slice(0, 50).map(toTrashItem);
  const lastItem = items.at(-1);
  return {
    items,
    nextCursor: hasNextPage && lastItem
      ? encodeTrashCursor({ deletedAt: lastItem.deletedAt, id: lastItem.id })
      : null,
  };
}

export async function getTrashPageForCurrentUser(
  encodedCursor?: string,
): Promise<TrashPage> {
  const cursor = encodedCursor === undefined ? null : decodeTrashCursor(encodedCursor);
  if (encodedCursor !== undefined && !cursor) throw new TrashQueryError();

  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new TrashAuthenticationError();

    const { data: profile, error: profileError } = await supabase
      .from("user_private_profiles")
      .select("default_ledger_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profileError) throwDatabaseError(profileError);
    if (!profile?.default_ledger_id) throw new TrashQueryError();

    const { data, error } = await supabase.rpc("get_deleted_transactions", {
      target_ledger_id: profile.default_ledger_id,
      cursor_deleted_at: cursor?.deletedAt ?? null,
      cursor_id: cursor?.id ?? null,
      page_size: 50,
    });
    if (error) throwDatabaseError(error);
    return toTrashPage((data ?? []) as unknown as TrashRow[]);
  } catch (error) {
    if (
      error instanceof TrashAuthenticationError
      || error instanceof TrashAuthorizationError
      || error instanceof TrashUnavailableError
      || error instanceof TrashQueryError
    ) {
      throw error;
    }
    throwDatabaseError(error as DatabaseError);
  }
}
