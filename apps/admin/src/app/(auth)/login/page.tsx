import { Suspense } from "react";
import { listDemoAccounts } from "@kora/auth/authenticate";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const accounts = await listDemoAccounts();
  return (
    <Suspense>
      <LoginForm accounts={accounts} />
    </Suspense>
  );
}
