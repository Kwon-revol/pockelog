import type { NextRequest } from "next/server";

import {
  getTrashPageForCurrentUser,
  TrashAuthenticationError,
  TrashAuthorizationError,
  TrashQueryError,
  TrashUnavailableError,
} from "@/features/trash/queries";
import { trashPageParamsSchema } from "@/features/trash/schemas";

export async function GET(request: NextRequest) {
  const parsed = trashPageParamsSchema.safeParse({
    cursor: request.nextUrl.searchParams.get("cursor") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json({ message: "잘못된 조회 요청입니다." }, { status: 400 });
  }

  try {
    const page = await getTrashPageForCurrentUser(parsed.data.cursor);
    return Response.json(page);
  } catch (error) {
    if (error instanceof TrashAuthenticationError) {
      return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });
    }
    if (error instanceof TrashAuthorizationError) {
      return Response.json({ message: "휴지통을 볼 권한이 없습니다." }, { status: 403 });
    }
    if (error instanceof TrashUnavailableError) {
      return Response.json({ message: "휴지통 준비가 아직 끝나지 않았어요." }, { status: 503 });
    }
    if (error instanceof TrashQueryError) {
      return Response.json({ message: "휴지통을 불러오지 못했습니다." }, { status: 500 });
    }
    return Response.json({ message: "잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}
