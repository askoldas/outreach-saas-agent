"use client";

import { useRouter } from "next/navigation";
import styles from "./AuthModal.module.css";

export function AuthModal({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  return (
    <div className={styles.layer} role="presentation" onMouseDown={() => router.back()}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className={styles.close}
          aria-label="Close authentication"
          onClick={() => router.back()}
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}
