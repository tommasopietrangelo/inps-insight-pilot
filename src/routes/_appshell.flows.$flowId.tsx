import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_appshell/flows/$flowId")({
  component: () => <Outlet />,
});
