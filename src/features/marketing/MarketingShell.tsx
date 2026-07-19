import Link from "next/link";
import styles from "./Marketing.module.css";

const productLinks = [
  ["Product overview", "/product"],
  ["Lead discovery", "/features/b2b-lead-discovery"],
  ["Research and qualification", "/features/lead-research-and-qualification"],
  ["Contact enrichment", "/features/contact-enrichment"],
  ["Outbound automation", "/features/outbound-automation"],
] as const;

export function MarketingShell({
  children,
  authenticated,
}: Readonly<{ children: React.ReactNode; authenticated: boolean }>) {
  return (
    <div className={styles.site}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/">
          Opptium
        </Link>
        <nav className={styles.nav} aria-label="Public navigation">
          <details className={styles.dropdown}>
            <summary>Product</summary>
            <div className={styles.menu}>
              {productLinks.map(([label, href]) => (
                <Link key={href} href={href}>
                  {label}
                </Link>
              ))}
            </div>
          </details>
          <Link href="/use-cases">Use cases</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/resources">Resources</Link>
        </nav>
        <div className={styles.actions}>
          {authenticated ? (
            <Link className={styles.secondaryButton} href="/dashboard">
              Open dashboard
            </Link>
          ) : (
            <Link className={styles.secondaryButton} href="/login">
              Log in
            </Link>
          )}
          <Link
            className={styles.primaryButton}
            href={authenticated ? "/dashboard" : "/signup"}
          >
            {authenticated ? "Go to app" : "Start for free"}
          </Link>
        </div>
      </header>
      <main>{children}</main>
      <footer className={styles.footer}>
        <div>
          <Link className={styles.brand} href="/">
            Opptium
          </Link>
          <p>Evidence-backed B2B prospecting and outbound preparation.</p>
        </div>
        <div>
          <strong>Product</strong>
          {productLinks.slice(0, 4).map(([label, href]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </div>
        <div>
          <strong>Company</strong>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/security">Security</Link>
        </div>
        <div>
          <strong>Legal</strong>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>
      </footer>
    </div>
  );
}
