import SignInPage from "@/app/(auth)/login/page";
import { AuthModal } from "@/features/auth/AuthModal";

export default async function SignInModal(props: Parameters<typeof SignInPage>[0]) {
  return <AuthModal>{await SignInPage(props)}</AuthModal>;
}
