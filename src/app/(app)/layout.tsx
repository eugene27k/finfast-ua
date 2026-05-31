import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { ToastProvider } from "@/components/Toast";
import DataProvider from "@/components/DataProvider";
import { needsSetup } from "@/lib/auth/bootstrap";
import { serverUserId } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Server-side gate: no account yet → setup; locked / no session → login.
  if (needsSetup()) redirect("/setup");
  const userId = await serverUserId();
  if (!userId) redirect("/login");

  return (
    <ToastProvider>
      <DataProvider>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 p-6 overflow-auto">{children}</main>
        </div>
      </DataProvider>
    </ToastProvider>
  );
}
