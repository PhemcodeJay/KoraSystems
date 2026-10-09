export const dynamic = "force-dynamic";
export const metadata = { title: "Create account" };

/** Whether the demo shared-password path is active (hint shown on the form). */
const DEMO_MODE = Boolean(process.env.KORA_DEMO_PASSWORD);

import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  return <RegisterForm demoMode={DEMO_MODE} />;
}
