import { describe, expect, it } from "vitest";

import {
  calculatePensionTaxBenefit,
  getTaxRule,
} from "@/features/tax/rules";
import { taxProfileFormSchema } from "@/features/tax/schemas";

describe("2026 pension tax rule", () => {
  it.each([
    [{ grossSalary: 55_000_000, pensionPaid: 6_000_000, irpPaid: 3_000_000 }, 1_350_000, 135_000, 1_485_000],
    [{ grossSalary: 55_000_001, pensionPaid: 6_000_000, irpPaid: 3_000_000 }, 1_080_000, 108_000, 1_188_000],
    [{ grossSalary: 40_000_000, pensionPaid: 9_000_000, irpPaid: 0 }, 900_000, 90_000, 990_000],
    [{ grossSalary: 40_000_000, pensionPaid: 0, irpPaid: 9_000_000 }, 1_350_000, 135_000, 1_485_000],
  ])("calculates the 2026 pension credit", (input, incomeTax, localTax, total) => {
    expect(calculatePensionTaxBenefit(getTaxRule(2026)!, input)).toMatchObject({
      incomeTaxCredit: incomeTax,
      localIncomeTaxEffect: localTax,
      estimatedTotalBenefit: total,
    });
  });

  it("registers only the 2026 rule with the statutory limits", () => {
    expect(getTaxRule(2026)).toMatchObject({
      year: 2026,
      pensionLimit: 6_000_000,
      combinedLimit: 9_000_000,
      salaryThreshold: 55_000_000,
      ruleVersion: "kr-employment-pension-2026-v1",
    });
    expect(getTaxRule(2025)).toBeNull();
    expect(getTaxRule(2027)).toBeNull();
  });

  it("reports item eligibility, remaining limits, and excess amounts", () => {
    expect(
      calculatePensionTaxBenefit(getTaxRule(2026)!, {
        grossSalary: 40_000_000,
        pensionPaid: 9_000_000,
        irpPaid: 10_000_000,
      }),
    ).toMatchObject({
      pensionPaid: 9_000_000,
      irpPaid: 10_000_000,
      pensionEligible: 6_000_000,
      irpEligible: 3_000_000,
      totalEligible: 9_000_000,
      pensionRemaining: 0,
      totalRemaining: 0,
      pensionExcess: 3_000_000,
      irpExcess: 7_000_000,
      incomeTaxRate: 0.15,
      ruleVersion: "kr-employment-pension-2026-v1",
    });
  });
});

describe("tax profile form", () => {
  it("normalizes a comma-separated safe integer salary and coerced year", () => {
    expect(
      taxProfileFormSchema.parse({ taxYear: "2026", grossSalary: "55,000,000" }),
    ).toEqual({ taxYear: 2026, grossSalary: 55_000_000 });
  });

  it.each(["", "   ", ",", ",,,"]) (
    "rejects a salary input without any digits: %j",
    (grossSalary) => {
      expect(taxProfileFormSchema.safeParse({ taxYear: "2026", grossSalary }).success).toBe(false);
    },
  );

  it.each([
    { taxYear: "2025", grossSalary: "55,000,000" },
    { taxYear: "2027", grossSalary: "55,000,000" },
    { taxYear: "2026", grossSalary: "-1" },
    { taxYear: "2026", grossSalary: "1.5" },
    { taxYear: "2026", grossSalary: "9007199254740992" },
  ])("rejects unsupported years and invalid salaries: %o", (input) => {
    expect(taxProfileFormSchema.safeParse(input).success).toBe(false);
  });
});
