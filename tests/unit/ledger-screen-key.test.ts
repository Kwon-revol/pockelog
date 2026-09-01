import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { getLedgerScreenKey } from "@/features/transactions/ledger-screen-key";
import type { LedgerPageData } from "@/features/transactions/types";

describe("ledger screen server key", () => {
  it("changes when authoritative ledger data changes", () => {
    const data = {
      ledger: { id: "ledger-1", name: "내 장부", periodStartDay: 1, kind: "personal" },
      categories: [],
      filters: {
        startOn: "2026-08-01",
        endOn: "2026-08-31",
        endExclusive: "2026-09-01",
        query: "",
        type: "all",
        categoryId: null,
        sort: "newest",
      },
      page: { items: [], nextCursor: null },
      summary: { incomeTotal: 0, expenseTotal: 0, balance: 0 },
      initialEditorItem: null,
      initialCategoryId: null,
    } satisfies LedgerPageData;

    expect(getLedgerScreenKey(data)).not.toBe(
      getLedgerScreenKey({
        ...data,
        summary: { incomeTotal: 1000, expenseTotal: 0, balance: 1000 },
      }),
    );
  });

  it("keeps server-callable helpers outside the client component import", () => {
    const pagePath = join(process.cwd(), "src/app/(app)/ledger/page.tsx");
    const source = ts.createSourceFile(
      pagePath,
      readFileSync(pagePath, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const imports = source.statements.filter(ts.isImportDeclaration).map((statement) => ({
      module: (statement.moduleSpecifier as ts.StringLiteral).text,
      names: statement.importClause?.namedBindings
        && ts.isNamedImports(statement.importClause.namedBindings)
        ? statement.importClause.namedBindings.elements.map(
          (element) => element.propertyName?.text ?? element.name.text,
        )
        : [],
    }));

    expect(imports.find(
      (entry) => entry.module === "@/features/transactions/ledger-screen",
    )?.names).toEqual(["LedgerScreen"]);
    expect(imports.find(
      (entry) => entry.module === "@/features/transactions/ledger-screen-key",
    )?.names).toContain("getLedgerScreenKey");
  });
});
