import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Search,
  FileText,
  Bell,
  Briefcase,
  Settings,
  ShieldCheck,
  FileSearch,
  ClipboardCheck,
  Brain,
  Sparkles,
  Workflow,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

const nav = [
  { title: "Cruscotto", url: "/dashboard", icon: LayoutDashboard },
  { title: "Ricerca", url: "/search", icon: Search },
  { title: "Flussi operativi", url: "/flows", icon: Workflow },
  { title: "Analizza documento", url: "/analyze", icon: FileSearch },
  { title: "Checklist pratica", url: "/checklist", icon: ClipboardCheck },
  { title: "Fonti", url: "/sources", icon: FileText },
  { title: "Avvisi", url: "/alerts", icon: Bell },
  { title: "Spazio di lavoro", url: "/workspace", icon: Briefcase },
  { title: "Memoria AI", url: "/memory", icon: Brain, badge: "PRO" },
];

const settings = [{ title: "Impostazioni", url: "/settings", icon: Settings }];


export function AppSidebar() {
  const { state } = useSidebar();
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (p: string) =>
    p === "/dashboard" ? currentPath === p : currentPath.startsWith(p);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/dashboard" className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-display text-sm font-semibold">INPS Copilot</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Studio Rossi · CAF
            </span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operazioni</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.title}</span>
                      {item.badge && state !== "collapsed" && (
                        <Badge className="ml-auto gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-[10px] text-white hover:from-amber-500 hover:to-orange-500">
                          <Sparkles className="h-3 w-3" /> PRO
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settings.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="rounded-md border bg-surface p-3 text-xs text-muted-foreground">
          <div className="font-medium text-foreground">Piano Studio</div>
          <div className="mt-0.5">8 utenti · 5.420 query / mese</div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
