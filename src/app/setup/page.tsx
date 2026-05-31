import { redirect } from "next/navigation";
import { needsSetup } from "@/lib/auth/bootstrap";
import SetupForm from "./SetupForm";

export default function SetupPage() {
  // Once an account exists, setup is closed — go to login.
  if (!needsSetup()) redirect("/login");
  return <SetupForm />;
}
