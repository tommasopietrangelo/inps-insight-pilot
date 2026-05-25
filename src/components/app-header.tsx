import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, Search, ChevronDown } from "lucide-react";
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

export function AppHeader() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-surface/90 px-4 backdrop-blur">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-6" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 text-sm font-medium">
            Studio Rossi · CAF
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuLabel>Cambia workspace</DropdownMenuLabel>
          <DropdownMenuItem>Studio Rossi · CAF</DropdownMenuItem>
          <DropdownMenuItem>Patronato Lombardia</DropdownMenuItem>
          <DropdownMenuItem>Consulenza Verdi & Partners</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>+ Nuovo workspace</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ to: "/search", search: { q } as never });
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
        <Button variant="ghost" size="icon" asChild className="relative">
          <Link to="/alerts">
            <Bell className="h-4 w-4" />
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              7
            </span>
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 pr-2 pl-1">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary text-[11px] text-primary-foreground">
                  GR
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-left text-xs leading-tight md:block">
                <div className="font-medium text-foreground">Giulia Rossi</div>
                <div className="text-muted-foreground">Admin</div>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              Giulia Rossi
              <div className="mt-1">
                <Badge variant="secondary" className="text-[10px]">Admin</Badge>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings">Impostazioni</Link>
            </DropdownMenuItem>
            <DropdownMenuItem>Fatturazione</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Esci</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
