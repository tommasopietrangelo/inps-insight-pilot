import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { FloatingCopilot } from "@/components/floating-copilot";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { listMyWorkspaces } from "@/lib/workspace.functions";

export const Route = createFileRoute("/_appshell")({
  component: AppShell,
});

function AppShell() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { setWorkspaces, current } = useWorkspace();
  const listFn = useServerFn(listMyWorkspaces);

  const workspacesQuery = useQuery({
    queryKey: ["my-workspaces", user?.id],
    queryFn: () => listFn({}),
    enabled: !!user,
  });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login", replace: true });
      return;
    }
    if (workspacesQuery.data) {
      setWorkspaces(workspacesQuery.data);
      if (workspacesQuery.data.length === 0) {
        navigate({ to: "/onboarding", replace: true });
      }
    }
  }, [loading, user, workspacesQuery.data, navigate, setWorkspaces]);

  if (loading || !user || workspacesQuery.isLoading || !current) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          <AppHeader />
          <main className="flex-1 px-6 py-6 lg:px-8">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
