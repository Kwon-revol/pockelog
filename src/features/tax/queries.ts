import "server-only";

import {
  calculatePensionTaxBenefit,
  getSupportedTaxYears,
  getTaxRule,
} from "@/features/tax/rules";
import {
  toTaxContributionPage,
  type TaxContributionRow,
} from "@/features/tax/query-utils";
import type {
  TaxContributionPage,
  TaxCursor,
  TaxPageData,
  TaxRule,
} from "@/features/tax/types";
import { createServerClient } from "@/shared/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createServerClient>>;

export class TaxAuthenticationError extends Error {
  constructor() {
    super("로그인이 필요합니다.");
  }
}

export class TaxQueryError extends Error {
  constructor() {
    super("세금 정보를 불러오지 못했습니다.");
  }
}

function requireTaxRule(year: number): TaxRule {
  const rule = getTaxRule(year);
  if (!rule) throw new TaxQueryError();
  return rule;
}

function contributionRpc(
  supabase: ServerClient,
  year: number,
  cursor: TaxCursor | null,
) {
  return supabase.rpc("get_my_pension_contributions", {
    target_year: year,
    page_size: 51,
    after_on: cursor?.occurredOn ?? null,
    after_created_at: cursor?.createdAt ?? null,
    after_id: cursor?.id ?? null,
  });
}

function mapContributionRows(data: unknown): TaxContributionPage {
  return toTaxContributionPage((data ?? []) as TaxContributionRow[]);
}

export async function getTaxPageData(year: number): Promise<TaxPageData> {
  const rule = requireTaxRule(year);
  try {
    const supabase = await createServerClient();

    const [authResult, profileResult, summaryResult, contributionsResult] = await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from("user_tax_profiles")
        .select("gross_salary")
        .eq("tax_year", year)
        .maybeSingle(),
      supabase.rpc("get_my_pension_tax_summary", { target_year: year }),
      contributionRpc(supabase, year, null),
    ]);

    if (!authResult.data.user) throw new TaxAuthenticationError();
    if (profileResult.error || summaryResult.error || contributionsResult.error) {
      throw new TaxQueryError();
    }

    const grossSalary = profileResult.data === null
      ? null
      : Number(profileResult.data.gross_salary);
    const summary = summaryResult.data?.[0];
    const pensionPaid = Number(summary?.pension_paid ?? 0);
    const irpPaid = Number(summary?.irp_paid ?? 0);

    return {
      taxYear: year,
      supportedYears: getSupportedTaxYears(),
      grossSalary,
      pensionPaid,
      irpPaid,
      rule,
      result: grossSalary === null
        ? null
        : calculatePensionTaxBenefit(rule, { grossSalary, pensionPaid, irpPaid }),
      contributions: mapContributionRows(contributionsResult.data),
    };
  } catch (error) {
    if (error instanceof TaxAuthenticationError || error instanceof TaxQueryError) throw error;
    throw new TaxQueryError();
  }
}

export async function getTaxContributionPage(
  year: number,
  cursor: TaxCursor | null,
): Promise<TaxContributionPage> {
  requireTaxRule(year);
  try {
    const supabase = await createServerClient();
    const [authResult, contributionsResult] = await Promise.all([
      supabase.auth.getUser(),
      contributionRpc(supabase, year, cursor),
    ]);

    if (!authResult.data.user) throw new TaxAuthenticationError();
    if (contributionsResult.error) throw new TaxQueryError();
    return mapContributionRows(contributionsResult.data);
  } catch (error) {
    if (error instanceof TaxAuthenticationError || error instanceof TaxQueryError) throw error;
    throw new TaxQueryError();
  }
}
