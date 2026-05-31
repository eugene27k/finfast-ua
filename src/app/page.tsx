import { redirect } from "next/navigation";
import { needsSetup } from "@/lib/auth/bootstrap";
import { serverUserId } from "@/lib/auth/session";

export default async function Home() {
  if (needsSetup()) redirect("/setup");
  const userId = await serverUserId();
  redirect(userId ? "/dashboard" : "/login");
}
