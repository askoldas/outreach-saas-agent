import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Workspace, WorkspaceContext } from "./types";

export const currentWorkspaceCookieName = "osa-current-workspace";

type WorkspaceRow = {
  created_at: string;
  default_locale: string;
  id: string;
  name: string;
  slug: string;
  status: Workspace["status"];
  updated_at: string;
  website_url: string | null;
};

export async function listWorkspaces(): Promise<Workspace[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspaces")
    .select("id,name,slug,website_url,default_locale,status,created_at,updated_at")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Could not load workspaces: ${error.message}`);
  }

  return (data ?? []).map(mapWorkspace);
}

export async function getWorkspaceContext(): Promise<WorkspaceContext> {
  const workspaces = await listWorkspaces();
  const cookieStore = await cookies();
  const selectedId = cookieStore.get(currentWorkspaceCookieName)?.value;
  const selectedWorkspace = workspaces.find((workspace) => workspace.id === selectedId);

  return {
    currentWorkspace: selectedWorkspace ?? workspaces[0] ?? null,
    workspaces,
  };
}

export async function createWorkspace(input: {
  name: string;
  websiteUrl?: string;
}): Promise<Workspace> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_workspace", {
    workspace_name: input.name,
    workspace_website_url: input.websiteUrl ?? null,
  });

  if (error) {
    throw new Error(`Could not create workspace: ${error.message}`);
  }

  return mapWorkspace(data as WorkspaceRow);
}

function mapWorkspace(row: WorkspaceRow): Workspace {
  return {
    createdAt: row.created_at,
    defaultLocale: row.default_locale,
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    updatedAt: row.updated_at,
    websiteUrl: row.website_url,
  };
}
