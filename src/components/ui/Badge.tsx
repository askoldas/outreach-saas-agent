import styles from "./Badge.module.css";

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "accent" | "blue";

export function Badge({
  children,
  tone = "neutral",
}: Readonly<{ children: React.ReactNode; tone?: BadgeTone }>) {
  return <span className={[styles.badge, styles[tone]].join(" ")}>{children}</span>;
}
