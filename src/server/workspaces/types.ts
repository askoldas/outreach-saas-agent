export type Workspace = {
  createdAt: string;
  defaultLocale: string;
  id: string;
  name: string;
  slug: string;
  status: "active" | "closed" | "suspended";
  updatedAt: string;
  websiteUrl: string | null;
};

export type WorkspaceContext = {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
};

export type WorkspaceMember = {
  createdAt: string;
  displayName: string | null;
  email: string | null;
  role: "admin" | "member" | "owner" | "viewer";
  status: "active" | "invited" | "removed";
  userId: string;
};

export type Profile = {
  displayName: string | null;
  id: string;
  locale: string;
};
