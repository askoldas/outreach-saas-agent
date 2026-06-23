import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { getCurrentUser } from "@/server/auth/user";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Outreach SaaS Agent",
  description: "Mock dashboard prototype for AI-assisted B2B prospecting.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  const workspaceContext = user
    ? await getWorkspaceContext().catch(() => ({
        currentWorkspace: null,
        workspaces: [],
      }))
    : { currentWorkspace: null, workspaces: [] };

  return (
    <html lang="en">
      <body>
        <AppShell
          currentWorkspace={workspaceContext.currentWorkspace}
          userEmail={user?.email ?? null}
          workspaces={workspaceContext.workspaces}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
