"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  createCampaignWithSetup,
  fetchCampaignLeadDetails,
  fetchCampaignRuntimeConfig,
  fetchCampaignSequences,
  fetchCampaigns,
  fetchLeads,
  fetchSenders,
  fetchTemplates,
  upsertCampaignSequences,
  updateCampaignRuntimeConfig,
  updateCampaign,
  deleteCampaign,
  type CampaignLeadDetail,
  type SequenceStepInput,
} from "@/app/actions/admin-actions";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Plus,
  Send,
  Users,
  Edit,
  Trash2,
  CheckCircle2,
  FileText,
  CalendarClock,
  X,
  Layers,
} from "lucide-react";

type Campaign = Tables<"campaigns">;
type Template = Tables<"email_templates">;
type Lead = Tables<"leads">;
type Sender = Tables<"sender_accounts">;
type RuntimeConfig = Tables<"campaign_runtime_config">;
type CampaignSequence = Tables<"campaign_sequences">;

const DAY_OPTIONS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
];

const DEFAULT_RUNTIME = {
  timezone: "Asia/Kolkata",
  startHour: "9",
  endHour: "18",
  activeDays: [1, 2, 3, 4, 5] as number[],
  isPaused: false,
};

const DEFAULT_FORM = {
  name: "",
  status: "active",
  senderAccountId: "",
  templateId: "",
  maxSteps: "3",
  defaultDelayDays: "3",
  ...DEFAULT_RUNTIME,
};

type CampaignForm = typeof DEFAULT_FORM;
type StepDraft = { id: string; templateId: string; delayDays: string };

function makeStep(templateId = "", delayDays = ""): StepDraft {
  return { id: crypto.randomUUID(), templateId, delayDays };
}

function statusVariant(status: string) {
  switch (status.toLowerCase()) {
    case "active":
    case "running":
      return "default" as const;
    case "paused":
    case "draft":
      return "secondary" as const;
    case "archived":
    case "stopped":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** ALL-CAPS field label consistent with leads form */
function FL({ children, req }: { children: React.ReactNode; req?: boolean }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
      {children}
      {req && <span className="text-destructive ml-0.5">*</span>}
    </div>
  );
}

export default function Campaigns() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [senders, setSenders] = useState<Sender[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  type ViewState = "list" | "create" | "edit" | "details";
  const [view, setView] = useState<ViewState>("list");

  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [campaignLeadDetails, setCampaignLeadDetails] = useState<CampaignLeadDetail[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

  const [createForm, setCreateForm] = useState<CampaignForm>({ ...DEFAULT_FORM });
  const [createSteps, setCreateSteps] = useState<StepDraft[]>([]);

  const [editForm, setEditForm] = useState<CampaignForm>({ ...DEFAULT_FORM });
  const [editSteps, setEditSteps] = useState<StepDraft[]>([]);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);

  /* ── Load workspace ─────────────────────────────────────────────────────── */
  const loadWorkspace = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const [campaignData, templateData, leadData, senderData] = await Promise.all([
        fetchCampaigns<Campaign>(user.id),
        fetchTemplates<Template>(user.id),
        fetchLeads<Lead>(user.id),
        fetchSenders<Sender>(user.id),
      ]);
      setCampaigns(campaignData ?? []);
      setTemplates(templateData ?? []);
      setLeads(leadData ?? []);
      setSenders(senderData ?? []);

      setCreateForm((v) => ({
        ...v,
        senderAccountId: v.senderAccountId || senderData?.[0]?.id || "",
        templateId: v.templateId || templateData?.[0]?.id || "",
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load campaign workspace");
    }
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(() => { if (!cancelled) void loadWorkspace(); }, 0);
    return () => { cancelled = true; window.clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const activeCount = campaigns.filter((c) => c.status.toLowerCase() === "active").length;

  /* ── Step helpers ───────────────────────────────────────────────────────── */
  const addStep = (setter: React.Dispatch<React.SetStateAction<StepDraft[]>>) =>
    setter((v) => [...v, makeStep()]);

  const removeStep = (setter: React.Dispatch<React.SetStateAction<StepDraft[]>>, id: string) =>
    setter((v) => v.filter((s) => s.id !== id));

  const updateStep = (
    setter: React.Dispatch<React.SetStateAction<StepDraft[]>>,
    id: string,
    patch: Partial<StepDraft>
  ) => setter((v) => v.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  /** Convert draft array to SequenceStepInput (positional, 1-indexed) */
  const buildSteps = (drafts: StepDraft[]): SequenceStepInput[] =>
    drafts.map((d, i) => ({
      stepNumber: i + 1,
      templateId: d.templateId,
      delayDays: Number(d.delayDays) || 0,
    }));

  /**
   * Expand drafts to fill 1..maxSteps.
   * Custom steps override positions 1..N; remaining use default template + delay.
   */
  const expandSteps = (
    drafts: StepDraft[],
    maxSteps: number,
    defaultTemplateId: string,
    defaultDelay: number
  ): SequenceStepInput[] =>
    Array.from({ length: maxSteps }, (_, i) => {
      const custom = drafts[i];
      return {
        stepNumber: i + 1,
        templateId: custom?.templateId || defaultTemplateId,
        delayDays: custom?.delayDays !== undefined && custom.delayDays !== ""
          ? Number(custom.delayDays)
          : defaultDelay,
      };
    });

  /* ── Create campaign ────────────────────────────────────────────────────── */
  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    if (!selectedLeadIds.length) {
      toast({ title: "No leads attached", description: "Attach at least one lead.", variant: "destructive" });
      return;
    }

    const maxSteps = Math.max(1, Number(createForm.maxSteps) || 3);
    const defaultDelay = Number(createForm.defaultDelayDays) || 3;

    setSaving(true);
    try {
      await createCampaignWithSetup<Campaign>(user.id, {
        name: createForm.name,
        status: createForm.status,
        senderAccountId: createForm.senderAccountId,
        templateId: createForm.templateId,
        leadIds: selectedLeadIds,
        steps: buildSteps(createSteps),
        maxSteps,
        defaultDelayDays: defaultDelay,
        timezone: createForm.timezone,
        startHour: Number(createForm.startHour),
        endHour: Number(createForm.endHour),
        activeDays: createForm.activeDays,
        isPaused: createForm.isPaused,
      });
      setCreateForm({ ...DEFAULT_FORM, senderAccountId: senders[0]?.id ?? "", templateId: templates[0]?.id ?? "" });
      setCreateSteps([]);
      setSelectedLeadIds([]);
      setView("list");
      toast({ title: "Campaign created" });
      await loadWorkspace();
    } catch (err) {
      toast({ title: "Campaign failed", description: err instanceof Error ? err.message : "Unable to create", variant: "destructive" });
    }
    setSaving(false);
  };

  /* ── Start edit ─────────────────────────────────────────────────────────── */
  const handleStartEdit = async (campaign: Campaign) => {
    if (!user) return;
    setSelectedCampaign(campaign);

    try {
      const [rt, seqs, ld] = await Promise.all([
        fetchCampaignRuntimeConfig<RuntimeConfig>(campaign.id),
        fetchCampaignSequences<CampaignSequence>(campaign.id),
        fetchCampaignLeadDetails(user.id, campaign.id),
      ]);

      const config = rt as RuntimeConfig | null;
      setEditForm({
        name: campaign.name,
        status: campaign.status,
        senderAccountId: campaign.sender_account_id ?? "",
        templateId: campaign.template_id ?? "",
        maxSteps: String(campaign.max_steps ?? (seqs.length || 3)),
        defaultDelayDays: String(campaign.default_delay_days ?? 3),
        timezone: config?.timezone ?? DEFAULT_RUNTIME.timezone,
        startHour: String(config?.start_hour ?? DEFAULT_RUNTIME.startHour),
        endHour: String(config?.end_hour ?? DEFAULT_RUNTIME.endHour),
        activeDays: config?.active_days ?? DEFAULT_RUNTIME.activeDays,
        isPaused: config?.is_paused ?? DEFAULT_RUNTIME.isPaused,
      });

      // Load only explicitly customized steps (those that differ from default template)
      const sequences = seqs as CampaignSequence[];
      setEditSteps(
        sequences.map((s) => makeStep(s.template_id ?? "", String(s.delay_days ?? 3)))
      );
      setSelectedLeadIds((ld as CampaignLeadDetail[]).map((i) => i.lead_id));
    } catch {
      toast({ title: "Load failed", description: "Could not load campaign details.", variant: "destructive" });
    }

    setView("edit");
  };

  /* ── Save edit ──────────────────────────────────────────────────────────── */
  const handleUpdate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !selectedCampaign) return;

    const maxSteps = Math.max(1, Number(editForm.maxSteps) || 3);
    const defaultDelay = Number(editForm.defaultDelayDays) || 3;

    setSaving(true);
    try {
      await updateCampaign<Campaign>(user.id, selectedCampaign.id, {
        name: editForm.name,
        status: editForm.status,
        senderAccountId: editForm.senderAccountId,
        templateId: editForm.templateId,
        maxSteps,
        defaultDelayDays: defaultDelay,
        leadIds: selectedLeadIds,
      });

      await updateCampaignRuntimeConfig(selectedCampaign.id, {
        timezone: editForm.timezone,
        startHour: Number(editForm.startHour),
        endHour: Number(editForm.endHour),
        activeDays: editForm.activeDays,
        isPaused: editForm.isPaused,
      });

      // Expand explicit steps + fill remaining with defaults
      const expanded = expandSteps(editSteps, maxSteps, editForm.templateId, defaultDelay);
      await upsertCampaignSequences(selectedCampaign.id, expanded);

      setView("list");
      setSelectedCampaign(null);
      toast({ title: "Campaign updated" });
      await loadWorkspace();
    } catch (err) {
      toast({ title: "Update failed", description: err instanceof Error ? err.message : "Unable to update", variant: "destructive" });
    }
    setSaving(false);
  };

  /* ── Delete ─────────────────────────────────────────────────────────────── */
  const handleDeleteConfirm = async () => {
    if (!user || !campaignToDelete) return;
    setSaving(true);
    try {
      await deleteCampaign(user.id, campaignToDelete.id);
      toast({ title: "Campaign deleted" });
      setCampaignToDelete(null);
      setDeleteDialogOpen(false);
      setView("list");
      await loadWorkspace();
    } catch (err) {
      toast({ title: "Deletion failed", description: err instanceof Error ? err.message : "Unable to delete", variant: "destructive" });
    }
    setSaving(false);
  };

  /* ── Details ────────────────────────────────────────────────────────────── */
  const openDetails = async (campaign: Campaign) => {
    if (!user) return;
    setSelectedCampaign(campaign);
    setView("details");
    setCampaignLeadDetails([]);
    setDetailLoading(true);
    try {
      const data = await fetchCampaignLeadDetails(user.id, campaign.id);
      setCampaignLeadDetails(data);
    } catch (err) {
      toast({ title: "Details failed", description: err instanceof Error ? err.message : "Could not load", variant: "destructive" });
    }
    setDetailLoading(false);
  };

  const resetView = () => { setView("list"); setSelectedCampaign(null); setCampaignLeadDetails([]); };

  /* ── Shared step builder ────────────────────────────────────────────────── */
  const renderStepBuilder = (
    steps: StepDraft[],
    setter: React.Dispatch<React.SetStateAction<StepDraft[]>>,
    form: CampaignForm
  ) => {
    const maxSteps = Math.max(1, Number(form.maxSteps) || 3);
    const implicitCount = Math.max(0, maxSteps - steps.length);

    return (
      <div className="space-y-2.5">
        <p className="text-[12px] text-muted-foreground">
          Custom steps override their position. Steps {steps.length + 1}–{maxSteps} (
          <span className="font-medium">{implicitCount} step{implicitCount !== 1 ? "s" : ""}</span>)
          will use the default template and <span className="font-medium">{form.defaultDelayDays || 3}d</span> delay.
        </p>

        {steps.map((step, idx) => (
          <div
            key={step.id}
            className="flex items-start gap-3 rounded-lg border border-border bg-background p-4"
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary mt-0.5">
              {idx + 1}
            </div>
            <div className="flex-1 grid gap-3 md:grid-cols-2">
              <div>
                <FL req>Template</FL>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                  value={step.templateId}
                  onChange={(e) => updateStep(setter, step.id, { templateId: e.target.value })}
                >
                  <option value="">
                    — use default ({templates.find((t) => t.id === form.templateId)?.name ?? "none"})
                  </option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <FL>Delay (days)</FL>
                <Input
                  type="number"
                  min={0}
                  className="h-9 text-[13px]"
                  placeholder={`${form.defaultDelayDays || 3} (default)`}
                  value={step.delayDays}
                  onChange={(e) => updateStep(setter, step.id, { delayDays: e.target.value })}
                />
              </div>
            </div>
            <button
              type="button"
              className="mt-0.5 rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              onClick={() => removeStep(setter, step.id)}
              title="Remove custom step"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {/* Implicit/default steps preview */}
        {implicitCount > 0 && (
          <div className="rounded-lg border border-dashed border-border bg-secondary/5 px-4 py-3 text-[12px] text-muted-foreground space-y-1">
            {Array.from({ length: Math.min(implicitCount, 3) }, (_, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                  {steps.length + i + 1}
                </span>
                <span>
                  Default — {templates.find((t) => t.id === form.templateId)?.name ?? "default template"} · {form.defaultDelayDays || 3}d delay
                </span>
              </div>
            ))}
            {implicitCount > 3 && (
              <div className="text-[11px] pl-7 text-muted-foreground/70">
                + {implicitCount - 3} more step{implicitCount - 3 !== 1 ? "s" : ""} using defaults…
              </div>
            )}
          </div>
        )}

        {steps.length < maxSteps && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-2 text-[12px]"
            onClick={() => addStep(setter)}
          >
            <Plus className="h-3.5 w-3.5" />
            Customize step {steps.length + 1}
          </Button>
        )}
      </div>
    );
  };

  /* ── Unified form card ──────────────────────────────────────────────────── */
  const renderForm = (
    form: CampaignForm,
    setForm: React.Dispatch<React.SetStateAction<CampaignForm>>,
    steps: StepDraft[],
    setSteps: React.Dispatch<React.SetStateAction<StepDraft[]>>,
    isEdit: boolean
  ) => (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">

      {/* ── Row 1: General ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-border bg-secondary/20">
        <Send className="h-4 w-4 text-primary" />
        <span className="text-[13px] font-semibold">Campaign details</span>
      </div>

      <div className="px-6 py-5 border-b border-border/60">
        <div className="grid gap-x-5 gap-y-5 md:grid-cols-2">
          <div>
            <FL req>Campaign name</FL>
            <Input
              required
              className="h-9 text-[13px]"
              placeholder="Q3 Outreach"
              value={form.name}
              onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
            />
          </div>
          <div>
            <FL req>Status</FL>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
              value={form.status}
              onChange={(e) => setForm((v) => ({ ...v, status: e.target.value }))}
            >
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="paused">Paused</option>
              <option value="stopped">Stopped</option>
            </select>
          </div>
          <div>
            <FL req>Sender account</FL>
            <select
              required
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
              value={form.senderAccountId}
              onChange={(e) => setForm((v) => ({ ...v, senderAccountId: e.target.value }))}
            >
              <option value="">Select sender</option>
              {senders.map((s) => <option key={s.id} value={s.id}>{s.email}</option>)}
            </select>
          </div>
          <div>
            <FL>Default template</FL>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
              value={form.templateId}
              onChange={(e) => setForm((v) => ({ ...v, templateId: e.target.value }))}
            >
              <option value="">Select template</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Row 2: Sequence config ────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-border bg-secondary/20">
        <Layers className="h-4 w-4 text-primary" />
        <span className="text-[13px] font-semibold">Sequence configuration</span>
      </div>

      <div className="px-6 py-5 border-b border-border/60 space-y-5">
        {/* Max steps + default delay row */}
        <div className="grid gap-x-5 gap-y-5 md:grid-cols-2">
          <div>
            <FL req>Max steps</FL>
            <Input
              required
              type="number"
              min={1}
              max={50}
              className="h-9 text-[13px]"
              placeholder="3"
              value={form.maxSteps}
              onChange={(e) => setForm((v) => ({ ...v, maxSteps: e.target.value }))}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Total steps in the sequence, including default-filled ones.
            </p>
          </div>
          <div>
            <FL req>Default delay (days)</FL>
            <Input
              required
              type="number"
              min={0}
              className="h-9 text-[13px]"
              placeholder="3"
              value={form.defaultDelayDays}
              onChange={(e) => setForm((v) => ({ ...v, defaultDelayDays: e.target.value }))}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Used for any step not explicitly customized below.
            </p>
          </div>
        </div>

        {/* Step builder */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">
              Custom steps
            </span>
            <span className="text-[11px] text-muted-foreground">
              — override individual steps (optional)
            </span>
          </div>
          {renderStepBuilder(steps, setSteps, form)}
        </div>
      </div>

      {/* ── Row 3: Runtime & Schedule ─────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-border bg-secondary/20">
        <CalendarClock className="h-4 w-4 text-primary" />
        <span className="text-[13px] font-semibold">Runtime & schedule</span>
      </div>

      <div className="px-6 py-5 border-b border-border/60">
        <div className="grid gap-x-5 gap-y-5 md:grid-cols-3">
          <div>
            <FL req>Timezone</FL>
            <Input
              className="h-9 text-[13px]"
              placeholder="Asia/Kolkata"
              value={form.timezone}
              onChange={(e) => setForm((v) => ({ ...v, timezone: e.target.value }))}
            />
          </div>
          <div>
            <FL req>Start hour (0–23)</FL>
            <Input
              type="number" min={0} max={23}
              className="h-9 text-[13px]"
              value={form.startHour}
              onChange={(e) => setForm((v) => ({ ...v, startHour: e.target.value }))}
            />
          </div>
          <div>
            <FL req>End hour (0–23)</FL>
            <Input
              type="number" min={0} max={23}
              className="h-9 text-[13px]"
              value={form.endHour}
              onChange={(e) => setForm((v) => ({ ...v, endHour: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <FL>Active days</FL>
            <div className="flex flex-wrap gap-2">
              {DAY_OPTIONS.map((day) => (
                <Button
                  key={day.value}
                  type="button"
                  variant={form.activeDays.includes(day.value) ? "default" : "outline"}
                  className="h-8 px-3 text-[12px]"
                  onClick={() =>
                    setForm((v) => ({
                      ...v,
                      activeDays: v.activeDays.includes(day.value)
                        ? v.activeDays.filter((i) => i !== day.value)
                        : [...v.activeDays, day.value].sort(),
                    }))
                  }
                >
                  {day.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 text-[13px] font-medium cursor-pointer">
              <Checkbox
                checked={form.isPaused}
                onCheckedChange={(c) => setForm((v) => ({ ...v, isPaused: c === true }))}
              />
              Pause runtime initially
            </label>
          </div>
        </div>
      </div>

      {/* ── Row 4: Leads ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-border bg-secondary/20">
        <Users className="h-4 w-4 text-primary" />
        <span className="text-[13px] font-semibold">Target audience</span>
      </div>

      <div className="px-6 py-5">
        <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/10 px-5 py-4">
          <div className="space-y-0.5">
            <p className="text-[13px] font-medium">Attached leads</p>
            <p className="text-[12px] text-muted-foreground">
              {selectedLeadIds.length > 0
                ? `${selectedLeadIds.length} lead${selectedLeadIds.length !== 1 ? "s" : ""} selected`
                : "No leads attached yet."}
            </p>
          </div>
          <Button type="button" onClick={() => setLeadDialogOpen(true)} variant="outline" className="h-9 gap-2 text-[13px]">
            <Users className="h-3.5 w-3.5" />
            {isEdit ? "Manage leads" : "Attach leads"}
          </Button>
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
                <BreadcrumbPage className="text-[13px] font-medium text-foreground">Campaigns</BreadcrumbPage>
              ) : (
                <BreadcrumbLink className="text-[13px] font-medium cursor-pointer" onClick={resetView}>Campaigns</BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {view === "create" && (<><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage className="text-[13px] font-medium text-foreground">New campaign</BreadcrumbPage></BreadcrumbItem></>)}
            {view === "edit" && (<><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage className="text-[13px] font-medium text-foreground max-w-[200px] truncate">{selectedCampaign ? `Edit · ${selectedCampaign.name}` : "Edit"}</BreadcrumbPage></BreadcrumbItem></>)}
            {view === "details" && (<><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage className="text-[13px] font-medium text-foreground max-w-[200px] truncate">{selectedCampaign?.name ?? "Details"}</BreadcrumbPage></BreadcrumbItem></>)}
          </BreadcrumbList>
        </Breadcrumb>

        {/* ── LIST ─────────────────────────────────────────────────────────── */}
        {view === "list" && (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
                <p className="mt-1 text-[13px] text-muted-foreground">Sequences, runtime config, and lead assignment.</p>
              </div>
              <Button onClick={() => setView("create")} className="h-9 gap-2 text-[13px]">
                <Plus className="h-3.5 w-3.5" /> Add campaign
              </Button>
            </div>

            <div className="flex items-center gap-3 text-[13px] text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5">
                <Send className="h-3.5 w-3.5" />
                <span className="font-semibold text-foreground">{campaigns.length}</span> campaign{campaigns.length !== 1 ? "s" : ""}
              </span>
              {activeCount > 0 && (<><span className="text-border">·</span><span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /><span className="font-semibold text-foreground">{activeCount}</span> active</span></>)}
            </div>

            <section className="rounded-md border border-border bg-card overflow-hidden shadow-sm">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary/30">
                <Send className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-[14px] font-semibold">Campaigns overview</h2>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading campaigns...
                </div>
              ) : error ? (
                <div className="px-4 py-12 text-center text-sm text-destructive">{error}</div>
              ) : campaigns.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Max steps</TableHead>
                      <TableHead>Default delay</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right w-[110px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium cursor-pointer text-primary hover:underline" onClick={() => void openDetails(c)}>
                          {c.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(c.status)} className="capitalize">{c.status}</Badge>
                        </TableCell>
                        <TableCell>{c.max_steps ?? "—"}</TableCell>
                        <TableCell>{c.default_delay_days != null ? `${c.default_delay_days}d` : "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(c.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => void openDetails(c)} className="h-8 w-8 hover:bg-secondary" title="View details">
                              <Users className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => void handleStartEdit(c)} className="h-8 w-8 hover:bg-secondary" title="Edit">
                              <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => { setCampaignToDelete(c); setDeleteDialogOpen(true); }} className="h-8 w-8 hover:bg-destructive/10" title="Delete">
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
                    <Send className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-[13px] text-muted-foreground">No campaigns yet. Connect a sender, create a template, then launch a sequence.</p>
                </div>
              )}
            </section>
          </>
        )}

        {/* ── CREATE ───────────────────────────────────────────────────────── */}
        {view === "create" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Create campaign</h1>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Set up a new outreach sequence with sender, steps, schedule, and leads.
              </p>
            </div>
            <form onSubmit={handleCreate} className="space-y-5 max-w-4xl">
              {renderForm(createForm, setCreateForm, createSteps, setCreateSteps, false)}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={resetView} className="h-9 text-[13px]">Cancel</Button>
                <Button type="submit" disabled={saving || !senders.length} className="h-9 text-[13px] gap-2">
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Create campaign
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* ── EDIT ─────────────────────────────────────────────────────────── */}
        {view === "edit" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Edit campaign</h1>
              <p className="mt-1 text-[13px] text-muted-foreground">Update campaign details, steps, schedule, and leads.</p>
            </div>
            <form onSubmit={handleUpdate} className="space-y-5 max-w-4xl">
              {renderForm(editForm, setEditForm, editSteps, setEditSteps, true)}
              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button" variant="destructive"
                  onClick={() => { if (selectedCampaign) { setCampaignToDelete(selectedCampaign); setDeleteDialogOpen(true); } }}
                  className="h-9 text-[13px] gap-2"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete campaign
                </Button>
                <div className="flex items-center gap-3">
                  <Button type="button" variant="ghost" onClick={resetView} className="h-9 text-[13px]">Cancel</Button>
                  <Button type="submit" disabled={saving} className="h-9 text-[13px] gap-2">
                    {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Save changes
                  </Button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* ── DETAILS ──────────────────────────────────────────────────────── */}
        {view === "details" && selectedCampaign && (
          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card px-6 py-5 flex flex-wrap gap-8 items-center shadow-sm">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Campaign</div>
                <div className="text-[15px] font-semibold">{selectedCampaign.name}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Status</div>
                <Badge variant={statusVariant(selectedCampaign.status)} className="capitalize">{selectedCampaign.status}</Badge>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Max steps</div>
                <div className="text-[13px] font-medium">{selectedCampaign.max_steps ?? "—"}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Default delay</div>
                <div className="text-[13px] font-medium">
                  {selectedCampaign.default_delay_days != null ? `${selectedCampaign.default_delay_days}d` : "—"}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Created</div>
                <div className="text-[13px]">{formatDate(selectedCampaign.created_at)}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Leads</div>
                <div className="text-[13px] font-medium">{detailLoading ? "…" : campaignLeadDetails.length}</div>
              </div>
              <div className="ml-auto">
                <Button variant="outline" size="sm" className="h-8 gap-2 text-[12px]" onClick={() => void handleStartEdit(selectedCampaign)}>
                  <Edit className="h-3.5 w-3.5" /> Edit campaign
                </Button>
              </div>
            </div>

            <section className="rounded-md border border-border bg-card overflow-hidden shadow-sm">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary/30">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-[14px] font-semibold">Leads attached to campaign</h2>
                {!detailLoading && <span className="ml-auto text-[12px] text-muted-foreground">{campaignLeadDetails.length} total</span>}
              </div>
              {detailLoading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading leads...
                </div>
              ) : campaignLeadDetails.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Step</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Next send</TableHead>
                      <TableHead>Last sent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaignLeadDetails.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.leads?.name ?? "—"}</TableCell>
                        <TableCell>{item.leads?.email ?? "—"}</TableCell>
                        <TableCell>{item.leads?.company ?? "—"}</TableCell>
                        <TableCell>{item.current_step}</TableCell>
                        <TableCell><Badge variant={statusVariant(item.status)} className="capitalize">{item.status}</Badge></TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(item.next_send_at)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(item.last_sent_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-secondary/40">
                    <Users className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-[13px] text-muted-foreground">No leads attached to this campaign.</p>
                </div>
              )}
            </section>
          </div>
        )}

      </div>

      {/* ── LEAD DIALOG ──────────────────────────────────────────────────── */}
      <Dialog open={leadDialogOpen} onOpenChange={setLeadDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-hidden flex flex-col sm:max-w-3xl p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <DialogTitle>Attach leads</DialogTitle>
            <DialogDescription>Select leads to attach to this campaign.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between px-6 py-3 bg-secondary/10 border-b border-border shrink-0">
            <p className="text-[13px] text-muted-foreground">{leads.length} leads available</p>
            <p className="text-[13px] font-semibold">{selectedLeadIds.length} selected</p>
          </div>
          <div className="overflow-y-auto flex-1 p-6">
            {leads.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {leads.map((lead) => (
                  <label key={lead.id} className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 cursor-pointer transition-colors hover:border-primary/50">
                    <Checkbox className="mt-0.5" checked={selectedLeadIds.includes(lead.id)} onCheckedChange={() => setSelectedLeadIds((v) => v.includes(lead.id) ? v.filter((i) => i !== lead.id) : [...v, lead.id])} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium leading-tight">{lead.name ?? lead.email}</p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{lead.email}</p>
                      {lead.company && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{lead.company}</p>}
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-8 w-8 text-muted-foreground/50 mb-3" />
                <p className="text-[14px] font-medium">No leads available</p>
                <p className="mt-1 text-[13px] text-muted-foreground">Add leads in the Leads section first.</p>
              </div>
            )}
          </div>
          <div className="px-6 py-4 border-t border-border shrink-0 flex justify-end">
            <Button type="button" onClick={() => setLeadDialogOpen(false)} className="h-9 text-[13px]">Confirm selection</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── DELETE DIALOG ────────────────────────────────────────────────── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;<span className="font-semibold text-foreground">{campaignToDelete?.name}</span>&quot; and its sequences.
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
              Delete campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
