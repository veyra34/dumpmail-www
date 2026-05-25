"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";
import { createSenderAccount, fetchSenders } from "@/app/actions/admin-actions";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mailbox, Plus } from "lucide-react";

type Sender = Tables<"sender_accounts">;

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Never";
}

function healthVariant(score: number | null) {
  if (score === null) {
    return "outline";
  }

  if (score >= 80) {
    return "default";
  }

  if (score >= 50) {
    return "secondary";
  }

  return "destructive";
}

export default function Senders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [senders, setSenders] = useState<Sender[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "",
    displayName: "",
    smtpHost: "smtp.gmail.com",
    smtpPort: "587",
    smtpUserEmail: "",
    smtpPassword: "",
    smtpSecure: false,
  });

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

  useEffect(() => {
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      if (!cancelled) void loadSenders();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;

    setSaving(true);
    try {
      await createSenderAccount<Sender>(user.id, {
        email: form.email,
        displayName: form.displayName,
        smtpHost: form.smtpHost,
        smtpPort: Number(form.smtpPort),
        smtpUserEmail: form.smtpUserEmail || form.email,
        smtpPassword: form.smtpPassword,
        smtpSecure: form.smtpSecure,
      });
      setForm({ email: "", displayName: "", smtpHost: "smtp.gmail.com", smtpPort: "587", smtpUserEmail: "", smtpPassword: "", smtpSecure: false });
      setFormOpen(false);
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

  const activeCount = senders.filter((sender) => sender.status.toLowerCase() === "active").length;

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-6">
        <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Sender accounts</h1>
            <p className="text-[13px] text-muted-foreground mt-1">SMTP mailboxes with warmup tracking and health scoring.</p>
          </div>
          <Button onClick={() => setFormOpen(true)} className="h-9 gap-2 text-[13px]">
            <Plus className="h-3.5 w-3.5" />
            Add sender
          </Button>
        </div>

        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add sender account</DialogTitle>
              <DialogDescription>Add SMTP credentials and initialize warmup tracking.</DialogDescription>
            </DialogHeader>
          <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-[12px]">Email</Label>
              <Input required type="email" className="h-9 text-[13px]" value={form.email} onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Display name</Label>
              <Input className="h-9 text-[13px]" value={form.displayName} onChange={(event) => setForm((value) => ({ ...value, displayName: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">SMTP user email</Label>
              <Input type="email" className="h-9 text-[13px]" value={form.smtpUserEmail} onChange={(event) => setForm((value) => ({ ...value, smtpUserEmail: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">SMTP host</Label>
              <Input required className="h-9 text-[13px]" value={form.smtpHost} onChange={(event) => setForm((value) => ({ ...value, smtpHost: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">SMTP port</Label>
              <Input required type="number" min={1} className="h-9 text-[13px]" value={form.smtpPort} onChange={(event) => setForm((value) => ({ ...value, smtpPort: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">SMTP password</Label>
              <Input required type="password" className="h-9 text-[13px]" value={form.smtpPassword} onChange={(event) => setForm((value) => ({ ...value, smtpPassword: event.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-[13px]">
              <Checkbox checked={form.smtpSecure} onCheckedChange={(checked) => setForm((value) => ({ ...value, smtpSecure: checked === true }))} />
              Secure SMTP
            </label>
            <div className="flex items-end md:col-span-2">
              <Button type="submit" disabled={saving} className="h-9 text-[13px]">
                {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Add sender
              </Button>
            </div>
          </form>
          </DialogContent>
        </Dialog>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-border bg-card p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Senders</div>
            <div className="mt-2 text-2xl font-bold tracking-tight">{senders.length}</div>
          </div>
          <div className="rounded-md border border-border bg-card p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Active</div>
            <div className="mt-2 text-2xl font-bold tracking-tight">{activeCount}</div>
          </div>
          <div className="rounded-md border border-border bg-card p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Needs review</div>
            <div className="mt-2 text-2xl font-bold tracking-tight">{Math.max(senders.length - activeCount, 0)}</div>
          </div>
        </div>

        <section className="rounded-md border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary/30">
            <Mailbox className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[14px] font-semibold">Mailbox inventory</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading sender accounts...
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {senders.map((sender) => (
                  <TableRow key={sender.id}>
                    <TableCell className="font-medium">{sender.email}</TableCell>
                    <TableCell>{sender.display_name || "-"}</TableCell>
                    <TableCell>{sender.provider || "smtp"}</TableCell>
                    <TableCell>
                      <Badge variant={healthVariant(sender.health_score)}>
                        {sender.health_score === null ? "-" : `${sender.health_score}%`}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={sender.status.toLowerCase() === "active" ? "default" : "outline"} className="capitalize">
                        {sender.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(sender.last_sent_at)}</TableCell>
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
      </div>
    </AppLayout>
  );
}
