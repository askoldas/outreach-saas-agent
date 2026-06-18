"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createActivityEvent } from "@/server/activity/repository";
import {
  createWorkspace,
  currentWorkspaceCookieName,
  listWorkspaces,
  updateCurrentProfile,
  updateWorkspace,
} from "./repository";

export async function createWorkspaceAction(formData: FormData) {
  const name = getString(formData, "name");
  const websiteUrl = getString(formData, "websiteUrl");

  if (name.length < 2 || name.length > 120) {
    redirect(
      `/onboarding/workspace?error=${encodeURIComponent(
        "Workspace name must be between 2 and 120 characters.",
      )}`,
    );
  }

  const workspace = await createWorkspace({ name, websiteUrl });
  await setCurrentWorkspaceCookie(workspace.id);
  redirect("/dashboard");
}

export async function selectWorkspaceAction(formData: FormData) {
  const workspaceId = getString(formData, "workspaceId");
  const workspaces = await listWorkspaces();

  if (!workspaces.some((workspace) => workspace.id === workspaceId)) {
    redirect("/dashboard?error=workspace-not-found");
  }

  await setCurrentWorkspaceCookie(workspaceId);
  redirect("/dashboard");
}

export async function updateWorkspaceSettingsAction(formData: FormData) {
  const workspaceId = getString(formData, "workspaceId");
  const name = getString(formData, "name");
  const websiteUrl = getString(formData, "websiteUrl");
  const defaultLocale = getString(formData, "defaultLocale") || "en";

  if (!workspaceId || name.length < 1 || name.length > 120) {
    redirect(
      `/settings?error=${encodeURIComponent(
        "Workspace name must be between 1 and 120 characters.",
      )}`,
    );
  }

  const workspace = await updateWorkspace({
    defaultLocale,
    id: workspaceId,
    name,
    websiteUrl,
  });

  await createActivityEvent(workspace.id, {
    description: `${workspace.name} workspace settings were updated.`,
    entityExternalId: workspace.id,
    entityType: "workspace",
    label: "Workspace settings updated",
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  redirect("/settings?message=workspace-updated");
}

export async function updateProfileSettingsAction(formData: FormData) {
  const displayName = getString(formData, "displayName");
  const locale = getString(formData, "locale") || "en";

  await updateCurrentProfile({ displayName, locale });

  revalidatePath("/settings");
  redirect("/settings?message=profile-updated");
}

async function setCurrentWorkspaceCookie(workspaceId: string) {
  const cookieStore = await cookies();
  cookieStore.set(currentWorkspaceCookieName, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}
