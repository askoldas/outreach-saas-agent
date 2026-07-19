import Link from "next/link";
import type { Campaign } from "@/types/domain";
import { Badge } from "@/components/ui/Badge";
import styles from "./CampaignShell.module.css";

export function CampaignShell({
  campaign,
  active,
  children,
}: Readonly<{
  campaign: Campaign;
  active: "overview" | "strategy" | "leads" | "outreach";
  children: React.ReactNode;
}>) {
  const base = `/campaigns/${campaign.id}`;
  const tabs = [
    { key: "overview", label: "Overview", href: base },
    { key: "strategy", label: "Strategy", href: `${base}/strategy` },
    { key: "leads", label: "Leads", href: `${base}/leads` },
    { key: "outreach", label: "Outreach", href: `${base}/outreach` },
  ] as const;
  return (
    <div className={styles.workspace}>
      <header className={styles.header}>
        <div>
          <p>Campaign workspace</p>
          <h2>{campaign.name}</h2>
          <span>
            {campaign.objective} · {campaign.geography} · Updated {campaign.lastActivity}
          </span>
        </div>
        <Badge
          tone={
            campaign.status === "completed"
              ? "success"
              : campaign.status === "running"
                ? "blue"
                : "warning"
          }
        >
          {campaign.status}
        </Badge>
      </header>
      <nav className={styles.tabs} aria-label="Campaign navigation">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active === tab.key ? "page" : undefined}
            className={active === tab.key ? styles.active : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
