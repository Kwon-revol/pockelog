import type {
  PensionTaxInput,
  PensionTaxResult,
  TaxRule,
} from "@/features/tax/types";

const taxRules: Readonly<Record<number, TaxRule>> = {
  2026: {
    year: 2026,
    pensionLimit: 6_000_000,
    combinedLimit: 9_000_000,
    salaryThreshold: 55_000_000,
    ruleVersion: "kr-employment-pension-2026-v1",
  },
};

export function getTaxRule(year: number): TaxRule | null {
  return taxRules[year] ?? null;
}

export function getSupportedTaxYears(): number[] {
  return Object.keys(taxRules).map(Number);
}

export function calculatePensionTaxBenefit(
  rule: TaxRule,
  input: PensionTaxInput,
): PensionTaxResult {
  const pensionEligible = Math.min(input.pensionPaid, rule.pensionLimit);
  const totalEligible = Math.min(pensionEligible + input.irpPaid, rule.combinedLimit);
  const irpEligible = totalEligible - pensionEligible;
  const incomeTaxRate = input.grossSalary <= rule.salaryThreshold ? 0.15 : 0.12;
  const incomeTaxCredit = Math.floor(totalEligible * incomeTaxRate);
  const localIncomeTaxEffect = Math.floor(incomeTaxCredit * 0.1);

  return {
    pensionPaid: input.pensionPaid,
    irpPaid: input.irpPaid,
    pensionEligible,
    irpEligible,
    totalEligible,
    pensionRemaining: Math.max(rule.pensionLimit - pensionEligible, 0),
    totalRemaining: Math.max(rule.combinedLimit - totalEligible, 0),
    pensionExcess: Math.max(input.pensionPaid - pensionEligible, 0),
    irpExcess: Math.max(input.irpPaid - irpEligible, 0),
    incomeTaxRate,
    incomeTaxCredit,
    localIncomeTaxEffect,
    estimatedTotalBenefit: incomeTaxCredit + localIncomeTaxEffect,
    ruleVersion: rule.ruleVersion,
  };
}
