import { cookies } from "next/headers";
import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import type { Profile, Workspace, WorkspaceContext, WorkspaceMember } from "./types";

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

type ProfileRow = {
  display_name: string | null;
  id: string;
  locale: string;
};

type WorkspaceMemberRow = {
  created_at: string;
  role: WorkspaceMember["role"];
  status: WorkspaceMember["status"];
  user_id: string;
};

export async function listWorkspaces(): Promise<Workspace[]> {
  const { supabase } = await createAuthenticatedDatabaseClient();
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
  const workspaces = await listWorkspaces().catch((error: unknown) => {
    if (isAuthenticationRequiredError(error)) {
      return [];
    }

    throw error;
  });
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
  const { supabase } = await createAuthenticatedDatabaseClient();
  const websiteUrl = input.websiteUrl?.trim();
  const { data, error } = await supabase.rpc(
    "create_workspace",
    websiteUrl
      ? {
          workspace_name: input.name,
          workspace_website_url: websiteUrl,
        }
      : { workspace_name: input.name },
  );

  if (error) {
    throw new Error(`Could not create workspace: ${error.message}`);
  }

  return mapWorkspace(data as WorkspaceRow);
}

export async function updateWorkspace(input: {
  defaultLocale: string;
  id: string;
  name: string;
  websiteUrl?: string;
}): Promise<Workspace> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("workspaces")
    .update({
      default_locale: input.defaultLocale,
      name: input.name,
      website_url: input.websiteUrl?.trim() ? input.websiteUrl.trim() : null,
    })
    .eq("id", input.id)
    .select("id,name,slug,website_url,default_locale,status,created_at,updated_at")
    .single();

  if (error) {
    throw new Error(`Could not update workspace: ${error.message}`);
  }

  return mapWorkspace(data as WorkspaceRow);
}

export async function clearWorkspaceData(workspaceId: string): Promise<void> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const documents: Array<{ storage_bucket: string; storage_path: string }> = [];
  const pageSize = 500;

  for (let from = 0; ; from += pageSize) {
    const { data, error: documentError } = await supabase
      .from("documents")
      .select("storage_bucket,storage_path")
      .eq("workspace_id", workspaceId)
      .range(from, from + pageSize - 1);
    if (documentError) {
      throw new Error(`Could not load workspace documents: ${documentError.message}`);
    }
    documents.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }

  const documentsByBucket = new Map<string, string[]>();
  for (const document of documents) {
    const paths = documentsByBucket.get(document.storage_bucket) ?? [];
    paths.push(document.storage_path);
    documentsByBucket.set(document.storage_bucket, paths);
  }

  for (const [bucket, bucketDocuments] of documentsByBucket) {
    for (let from = 0; from < bucketDocuments.length; from += 100) {
      const { error: storageError } = await supabase.storage
        .from(bucket)
        .remove(bucketDocuments.slice(from, from + 100));
      if (storageError) {
        throw new Error(`Could not delete workspace documents: ${storageError.message}`);
      }
    }
  }
  const { error } = await supabase.rpc("clear_workspace_data", {
    target_workspace_id: workspaceId,
  });

  if (error) {
    throw new Error(`Could not clear workspace data: ${error.message}`);
  }
}

export async function getCurrentProfile(): Promise<Profile> {
  const { supabase, user } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,display_name,locale")
    .eq("id", user.id)
    .single();

  if (error) {
    throw new Error(`Could not load profile: ${error.message}`);
  }

  return mapProfile(data as ProfileRow);
}

function isAuthenticationRequiredError(error: unknown) {
  return error instanceof Error && error.message === "Authentication required";
}

export async function updateCurrentProfile(input: {
  displayName?: string;
  locale: string;
}): Promise<Profile> {
  const { supabase, user } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      display_name: input.displayName?.trim() ? input.displayName.trim() : null,
      locale: input.locale,
    })
    .eq("id", user.id)
    .select("id,display_name,locale")
    .single();

  if (error) {
    throw new Error(`Could not update profile: ${error.message}`);
  }

  return mapProfile(data as ProfileRow);
}

export async function listWorkspaceMembers(
  workspaceId: string,
): Promise<WorkspaceMember[]> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("user_id,role,status,created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Could not load workspace members: ${error.message}`);
  }

  const members = (data ?? []) as WorkspaceMemberRow[];
  const userIds = members.map((member) => member.user_id);
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id,display_name,locale")
    .in("id", userIds);

  if (profilesError) {
    throw new Error(`Could not load member profiles: ${profilesError.message}`);
  }

  const profileById = new Map(
    ((profiles ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
  );

  return members.map((member) =>
    mapWorkspaceMember(member, profileById.get(member.user_id)),
  );
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

function mapProfile(row: ProfileRow): Profile {
  return {
    displayName: row.display_name,
    id: row.id,
    locale: row.locale,
  };
}

function mapWorkspaceMember(
  row: WorkspaceMemberRow,
  profile: ProfileRow | undefined,
): WorkspaceMember {
  return {
    createdAt: row.created_at,
    displayName: profile?.display_name ?? null,
    email: null,
    role: row.role,
    status: row.status,
    userId: row.user_id,
  };
}
