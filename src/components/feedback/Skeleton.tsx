import styles from "./Skeleton.module.css";

export function Skeleton({ rows = 3 }: Readonly<{ rows?: number }>) {
  return (
    <div className={styles.stack} aria-label="Loading placeholder">
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} className={styles.line} />
      ))}
    </div>
  );
}
