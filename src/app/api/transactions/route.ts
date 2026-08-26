import type { NextRequest } from "next/server";

import {
  getTransactionPageForCurrentUser,
  TransactionAuthenticationError,
  TransactionQueryError,
} from "@/features/transactions/queries";
import { parseTransactionPageParams } from "@/features/transactions/route-contract";

export async function GET(request: NextRequest) {
  const parsed = parseTransactionPageParams(request.nextUrl.searchParams);
  if (!parsed.ok) return Response.json({ message: parsed.message }, { status: 400 });

  try {
    const page = await getTransactionPageForCurrentUser(parsed.filters, parsed.cursor);
    return Response.json(page);
  } catch (error) {
    if (error instanceof TransactionAuthenticationError) {
      return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });
    }
    if (error instanceof TransactionQueryError) {
      return Response.json({ message: "내역을 불러오지 못했습니다." }, { status: 500 });
    }
    return Response.json({ message: "잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}
