import styles from "./PageHeader.module.css";

export function PageHeader({
  title,
  description,
  actions,
}: Readonly<{
  title: string;
  description: string;
  actions?: React.ReactNode;
}>) {
  return (
    <div className={styles.header}>
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  );
}
