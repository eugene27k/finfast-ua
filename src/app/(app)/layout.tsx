import Sidebar from "@/components/Sidebar";
import { ToastProvider } from "@/components/Toast";
import DataProvider from "@/components/DataProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
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
