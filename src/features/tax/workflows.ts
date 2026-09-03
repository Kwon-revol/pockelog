export type TaxActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export type TaxGateway = {
  getSessionUserId(): Promise<string | null>;
  upsertProfile(
    userId: string,
  input: { taxYear: number; grossSalary: number },
): Promise<"saved" | "forbidden" | "error">;
};

const SAVE_ERROR_MESSAGE = "총급여를 저장하지 못했습니다. 다시 시도해 주세요.";

export async function saveTaxProfile(
  gateway: TaxGateway,
  input: { taxYear: number; grossSalary: number },
): Promise<TaxActionState> {
  let userId: string | null;
  try {
    userId = await gateway.getSessionUserId();
  } catch {
    return { status: "error", message: SAVE_ERROR_MESSAGE };
  }

  if (!userId) return { status: "error", message: "로그인이 필요합니다." };

  try {
    const result = await gateway.upsertProfile(userId, input);
    if (result === "saved") return { status: "success", message: "총급여를 저장했어요." };
    if (result === "forbidden") {
      return { status: "error", message: "본인의 세금 정보만 변경할 수 있습니다." };
    }
  } catch {
    // The same retry guidance applies to unavailable database requests.
  }

  return { status: "error", message: SAVE_ERROR_MESSAGE };
}
