import { transactionIdSchema } from "@/features/transactions/schemas";
import type {
  TransactionActionState,
  TransactionInput,
} from "@/features/transactions/types";

export type TransactionSessionContext = {
  userId: string;
  ledgerId: string;
};

export type CreateResult = "created" | "duplicate" | "forbidden" | "error";
export type ChangeResult = "updated" | "trashed" | "forbidden" | "error";

export interface TransactionGateway {
  getSessionContext(): Promise<TransactionSessionContext | null>;
  create(context: TransactionSessionContext, input: TransactionInput): Promise<CreateResult>;
  update(context: TransactionSessionContext, id: string, input: TransactionInput): Promise<ChangeResult>;
  trash(context: TransactionSessionContext, id: string): Promise<ChangeResult>;
}

const CHANGE_ERROR = "이 내역을 변경할 수 없습니다.";

async function requireContext(gateway: TransactionGateway) {
  try {
    return await gateway.getSessionContext();
  } catch {
    return undefined;
  }
}

export async function createTransaction(
  input: TransactionInput,
  gateway: TransactionGateway,
): Promise<TransactionActionState> {
  const context = await requireContext(gateway);
  if (context === null) return { status: "error", message: "로그인이 필요합니다." };
  if (!context) {
    return { status: "error", message: "내역을 저장하지 못했습니다. 다시 시도해 주세요." };
  }

  try {
    const result = await gateway.create(context, input);
    if (result === "created" || result === "duplicate") {
      return { status: "success", message: "내역을 저장했어요." };
    }
    return {
      status: "error",
      message: result === "forbidden" ? CHANGE_ERROR : "내역을 저장하지 못했습니다. 다시 시도해 주세요.",
    };
  } catch {
    return { status: "error", message: "내역을 저장하지 못했습니다. 다시 시도해 주세요." };
  }
}

export async function updateTransaction(
  id: string,
  input: TransactionInput,
  gateway: TransactionGateway,
): Promise<TransactionActionState> {
  if (!transactionIdSchema.safeParse(id).success) {
    return { status: "error", message: CHANGE_ERROR };
  }
  const context = await requireContext(gateway);
  if (context === null) return { status: "error", message: "로그인이 필요합니다." };
  if (!context) return { status: "error", message: CHANGE_ERROR };

  try {
    const result = await gateway.update(context, id, input);
    return result === "updated"
      ? { status: "success", message: "내역을 수정했어요." }
      : { status: "error", message: CHANGE_ERROR };
  } catch {
    return { status: "error", message: CHANGE_ERROR };
  }
}

export async function trashTransaction(
  id: string,
  gateway: TransactionGateway,
): Promise<TransactionActionState> {
  if (!transactionIdSchema.safeParse(id).success) {
    return { status: "error", message: CHANGE_ERROR };
  }
  const context = await requireContext(gateway);
  if (context === null) return { status: "error", message: "로그인이 필요합니다." };
  if (!context) return { status: "error", message: CHANGE_ERROR };

  try {
    const result = await gateway.trash(context, id);
    return result === "trashed"
      ? { status: "success", message: "내역을 휴지통으로 이동했어요." }
      : { status: "error", message: CHANGE_ERROR };
  } catch {
    return { status: "error", message: CHANGE_ERROR };
  }
}
