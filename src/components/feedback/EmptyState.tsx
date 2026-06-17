import { ButtonLink } from "@/components/ui/Button";
import type { LinkProps } from "next/link";
import styles from "./EmptyState.module.css";

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: Readonly<{
  title: string;
  description: string;
  actionHref?: LinkProps<string>["href"];
  actionLabel?: string;
}>) {
  return (
    <div className={styles.empty}>
      <div aria-hidden="true" className={styles.mark}>
        O
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      {actionHref && actionLabel ? (
        <ButtonLink href={actionHref} variant="primary">
          {actionLabel}
        </ButtonLink>
      ) : null}
    </div>
  );
}
