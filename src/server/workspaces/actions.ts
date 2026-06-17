"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createWorkspace,
  currentWorkspaceCookieName,
  listWorkspaces,
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
