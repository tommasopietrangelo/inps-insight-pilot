import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, UserPlus, Trash2, Mail, Copy, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useWorkspace } from "@/hooks/use-workspace";
import { useAuth } from "@/hooks/use-auth";
import { listMembers, updateMemberRole, removeMember } from "@/lib/members.functions";
import {
  listWorkspaceInvitations,
  createInvitation,
  revokeInvitation,
} from "@/lib/invitations.functions";

const ROLE_LABEL: Record<string, string> = {
  owner: "Proprietario",
  admin: "Admin",
  member: "Operatore",
};

export function TeamCard() {
  const { current } = useWorkspace();
  const { user } = useAuth();
  const qc = useQueryClient();
  const wsId = current?.id;
  const myRole = current?.role;
  const canManage = myRole === "owner" || myRole === "admin";

  const listMembersFn = useServerFn(listMembers);
  const listInvFn = useServerFn(listWorkspaceInvitations);
  const updateRoleFn = useServerFn(updateMemberRole);
  const removeFn = useServerFn(removeMember);
  const createInvFn = useServerFn(createInvitation);
  const revokeInvFn = useServerFn(revokeInvitation);

  const membersQ = useQuery({
    queryKey: ["members", wsId],
    queryFn: () => listMembersFn({ data: { workspaceId: wsId! } }),
    enabled: !!wsId,
  });
  const invQ = useQuery({
    queryKey: ["invitations", wsId],
    queryFn: () => listInvFn({ data: { workspaceId: wsId! } }),
    enabled: !!wsId,
  });

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [copied, setCopied] = useState<string | null>(null);

  const inviteM = useMutation({
    mutationFn: () => createInvFn({ data: { workspaceId: wsId!, email, role } }),
    onSuccess: () => {
      toast.success(`Invito inviato a ${email}`);
      setEmail("");
      qc.invalidateQueries({ queryKey: ["invitations", wsId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleM = useMutation({
    mutationFn: (p: { userId: string; role: "owner" | "admin" | "member" }) =>
      updateRoleFn({ data: { workspaceId: wsId!, userId: p.userId, role: p.role } }),
    onSuccess: () => {
      toast.success("Ruolo aggiornato");
      qc.invalidateQueries({ queryKey: ["members", wsId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeM = useMutation({
    mutationFn: (userId: string) =>
      removeFn({ data: { workspaceId: wsId!, userId } }),
    onSuccess: () => {
      toast.success("Membro rimosso");
      qc.invalidateQueries({ queryKey: ["members", wsId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeM = useMutation({
    mutationFn: (id: string) => revokeInvFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Invito revocato");
      qc.invalidateQueries({ queryKey: ["invitations", wsId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/accept-invite?token=${token}`;
    await navigator.clipboard.writeText(url);
    setCopied(token);
    toast.success("Link copiato");
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <Card className="p-6 lg:col-span-2">
      <div className="mb-1 font-display text-base font-semibold">Team e ruoli</div>
      <p className="text-sm text-muted-foreground">
        Proprietario e admin gestiscono membri e inviti · Operatore può creare ricerche, note e
        avvisi.
      </p>

      {canManage && (
        <>
          <Separator className="my-4" />
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <UserPlus className="h-4 w-4 text-primary" /> Invita un collega
          </div>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim()) inviteM.mutate();
            }}
          >
            <div className="flex-1">
              <Label htmlFor="inv-email" className="sr-only">
                Email
              </Label>
              <Input
                id="inv-email"
                type="email"
                placeholder="email@studio.it"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Select value={role} onValueChange={(v) => setRole(v as "admin" | "member")}>
              <SelectTrigger className="sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Operatore</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" size="sm" disabled={inviteM.isPending || !email.trim()}>
              {inviteM.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              Invita
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            L'invitato riceverà accesso dopo aver effettuato l'accesso e accettato l'invito.
            Puoi copiare il link e inviarglielo manualmente.
          </p>
        </>
      )}

      <Separator className="my-4" />
      <div className="mb-2 text-sm font-medium">Membri attivi</div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Ruolo</TableHead>
            <TableHead className="text-right">Azioni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {membersQ.isLoading && (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground">
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              </TableCell>
            </TableRow>
          )}
          {membersQ.data?.map((m) => {
            const prof = m.profile as { display_name?: string | null } | null;
            const isMe = user?.id === m.user_id;
            const canEdit = canManage && !isMe && m.role !== "owner";
            return (
              <TableRow key={m.id}>
                <TableCell className="font-medium">
                  {prof?.display_name ?? "—"}
                  {isMe && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      tu
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {canEdit ? (
                    <Select
                      value={m.role}
                      onValueChange={(v) =>
                        roleM.mutate({
                          userId: m.user_id,
                          role: v as "owner" | "admin" | "member",
                        })
                      }
                    >
                      <SelectTrigger className="h-8 w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Operatore</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline">{ROLE_LABEL[m.role] ?? m.role}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm("Rimuovere questo membro dal workspace?")) {
                          removeM.mutate(m.user_id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {canManage && (invQ.data?.some((i) => i.status === "pending") ?? false) && (
        <>
          <Separator className="my-4" />
          <div className="mb-2 text-sm font-medium">Inviti in attesa</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Ruolo</TableHead>
                <TableHead>Scadenza</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invQ.data
                ?.filter((i) => i.status === "pending")
                .map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{ROLE_LABEL[i.role] ?? i.role}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(i.expires_at).toLocaleDateString("it-IT")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyLink(i.token)}
                        title="Copia link invito"
                      >
                        {copied === i.token ? (
                          <Check className="h-4 w-4 text-primary" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => revokeM.mutate(i.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </>
      )}
    </Card>
  );
}
