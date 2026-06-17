"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
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

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const page = useMemo(
    () => titleByPath.find((item) => pathname.startsWith(item.prefix)) ?? titleByPath[0],
    [pathname],
  );

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar} aria-label="Primary navigation">
        <SidebarContent pathname={pathname} onNavigate={() => setIsOpen(false)} />
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
            <SidebarContent pathname={pathname} onNavigate={() => setIsOpen(false)} />
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
            <button className={styles.workspaceSelect} type="button">
              Northstar Components
            </button>
            <button
              className={styles.iconButton}
              type="button"
              aria-label="Notifications"
            >
              N
            </button>
            <button className={styles.avatarButton} type="button" aria-label="User menu">
              AR
            </button>
          </div>
        </header>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({
  pathname,
  onNavigate,
}: Readonly<{ pathname: string; onNavigate: () => void }>) {
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
        <span>Prototype</span>
        <p>Mock data only. External sending stays outside the product.</p>
      </div>
    </div>
  );
}
