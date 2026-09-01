import type {
  TrashActionState,
  TrashMutationResult,
} from "@/features/trash/types";

export type TrashMutationGateway = {
  restore(id: string): Promise<TrashMutationResult>;
  permanentlyDelete(id: string): Promise<TrashMutationResult>;
};

const CHANGE_ERROR = "이 내역을 변경할 수 없습니다.";

export async function restoreDeletedTransaction(
  id: string,
  gateway: TrashMutationGateway,
): Promise<TrashActionState> {
  try {
    const result = await gateway.restore(id);
    if (result === "restored") {
      return { status: "success", message: "내역을 복원했어요." };
    }
    return {
      status: "error",
      message: result === "error"
        ? "복원하지 못했습니다. 다시 시도해 주세요."
        : CHANGE_ERROR,
    };
  } catch {
    return { status: "error", message: "복원하지 못했습니다. 다시 시도해 주세요." };
  }
}

export async function permanentlyDeleteTransaction(
  id: string,
  gateway: TrashMutationGateway,
): Promise<TrashActionState> {
  try {
    const result = await gateway.permanentlyDelete(id);
    if (result === "deleted") {
      return { status: "success", message: "내역을 영구 삭제했어요." };
    }
    return {
      status: "error",
      message: result === "error"
        ? "영구 삭제하지 못했습니다. 다시 시도해 주세요."
        : CHANGE_ERROR,
    };
  } catch {
    return {
      status: "error",
      message: "영구 삭제하지 못했습니다. 다시 시도해 주세요.",
    };
  }
}
