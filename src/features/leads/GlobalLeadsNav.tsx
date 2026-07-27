import Link from "next/link";
import styles from "@/features/shared/Feature.module.css";

export function GlobalLeadsNav({
  active,
}: Readonly<{ active: "contacts" | "companies" }>) {
  return (
    <nav className={styles.subnav} aria-label="Global leads views">
      <Link
        href="/leads/contacts"
        aria-current={active === "contacts" ? "page" : undefined}
      >
        Contacts
      </Link>
      <Link
        href="/leads/companies"
        aria-current={active === "companies" ? "page" : undefined}
      >
        Companies
      </Link>
    </nav>
  );
}
