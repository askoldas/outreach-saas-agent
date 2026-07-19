import Link from "next/link";
import styles from "@/features/marketing/Marketing.module.css";

export default function HomePage() {
  return (
    <section className={styles.hero}>
      <p className={styles.eyebrow}>
        AI-powered B2B prospecting and outbound preparation
      </p>
      <h1>Find and reach the B2B leads that actually fit your business.</h1>
      <p className={styles.heroText}>
        Describe the companies you want to find. Opptium builds a visible research
        strategy, discovers and qualifies companies using source-backed evidence, finds
        public contact routes, and prepares grounded outreach for review.
      </p>
      <div className={styles.heroActions}>
        <Link className={styles.primaryButton} href="/signup">
          Start for free
        </Link>
        <Link className={styles.secondaryButton} href="/product">
          See how it works
        </Link>
      </div>
      <div className={styles.workflow}>
        {[
          "Company Profile",
          "Campaign",
          "Research",
          "Qualified leads",
          "Contacts",
          "Reviewed drafts",
          "CSV export",
        ].map((item, index) => (
          <span key={item}>{index ? `→ ${item}` : item}</span>
        ))}
      </div>
    </section>
  );
}
