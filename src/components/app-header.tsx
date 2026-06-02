import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, Search, ChevronDown, LogOut, Check } from "lucide-react";
import { useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";

function initials(name: string | undefined | null) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function AppHeader() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const { user, signOut } = useAuth();
  const { current, workspaces, setCurrent } = useWorkspace();

  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "Utente";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-surface/90 px-4 backdrop-blur">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-6" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 text-sm font-medium">
            {current?.name ?? "Workspace"}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuLabel>Cambia workspace</DropdownMenuLabel>
          {workspaces.map((w) => (
            <DropdownMenuItem key={w.id} onSelect={() => setCurrent(w.id)}>
              <span className="flex-1 truncate">{w.name}</span>
              {current?.id === w.id && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate({ to: "/onboarding" })}>
            + Nuovo workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const query = q.trim();
          if (query.length < 2) return;
          navigate({ to: "/search", search: { q: query } });
        }}
        className="ml-2 hidden flex-1 max-w-xl md:block"
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca circolari, messaggi, normativa…"
            className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none ring-ring focus:ring-2"
          />
        </div>
      </form>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/alerts">
            <Bell className="h-4 w-4" />
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 pr-2 pl-1">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary text-[11px] text-primary-foreground">
                  {initials(displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-left text-xs leading-tight md:block">
                <div className="font-medium text-foreground">{displayName}</div>
                <div className="text-muted-foreground capitalize">{current?.role ?? ""}</div>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="truncate">{displayName}</div>
              <div className="mt-1 truncate text-xs font-normal text-muted-foreground">
                {user?.email}
              </div>
              {current?.role && (
                <div className="mt-1">
                  <Badge variant="secondary" className="text-[10px] capitalize">{current.role}</Badge>
                </div>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings">Impostazioni</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={async () => {
                await signOut();
                navigate({ to: "/login", replace: true });
              }}
            >
              <LogOut className="mr-2 h-3.5 w-3.5" /> Esci
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
