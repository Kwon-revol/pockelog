export type TaxCategoryCode = "pension_savings" | "irp";

export type TaxRule = {
  year: number;
  pensionLimit: number;
  combinedLimit: number;
  salaryThreshold: number;
  ruleVersion: string;
};

export type PensionTaxInput = {
  grossSalary: number;
  pensionPaid: number;
  irpPaid: number;
};

export type PensionTaxResult = {
  pensionPaid: number;
  irpPaid: number;
  pensionEligible: number;
  irpEligible: number;
  totalEligible: number;
  pensionRemaining: number;
  totalRemaining: number;
  pensionExcess: number;
  irpExcess: number;
  incomeTaxRate: 0.15 | 0.12;
  incomeTaxCredit: number;
  localIncomeTaxEffect: number;
  estimatedTotalBenefit: number;
  ruleVersion: string;
};
