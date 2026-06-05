"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";
import { createSenderAccount, fetchSenders, updateSenderAccount, deleteSenderAccount } from "@/app/actions/admin-actions";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mailbox, Plus, Edit, Trash2, CheckCircle2, AlertCircle } from "lucide-react";

type Sender = Tables<"sender_accounts">;

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Never";
}

function healthVariant(score: number | null) {
  if (score === null) return "outline";
  if (score >= 80) return "default";
  if (score >= 50) return "secondary";
  return "destructive";
}

export default function Senders({
  initialSenders,
}: {
  initialSenders: Sender[];
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [senders, setSenders] = useState<Sender[]>(initialSenders);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editingSender, setEditingSender] = useState<Sender | null>(null);

  const [createForm, setCreateForm] = useState({
    email: "",
    displayName: "",
    smtpHost: "smtp.gmail.com",
    smtpPort: "587",
    smtpUserEmail: "",
    smtpPassword: "",
    smtpSecure: false,
  });

  const [editForm, setEditForm] = useState({
    email: "",
    displayName: "",
    smtpHost: "",
    smtpPort: "587",
    smtpUserEmail: "",
    smtpPassword: "", // empty means no change
    smtpSecure: false,
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [senderToDelete, setSenderToDelete] = useState<Sender | null>(null);

  const loadSenders = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSenders<Sender>(user.id);
      setSenders(data ?? []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load sender accounts");
    }
    setLoading(false);
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await createSenderAccount<Sender>(user.id, {
        email: createForm.email,
        displayName: createForm.displayName,
        smtpHost: createForm.smtpHost,
        smtpPort: Number(createForm.smtpPort),
        smtpUserEmail: createForm.smtpUserEmail || createForm.email,
        smtpPassword: createForm.smtpPassword,
        smtpSecure: createForm.smtpSecure,
      });
      setCreateForm({ email: "", displayName: "", smtpHost: "smtp.gmail.com", smtpPort: "587", smtpUserEmail: "", smtpPassword: "", smtpSecure: false });
      setView("list");
      toast({ title: "Sender account added" });
      await loadSenders();
    } catch (requestError) {
      toast({
        title: "Sender failed",
        description: requestError instanceof Error ? requestError.message : "Unable to add sender account",
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  const handleStartEdit = (sender: Sender) => {
    setEditingSender(sender);
    setEditForm({
      email: sender.email,
      displayName: sender.display_name || "",
      smtpHost: sender.smtp_host || "",
      smtpPort: sender.smtp_port?.toString() || "587",
      smtpUserEmail: sender.smtp_user_email || sender.email,
      smtpPassword: "", // Leave blank to not update password
      smtpSecure: sender.smtp_secure || false,
    });
    setView("edit");
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !editingSender) return;
    setSaving(true);
    try {
      await updateSenderAccount<Sender>(user.id, editingSender.id, {
        email: editForm.email,
        displayName: editForm.displayName,
        smtpHost: editForm.smtpHost,
        smtpPort: Number(editForm.smtpPort),
        smtpSecure: editForm.smtpSecure,
        smtpUserEmail: editForm.smtpUserEmail || editForm.email,
        smtpPassword: editForm.smtpPassword || undefined,
      });
      setView("list");
      setEditingSender(null);
      toast({ title: "Sender updated" });
      await loadSenders();
    } catch (requestError) {
      toast({
        title: "Update failed",
        description: requestError instanceof Error ? requestError.message : "Unable to update sender",
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  const handleDeleteConfirm = async () => {
    if (!user || !senderToDelete) return;
    setSaving(true);
    try {
      await deleteSenderAccount(user.id, senderToDelete.id);
      toast({ title: "Sender account deleted" });
      setSenderToDelete(null);
      setDeleteDialogOpen(false);
      setView("list");
      await loadSenders();
    } catch (requestError) {
      toast({
        title: "Deletion failed",
        description: requestError instanceof Error ? requestError.message : "Sender may be in use.",
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  const activeCount = senders.filter((sender) => sender.status?.toLowerCase() === "active").length;
  const reviewCount = Math.max(senders.length - activeCount, 0);

  const renderFormFields = (
    form: typeof createForm,
    setForm: React.Dispatch<React.SetStateAction<any>>,
    isEdit: boolean = false
  ) => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <div className="space-y-1.5">
        <Label className="text-[12px] font-medium text-muted-foreground">Email Address</Label>
        <Input required type="email" className="h-9 text-[13px]" value={form.email} onChange={(e) => setForm((v: any) => ({ ...v, email: e.target.value }))} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[12px] font-medium text-muted-foreground">Display Name</Label>
        <Input className="h-9 text-[13px]" value={form.displayName} onChange={(e) => setForm((v: any) => ({ ...v, displayName: e.target.value }))} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[12px] font-medium text-muted-foreground">SMTP Host</Label>
        <Input required className="h-9 text-[13px]" value={form.smtpHost} onChange={(e) => setForm((v: any) => ({ ...v, smtpHost: e.target.value }))} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[12px] font-medium text-muted-foreground">SMTP Port</Label>
        <Input required type="number" min={1} className="h-9 text-[13px]" value={form.smtpPort} onChange={(e) => setForm((v: any) => ({ ...v, smtpPort: e.target.value }))} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[12px] font-medium text-muted-foreground">SMTP User Email</Label>
        <Input type="email" className="h-9 text-[13px]" value={form.smtpUserEmail} onChange={(e) => setForm((v: any) => ({ ...v, smtpUserEmail: e.target.value }))} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[12px] font-medium text-muted-foreground">
          SMTP Password {isEdit && <span className="font-normal opacity-70">(leave blank to keep current)</span>}
        </Label>
        <Input required={!isEdit} type="password" placeholder={isEdit ? "********" : ""} className="h-9 text-[13px]" value={form.smtpPassword} onChange={(e) => setForm((v: any) => ({ ...v, smtpPassword: e.target.value }))} />
      </div>
      <div className="md:col-span-2 lg:col-span-3 flex items-center pt-2">
        <label className="flex items-center gap-2 text-[13px] font-medium cursor-pointer">
          <Checkbox checked={form.smtpSecure} onCheckedChange={(c) => setForm((v: any) => ({ ...v, smtpSecure: c === true }))} />
          Use Secure SMTP (SSL/TLS)
        </label>
      </div>
    </div>
  );

  return (
    <AppLayout>
      <div className="max-w-[100rem] mx-auto p-6 md:p-8 space-y-6">

        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              {view === "list" ? (
                <BreadcrumbPage className="text-[13px] font-medium text-foreground">Sender accounts</BreadcrumbPage>
              ) : (
                <BreadcrumbLink className="text-[13px] font-medium cursor-pointer" onClick={() => setView("list")}>
                  Sender accounts
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {view === "create" && (
              <><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage className="text-[13px] font-medium text-foreground">New sender</BreadcrumbPage></BreadcrumbItem></>
            )}
            {view === "edit" && (
              <><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage className="text-[13px] font-medium text-foreground max-w-[200px] truncate">{editingSender ? `Edit · ${editingSender.email}` : "Edit sender"}</BreadcrumbPage></BreadcrumbItem></>
            )}
          </BreadcrumbList>
        </Breadcrumb>

        {view === "list" && (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Sender accounts</h1>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  SMTP mailboxes with warmup tracking and health scoring.
                </p>
              </div>
              <Button onClick={() => setView("create")} className="h-9 gap-2 text-[13px]">
                <Plus className="h-3.5 w-3.5" /> Add sender
              </Button>
            </div>

            <div className="flex items-center gap-3 text-[13px] text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5">
                <Mailbox className="h-3.5 w-3.5" />
                <span className="font-semibold text-foreground">{senders.length}</span> sender{senders.length !== 1 ? "s" : ""}
              </span>
              {activeCount > 0 && (
                <>
                  <span className="text-border">·</span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span className="font-semibold text-foreground">{activeCount}</span> active
                  </span>
                </>
              )}
              {reviewCount > 0 && (
                <>
                  <span className="text-border">·</span>
                  <span className="flex items-center gap-1.5 text-amber-600">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span className="font-semibold">{reviewCount}</span> needs review
                  </span>
                </>
              )}
            </div>

            <section className="rounded-md border border-border bg-card overflow-hidden shadow-sm">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary/30">
                <Mailbox className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-[14px] font-semibold">Mailbox inventory</h2>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading sender accounts...
                </div>
              ) : error ? (
                <div className="px-4 py-12 text-center text-sm text-destructive">{error}</div>
              ) : senders.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Display name</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Health score</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last sent</TableHead>
                      <TableHead className="text-right w-[90px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {senders.map((sender) => (
                      <TableRow key={sender.id}>
                        <TableCell className="font-medium">{sender.email}</TableCell>
                        <TableCell>{sender.display_name || "-"}</TableCell>
                        <TableCell className="capitalize">{sender.provider || "smtp"}</TableCell>
                        <TableCell>
                          <Badge variant={healthVariant(sender.health_score)}>
                            {sender.health_score === null ? "-" : `${sender.health_score}%`}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={sender.status?.toLowerCase() === "active" ? "default" : "outline"} className="capitalize">
                            {sender.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(sender.last_sent_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleStartEdit(sender)} className="h-8 w-8 hover:bg-secondary" title="Edit">
                              <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => { setSenderToDelete(sender); setDeleteDialogOpen(true); }} className="h-8 w-8 hover:bg-destructive/10" title="Delete">
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="px-4 py-16 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-secondary/40">
                    <Mailbox className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-[13px] text-muted-foreground">No sender accounts yet. Add one SMTP mailbox to start sending safely.</p>
                </div>
              )}
            </section>
          </>
        )}

        {view === "create" && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">New sender account</h1>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Add SMTP credentials and initialize warmup tracking.
              </p>
            </div>
            <form onSubmit={handleCreate} className="grid gap-5 rounded-md border border-border bg-card p-6 shadow-sm">
              {renderFormFields(createForm, setCreateForm, false)}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <Button type="button" variant="ghost" onClick={() => setView("list")} className="h-9 text-[13px]">Cancel</Button>
                <Button type="submit" disabled={saving} className="h-9 text-[13px] gap-2">
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Add sender
                </Button>
              </div>
            </form>
          </div>
        )}

        {view === "edit" && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Edit sender account</h1>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Update SMTP credentials or delete the mailbox.
              </p>
            </div>
            <form onSubmit={handleUpdate} className="grid gap-5 rounded-md border border-border bg-card p-6 shadow-sm">
              {renderFormFields(editForm, setEditForm, true)}
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <Button type="button" variant="destructive" onClick={() => { if (editingSender) { setSenderToDelete(editingSender); setDeleteDialogOpen(true); } }} className="h-9 text-[13px] gap-2">
                  <Trash2 className="h-3.5 w-3.5" /> Delete sender
                </Button>
                <div className="flex items-center gap-3">
                  <Button type="button" variant="ghost" onClick={() => setView("list")} className="h-9 text-[13px]">Cancel</Button>
                  <Button type="submit" disabled={saving} className="h-9 text-[13px] gap-2">
                    {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Save changes
                  </Button>
                </div>
              </div>
            </form>
          </div>
        )}

      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete sender account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;<span className="font-semibold text-foreground">{senderToDelete?.email}</span>&quot;. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void handleDeleteConfirm(); }}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Delete account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
