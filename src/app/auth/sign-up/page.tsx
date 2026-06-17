import Link from "next/link";
import { redirect } from "next/navigation";
import { signUpAction } from "@/server/auth/actions";
import { getCurrentUser } from "@/server/auth/user";
import form from "@/components/ui/FormControls.module.css";
import { Button } from "@/components/ui/Button";
import styles from "@/features/auth/AuthCard.module.css";

type SearchParams = {
  error?: string;
};

export default async function SignUpPage({
  searchParams,
}: Readonly<{ searchParams: Promise<SearchParams> }>) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  const params = await searchParams;

  return (
    <section className={styles.card} aria-labelledby="sign-up-title">
      <div className={styles.header}>
        <span className={styles.wordmark}>OSA</span>
        <h1 id="sign-up-title">Create account</h1>
        <p>Email and password authentication is the first supported sign-in method.</p>
      </div>
      <form className={styles.body} action={signUpAction}>
        {params.error ? <div className={styles.error}>{params.error}</div> : null}
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
            autoComplete="new-password"
            className={form.input}
            id="password"
            minLength={6}
            name="password"
            required
            type="password"
          />
        </label>
        <label className={form.field} htmlFor="confirmPassword">
          <span>Confirm password</span>
          <input
            autoComplete="new-password"
            className={form.input}
            id="confirmPassword"
            minLength={6}
            name="confirmPassword"
            required
            type="password"
          />
        </label>
        <Button type="submit" variant="primary">
          Create account
        </Button>
        <p className={styles.footerText}>
          Already have an account? <Link href="/auth/sign-in">Sign in</Link>
        </p>
      </form>
    </section>
  );
}
