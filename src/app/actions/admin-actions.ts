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
  bodyText: string;
  attachmentName?: string | null;
  attachmentPath?: string | null;
  attachmentSize?: number | null;
  attachmentMimeType?: string | null;
  attachmentUrl?: string | null;
};

export type CreateLeadInput = {
  name: string;
  email: string;
  company?: string;
  role?: string;
  source?: string;
  status?: string;
  private?: boolean;
  user_id?: string | null;
  campaign_id?: string | null;
  linkedin_url?: string | null;
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

export type SequenceStepInput = {
  stepNumber: number;
  templateId: string;
  delayDays: number;
};

export type CreateCampaignInput = RuntimeConfigInput & {
  name: string;
  status: string;
  senderAccountId: string;
  templateId: string;
  leadIds: string[];
  /** Explicitly configured steps (overrides defaults for those positions) */
  steps: SequenceStepInput[];
  /** Total number of sequence steps, including default-filled ones */
  maxSteps: number;
  /** Default delay days for steps not explicitly configured */
  defaultDelayDays: number;
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
    name: string | null;
    email: string;
    company: string | null;
    role: string | null;
    source: string | null;
    status: string | null;
    last_contacted_at: string | null;
    created_at: string | null;
    updated_at: string | null;
  } | null;
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

  const [campaigns, leads, templates, senders, events] = await Promise.all([
    supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("user_id", userId ?? ""),
    supabase.from("leads").select("id", { count: "exact", head: true }).or(`user_id.eq.${userId ?? ""},private.eq.false`),
    supabase.from("email_templates").select("id", { count: "exact", head: true }).eq("user_id", userId ?? ""),
    supabase.from("sender_accounts").select("id", { count: "exact", head: true }).eq("user_id", userId ?? ""),
    userId
      ? supabase
          .from("email_events")
          .select("id, campaign_leads!inner(campaigns!inner(user_id))", { count: "exact", head: true })
          .eq("campaign_leads.campaigns.user_id", userId)
      : Promise.resolve({ count: 0, error: null }),
  ]);

  const firstError = campaigns.error ?? leads.error ?? templates.error ?? senders.error ?? events.error;
  if (firstError) throw firstError;

  return {
    campaigns: campaigns.count ?? 0,
    leads: leads.count ?? 0,
    templates: templates.count ?? 0,
    senders: senders.count ?? 0,
    events: events.count ?? 0,
  } satisfies DashboardStats;
}

export async function fetchTemplates<T>(
  userId: string,
  page?: number,
  limit?: number
): Promise<{ data: T[]; count: number }> {
  const supabase = createServerSupabase();
  let query = supabase
    .from("email_templates")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (page !== undefined && limit !== undefined) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);
  }

  const { data, error, count } = await query;

  if (error) throw error;
  return {
    data: (data ?? []) as T[],
    count: count ?? 0,
  };
}

export async function fetchCampaigns<T>(
  userId: string,
  page?: number,
  limit?: number
): Promise<{ data: T[]; count: number }> {
  const supabase = createServerSupabase();
  let query = supabase
    .from("campaigns")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (page !== undefined && limit !== undefined) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);
  }

  const { data, error, count } = await query;

  if (error) throw error;
  return {
    data: (data ?? []) as T[],
    count: count ?? 0,
  };
}

export async function fetchLeads<T>(
  userId?: string,
  page?: number,
  limit?: number
): Promise<{ data: T[]; count: number }> {
  const supabase = createServerSupabase();

  let query = supabase.from("leads").select("*", { count: "exact" });

  if (userId) {
    query = query.or(`user_id.eq.${userId},private.eq.false`);
  } else {
    query = query.eq("private", false);
  }

  query = query.order("updated_at", { ascending: false });

  if (page !== undefined && limit !== undefined) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);
  }

  const { data, error, count } = await query;

  if (error) throw error;
  return {
    data: (data ?? []) as T[],
    count: count ?? 0,
  };
}

export async function fetchRuntimeConfigs<T>(campaignId?: string) {
  const supabase = createServerSupabase();
  let query = supabase.from("campaign_runtime_config").select("*");
  if (campaignId) {
    query = query.eq("campaign_id", campaignId);
  }
  const { data, error } = await query.order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as T[];
}

export async function fetchCampaignRuntimeConfig<T>(campaignId: string) {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("campaign_runtime_config")
    .select("*")
    .eq("campaign_id", campaignId)
    .maybeSingle();
  if (error) throw error;
  return data as T | null;
}

export async function fetchCampaignSequences<T>(campaignId: string) {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("campaign_sequences")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("deleted", false)
    .order("step_number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as T[];
}

export async function upsertCampaignSequences(campaignId: string, steps: SequenceStepInput[]) {
  const supabase = createServerSupabase();

  const {error: deleteError} = await supabase
  .from("campaign_sequences")
  .update({ deleted: true })
  .eq("campaign_id", campaignId);

  if (deleteError) throw deleteError;

  if (!steps.length) return;

  const {error: insertError} = await supabase
    .from("campaign_sequences")
    .upsert(
      steps.map((s) => ({
        campaign_id: campaignId,
        step_number: s.stepNumber,
        template_id: s.templateId,
        delay_days: s.delayDays,
        deleted: false,
      })),
      {
        onConflict: "campaign_id,step_number",
      }
  );

  if (insertError) throw insertError;
}

export async function fetchSenders<T>(
  userId: string,
  page?: number,
  limit?: number
): Promise<{ data: T[]; count: number }> {
  const supabase = createServerSupabase();
  let query = supabase
    .from("sender_accounts")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (page !== undefined && limit !== undefined) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);
  }

  const { data, error, count } = await query;

  if (error) throw error;
  return {
    data: (data ?? []) as T[],
    count: count ?? 0,
  };
}

export async function fetchEvents<T>(
  page?: number,
  limit?: number
): Promise<{ data: T[]; count: number }> {
  const supabase = createServerSupabase();
  let query = supabase
    .from("email_events")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (page !== undefined && limit !== undefined) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);
  }

  const { data, error, count } = await query;

  if (error) throw error;
  return {
    data: (data ?? []) as T[],
    count: count ?? 0,
  };
}

export async function fetchUserEvents<T>(
  userId: string,
  page?: number,
  limit?: number
): Promise<{ data: T[]; count: number }> {
  const supabase = createServerSupabase();

  let query = supabase
    .from("email_events")
    .select(`
      *,
      campaign_leads!inner(
        campaigns!inner(id)
      )
    `, { count: "exact" })
    .eq("campaign_leads.campaigns.user_id", userId)
    .order("created_at", { ascending: false });

  if (page !== undefined && limit !== undefined) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);
  }

  const { data, error, count } = await query;

  if (error) throw error;
  return {
    data: (data ?? []) as T[],
    count: count ?? 0,
  };
}

export async function fetchUserEventsStats(userId: string) {
  const supabase = createServerSupabase();
  const [totalRes, sentRes, replyRes] = await Promise.all([
    supabase
      .from("email_events")
      .select("id, campaign_leads!inner(campaigns!inner(user_id))", { count: "exact", head: true })
      .eq("campaign_leads.campaigns.user_id", userId),
    supabase
      .from("email_events")
      .select("id, campaign_leads!inner(campaigns!inner(user_id))", { count: "exact", head: true })
      .eq("campaign_leads.campaigns.user_id", userId)
      .eq("event_type", "sent"),
    supabase
      .from("email_events")
      .select("id, campaign_leads!inner(campaigns!inner(user_id))", { count: "exact", head: true })
      .eq("campaign_leads.campaigns.user_id", userId)
      .eq("event_type", "replied"),
  ]);
  return {
    total: totalRes.count ?? 0,
    sent: sentRes.count ?? 0,
    replied: replyRes.count ?? 0,
  };
}

export async function fetchCampaignLeadDetails(userId: string, campaignId: string) {
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("campaign_leads")
    .select(`
      *,
      leads(*),
      campaigns!inner(id, user_id)
    `)
    .eq("campaign_id", campaignId)
    .eq("campaigns.user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as CampaignLeadDetail[];
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
      body_text: input.bodyText,
      attachment_name: input.attachmentName || null,
      attachment_path: input.attachmentPath || null,
      attachment_size: input.attachmentSize || null,
      attachment_mime_type: input.attachmentMimeType || null,
      attachment_url: input.attachmentUrl || null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as T;
}

export async function updateTemplate<T>(
  userId: string,
  templateId: string,
  input: {
    name: string;
    subject: string;
    bodyText: string;
    attachmentName?: string | null;
    attachmentPath?: string | null;
    attachmentSize?: number | null;
    attachmentMimeType?: string | null;
    attachmentUrl?: string | null;
  }
) {
  const supabase = createServerSupabase();
  await ensurePublicUserForClient(supabase, userId);

  const { data, error } = await supabase
    .from("email_templates")
    .update({
      name: input.name,
      subject: input.subject,
      body_text: input.bodyText,
      attachment_name: input.attachmentName ?? null,
      attachment_path: input.attachmentPath ?? null,
      attachment_size: input.attachmentSize ?? null,
      attachment_mime_type: input.attachmentMimeType ?? null,
      attachment_url: input.attachmentUrl ?? null,
    })
    .eq("id", templateId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw error;
  return data as T;
}

// ─── PDF Attachment Library ──────────────────────────────────────────────────

const MAX_TOTAL_STORAGE = 100 * 1024 * 1024; // 100 MB per user
const MAX_FILE_SIZE = 10 * 1024 * 1024;       // 10 MB per file

export async function fetchUserAttachments<T>(userId: string) {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("template_attachments")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as T[];
}

export async function getUserStorageUsed(userId: string): Promise<number> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("template_attachments")
    .select("size")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).reduce((sum, row) => sum + ((row as { size: number }).size ?? 0), 0);
}

export async function uploadAndRegisterAttachment(formData: FormData) {
  const file = formData.get("file") as File;
  const userId = formData.get("userId") as string;

  if (!file || !userId) throw new Error("Missing file or userId");
  if (file.type !== "application/pdf") throw new Error("Only PDF files are allowed");
  if (file.size > MAX_FILE_SIZE) throw new Error("File exceeds the 10 MB limit");

  // Enforce 100 MB per-user quota
  const used = await getUserStorageUsed(userId);
  const remaining = MAX_TOTAL_STORAGE - used;
  if (file.size > remaining) {
    const remainMB = (remaining / (1024 * 1024)).toFixed(1);
    throw new Error(`Storage limit reached. You have ${remainMB} MB remaining.`);
  }

  const supabase = createServerSupabase();
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${userId}/${timestamp}-${safeName}`;

  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from("template-attachments")
    .upload(storagePath, fileBuffer, { contentType: file.type, upsert: false });

  if (uploadError) throw uploadError;

  // 1-year signed URL
  const { data: urlData, error: urlError } = await supabase.storage
    .from("template-attachments")
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

  if (urlError) throw urlError;

  // Register in library table
  const { data, error: insertError } = await supabase
    .from("template_attachments")
    .insert({
      user_id: userId,
      name: file.name,
      path: storagePath,
      size: file.size,
      mime_type: file.type,
      url: urlData.signedUrl,
    })
    .select("*")
    .single();

  if (insertError) throw insertError;
  return data;
}

export async function deleteAttachmentRecord(
  userId: string,
  attachmentId: string,
  attachmentPath: string,
) {
  const supabase = createServerSupabase();
  await ensurePublicUserForClient(supabase, userId);

  // Remove from storage (non-fatal if already gone)
  await supabase.storage.from("template-attachments").remove([attachmentPath]);

  const { error } = await supabase
    .from("template_attachments")
    .delete()
    .eq("id", attachmentId)
    .eq("user_id", userId);

  if (error) throw error;
  return true;
}

export async function deleteTemplate(userId: string, templateId: string) {
  const supabase = createServerSupabase();
  await ensurePublicUserForClient(supabase, userId);

  const { error } = await supabase
    .from("email_templates")
    .delete()
    .eq("id", templateId)
    .eq("user_id", userId);

  if (error) throw error;
  return true;
}


export async function createLead<T>(input: CreateLeadInput) {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("leads")
    .insert({
      name: input.name,
      email: input.email,
      company: input.company || null,
      role: input.role || null,
      source: input.source || "csv",
      status: input.status || "new",
      private: input.private ?? true,
      user_id: input.user_id ?? null,
      linkedin_url: input.linkedin_url || null,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        data: null,
        error: "Lead already exists in your contact list or in global contact list. To add it in your compaign either get it from global contact list or from your contact list",
      };
    }

    return { data: null, error: error.message };
  }

  if (input.campaign_id && data) {
    const now = new Date().toISOString();
    await supabase.from("campaign_leads").upsert({
      campaign_id: input.campaign_id,
      lead_id: data.id,
      current_step: 0,
      next_send_at: now,
      status: "pending",
    },
    {
      onConflict: "campaign_id,lead_id"
    });
  }

  return data as T;
}

export type BulkImportLeadsResult = {
  imported: number;
  skipped: number;
  errors: { row: number; email: string; reason: string }[];
};

export async function bulkImportLeads(
  userId: string,
  rows: { name: string; email: string; company?: string; role?: string; linkedin_url?: string; linkedin?: string }[],
  campaignId?: string | null
): Promise<BulkImportLeadsResult> {
  const supabase = createServerSupabase();
  await ensurePublicUserForClient(supabase, userId);

  const result: BulkImportLeadsResult = { imported: 0, skipped: 0, errors: [] };
  const insertedLeadIds: string[] = [];

  // Upsert leads in chunks of 50
  const CHUNK = 50;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("leads")
      .insert(
        chunk.map((row) => ({
          name: row.name || null,
          email: row.email,
          company: row.company || null,
          role: row.role || null,
          source: "csv",
          status: "new",
          private: true,
          user_id: userId,
          linkedin_url: row.linkedin_url || row.linkedin || null,
        }))
      )
      .select("id, email");

    if (error) {
      chunk.forEach((row, j) => {
        if (error.code === "23505") {
          error.message = "Lead already exists in your contact list or in global contact list";
        }
        result.errors.push({ row: i + j + 1, email: row.email, reason: error.message });
        result.skipped++;
      });
    } else {
      result.imported += data?.length ?? 0;
      insertedLeadIds.push(...(data ?? []).map((d) => d.id));
    }
  }

  // Attach to campaign if specified
  if (campaignId && insertedLeadIds.length > 0) {
    const now = new Date().toISOString();
    // Only attach leads not already in the campaign
    const { data: existing } = await supabase
      .from("campaign_leads")
      .select("lead_id")
      .eq("campaign_id", campaignId)
      .in("lead_id", insertedLeadIds);

    const existingIds = new Set((existing ?? []).map((e) => e.lead_id));
    const toAttach = insertedLeadIds.filter((id) => !existingIds.has(id));

    if (toAttach.length > 0) {
      await supabase.from("campaign_leads").insert(
        toAttach.map((leadId) => ({
          campaign_id: campaignId,
          lead_id: leadId,
          current_step: 0,
          next_send_at: now,
          status: "pending",
        }))
      );
    }
  }

  return result;
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
      template_id: input.templateId || null,
      name: input.name,
      status: input.status,
      max_steps: input.maxSteps,
      default_delay_days: input.defaultDelayDays,
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

  // Expand steps: fill 1..maxSteps, using explicit steps for configured positions,
  // defaulting to templateId + defaultDelayDays for the rest.
  const expandedSteps: SequenceStepInput[] = Array.from(
    { length: input.maxSteps },
    (_, i) => {
      const custom = input.steps[i]; // explicit steps are positional (0-indexed)
      return {
        stepNumber: i + 1,
        templateId: custom?.templateId || input.templateId,
        delayDays: custom ? Number(custom.delayDays) : input.defaultDelayDays,
      };
    }
  );

  const { error: sequenceError } = await supabase.from("campaign_sequences").insert(
    expandedSteps.map((s) => ({
      campaign_id: campaign.id,
      step_number: s.stepNumber,
      template_id: s.templateId,
      delay_days: s.delayDays,
    }))
  );
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

export async function updateLead<T>(id: string, input: CreateLeadInput) {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("leads")
    .update({
      name: input.name,
      email: input.email,
      company: input.company || null,
      role: input.role || null,
      source: input.source || "csv",
      status: input.status || "new",
      private: input.private ?? true,
      linkedin_url: input.linkedin_url || null,

    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as T;
}

export async function deleteLead(userId: string, id: string) {
  const supabase = createServerSupabase();
  await ensurePublicUserForClient(supabase, userId);

  const { data: lead, error: fetchError } = await supabase
    .from("leads")
    .select("user_id")
    .eq("id", id)
    .single();

  if (fetchError) throw fetchError;
  if (!lead) throw new Error("Lead not found");

  if (lead.user_id !== userId) {
    throw new Error("You are not authorized to delete this lead as you are not the owner.");
  }

  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) throw error;
  return true;
}

export async function updateSenderAccount<T>(
  userId: string,
  id: string,
  input: {
    email: string;
    displayName?: string;
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    smtpUserEmail?: string;
    smtpPassword?: string;
  }
) {
  const supabase = createServerSupabase();
  await ensurePublicUserForClient(supabase, userId);

  const updates: any = {
    email: input.email,
    display_name: input.displayName || null,
    smtp_host: input.smtpHost,
    smtp_port: input.smtpPort,
    smtp_secure: input.smtpSecure,
    smtp_user_email: input.smtpUserEmail || input.email,
  };

  if (input.smtpPassword) {
    updates.encrypted_smtp_password = encryptSmtpPassword(input.smtpPassword);
  }

  const { data, error } = await supabase
    .from("sender_accounts")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw error;
  return data as T;
}

export async function deleteSenderAccount(userId: string, id: string) {
  const supabase = createServerSupabase();
  await ensurePublicUserForClient(supabase, userId);
  const { error } = await supabase
    .from("sender_accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
  return true;
}

export async function updateCampaign<T>(
  userId: string,
  id: string,
  input: {
    name: string;
    status: string;
    senderAccountId: string;
    templateId: string;
    maxSteps: number;
    defaultDelayDays: number;
    leadIds?: string[];
  }
) {
  const supabase = createServerSupabase();
  await ensurePublicUserForClient(supabase, userId);

  const { data, error } = await supabase
    .from("campaigns")
    .update({
      name: input.name,
      status: input.status,
      sender_account_id: input.senderAccountId,
      template_id: input.templateId || null,
      max_steps: input.maxSteps,
      default_delay_days: input.defaultDelayDays,
    })
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw error;

  if (input.leadIds) {
    const { error } = await supabase.rpc(
      "www_sync_campaign_leads",
      {
        p_campaign_id: id,
        p_lead_ids: input.leadIds,
      }
    );

    if (error) throw error;
  }

  return data as T;
}

export async function deleteCampaign(userId: string, id: string) {
  const supabase = createServerSupabase();
  await ensurePublicUserForClient(supabase, userId);
  const { error } = await supabase
    .from("campaigns")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
  return true;
}

export async function addLeadsToCampaign(campaignId: string, leadIds: string[]) {
  const supabase = createServerSupabase();
  const now = new Date().toISOString();

  // Only attach leads not already in the campaign
  const { data: existing } = await supabase
    .from("campaign_leads")
    .select("lead_id")
    .eq("campaign_id", campaignId)
    .in("lead_id", leadIds);

  const existingIds = new Set((existing ?? []).map((e) => e.lead_id));
  const toAttach = leadIds.filter((id) => !existingIds.has(id));

  if (toAttach.length > 0) {
    const { error } = await supabase.from("campaign_leads").insert(
      toAttach.map((leadId) => ({
        campaign_id: campaignId,
        lead_id: leadId,
        current_step: 0,
        next_send_at: now,
        status: "pending",
      }))
    );
    if (error) throw error;
  }

  return {
    attachedCount: toAttach.length,
    alreadyAttachedCount: leadIds.length - toAttach.length,
  };
}

