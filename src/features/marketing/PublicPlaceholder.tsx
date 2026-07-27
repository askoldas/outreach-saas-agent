import Link from "next/link";
import styles from "./Marketing.module.css";

export function PublicPlaceholder({
  eyebrow,
  title,
  description,
  note = "Placeholder page — final copy and product proof will follow the public-site strategy.",
}: Readonly<{ eyebrow: string; title: string; description: string; note?: string }>) {
  return (
    <section className={styles.placeholder}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h1>{title}</h1>
      <p className={styles.placeholderText}>{description}</p>
      <p className={styles.notice}>{note}</p>
      <div className={styles.heroActions}>
        <Link className={styles.primaryButton} href="/signup">
          Start for free
        </Link>
        <Link className={styles.secondaryButton} href="/product">
          See the product
        </Link>
      </div>
    </section>
  );
}
