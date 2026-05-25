"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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
import {
  createCampaignWithSetup,
  fetchCampaignLeadDetails,
  fetchCampaigns,
  fetchLeads,
  fetchRuntimeConfigs,
  fetchSenders,
  fetchTemplates,
  updateCampaignRuntimeConfig,
  type CampaignLeadDetail,
} from "@/app/actions/admin-actions";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Send, Settings2 } from "lucide-react";

type Campaign = Tables<"campaigns">;
type Template = Tables<"email_templates">;
type Lead = Tables<"leads">;
type Sender = Tables<"sender_accounts">;
type RuntimeConfig = Tables<"campaign_runtime_config">;

const dayOptions = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
];

function statusVariant(status: string) {
  switch (status.toLowerCase()) {
    case "active":
    case "running":
      return "default";
    case "paused":
    case "draft":
      return "secondary";
    case "archived":
    case "stopped":
      return "destructive";
    default:
      return "outline";
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function Campaigns() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [runtimeConfigs, setRuntimeConfigs] = useState<RuntimeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runtimeSaving, setRuntimeSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [runtimeOpen, setRuntimeOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [campaignLeadDetails, setCampaignLeadDetails] = useState<CampaignLeadDetail[]>([]);
  const [leadScope, setLeadScope] = useState<"private" | "global">("private");
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: "",
    status: "active",
    senderAccountId: "",
    templateId: "",
    followupTemplateId: "",
    followupDelayDays: "3",
    timezone: "Asia/Kolkata",
    startHour: "0",
    endHour: "23",
    activeDays: [1, 2, 3, 4, 5, 6, 7],
    isPaused: false,
  });
  const [runtimeForm, setRuntimeForm] = useState({
    campaignId: "",
    timezone: "Asia/Kolkata",
    startHour: "0",
    endHour: "23",
    activeDays: [1, 2, 3, 4, 5, 6, 7],
    isPaused: false,
  });

  const privateLeads = useMemo(() => leads.filter((lead) => lead.source !== "global"), [leads]);
  const campaignLeadOptions = leadScope === "global" ? leads : privateLeads;

  const loadWorkspace = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [campaignData, templateData, leadData, senderData, runtimeData] = await Promise.all([
        fetchCampaigns<Campaign>(user.id),
        fetchTemplates<Template>(user.id),
        fetchLeads<Lead>(),
        fetchSenders<Sender>(user.id),
        fetchRuntimeConfigs<RuntimeConfig>(),
      ]);

      setCampaigns(campaignData ?? []);
      setTemplates(templateData ?? []);
      setLeads(leadData ?? []);
      setSenders(senderData ?? []);
      setRuntimeConfigs(runtimeData ?? []);

      setForm((value) => ({
        ...value,
        senderAccountId: value.senderAccountId || senderData?.[0]?.id || "",
        templateId: value.templateId || templateData?.[0]?.id || "",
      }));
      setRuntimeForm((value) => ({
        ...value,
        campaignId: value.campaignId || campaignData?.[0]?.id || "",
      }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load campaign workspace");
    }

    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      if (!cancelled) void loadWorkspace();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const activeCount = campaigns.filter((campaign) => campaign.status.toLowerCase() === "active").length;
  const selectedRuntime = runtimeConfigs.find((config) => config.campaign_id === runtimeForm.campaignId);

  const toggleDay = (day: number, target: "create" | "runtime") => {
    if (target === "create") {
      setForm((value) => ({
        ...value,
        activeDays: value.activeDays.includes(day) ? value.activeDays.filter((item) => item !== day) : [...value.activeDays, day].sort(),
      }));
      return;
    }

    setRuntimeForm((value) => ({
      ...value,
      activeDays: value.activeDays.includes(day) ? value.activeDays.filter((item) => item !== day) : [...value.activeDays, day].sort(),
    }));
  };

  const toggleLead = (leadId: string) => {
    setSelectedLeadIds((value) => value.includes(leadId) ? value.filter((id) => id !== leadId) : [...value, leadId]);
  };

  const handleCreateCampaign = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;

    const leadIds = leadScope === "global" ? campaignLeadOptions.map((lead) => lead.id) : selectedLeadIds;
    setSaving(true);
    try {
      await createCampaignWithSetup<Campaign>(user.id, {
        name: form.name,
        status: form.status,
        senderAccountId: form.senderAccountId,
        templateId: form.templateId,
        leadIds,
        followupTemplateId: form.followupTemplateId || undefined,
        followupDelayDays: Number(form.followupDelayDays || 3),
        timezone: form.timezone,
        startHour: Number(form.startHour),
        endHour: Number(form.endHour),
        activeDays: form.activeDays,
        isPaused: form.isPaused,
      });
      setForm((value) => ({ ...value, name: "", followupTemplateId: "" }));
      setSelectedLeadIds([]);
      setCreateOpen(false);
      toast({ title: "Campaign created" });
      await loadWorkspace();
    } catch (requestError) {
      toast({
        title: "Campaign failed",
        description: requestError instanceof Error ? requestError.message : "Unable to create campaign",
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  const handleRuntimeCampaignChange = (campaignId: string) => {
    const config = runtimeConfigs.find((item) => item.campaign_id === campaignId);
    setRuntimeForm({
      campaignId,
      timezone: config?.timezone ?? "Asia/Kolkata",
      startHour: String(config?.start_hour ?? 0),
      endHour: String(config?.end_hour ?? 23),
      activeDays: config?.active_days ?? [1, 2, 3, 4, 5, 6, 7],
      isPaused: config?.is_paused ?? false,
    });
  };

  const handleUpdateRuntime = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!runtimeForm.campaignId) return;

    setRuntimeSaving(true);
    try {
      await updateCampaignRuntimeConfig<RuntimeConfig>(runtimeForm.campaignId, {
        timezone: runtimeForm.timezone,
        startHour: Number(runtimeForm.startHour),
        endHour: Number(runtimeForm.endHour),
        activeDays: runtimeForm.activeDays,
        isPaused: runtimeForm.isPaused,
      });
      toast({ title: "Runtime config saved" });
      setRuntimeOpen(false);
      await loadWorkspace();
    } catch (requestError) {
      toast({
        title: "Runtime update failed",
        description: requestError instanceof Error ? requestError.message : "Unable to update runtime config",
        variant: "destructive",
      });
    }
    setRuntimeSaving(false);
  };

  const openCampaignDetails = async (campaign: Campaign) => {
    if (!user) return;

    setSelectedCampaign(campaign);
    setCampaignLeadDetails([]);
    setDetailOpen(true);
    setDetailLoading(true);

    try {
      const data = await fetchCampaignLeadDetails(user.id, campaign.id);
      setCampaignLeadDetails(data);
    } catch (requestError) {
      toast({
        title: "Campaign details failed",
        description: requestError instanceof Error ? requestError.message : "Unable to load campaign leads",
        variant: "destructive",
      });
    }

    setDetailLoading(false);
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-6">
        <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
            <p className="text-[13px] text-muted-foreground mt-1">Sequences, runtime config, and lead assignment.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setRuntimeOpen(true)} variant="outline" className="h-9 gap-2 text-[13px]">
              <Settings2 className="h-3.5 w-3.5" />
              Runtime
            </Button>
            <Button onClick={() => setCreateOpen(true)} className="h-9 gap-2 text-[13px]">
              <Plus className="h-3.5 w-3.5" />
              Add campaign
            </Button>
          </div>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle>Create campaign</DialogTitle>
              <DialogDescription>Attach a sender, templates, runtime window, and private or global leads.</DialogDescription>
            </DialogHeader>
          <form onSubmit={handleCreateCampaign} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-[12px]">Campaign name</Label>
                <Input required className="h-9 text-[13px]" value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Sender</Label>
                <select required className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px]" value={form.senderAccountId} onChange={(event) => setForm((value) => ({ ...value, senderAccountId: event.target.value }))}>
                  <option value="">Select sender</option>
                  {senders.map((sender) => (
                    <option key={sender.id} value={sender.id}>{sender.email}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Status</Label>
                <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px]" value={form.status} onChange={(event) => setForm((value) => ({ ...value, status: event.target.value }))}>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="paused">Paused</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Step 1 template</Label>
                <select required className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px]" value={form.templateId} onChange={(event) => setForm((value) => ({ ...value, templateId: event.target.value }))}>
                  <option value="">Select template</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Follow-up template</Label>
                <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px]" value={form.followupTemplateId} onChange={(event) => setForm((value) => ({ ...value, followupTemplateId: event.target.value }))}>
                  <option value="">None</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Follow-up delay</Label>
                <Input type="number" min={0} className="h-9 text-[13px]" value={form.followupDelayDays} onChange={(event) => setForm((value) => ({ ...value, followupDelayDays: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Timezone</Label>
                <Input required className="h-9 text-[13px]" value={form.timezone} onChange={(event) => setForm((value) => ({ ...value, timezone: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Start hour</Label>
                <Input required type="number" min={0} max={23} className="h-9 text-[13px]" value={form.startHour} onChange={(event) => setForm((value) => ({ ...value, startHour: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">End hour</Label>
                <Input required type="number" min={0} max={23} className="h-9 text-[13px]" value={form.endHour} onChange={(event) => setForm((value) => ({ ...value, endHour: event.target.value }))} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-[12px]">Lead scope</Label>
                  <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px]" value={leadScope} onChange={(event) => setLeadScope(event.target.value as "private" | "global")}>
                    <option value="private">Private leads</option>
                    <option value="global">Global leads</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 text-[13px]">
                  <Checkbox checked={form.isPaused} onCheckedChange={(checked) => setForm((value) => ({ ...value, isPaused: checked === true }))} />
                  Pause runtime
                </label>
                <div className="flex flex-wrap gap-2">
                  {dayOptions.map((day) => (
                    <Button key={day.value} type="button" variant={form.activeDays.includes(day.value) ? "default" : "outline"} className="h-8 px-2 text-[12px]" onClick={() => toggleDay(day.value, "create")}>
                      {day.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="rounded-md border border-border p-3">
                <div className="mb-2 text-[12px] font-medium">Attach leads</div>
                {campaignLeadOptions.length ? (
                  <div className="grid max-h-40 gap-2 overflow-auto md:grid-cols-2">
                    {campaignLeadOptions.map((lead) => (
                      <label key={lead.id} className="flex items-center gap-2 rounded border border-border px-2 py-1.5 text-[12px]">
                        <Checkbox checked={leadScope === "global" || selectedLeadIds.includes(lead.id)} disabled={leadScope === "global"} onCheckedChange={() => toggleLead(lead.id)} />
                        <span className="truncate">{lead.name} · {lead.email}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="text-[13px] text-muted-foreground">No leads available for this scope.</div>
                )}
              </div>
            </div>

            <Button type="submit" disabled={saving || !templates.length || !senders.length || !campaignLeadOptions.length} className="h-9 text-[13px]">
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Create campaign
            </Button>
          </form>
          </DialogContent>
        </Dialog>

        <Dialog open={runtimeOpen} onOpenChange={setRuntimeOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Change runtime config</DialogTitle>
              <DialogDescription>Adjust sending hours, active days, timezone, and pause state.</DialogDescription>
            </DialogHeader>
          <form onSubmit={handleUpdateRuntime} className="grid gap-3 md:grid-cols-5">
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-[12px]">Campaign</Label>
              <select required className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px]" value={runtimeForm.campaignId} onChange={(event) => handleRuntimeCampaignChange(event.target.value)}>
                <option value="">Select campaign</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Timezone</Label>
              <Input required className="h-9 text-[13px]" value={runtimeForm.timezone} onChange={(event) => setRuntimeForm((value) => ({ ...value, timezone: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Start</Label>
              <Input required type="number" min={0} max={23} className="h-9 text-[13px]" value={runtimeForm.startHour} onChange={(event) => setRuntimeForm((value) => ({ ...value, startHour: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">End</Label>
              <Input required type="number" min={0} max={23} className="h-9 text-[13px]" value={runtimeForm.endHour} onChange={(event) => setRuntimeForm((value) => ({ ...value, endHour: event.target.value }))} />
            </div>
            <div className="flex flex-wrap items-end gap-2 md:col-span-3">
              {dayOptions.map((day) => (
                <Button key={day.value} type="button" variant={runtimeForm.activeDays.includes(day.value) ? "default" : "outline"} className="h-8 px-2 text-[12px]" onClick={() => toggleDay(day.value, "runtime")}>
                  {day.label}
                </Button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-[13px]">
              <Checkbox checked={runtimeForm.isPaused} onCheckedChange={(checked) => setRuntimeForm((value) => ({ ...value, isPaused: checked === true }))} />
              Paused
            </label>
            <div className="flex items-end">
              <Button type="submit" disabled={runtimeSaving || !runtimeForm.campaignId} className="h-9 text-[13px]">
                {runtimeSaving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Save runtime
              </Button>
            </div>
            {selectedRuntime && (
              <div className="text-[12px] text-muted-foreground md:col-span-5">
                Current window: {selectedRuntime.start_hour}:00-{selectedRuntime.end_hour}:00, {selectedRuntime.timezone}
              </div>
            )}
          </form>
          </DialogContent>
        </Dialog>

        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle>{selectedCampaign?.name ?? "Campaign"} leads</DialogTitle>
              <DialogDescription>Lead assignment details and current sequence state for this campaign.</DialogDescription>
            </DialogHeader>
            {detailLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading campaign leads...
              </div>
            ) : campaignLeadDetails.length ? (
              <div className="overflow-hidden rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Step</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Next send</TableHead>
                      <TableHead>Last sent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaignLeadDetails.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.leads?.name ?? "-"}</TableCell>
                        <TableCell>{item.leads?.email ?? "-"}</TableCell>
                        <TableCell>{item.leads?.company || "-"}</TableCell>
                        <TableCell>{item.leads?.role || "-"}</TableCell>
                        <TableCell>{item.current_step}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(item.status)} className="capitalize">
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.next_send_at ? formatDate(item.next_send_at) : "-"}</TableCell>
                        <TableCell>{item.last_sent_at ? formatDate(item.last_sent_at) : "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="py-12 text-center text-[13px] text-muted-foreground">No leads are attached to this campaign.</div>
            )}
          </DialogContent>
        </Dialog>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-border bg-card p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Campaigns</div>
            <div className="mt-2 text-2xl font-bold tracking-tight">{campaigns.length}</div>
          </div>
          <div className="rounded-md border border-border bg-card p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Active</div>
            <div className="mt-2 text-2xl font-bold tracking-tight">{activeCount}</div>
          </div>
          <div className="rounded-md border border-border bg-card p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Need setup</div>
            <div className="mt-2 text-2xl font-bold tracking-tight">{Math.max(campaigns.length - activeCount, 0)}</div>
          </div>
        </div>

        <section className="rounded-md border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary/30">
            <Send className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[14px] font-semibold">Campaigns overview</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading campaigns...
            </div>
          ) : error ? (
            <div className="px-4 py-12 text-center text-sm text-destructive">{error}</div>
          ) : campaigns.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sender account</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow
                    key={campaign.id}
                    className="cursor-pointer"
                    onClick={() => void openCampaignDetails(campaign)}
                  >
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(campaign.status)} className="capitalize">
                        {campaign.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{campaign.sender_account_id ? campaign.sender_account_id.slice(0, 8) : "-"}</TableCell>
                    <TableCell>{campaign.template_id ? campaign.template_id.slice(0, 8) : "-"}</TableCell>
                    <TableCell>{formatDate(campaign.created_at)}</TableCell>
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
      </div>
    </AppLayout>
  );
}
