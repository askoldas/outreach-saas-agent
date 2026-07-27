import Link from "next/link";
import type { Campaign } from "@/types/domain";
import { Badge } from "@/components/ui/Badge";
import { ContextualAiDrawer } from "@/features/guided/ContextualAiDrawer";
import styles from "./CampaignShell.module.css";

type CampaignSection =
  | "overview"
  | "market"
  | "discovery"
  | "companies"
  | "contacts"
  | "outreach";

export function CampaignShell({
  campaign,
  active,
  children,
}: Readonly<{
  campaign: Campaign;
  active: CampaignSection;
  children: React.ReactNode;
}>) {
  const base = `/campaigns/${campaign.id}`;
  const tabs = [
    { key: "overview", label: "Overview", href: base },
    { key: "market", label: "Market Analysis", href: `${base}/market-analysis` },
    { key: "discovery", label: "Discovery", href: `${base}/discovery` },
    { key: "companies", label: "Companies", href: `${base}/leads` },
    { key: "contacts", label: "Contacts", href: `${base}/outreach?view=contacts` },
    { key: "outreach", label: "Outreach", href: `${base}/outreach?view=drafts` },
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
          <Link href={`${base}/strategy`}>Campaign strategy</Link>
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
      <ContextualAiDrawer
        context={`Campaign — ${campaign.name}`}
        scope="campaign"
        entityId={campaign.id}
        baseVersion={campaign.strategyVersion ?? 0}
        actions={[
          "Narrow the target market",
          "Add an exclusion",
          "Change buyer personas",
          "Explain the discovery strategy",
        ]}
      />
      {children}
    </div>
  );
}
