import SignUpPage from "@/app/(auth)/signup/page";
import { AuthModal } from "@/features/auth/AuthModal";

export default async function SignUpModal(props: Parameters<typeof SignUpPage>[0]) {
  return <AuthModal>{await SignUpPage(props)}</AuthModal>;
}
