import styles from "./Card.module.css";

export function Card({
  children,
  className,
}: Readonly<{ children: React.ReactNode; className?: string }>) {
  return (
    <section className={[styles.card, className].filter(Boolean).join(" ")}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  eyebrow,
  action,
}: Readonly<{ title: string; eyebrow?: string; action?: React.ReactNode }>) {
  return (
    <div className={styles.header}>
      <div>
        {eyebrow ? <p>{eyebrow}</p> : null}
        <h2>{title}</h2>
      </div>
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
