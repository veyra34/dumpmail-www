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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";
import { createTemplate, fetchTemplates } from "@/app/actions/admin-actions";
import { useToast } from "@/hooks/use-toast";
import { FileText, Loader2, Plus } from "lucide-react";

type Template = Tables<"email_templates">;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function Templates() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    subject: "",
    bodyHtml: "",
    bodyText: "",
    variables: "name",
  });

  const loadTemplates = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchTemplates<Template>(user.id);
      setTemplates(data ?? []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load templates");
    }

    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      if (!cancelled) void loadTemplates();
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
      await createTemplate<Template>(user.id, {
        name: form.name,
        subject: form.subject,
        bodyHtml: form.bodyHtml,
        bodyText: form.bodyText,
        variables: form.variables.split(",").map((item) => item.trim()).filter(Boolean),
      });
      setForm({ name: "", subject: "", bodyHtml: "", bodyText: "", variables: "name" });
      setFormOpen(false);
      toast({ title: "Template added" });
      await loadTemplates();
    } catch (requestError) {
      toast({
        title: "Template failed",
        description: requestError instanceof Error ? requestError.message : "Unable to add template",
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-6">
        <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Email templates</h1>
            <p className="text-[13px] text-muted-foreground mt-1">Reusable email content with variables.</p>
          </div>
          <Button onClick={() => setFormOpen(true)} className="h-9 gap-2 text-[13px]">
            <Plus className="h-3.5 w-3.5" />
            Add template
          </Button>
        </div>

        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add template</DialogTitle>
              <DialogDescription>Create reusable subject and body content for campaign sequences.</DialogDescription>
            </DialogHeader>
          <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-[12px]">Name</Label>
              <Input required className="h-9 text-[13px]" value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Subject</Label>
              <Input required className="h-9 text-[13px]" value={form.subject} onChange={(event) => setForm((value) => ({ ...value, subject: event.target.value }))} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-[12px]">Body HTML</Label>
              <Textarea required className="min-h-24 text-[13px]" value={form.bodyHtml} onChange={(event) => setForm((value) => ({ ...value, bodyHtml: event.target.value }))} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-[12px]">Body text</Label>
              <Textarea className="min-h-20 text-[13px]" value={form.bodyText} onChange={(event) => setForm((value) => ({ ...value, bodyText: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Variables</Label>
              <Input className="h-9 text-[13px]" value={form.variables} onChange={(event) => setForm((value) => ({ ...value, variables: event.target.value }))} />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={saving} className="h-9 text-[13px]">
                {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Add template
              </Button>
            </div>
          </form>
          </DialogContent>
        </Dialog>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-border bg-card p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total templates</div>
            <div className="mt-2 text-2xl font-bold tracking-tight">{templates.length}</div>
          </div>
          <div className="rounded-md border border-border bg-card p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">HTML ready</div>
            <div className="mt-2 text-2xl font-bold tracking-tight">{templates.filter((template) => Boolean(template.body_html)).length}</div>
          </div>
          <div className="rounded-md border border-border bg-card p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Variable-ready</div>
            <div className="mt-2 text-2xl font-bold tracking-tight">{templates.filter((template) => Boolean(template.variables)).length}</div>
          </div>
        </div>

        <section className="rounded-md border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary/30">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[14px] font-semibold">Template library</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading templates...
            </div>
          ) : error ? (
            <div className="px-4 py-12 text-center text-sm text-destructive">{error}</div>
          ) : templates.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Variables</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => {
                  const variables = Array.isArray(template.variables) ? template.variables : [];

                  return (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell>{template.subject}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {variables.length ? variables.map((variable) => (
                            <Badge key={String(variable)} variant="secondary" className="capitalize">
                              {String(variable)}
                            </Badge>
                          )) : <span className="text-muted-foreground">-</span>}
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(template.created_at)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="px-4 py-16 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-secondary/40">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-[13px] text-muted-foreground">No templates yet. Add your first outreach draft with variables and attachments.</p>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
