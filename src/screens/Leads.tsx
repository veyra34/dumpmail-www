"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { createLead, fetchLeads } from "@/app/actions/admin-actions";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Users } from "lucide-react";

type Lead = Tables<"leads">;

function statusVariant(status: string) {
  switch (status.toLowerCase()) {
    case "active":
    case "engaged":
    case "replied":
      return "default";
    case "paused":
    case "new":
    case "nurture":
      return "secondary";
    case "bounced":
    case "do_not_contact":
    case "do-not-contact":
      return "destructive";
    default:
      return "outline";
  }
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Never";
}

export default function Leads() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    role: "",
    source: "private",
    status: "new",
  });

  const loadLeads = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchLeads<Lead>();
      setLeads(data ?? []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load leads");
    }

    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      if (!cancelled) void loadLeads();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await createLead<Lead>(form);
      setForm({ name: "", email: "", company: "", role: "", source: "private", status: "new" });
      setFormOpen(false);
      toast({ title: "Lead added" });
      await loadLeads();
    } catch (requestError) {
      toast({
        title: "Lead failed",
        description: requestError instanceof Error ? requestError.message : "Unable to add lead",
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  const activeCount = leads.filter((lead) => ["active", "engaged", "replied"].includes(lead.status.toLowerCase())).length;
  const contactedCount = leads.filter((lead) => Boolean(lead.last_contacted_at)).length;

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-6">
        <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
            <p className="text-[13px] text-muted-foreground mt-1">Your contact list. Import via CSV or add manually.</p>
          </div>
          <Button onClick={() => setFormOpen(true)} className="h-9 gap-2 text-[13px]">
            <Plus className="h-3.5 w-3.5" />
            Add lead
          </Button>
        </div>

        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add lead</DialogTitle>
              <DialogDescription>Add a private lead or mark it global for shared campaign attachment.</DialogDescription>
            </DialogHeader>
          <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-[12px]">Name</Label>
              <Input required className="h-9 text-[13px]" value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Email</Label>
              <Input required type="email" className="h-9 text-[13px]" value={form.email} onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Company</Label>
              <Input className="h-9 text-[13px]" value={form.company} onChange={(event) => setForm((value) => ({ ...value, company: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Role</Label>
              <Input className="h-9 text-[13px]" value={form.role} onChange={(event) => setForm((value) => ({ ...value, role: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Scope</Label>
              <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px]" value={form.source} onChange={(event) => setForm((value) => ({ ...value, source: event.target.value }))}>
                <option value="private">Private</option>
                <option value="global">Global</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={saving} className="h-9 text-[13px]">
                {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Add lead
              </Button>
            </div>
          </form>
          </DialogContent>
        </Dialog>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-border bg-card p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total leads</div>
            <div className="mt-2 text-2xl font-bold tracking-tight">{leads.length}</div>
          </div>
          <div className="rounded-md border border-border bg-card p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Contacted</div>
            <div className="mt-2 text-2xl font-bold tracking-tight">{contactedCount}</div>
          </div>
          <div className="rounded-md border border-border bg-card p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Active pipeline</div>
            <div className="mt-2 text-2xl font-bold tracking-tight">{activeCount}</div>
          </div>
        </div>

        <section className="rounded-md border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary/30">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[14px] font-semibold">Lead list</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading leads...
            </div>
          ) : error ? (
            <div className="px-4 py-12 text-center text-sm text-destructive">{error}</div>
          ) : leads.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last contacted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.name}</TableCell>
                    <TableCell>{lead.email}</TableCell>
                    <TableCell>{lead.company || "-"}</TableCell>
                    <TableCell>{lead.role || "-"}</TableCell>
                    <TableCell>{lead.source || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(lead.status)} className="capitalize">
                        {lead.status?.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(lead.last_contacted_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="px-4 py-16 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-secondary/40">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-[13px] text-muted-foreground">No leads yet. Import a CSV or add your first contact to start a campaign.</p>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
