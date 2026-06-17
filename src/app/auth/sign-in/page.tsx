import Link from "next/link";
import { redirect } from "next/navigation";
import { signInAction } from "@/server/auth/actions";
import { getCurrentUser } from "@/server/auth/user";
import form from "@/components/ui/FormControls.module.css";
import { Button } from "@/components/ui/Button";
import styles from "@/features/auth/AuthCard.module.css";

type SearchParams = {
  error?: string;
  message?: string;
  next?: string;
};

export default async function SignInPage({
  searchParams,
}: Readonly<{ searchParams: Promise<SearchParams> }>) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  const params = await searchParams;

  return (
    <section className={styles.card} aria-labelledby="sign-in-title">
      <div className={styles.header}>
        <span className={styles.wordmark}>OSA</span>
        <h1 id="sign-in-title">Sign in</h1>
        <p>Use your workspace account to review campaigns, leads, and drafts.</p>
      </div>
      <form className={styles.body} action={signInAction}>
        {params.error ? <div className={styles.error}>{params.error}</div> : null}
        {params.message ? <div className={styles.message}>{params.message}</div> : null}
        <input type="hidden" name="next" value={params.next ?? "/dashboard"} />
        <label className={form.field} htmlFor="email">
          <span>Email</span>
          <input
            autoComplete="email"
            className={form.input}
            id="email"
            name="email"
            required
            type="email"
          />
        </label>
        <label className={form.field} htmlFor="password">
          <span>Password</span>
          <input
            autoComplete="current-password"
            className={form.input}
            id="password"
            minLength={6}
            name="password"
            required
            type="password"
          />
        </label>
        <Button type="submit" variant="primary">
          Sign in
        </Button>
        <p className={styles.footerText}>
          Need an account? <Link href="/auth/sign-up">Create one</Link>
        </p>
      </form>
    </section>
  );
}
