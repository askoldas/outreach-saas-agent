import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { getCurrentUser } from "@/server/auth/user";
import { getWorkspaceContext } from "@/server/workspaces/repository";

export const metadata = { robots: { index: false, follow: false } };

export default async function AuthenticatedAppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/campaigns");
  const workspaceContext = await getWorkspaceContext().catch(() => ({
    currentWorkspace: null,
    workspaces: [],
  }));
  return (
    <AppShell
      currentWorkspace={workspaceContext.currentWorkspace}
      userEmail={user.email ?? null}
      workspaces={workspaceContext.workspaces}
    >
      {children}
    </AppShell>
  );
}
