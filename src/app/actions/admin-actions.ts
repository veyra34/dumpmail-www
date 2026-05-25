"use server";

import crypto from "node:crypto";
import createServerSupabase from "@/integrations/supabase/server";
import { ensurePublicUserForClient } from "@/lib/public-user";

export type DashboardStats = {
  campaigns: number;
  leads: number;
  templates: number;
  senders: number;
  events: number;
};


const SMTP_ENCRYPTION_KEY = Buffer.from(
  process.env.ENCRYPTION_KEY || "7a8e99523a80bfe2e50a3e1dd6fad28f2f7eb853e829252de365ee8422778d82",
  "hex",
);

function encryptSmtpPassword(password: string) {
  if (SMTP_ENCRYPTION_KEY.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes");
  }

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", SMTP_ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(password, "utf8", "hex");
  encrypted += cipher.final("hex");

  return [iv.toString("hex"), cipher.getAuthTag().toString("hex"), encrypted].join(":");
}

export async function ensurePublicUser(userId: string) {
  return ensurePublicUserForClient(createServerSupabase(), userId);
}

export type CreateTemplateInput = {
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  variables: string[];
};

export type CreateLeadInput = {
  name: string;
  email: string;
  company?: string;
  role?: string;
  source?: string;
  status?: string;
};

export type CreateSenderInput = {
  email: string;
  displayName?: string;
  smtpHost: string;
  smtpPort: number;
  smtpUserEmail?: string;
  smtpPassword: string;
  smtpSecure: boolean;
  status?: string;
};

export type RuntimeConfigInput = {
  timezone: string;
  startHour: number;
  endHour: number;
  activeDays: number[];
  isPaused: boolean;
};

export type CampaignLeadDetail = {
  id: string;
  campaign_id: string;
  lead_id: string;
  current_step: number;
  next_send_at: string | null;
  last_sent_at: string | null;
  status: string;
  reserved_at: string | null;
  completed_at: string | null;
  created_at: string;
  leads: {
    id: string;
    name: string;
    email: string;
    company: string | null;
    role: string | null;
    source: string | null;
    status: string;
    last_contacted_at: string | null;
    created_at: string;
    updated_at: string;
  } | null;
};

export type CreateCampaignInput = RuntimeConfigInput & {
  name: string;
  status: string;
  senderAccountId: string;
  templateId: string;
  leadIds: string[];
  followupTemplateId?: string;
  followupDelayDays?: number;
};

export async function fetchProfile<T>(userId: string) {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("users")
    .select("id,name,email,created_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data as T | null;
}

export async function updateProfile<T>(userId: string, profile: { name: string; email: string }) {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("users")
    .upsert(
      {
        id: userId,
        name: profile.name,
        email: profile.email,
      },
      { onConflict: "id" },
    )
    .select("id,name,email,created_at")
    .single();

  if (error) throw error;
  return data as T;
}

export async function fetchDashboardStats(userId?: string) {
  const supabase = createServerSupabase();

  const [campaigns, leads, templates, senders] = await Promise.all([
    supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("user_id", userId ?? ""),
    supabase.from("leads").select("id", { count: "exact", head: true }),
    supabase.from("email_templates").select("id", { count: "exact", head: true }).eq("user_id", userId ?? ""),
    supabase.from("sender_accounts").select("id", { count: "exact", head: true }).eq("user_id", userId ?? ""),
  ]);

  const firstError = campaigns.error ?? leads.error ?? templates.error ?? senders.error;
  if (firstError) throw firstError;

  const userEvents = userId ? await fetchUserEvents(userId) : [];

  return {
    campaigns: campaigns.count ?? 0,
    leads: leads.count ?? 0,
    templates: templates.count ?? 0,
    senders: senders.count ?? 0,
    events: userEvents.length,
  } satisfies DashboardStats;
}

export async function fetchTemplates<T>(userId: string) {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as T[];
}

export async function fetchCampaigns<T>(userId: string) {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as T[];
}

export async function fetchLeads<T>() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as T[];
}

export async function fetchRuntimeConfigs<T>() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("campaign_runtime_config")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as T[];
}

export async function fetchSenders<T>(userId: string) {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("sender_accounts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as T[];
}

export async function fetchEvents<T>() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("email_events")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as T[];
}

export async function fetchUserEvents<T>(userId: string) {
  const supabase = createServerSupabase();

  const [campaigns, senders] = await Promise.all([
    supabase.from("campaigns").select("id").eq("user_id", userId),
    supabase.from("sender_accounts").select("id").eq("user_id", userId),
  ]);

  const firstError = campaigns.error ?? senders.error;
  if (firstError) throw firstError;

  const campaignIds = (campaigns.data ?? []).map((campaign) => campaign.id);
  const senderIds = (senders.data ?? []).map((sender) => sender.id);

  let campaignLeadIds: string[] = [];
  if (campaignIds.length) {
    const { data, error } = await supabase
      .from("campaign_leads")
      .select("id")
      .in("campaign_id", campaignIds);

    if (error) throw error;
    campaignLeadIds = (data ?? []).map((campaignLead) => campaignLead.id);
  }

  const filters = [
    campaignLeadIds.length ? `campaign_lead_id.in.(${campaignLeadIds.join(",")})` : null,
    senderIds.length ? `sender_account_id.in.(${senderIds.join(",")})` : null,
  ].filter(Boolean);

  if (!filters.length) {
    return [] as T[];
  }

  const { data, error } = await supabase
    .from("email_events")
    .select("*")
    .or(filters.join(","))
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as T[];
}

export async function fetchCampaignLeadDetails(userId: string, campaignId: string) {
  const supabase = createServerSupabase();

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("user_id", userId)
    .maybeSingle();

  if (campaignError) throw campaignError;
  if (!campaign) throw new Error("Campaign not found");

  const { data, error } = await supabase
    .from("campaign_leads")
    .select("*, leads(*)")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as CampaignLeadDetail[];
}

export async function createTemplate<T>(userId: string, input: CreateTemplateInput) {
  const supabase = createServerSupabase();
  await ensurePublicUserForClient(supabase, userId);

  const { data, error } = await supabase
    .from("email_templates")
    .insert({
      user_id: userId,
      name: input.name,
      subject: input.subject,
      body_html: input.bodyHtml,
      body_text: input.bodyText,
      variables: input.variables,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as T;
}

export async function createLead<T>(input: CreateLeadInput) {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("leads")
    .upsert(
      {
        name: input.name,
        email: input.email,
        company: input.company || null,
        role: input.role || null,
        source: input.source || "private",
        status: input.status || "new",
      },
      { onConflict: "email" },
    )
    .select("*")
    .single();

  if (error) throw error;
  return data as T;
}

export async function createSenderAccount<T>(userId: string, input: CreateSenderInput) {
  const supabase = createServerSupabase();
  await ensurePublicUserForClient(supabase, userId);

  const { data: sender, error: senderError } = await supabase
    .from("sender_accounts")
    .insert({
      user_id: userId,
      email: input.email,
      display_name: input.displayName || null,
      provider: "smtp",
      smtp_host: input.smtpHost,
      smtp_port: input.smtpPort,
      smtp_secure: input.smtpSecure,
      smtp_user_email: input.smtpUserEmail || input.email,
      encrypted_smtp_password: encryptSmtpPassword(input.smtpPassword),
      status: input.status || "active",
    })
    .select("*")
    .single();

  if (senderError) throw senderError;

  const { error: warmupError } = await supabase
    .from("sender_warmup_state")
    .upsert({
      sender_account_id: sender.id,
      warmup_start_date: new Date().toISOString().slice(0, 10),
      current_mode: "warmup_1",
    });

  if (warmupError) throw warmupError;
  return sender as T;
}

export async function createCampaignWithSetup<T>(userId: string, input: CreateCampaignInput) {
  if (!input.leadIds.length) {
    throw new Error("Select at least one lead for this campaign");
  }

  const supabase = createServerSupabase();
  await ensurePublicUserForClient(supabase, userId);

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .insert({
      user_id: userId,
      sender_account_id: input.senderAccountId,
      template_id: input.templateId,
      name: input.name,
      status: input.status,
    })
    .select("*")
    .single();

  if (campaignError) throw campaignError;

  const { error: runtimeError } = await supabase
    .from("campaign_runtime_config")
    .insert({
      campaign_id: campaign.id,
      timezone: input.timezone,
      start_hour: input.startHour,
      end_hour: input.endHour,
      active_days: input.activeDays,
      is_paused: input.isPaused,
    });

  if (runtimeError) throw runtimeError;

  const sequences = [
    {
      campaign_id: campaign.id,
      step_number: 1,
      template_id: input.templateId,
      delay_days: 0,
    },
  ];

  if (input.followupTemplateId) {
    sequences.push({
      campaign_id: campaign.id,
      step_number: 2,
      template_id: input.followupTemplateId,
      delay_days: input.followupDelayDays ?? 3,
    });
  }

  const { error: sequenceError } = await supabase.from("campaign_sequences").insert(sequences);
  if (sequenceError) throw sequenceError;

  const now = new Date().toISOString();
  const { error: leadsError } = await supabase.from("campaign_leads").upsert(
    input.leadIds.map((leadId) => ({
      campaign_id: campaign.id,
      lead_id: leadId,
      current_step: 0,
      next_send_at: now,
      status: "pending",
    })),
    { onConflict: "campaign_id,lead_id" },
  );

  if (leadsError) throw leadsError;
  return campaign as T;
}

export async function updateCampaignRuntimeConfig<T>(campaignId: string, input: RuntimeConfigInput) {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("campaign_runtime_config")
    .upsert(
      {
        campaign_id: campaignId,
        timezone: input.timezone,
        start_hour: input.startHour,
        end_hour: input.endHour,
        active_days: input.activeDays,
        is_paused: input.isPaused,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "campaign_id" },
    )
    .select("*")
    .single();

  if (error) throw error;
  return data as T;
}
