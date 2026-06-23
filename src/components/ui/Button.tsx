import Link from "next/link";
import type { LinkProps } from "next/link";
import styles from "./Button.module.css";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

type ButtonLinkProps = {
  href: LinkProps<string>["href"];
  children: React.ReactNode;
  variant?: ButtonVariant;
  className?: string;
};

export function Button({
  variant = "secondary",
  className,
  type = "button",
  ...props
}: Readonly<ButtonProps>) {
  return (
    <button
      className={[styles.button, styles[variant], className].filter(Boolean).join(" ")}
      {...props}
      type={type}
    />
  );
}

export function ButtonLink({
  href,
  children,
  variant = "secondary",
  className,
}: Readonly<ButtonLinkProps>) {
  return (
    <Link
      className={[styles.button, styles[variant], className].filter(Boolean).join(" ")}
      href={href}
    >
      {children}
    </Link>
  );
}
