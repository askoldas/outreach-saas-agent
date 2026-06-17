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
