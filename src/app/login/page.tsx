import { redirect } from "next/navigation";
import { needsSetup } from "@/lib/auth/bootstrap";
import { serverUserId } from "@/lib/auth/session";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  if (needsSetup()) redirect("/setup");
  if (await serverUserId()) redirect("/dashboard");
  return <LoginForm />;
}
