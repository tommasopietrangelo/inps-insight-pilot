import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Check, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  PLAN_CATALOG,
  getMySubscription,
  requestPlanChange,
  type PlanId,
} from "@/lib/billing.functions";

const STATUS_LABEL: Record<string, string> = {
  trialing: "Trial",
  active: "Attivo",
  past_due: "Pagamento sospeso",
  canceled: "Cancellato",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function BillingCard() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const wsId = current?.id;
  const canManage = current?.role === "owner" || current?.role === "admin";

  const getSubFn = useServerFn(getMySubscription);
  const changeFn = useServerFn(requestPlanChange);

  const subQ = useQuery({
    queryKey: ["subscription", wsId],
    queryFn: () => getSubFn({ data: { workspaceId: wsId! } }),
    enabled: !!wsId,
  });

  const [pendingPlan, setPendingPlan] = useState<PlanId | null>(null);
  const changeM = useMutation({
    mutationFn: (plan: PlanId) => changeFn({ data: { workspaceId: wsId!, plan } }),
    onMutate: (p) => setPendingPlan(p),
    onSuccess: (res) => {
      toast.success(`Piano aggiornato · ${res.note ?? ""}`);
      qc.invalidateQueries({ queryKey: ["subscription", wsId] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setPendingPlan(null),
  });

  const sub = subQ.data;
  const currentEntry = useMemo(
    () => (sub ? PLAN_CATALOG.find((p) => p.id === sub.plan) : null),
    [sub],
  );

  return (
    <Card className="p-6 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-display text-base font-semibold">Piano e fatturazione</div>
          <p className="text-sm text-muted-foreground">
            Ogni utente accede con le proprie credenziali. Piano, quote e posti sono a livello di
            workspace.
          </p>
        </div>
        {sub && (
          <div className="flex gap-2">
            <Badge className="bg-primary text-primary-foreground">
              {currentEntry?.name ?? sub.plan}
            </Badge>
            <Badge variant="outline">{STATUS_LABEL[sub.status] ?? sub.status}</Badge>
          </div>
        )}
      </div>

      <Separator className="my-4" />

      {subQ.isLoading || !sub ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <QuotaStat
              label="Posti utente"
              used={sub.usage.seats_used}
              limit={sub.seats_limit}
            />
            <QuotaStat
              label="Query AI (mese)"
              used={sub.usage.queries}
              limit={sub.queries_limit_monthly}
            />
            <QuotaStat
              label="Fonti aggiunte (mese)"
              used={sub.usage.sources}
              limit={sub.sources_limit_monthly}
            />
          </div>
          <div className="mt-4 text-xs text-muted-foreground">
            {sub.status === "trialing" && sub.trial_ends_at && (
              <>Trial in corso · scade il {fmtDate(sub.trial_ends_at)} · </>
            )}
            Ciclo corrente fino al {fmtDate(sub.current_period_end)}
          </div>

          <Separator className="my-6" />

          <div className="mb-3 text-sm font-medium">Cambia piano</div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {PLAN_CATALOG.map((p) => {
              const isCurrent = p.id === sub.plan;
              return (
                <div
                  key={p.id}
                  className={`flex flex-col rounded-md border bg-surface p-4 ${
                    p.highlight ? "border-primary/50 shadow-sm" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-display text-sm font-semibold">{p.name}</div>
                    {p.highlight && (
                      <Sparkles className="h-4 w-4 text-primary" aria-hidden />
                    )}
                  </div>
                  <div className="mt-1 text-xl font-semibold">
                    {p.priceEur === null
                      ? "Su misura"
                      : p.priceEur === 0
                        ? "€0"
                        : `€${p.priceEur}`}
                    {p.priceEur && p.priceEur > 0 ? (
                      <span className="text-xs font-normal text-muted-foreground"> /mese</span>
                    ) : null}
                  </div>
                  <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4">
                    {isCurrent ? (
                      <Button variant="outline" size="sm" disabled className="w-full">
                        Piano attuale
                      </Button>
                    ) : p.id === "enterprise" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() =>
                          window.open("mailto:sales@example.com?subject=Piano Enterprise", "_blank")
                        }
                      >
                        Contattaci
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full"
                        disabled={!canManage || changeM.isPending}
                        onClick={() => changeM.mutate(p.id)}
                      >
                        {pendingPlan === p.id ? (
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        Passa a {p.name}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {!canManage && (
            <p className="mt-3 text-xs text-muted-foreground">
              Solo proprietario o admin possono cambiare il piano.
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Integrazione pagamento (Stripe) non ancora attiva: gli aggiornamenti applicano subito
            le nuove quote per test interni.
          </p>
        </>
      )}
    </Card>
  );
}

function QuotaStat({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const near = pct >= 80;
  return (
    <div className="rounded-md border bg-surface p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-lg font-semibold">
        {used.toLocaleString("it-IT")}{" "}
        <span className="text-sm font-normal text-muted-foreground">
          / {limit.toLocaleString("it-IT")}
        </span>
      </div>
      <Progress value={pct} className={`mt-2 h-1.5 ${near ? "[&>div]:bg-destructive" : ""}`} />
    </div>
  );
}
