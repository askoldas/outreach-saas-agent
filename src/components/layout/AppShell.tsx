"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import type { Workspace } from "@/server/workspaces/types";
import styles from "./AppShell.module.css";

const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/offers", label: "Offers" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/leads", label: "Leads" },
  { href: "/drafts", label: "Outreach drafts" },
  { href: "/settings", label: "Settings" },
] as const;

const titleByPath = [
  { prefix: "/dashboard", title: "Overview", context: "Pipeline health" },
  { prefix: "/offers", title: "Offers", context: "Seller knowledge" },
  { prefix: "/campaigns", title: "Campaigns", context: "Market strategy" },
  { prefix: "/leads", title: "Leads", context: "Review queue" },
  { prefix: "/drafts", title: "Outreach drafts", context: "Human approval" },
  { prefix: "/settings", title: "Settings", context: "Workspace controls" },
] as const;

export function AppShell({
  children,
  currentWorkspace,
  userEmail,
  workspaces,
}: Readonly<{
  children: React.ReactNode;
  currentWorkspace: Workspace | null;
  userEmail: string | null;
  workspaces: Workspace[];
}>) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const page = useMemo(
    () => titleByPath.find((item) => pathname.startsWith(item.prefix)) ?? titleByPath[0],
    [pathname],
  );

  if (pathname.startsWith("/auth")) {
    return <main className={styles.authPage}>{children}</main>;
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar} aria-label="Primary navigation">
        <SidebarContent
          currentWorkspace={currentWorkspace}
          pathname={pathname}
          onNavigate={() => setIsOpen(false)}
        />
      </aside>

      {isOpen ? (
        <div className={styles.mobileLayer} role="presentation">
          <button
            className={styles.backdrop}
            type="button"
            aria-label="Close navigation"
            onClick={() => setIsOpen(false)}
          />
          <aside className={styles.drawer} aria-label="Mobile navigation">
            <SidebarContent
              currentWorkspace={currentWorkspace}
              pathname={pathname}
              onNavigate={() => setIsOpen(false)}
            />
          </aside>
        </div>
      ) : null}

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <button
            className={styles.menuButton}
            type="button"
            aria-label="Open navigation"
            onClick={() => setIsOpen(true)}
          >
            <span />
            <span />
            <span />
          </button>
          <div className={styles.titleGroup}>
            <p>{page.context}</p>
            <h1>{page.title}</h1>
          </div>
          <div className={styles.actions}>
            {workspaces.length > 0 ? (
              <form
                action="/workspaces/select"
                className={styles.workspaceForm}
                method="post"
              >
                <label className="sr-only" htmlFor="workspaceId">
                  Current workspace
                </label>
                <select
                  className={styles.workspaceSelect}
                  defaultValue={currentWorkspace?.id}
                  id="workspaceId"
                  name="workspaceId"
                >
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
                <button className={styles.smallButton} type="submit">
                  Switch
                </button>
              </form>
            ) : (
              <Link className={styles.workspaceLink} href="/onboarding/workspace">
                Create workspace
              </Link>
            )}
            <button
              className={styles.iconButton}
              type="button"
              aria-label="Notifications"
            >
              N
            </button>
            <form action="/auth/sign-out" method="post">
              <button className={styles.avatarButton} type="submit" aria-label="Sign out">
                {getInitials(userEmail)}
              </button>
            </form>
          </div>
        </header>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({
  currentWorkspace,
  pathname,
  onNavigate,
}: Readonly<{
  currentWorkspace: Workspace | null;
  pathname: string;
  onNavigate: () => void;
}>) {
  return (
    <div className={styles.sidebarInner}>
      <Link className={styles.wordmark} href="/dashboard" onClick={onNavigate}>
        <span>OSA</span>
        <strong>Outreach Agent</strong>
      </Link>
      <nav className={styles.nav}>
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              className={active ? styles.navActive : styles.navLink}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className={styles.sidebarNote}>
        <span>{currentWorkspace ? "Workspace" : "Setup needed"}</span>
        <p>
          {currentWorkspace
            ? `${currentWorkspace.name} owns tenant data for this session.`
            : "Create a workspace before replacing mock business records."}
        </p>
      </div>
    </div>
  );
}

function getInitials(email: string | null) {
  if (!email) {
    return "U";
  }

  return email.slice(0, 2).toUpperCase();
}
