export const dynamic = "force-dynamic";
export const metadata = { title: "Create account" };

import { demoLoginEnabled } from "@kora/auth/authenticate";
import { RegisterForm } from "./register-form";

/** Whether the demo shared-password path is active (hint shown on the form). */
const DEMO_MODE = demoLoginEnabled();

export default function RegisterPage() {
  return <RegisterForm demoMode={DEMO_MODE} />;
}
