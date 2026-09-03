import type { NextRequest } from "next/server";

import { decodeTaxCursor } from "@/features/tax/cursor";
import {
  getTaxContributionPage,
  TaxAuthenticationError,
  TaxQueryError,
} from "@/features/tax/queries";
import { getTaxRule } from "@/features/tax/rules";

export async function GET(request: NextRequest) {
  const yearParam = request.nextUrl.searchParams.get("year");
  const yearNum = yearParam !== null ? Number(yearParam) : NaN;
  const validYear = Number.isInteger(yearNum) && getTaxRule(yearNum) !== null;
  const cursor = validYear
    ? decodeTaxCursor(request.nextUrl.searchParams.get("cursor"), yearNum)
    : null;
  if (!validYear || !cursor) {
    return Response.json({ message: "잘못된 조회 요청입니다." }, { status: 400 });
  }

  try {
    const page = await getTaxContributionPage(yearNum, cursor);
    return Response.json(page);
  } catch (error) {
    if (error instanceof TaxAuthenticationError) {
      return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });
    }
    if (error instanceof TaxQueryError) {
      return Response.json({ message: "내역을 불러오지 못했습니다." }, { status: 500 });
    }
    return Response.json({ message: "잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}
