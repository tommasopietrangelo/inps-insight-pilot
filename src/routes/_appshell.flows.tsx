import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecurringFlowsSection } from "@/components/recurring-flows-section";

export const Route = createFileRoute("/_appshell/flows")({
  head: () => ({ meta: [{ title: "Flussi operativi · INPS Copilot" }] }),
  component: FlowsPage,
});

function FlowsPage() {
  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/dashboard">
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Cruscotto
        </Link>
      </Button>
      <RecurringFlowsSection />
    </div>
  );
}
