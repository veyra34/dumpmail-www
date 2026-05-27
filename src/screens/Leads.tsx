"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";
import {
  bulkImportLeads,
  createLead,
  deleteLead,
  fetchCampaigns,
  fetchLeads,
  updateLead,
  type BulkImportLeadsResult,
} from "@/app/actions/admin-actions";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle,
  CheckCircle2,
  Edit,
  FileSpreadsheet,
  Globe,
  Loader2,
  Lock,
  PhoneCall,
  Plus,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";

type Lead = Tables<"leads">;
type Campaign = Tables<"campaigns">;

const LAST_CAMPAIGN_KEY = "dumpmail_last_import_campaign";

function statusVariant(status: string | null) {
  switch ((status ?? "").toLowerCase()) {
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
  return value
    ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "Never";
}

const defaultForm = {
  name: "",
  email: "",
  company: "",
  role: "",
  source: "csv",
  status: "new",
  private: true,
  campaignId: "",
};

type LeadForm = typeof defaultForm;

/* ── CSV parsing ──────────────────────────────────────────────────────────── */
type CsvRow = { name: string; email: string; company: string; role: string; _row: number };

function parseCSV(text: string): { rows: CsvRow[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { rows: [], errors: ["File is empty"] };

  const errors: string[] = [];
  const rawHeaders = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, ""));

  // Map header index for each required field (fuzzy match)
  const colIdx = (keys: string[]) => rawHeaders.findIndex((h) => keys.some((k) => h.includes(k)));

  const nameIdx = colIdx(["name", "fullname", "full_name"]);
  const emailIdx = colIdx(["email", "mail"]);
  const companyIdx = colIdx(["company", "org", "organisation", "organization"]);
  const roleIdx = colIdx(["role", "title", "position", "jobtitle"]);

  if (emailIdx === -1) {
    return { rows: [], errors: ["CSV must contain an 'email' column."] };
  }

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = splitCSVLine(lines[i]);
    const email = (parts[emailIdx] ?? "").trim().replace(/^"|"$/g, "");
    if (!email) { errors.push(`Row ${i + 1}: missing email, skipped`); continue; }
    if (!email.includes("@")) { errors.push(`Row ${i + 1}: invalid email "${email}", skipped`); continue; }
    rows.push({
      email,
      name: nameIdx >= 0 ? (parts[nameIdx] ?? "").trim().replace(/^"|"$/g, "") : "",
      company: companyIdx >= 0 ? (parts[companyIdx] ?? "").trim().replace(/^"|"$/g, "") : "",
      role: roleIdx >= 0 ? (parts[roleIdx] ?? "").trim().replace(/^"|"$/g, "") : "",
      _row: i + 1,
    });
  }

  return { rows, errors };
}

/** Simple CSV line splitter handling quoted fields */
function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQuote = !inQuote; cur += line[i]; }
    else if (line[i] === "," && !inQuote) { result.push(cur); cur = ""; }
    else { cur += line[i]; }
  }
  result.push(cur);
  return result;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function Leads() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  type ViewState = "list" | "create" | "edit" | "import";
  const [view, setView] = useState<ViewState>("list");
  const [editingLead, setEditingLead] = useState<Lead | null>(null);

  const [createForm, setCreateForm] = useState<LeadForm>({ ...defaultForm });
  const [editForm, setEditForm] = useState<LeadForm>({ ...defaultForm });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);

  /* ── CSV import state ───────────────────────────────────────────────────── */
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvParseErrors, setCsvParseErrors] = useState<string[]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [importCampaignId, setImportCampaignId] = useState<string>("");
  const [importResult, setImportResult] = useState<BulkImportLeadsResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  /* ── Load ───────────────────────────────────────────────────────────────── */
  const loadData = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const [leadData, campaignData] = await Promise.all([
        fetchLeads<Lead>(user.id),
        fetchCampaigns<Campaign>(user.id),
      ]);
      setLeads(leadData ?? []);
      setCampaigns(campaignData ?? []);

      // Restore last campaign from localStorage
      const stored = typeof window !== "undefined" ? localStorage.getItem(LAST_CAMPAIGN_KEY) : null;
      if (stored && campaignData?.some((c) => c.id === stored)) {
        setImportCampaignId(stored);
        setCreateForm((prev) => ({ ...prev, campaignId: stored }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load leads");
    }
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(() => { if (!cancelled) void loadData(); }, 0);
    return () => { cancelled = true; window.clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /* ── CRUD ───────────────────────────────────────────────────────────────── */
  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await createLead<Lead>({ ...createForm, user_id: user.id, campaign_id: createForm.campaignId || null });
      if (createForm.campaignId) {
        localStorage.setItem(LAST_CAMPAIGN_KEY, createForm.campaignId);
      }
      setCreateForm({ ...defaultForm, campaignId: createForm.campaignId }); // Keep campaignId for next entry
      setView("list");
      toast({ title: "Lead created" });
      await loadData();
    } catch (err) {
      toast({ title: "Lead failed", description: err instanceof Error ? err.message : "Unable to create lead", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleStartEdit = (lead: Lead) => {
    setEditingLead(lead);
    setEditForm({ name: lead.name ?? "", email: lead.email, company: lead.company ?? "", role: lead.role ?? "", source: lead.source ?? "csv", status: lead.status ?? "new", private: lead.private, campaignId: "" });
    setView("edit");
  };

  const handleUpdate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingLead) return;
    setSaving(true);
    try {
      await updateLead<Lead>(editingLead.id, editForm);
      setView("list");
      setEditingLead(null);
      toast({ title: "Lead updated" });
      await loadData();
    } catch (err) {
      toast({ title: "Update failed", description: err instanceof Error ? err.message : "Unable to update lead", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDeleteConfirm = async () => {
    if (!leadToDelete) return;
    setSaving(true);
    try {
      await deleteLead(leadToDelete.id);
      toast({ title: "Lead deleted" });
      setLeadToDelete(null);
      setDeleteDialogOpen(false);
      setView("list");
      await loadData();
    } catch (err) {
      toast({ title: "Deletion failed", description: err instanceof Error ? err.message : "Cannot delete lead", variant: "destructive" });
    }
    setSaving(false);
  };

  /* ── CSV handlers ───────────────────────────────────────────────────────── */
  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast({ title: "Invalid file", description: "Please upload a .csv file", variant: "destructive" });
      return;
    }
    setCsvFileName(file.name);
    setCsvRows([]);
    setCsvParseErrors([]);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { rows, errors } = parseCSV(text);
      setCsvRows(rows);
      setCsvParseErrors(errors);
    };
    reader.readAsText(file);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleImport = async () => {
    if (!user || !csvRows.length) return;
    setImporting(true);
    setImportResult(null);
    try {
      const result = await bulkImportLeads(user.id, csvRows, importCampaignId || null);
      setImportResult(result);

      // Persist last used campaign
      if (importCampaignId) {
        localStorage.setItem(LAST_CAMPAIGN_KEY, importCampaignId);
      }

      if (result.imported > 0) {
        toast({ title: `${result.imported} lead${result.imported !== 1 ? "s" : ""} imported` });
        await loadData();
      }
    } catch (err) {
      toast({ title: "Import failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
    setImporting(false);
  };

  const resetImport = () => {
    setCsvRows([]);
    setCsvParseErrors([]);
    setCsvFileName("");
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openImportView = () => {
    resetImport();
    setView("import");
  };

  /* ── Stats ──────────────────────────────────────────────────────────────── */
  const activeCount = leads.filter((l) => ["active", "engaged", "replied"].includes((l.status ?? "").toLowerCase())).length;
  const contactedCount = leads.filter((l) => Boolean(l.last_contacted_at)).length;

  /* ── Shared form card ───────────────────────────────────────────────────── */
  const renderFormFields = (form: LeadForm, setForm: React.Dispatch<React.SetStateAction<LeadForm>>) => (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-border bg-secondary/20">
        <Users className="h-4 w-4 text-primary" />
        <span className="text-[13px] font-semibold">Lead details</span>
      </div>
      <div className="p-6 space-y-0">
        <div className="grid gap-x-5 gap-y-5 md:grid-cols-2 pb-5 border-b border-border/60">
          <div className="space-y-1.5">
            <Label htmlFor="lead-name" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Full Name</Label>
            <Input id="lead-name" placeholder="e.g. Jane Doe" className="h-9 text-[13px]" value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-email" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Email Address <span className="text-destructive">*</span></Label>
            <Input id="lead-email" required type="email" placeholder="jane@company.com" className="h-9 text-[13px]" value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} />
          </div>
        </div>
        <div className="grid gap-x-5 gap-y-5 md:grid-cols-2 py-5 border-b border-border/60">
          <div className="space-y-1.5">
            <Label htmlFor="lead-company" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Company</Label>
            <Input id="lead-company" placeholder="Acme Inc." className="h-9 text-[13px]" value={form.company} onChange={(e) => setForm((v) => ({ ...v, company: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-role" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Role / Title</Label>
            <Input id="lead-role" placeholder="e.g. Head of Marketing" className="h-9 text-[13px]" value={form.role} onChange={(e) => setForm((v) => ({ ...v, role: e.target.value }))} />
          </div>
        </div>
        <div className="grid gap-x-5 gap-y-5 md:grid-cols-2 py-5 border-b border-border/60">
          <div className="space-y-1.5">
            <Label htmlFor="lead-status" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</Label>
            <select id="lead-status" className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1" value={form.status} onChange={(e) => setForm((v) => ({ ...v, status: e.target.value }))}>
              <option value="new">New</option>
              <option value="active">Active</option>
              <option value="engaged">Engaged</option>
              <option value="replied">Replied</option>
              <option value="paused">Paused</option>
              <option value="nurture">Nurture</option>
              <option value="bounced">Bounced</option>
              <option value="do_not_contact">Do Not Contact</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Visibility</Label>
            <div className="flex gap-2 pt-0.5">
              <button type="button" onClick={() => setForm((v) => ({ ...v, private: true }))} className={`flex-1 flex items-center justify-center gap-2 h-9 rounded-md border text-[12px] font-medium transition-all ${form.private ? "border-primary bg-primary/10 text-primary" : "border-input bg-background text-muted-foreground hover:border-border hover:text-foreground"}`}>
                <Lock className="h-3.5 w-3.5" /> Private
              </button>
              <button type="button" onClick={() => setForm((v) => ({ ...v, private: false }))} className={`flex-1 flex items-center justify-center gap-2 h-9 rounded-md border text-[12px] font-medium transition-all ${!form.private ? "border-primary bg-primary/10 text-primary" : "border-input bg-background text-muted-foreground hover:border-border hover:text-foreground"}`}>
                <Globe className="h-3.5 w-3.5" /> Global
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">{form.private ? "Only visible to you" : "Visible to all users in your workspace"}</p>
          </div>
        </div>
        <div className="pt-5 flex gap-5">
          <div className="space-y-1.5 w-1/2">
            <Label htmlFor="lead-source" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Source</Label>
            <Input id="lead-source" placeholder="e.g. csv, linkedin, manual" className="h-9 text-[13px]" value={form.source} onChange={(e) => setForm((v) => ({ ...v, source: e.target.value }))} />
          </div>
          <div className="space-y-1.5 w-1/2">
            <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Assign to Campaign <span className="lowercase normal-case font-normal text-muted-foreground ml-1">— optional</span></Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
              value={form.campaignId}
              onChange={(e) => setForm((v) => ({ ...v, campaignId: e.target.value }))}
            >
              <option value="">— No campaign</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );

  /* ── RENDER ─────────────────────────────────────────────────────────────── */
  return (
    <AppLayout>
      <div className="max-w-[100rem] mx-auto p-6 md:p-8 space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              {view === "list" ? (
                <BreadcrumbPage className="text-[13px] font-medium text-foreground">Leads</BreadcrumbPage>
              ) : (
                <BreadcrumbLink className="text-[13px] font-medium cursor-pointer" onClick={() => setView("list")}>Leads</BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {view === "create" && (<><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage className="text-[13px] font-medium text-foreground">New lead</BreadcrumbPage></BreadcrumbItem></>)}
            {view === "edit" && (<><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage className="text-[13px] font-medium text-foreground max-w-[200px] truncate">{editingLead ? `Edit · ${editingLead.name}` : "Edit lead"}</BreadcrumbPage></BreadcrumbItem></>)}
            {view === "import" && (<><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage className="text-[13px] font-medium text-foreground">Import CSV</BreadcrumbPage></BreadcrumbItem></>)}
          </BreadcrumbList>
        </Breadcrumb>

        {/* ── LIST ─────────────────────────────────────────────────────────── */}
        {view === "list" && (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
                <p className="mt-1 text-[13px] text-muted-foreground">Manage contacts, engagement statuses, and tracking.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={openImportView} variant="outline" className="h-9 gap-2 text-[13px]">
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Import CSV
                </Button>
                <Button onClick={() => setView("create")} className="h-9 gap-2 text-[13px]">
                  <Plus className="h-3.5 w-3.5" /> Add lead
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-3 text-[13px] text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /><span className="font-semibold text-foreground">{leads.length}</span> lead{leads.length !== 1 ? "s" : ""}</span>
              {activeCount > 0 && (<><span className="text-border">·</span><span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /><span className="font-semibold text-foreground">{activeCount}</span> active</span></>)}
              {contactedCount > 0 && (<><span className="text-border">·</span><span className="flex items-center gap-1.5"><PhoneCall className="h-3.5 w-3.5" /><span className="font-semibold text-foreground">{contactedCount}</span> contacted</span></>)}
            </div>

            <section className="rounded-md border border-border bg-card overflow-hidden shadow-sm">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary/30">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-[14px] font-semibold">Lead database</h2>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading leads...</div>
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
                      <TableHead>Visibility</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last contacted</TableHead>
                      <TableHead className="w-[90px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">{lead.name ?? "—"}</TableCell>
                        <TableCell>{lead.email}</TableCell>
                        <TableCell>{lead.company ?? "—"}</TableCell>
                        <TableCell>{lead.role ?? "—"}</TableCell>
                        <TableCell className="capitalize">{lead.source ?? "—"}</TableCell>
                        <TableCell>
                          {lead.private ? (
                            <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground"><Lock className="h-3 w-3" /> Private</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[12px] text-primary"><Globe className="h-3 w-3" /> Global</span>
                          )}
                        </TableCell>
                        <TableCell><Badge variant={statusVariant(lead.status)} className="capitalize">{(lead.status ?? "new").replace(/_/g, " ")}</Badge></TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(lead.last_contacted_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleStartEdit(lead)} className="h-8 w-8 hover:bg-secondary" title="Edit"><Edit className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => { setLeadToDelete(lead); setDeleteDialogOpen(true); }} className="h-8 w-8 hover:bg-destructive/10" title="Delete"><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                          </div>
                        </TableCell>
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
                  <Button onClick={openImportView} variant="outline" className="mt-4 h-9 gap-2 text-[13px]"><FileSpreadsheet className="h-3.5 w-3.5" /> Import CSV</Button>
                </div>
              )}
            </section>
          </>
        )}

        {/* ── CREATE ───────────────────────────────────────────────────────── */}
        {view === "create" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">New lead</h1>
              <p className="mt-1 text-[13px] text-muted-foreground">Add a private lead or mark it global for shared campaign access.</p>
            </div>
            <form onSubmit={handleCreate} className="space-y-6 max-w-3xl">
              {renderFormFields(createForm, setCreateForm)}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setView("list")} className="h-9 text-[13px]">Cancel</Button>
                <Button type="submit" disabled={saving} className="h-9 text-[13px] gap-2">
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Add lead
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* ── EDIT ─────────────────────────────────────────────────────────── */}
        {view === "edit" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Edit lead</h1>
              <p className="mt-1 text-[13px] text-muted-foreground">Modify lead details or delete it permanently.</p>
            </div>
            <form onSubmit={handleUpdate} className="space-y-6 max-w-3xl">
              {renderFormFields(editForm, setEditForm)}
              <div className="flex items-center justify-between pt-2">
                <Button type="button" variant="destructive" onClick={() => { if (editingLead) { setLeadToDelete(editingLead); setDeleteDialogOpen(true); } }} className="h-9 text-[13px] gap-2">
                  <Trash2 className="h-3.5 w-3.5" /> Delete lead
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

        {/* ── IMPORT ───────────────────────────────────────────────────────── */}
        {view === "import" && (
          <div className="space-y-6 max-w-3xl">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Import leads from CSV</h1>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Upload a CSV with columns: <span className="font-semibold">name</span>, <span className="font-semibold">email</span>, <span className="font-semibold">company</span>. Extra columns (role, etc.) are imported automatically.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">

              {/* ── Drop zone ─────────────────────────────────────────────── */}
              <div className="flex items-center gap-2.5 px-6 py-4 border-b border-border bg-secondary/20">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                <span className="text-[13px] font-semibold">Upload CSV file</span>
              </div>

              <div className="px-6 py-5 border-b border-border/60">
                <div
                  onDrop={handleFileDrop}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-12 cursor-pointer transition-all ${dragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-border bg-secondary/5 hover:border-primary/40 hover:bg-secondary/10"}`}
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full border transition-all ${dragOver ? "border-primary bg-primary/10" : "border-border bg-secondary/30"}`}>
                    <Upload className={`h-5 w-5 transition-colors ${dragOver ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  {csvFileName ? (
                    <div className="text-center">
                      <p className="text-[13px] font-semibold text-foreground">{csvFileName}</p>
                      <p className="text-[12px] text-muted-foreground mt-0.5">
                        {csvRows.length} valid row{csvRows.length !== 1 ? "s" : ""} found · click to change
                      </p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-[13px] font-medium">Drop your CSV here or click to browse</p>
                      <p className="text-[12px] text-muted-foreground mt-1">Supported: .csv — required columns: email</p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
                  />
                </div>

                {/* Parse errors */}
                {csvParseErrors.length > 0 && (
                  <div className="mt-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 space-y-1">
                    {csvParseErrors.map((err, i) => (
                      <p key={i} className="text-[12px] text-yellow-600 dark:text-yellow-400 flex items-start gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {err}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Campaign assignment ────────────────────────────────────── */}
              <div className="flex items-center gap-2.5 px-6 py-4 border-b border-border bg-secondary/20">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-[13px] font-semibold">Assign to campaign</span>
                <span className="text-[11px] text-muted-foreground ml-1">— optional</span>
              </div>

              <div className="px-6 py-5 border-b border-border/60">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Campaign</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                    value={importCampaignId}
                    onChange={(e) => setImportCampaignId(e.target.value)}
                  >
                    <option value="">— No campaign (leads only)</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {importCampaignId && (
                    <p className="text-[11px] text-primary flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Imported leads will be attached to this campaign as pending.
                      <span className="text-muted-foreground">(saved as default for next import)</span>
                    </p>
                  )}
                </div>
              </div>

              {/* ── Preview ───────────────────────────────────────────────── */}
              {csvRows.length > 0 && !importResult && (
                <>
                  <div className="flex items-center gap-2.5 px-6 py-4 border-b border-border bg-secondary/20">
                    <FileSpreadsheet className="h-4 w-4 text-primary" />
                    <span className="text-[13px] font-semibold">Preview</span>
                    <span className="text-[12px] text-muted-foreground ml-1">— {csvRows.length} row{csvRows.length !== 1 ? "s" : ""} to import</span>
                  </div>
                  <div className="overflow-x-auto max-h-72 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[11px]">Row</TableHead>
                          <TableHead className="text-[11px]">Name</TableHead>
                          <TableHead className="text-[11px]">Email</TableHead>
                          <TableHead className="text-[11px]">Company</TableHead>
                          <TableHead className="text-[11px]">Role</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {csvRows.slice(0, 100).map((row) => (
                          <TableRow key={row._row}>
                            <TableCell className="text-[12px] text-muted-foreground">{row._row}</TableCell>
                            <TableCell className="text-[12px]">{row.name || "—"}</TableCell>
                            <TableCell className="text-[12px] font-medium">{row.email}</TableCell>
                            <TableCell className="text-[12px]">{row.company || "—"}</TableCell>
                            <TableCell className="text-[12px]">{row.role || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {csvRows.length > 100 && (
                      <p className="px-4 py-2 text-[12px] text-muted-foreground border-t border-border">
                        Showing first 100 of {csvRows.length} rows — all {csvRows.length} will be imported.
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* ── Result ────────────────────────────────────────────────── */}
              {importResult && (
                <>
                  <div className="flex items-center gap-2.5 px-6 py-4 border-b border-border bg-secondary/20">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-[13px] font-semibold">Import complete</span>
                  </div>
                  <div className="px-6 py-5 space-y-3">
                    <div className="flex flex-wrap gap-4">
                      <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/20 px-4 py-3 min-w-[140px]">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <div>
                          <div className="text-[20px] font-bold leading-tight">{importResult.imported}</div>
                          <div className="text-[11px] text-muted-foreground">imported</div>
                        </div>
                      </div>
                      {importResult.skipped > 0 && (
                        <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/20 px-4 py-3 min-w-[140px]">
                          <AlertCircle className="h-4 w-4 text-yellow-500" />
                          <div>
                            <div className="text-[20px] font-bold leading-tight">{importResult.skipped}</div>
                            <div className="text-[11px] text-muted-foreground">skipped</div>
                          </div>
                        </div>
                      )}
                    </div>
                    {importResult.errors.length > 0 && (
                      <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 space-y-1">
                        {importResult.errors.slice(0, 10).map((e, i) => (
                          <p key={i} className="text-[12px] text-yellow-600 dark:text-yellow-400 flex items-start gap-1.5">
                            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            Row {e.row} · {e.email} — {e.reason}
                          </p>
                        ))}
                        {importResult.errors.length > 10 && (
                          <p className="text-[11px] text-muted-foreground pl-5">+{importResult.errors.length - 10} more errors</p>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ── Actions ───────────────────────────────────────────────── */}
              <div className="px-6 py-4 flex items-center justify-between gap-3">
                {importResult ? (
                  <>
                    <Button type="button" variant="outline" onClick={resetImport} className="h-9 text-[13px] gap-2">
                      <Upload className="h-3.5 w-3.5" /> Import another file
                    </Button>
                    <Button type="button" onClick={() => setView("list")} className="h-9 text-[13px]">View all leads</Button>
                  </>
                ) : (
                  <>
                    <Button type="button" variant="ghost" onClick={() => setView("list")} className="h-9 text-[13px]">Cancel</Button>
                    <Button
                      type="button"
                      onClick={handleImport}
                      disabled={importing || !csvRows.length}
                      className="h-9 text-[13px] gap-2"
                    >
                      {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      {importing ? "Importing…" : `Import ${csvRows.length} lead${csvRows.length !== 1 ? "s" : ""}`}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Delete Dialog ─────────────────────────────────────────────────── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete lead?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;<span className="font-semibold text-foreground">{leadToDelete?.name}</span>&quot;. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void handleDeleteConfirm(); }} disabled={saving} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Delete lead
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
