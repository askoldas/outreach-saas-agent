import { MarketingShell } from "@/features/marketing/MarketingShell";
import { getCurrentUser } from "@/server/auth/user";

export default async function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <MarketingShell authenticated={Boolean(await getCurrentUser())}>
      {children}
    </MarketingShell>
  );
}
