import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  listPractices,
  savePractice,
  deletePractice,
  type PracticeKind,
} from "@/lib/practices.functions";

interface Props {
  kind: PracticeKind;
  title: string;
  input: unknown;
  result: unknown;
  disabled?: boolean;
  onLoad?: (input: unknown, result: unknown) => void;
  /** When provided, also renders a list of previously saved practices for this kind. */
  showHistory?: boolean;
  historyEmptyLabel?: string;
}

export function SavePracticeButton({
  kind,
  title,
  input,
  result,
  disabled,
  onLoad,
  showHistory,
  historyEmptyLabel,
}: Props) {
  const { current: workspace } = useWorkspace();
  const wsId = workspace?.id ?? "";
  const qc = useQueryClient();
  const saveFn = useServerFn(savePractice);
  const listFn = useServerFn(listPractices);
  const delFn = useServerFn(deletePractice);

  const saved = useQuery({
    queryKey: ["practices", wsId, kind],
    queryFn: () => listFn({ data: { workspaceId: wsId, kind } }),
    enabled: !!wsId && !!showHistory,
  });

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          workspaceId: wsId,
          kind,
          title: title.slice(0, 300) || "Senza titolo",
          input,
          result,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["practices", wsId, kind] });
      toast.success("Salvato nel workspace");
    },
    onError: (e) => toast.error(`Errore: ${(e as Error).message}`),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["practices", wsId, kind] });
      toast.success("Eliminato");
    },
    onError: (e) => toast.error(`Errore: ${(e as Error).message}`),
  });

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => save.mutate()}
        disabled={disabled || save.isPending || !wsId}
        className="gap-1.5"
      >
        {save.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Save className="h-3.5 w-3.5" />
        )}
        Salva nel workspace
      </Button>

      {showHistory && (
        <SavedList
          rows={saved.data ?? []}
          loading={saved.isLoading}
          emptyLabel={historyEmptyLabel}
          onLoad={onLoad}
          onDelete={(id) => remove.mutate(id)}
        />
      )}
    </>
  );
}

function SavedList({
  rows,
  loading,
  emptyLabel,
  onLoad,
  onDelete,
}: {
  rows: { id: string; title: string; updated_at: string; input: unknown; result: unknown }[];
  loading: boolean;
  emptyLabel?: string;
  onLoad?: (input: unknown, result: unknown) => void;
  onDelete: (id: string) => void;
}) {
  if (loading) {
    return (
      <Card className="mt-4 p-3 text-xs text-muted-foreground">Carico salvati…</Card>
    );
  }
  if (rows.length === 0) {
    return (
      <Card className="mt-4 p-3 text-xs text-muted-foreground">
        {emptyLabel ?? "Nessun elemento salvato nel workspace."}
      </Card>
    );
  }
  return (
    <Card className="mt-4 p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Salvati nel workspace
      </div>
      <ul className="divide-y">
        {rows.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 py-2">
            <button
              type="button"
              className="min-w-0 flex-1 text-left hover:underline disabled:cursor-default disabled:no-underline"
              disabled={!onLoad}
              onClick={() => onLoad?.(s.input, s.result)}
            >
              <div className="truncate text-sm font-medium">{s.title}</div>
              <div className="truncate text-xs text-muted-foreground">
                {new Date(s.updated_at).toLocaleString("it-IT")}
              </div>
            </button>
            <Button size="icon" variant="ghost" onClick={() => onDelete(s.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
