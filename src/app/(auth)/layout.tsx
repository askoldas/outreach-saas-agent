import styles from "@/features/auth/AuthCard.module.css";

export const metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <main className={styles.shell}>{children}</main>;
}
