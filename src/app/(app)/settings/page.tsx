import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { logoutAction } from "@/features/auth/actions";
import { changePasswordAction, updateProfileAction } from "@/features/profile/actions";
import { getProfilePageData, ProfileQueryError } from "@/features/profile/queries";
import {
  createCategoryAction,
  moveCategoryAction,
  setCategoryActiveAction,
  updateCategoryAction,
  updateLedgerSettingsAction,
} from "@/features/settings/actions";
import { getSettingsPageData, SettingsQueryError } from "@/features/settings/queries";
import { SettingsScreen } from "@/features/settings/settings-screen";
import {
  createSharedLedgerAction,
  deleteSharedLedgerAction,
  inviteLedgerMemberAction,
  leaveSharedLedgerAction,
  removeLedgerMemberAction,
  respondToInvitationAction,
  revokeInvitationAction,
} from "@/features/shared-ledgers/actions";
import { getSharedLedgerPageData, SharedLedgerQueryError } from "@/features/shared-ledgers/queries";

export const metadata: Metadata = { title: "설정" };

export default async function SettingsPage() {
  let data;
  let sharedLedgerData;
  let profileData;
  try {
    [data, sharedLedgerData, profileData] = await Promise.all([
      getSettingsPageData(),
      getSharedLedgerPageData(),
      getProfilePageData(),
    ]);
  } catch (error) {
    if (!(error instanceof SettingsQueryError) && !(error instanceof SharedLedgerQueryError) && !(error instanceof ProfileQueryError)) throw error;
    return <div className="rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-black text-slate-950">설정을 불러오지 못했어요</h1><p className="mt-2 text-sm text-slate-500">잠시 후 페이지를 새로고침해 주세요.</p></div>;
  }
  if (!data || sharedLedgerData === null || profileData === null) redirect("/login?next=%2Fsettings");
  return <SettingsScreen changePasswordAction={changePasswordAction} createCategoryAction={createCategoryAction} data={data} logoutAction={logoutAction} moveCategoryAction={moveCategoryAction} profileData={profileData} setCategoryActiveAction={setCategoryActiveAction} sharedLedgerActions={{ createAction: createSharedLedgerAction, inviteAction: inviteLedgerMemberAction, respondAction: respondToInvitationAction, revokeAction: revokeInvitationAction, removeAction: removeLedgerMemberAction, leaveAction: leaveSharedLedgerAction, deleteAction: deleteSharedLedgerAction }} sharedLedgerData={sharedLedgerData} updateCategoryAction={updateCategoryAction} updateLedgerAction={updateLedgerSettingsAction} updateProfileAction={updateProfileAction} />;
}
