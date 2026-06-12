export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      campaign_leads: {
        Row: {
          campaign_id: string
          completed_at: string | null
          created_at: string | null
          current_step: number | null
          id: string
          last_sent_at: string | null
          lead_id: string
          next_send_at: string | null
          reserved_at: string | null
          status: string | null
        }
        Insert: {
          campaign_id: string
          completed_at?: string | null
          created_at?: string | null
          current_step?: number | null
          id?: string
          last_sent_at?: string | null
          lead_id: string
          next_send_at?: string | null
          reserved_at?: string | null
          status?: string | null
        }
        Update: {
          campaign_id?: string
          completed_at?: string | null
          created_at?: string | null
          current_step?: number | null
          id?: string
          last_sent_at?: string | null
          lead_id?: string
          next_send_at?: string | null
          reserved_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_leads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_runtime_config: {
        Row: {
          active_days: number[] | null
          campaign_id: string
          end_hour: number | null
          id: string
          is_paused: boolean | null
          last_ran_at: string | null
          max_delay_minutes: number | null
          min_delay_minutes: number | null
          start_hour: number | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          active_days?: number[] | null
          campaign_id: string
          end_hour?: number | null
          id?: string
          is_paused?: boolean | null
          last_ran_at?: string | null
          max_delay_minutes?: number | null
          min_delay_minutes?: number | null
          start_hour?: number | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          active_days?: number[] | null
          campaign_id?: string
          end_hour?: number | null
          id?: string
          is_paused?: boolean | null
          last_ran_at?: string | null
          max_delay_minutes?: number | null
          min_delay_minutes?: number | null
          start_hour?: number | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_runtime_config_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_sequences: {
        Row: {
          campaign_id: string
          created_at: string | null
          delay_days: number | null
          deleted: boolean
          id: string
          step_number: number
          template_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          delay_days?: number | null
          deleted?: boolean
          id?: string
          step_number: number
          template_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          delay_days?: number | null
          deleted?: boolean
          id?: string
          step_number?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_sequences_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string | null
          default_delay_days: number | null
          id: string
          max_steps: number | null
          name: string
          sender_account_id: string
          status: string | null
          template_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          default_delay_days?: number | null
          id?: string
          max_steps?: number | null
          name: string
          sender_account_id: string
          status?: string | null
          template_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          default_delay_days?: number | null
          id?: string
          max_steps?: number | null
          name?: string
          sender_account_id?: string
          status?: string | null
          template_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_events: {
        Row: {
          campaign_lead_id: string | null
          created_at: string | null
          event_type: string
          id: string
          message_id: string | null
          provider_response: string | null
          sender_account_id: string | null
          sequence_id: string | null
          subject: string | null
        }
        Insert: {
          campaign_lead_id?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          message_id?: string | null
          provider_response?: string | null
          sender_account_id?: string | null
          sequence_id?: string | null
          subject?: string | null
        }
        Update: {
          campaign_lead_id?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          message_id?: string | null
          provider_response?: string | null
          sender_account_id?: string | null
          sequence_id?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_events_campaign_lead_id_fkey"
            columns: ["campaign_lead_id"]
            isOneToOne: false
            referencedRelation: "campaign_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_events_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "campaign_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          attachment_mime_type: string | null
          attachment_name: string | null
          attachment_path: string | null
          attachment_size: number | null
          attachment_url: string | null
          body_text: string | null
          created_at: string | null
          id: string
          name: string
          subject: string
          user_id: string
          is_published_to_global: boolean | null
        }
        Insert: {
          attachment_mime_type?: string | null
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          attachment_url?: string | null
          body_text?: string | null
          created_at?: string | null
          id?: string
          name: string
          subject: string
          user_id: string
          is_published_to_global?: boolean | null
        }
        Update: {
          attachment_mime_type?: string | null
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          attachment_url?: string | null
          body_text?: string | null
          created_at?: string | null
          id?: string
          name?: string
          subject?: string
          user_id?: string
          is_published_to_global?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      global_email_templates: {
        Row: {
          id: string
          original_template_id: string | null
          published_by_user_id: string | null
          name: string
          subject: string
          body_text: string | null
          preview_image_url: string | null
          preview_image_path: string | null
          category: string | null
          description: string | null
          is_published: boolean
          is_featured: boolean
          report_count: number
          add_count: number
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          original_template_id?: string | null
          published_by_user_id?: string | null
          name: string
          subject: string
          body_text?: string | null
          preview_image_url?: string | null
          preview_image_path?: string | null
          category?: string | null
          description?: string | null
          is_published?: boolean
          is_featured?: boolean
          report_count?: number
          add_count?: number
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          original_template_id?: string | null
          published_by_user_id?: string | null
          name?: string
          subject?: string
          body_text?: string | null
          preview_image_url?: string | null
          preview_image_path?: string | null
          category?: string | null
          description?: string | null
          is_published?: boolean
          is_featured?: boolean
          report_count?: number
          add_count?: number
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "global_email_templates_original_template_id_fkey"
            columns: ["original_template_id"]
            isOneToOne: true
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "global_email_templates_published_by_user_id_fkey"
            columns: ["published_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          company: string | null
          created_at: string | null
          email: string
          id: string
          linkedin_url: string | null
          metadata: Json | null
          name: string | null
          private: boolean | null
          role: string | null
          source: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string | null
          email: string
          id?: string
          linkedin_url?: string | null
          metadata?: Json | null
          name?: string | null
          private?: boolean | null
          role?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string | null
          email?: string
          id?: string
          linkedin_url?: string | null
          metadata?: Json | null
          name?: string | null
          private?: boolean | null
          role?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sender_accounts: {
        Row: {
          created_at: string | null
          display_name: string | null
          email: string
          encrypted_smtp_password: string | null
          health_score: number | null
          id: string
          last_sent_at: string | null
          live: string | null
          provider: string
          smtp_host: string | null
          smtp_port: number | null
          smtp_secure: boolean | null
          smtp_user_email: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          email: string
          encrypted_smtp_password?: string | null
          health_score?: number | null
          id?: string
          last_sent_at?: string | null
          live?: string | null
          provider: string
          smtp_host?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean | null
          smtp_user_email?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          email?: string
          encrypted_smtp_password?: string | null
          health_score?: number | null
          id?: string
          last_sent_at?: string | null
          live?: string | null
          provider?: string
          smtp_host?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean | null
          smtp_user_email?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sender_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sender_warmup_state: {
        Row: {
          current_mode: string | null
          sender_account_id: string
          updated_at: string | null
          warmup_start_date: string | null
        }
        Insert: {
          current_mode?: string | null
          sender_account_id: string
          updated_at?: string | null
          warmup_start_date?: string | null
        }
        Update: {
          current_mode?: string | null
          sender_account_id?: string
          updated_at?: string | null
          warmup_start_date?: string | null
        }
        Relationships: []
      }
      template_attachments: {
        Row: {
          created_at: string
          id: string
          mime_type: string
          name: string
          path: string
          size: number
          url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type?: string
          name: string
          path: string
          size?: number
          url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string
          name?: string
          path?: string
          size?: number
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          name?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_template_add_count: {
        Args: {
          p_template_id: string
        }
        Returns: number
      }
      rpc_check_campaign_to_run_v2: {
        Args: { p_user_id: string }
        Returns: {
          campaign_id: string
          should_run: boolean
        }[]
      }
      rpc_get_campaign_leads_to_send_v2: {
        Args: { p_campaign_id: string; p_limit: number; p_user_id: string }
        Returns: {
          attachment_mime_type: string
          attachment_name: string
          attachment_path: string
          attachment_size: number
          attachment_url: string
          campaign_id: string
          campaign_lead_id: string
          current_step: number
          encrypted_smtp_password: string
          lead_company: string
          lead_email: string
          lead_id: string
          lead_name: string
          lead_role: string
          sender_account_id: string
          sequence_id: string
          smtp_host: string
          smtp_live: boolean
          smtp_port: number
          smtp_secure: boolean
          smtp_user_email: string
          template_body: string
          template_id: string
          template_subject: string
        }[]
      }
      rpc_get_followups: {
        Args: never
        Returns: {
          company: string
          email: string
          id: string
          name: string
        }[]
      }
      rpc_get_leads_to_send: {
        Args: { p_limit: number }
        Returns: {
          company: string
          email: string
          id: string
          name: string
          role: string
        }[]
      }
      rpc_get_sender_state_v2: {
        Args: { p_sender_account_id: string }
        Returns: {
          current_mode: string
          daily_cap: number
          remaining_today: number
          sender_account_id: string
          sent_today: number
        }[]
      }
      rpc_get_sent_threads: {
        Args: never
        Returns: {
          message_id: string
          subject: string
        }[]
      }
      rpc_get_system_state: {
        Args: never
        Returns: {
          daily_cap: number
          mode: string
        }[]
      }
      rpc_mark_followup: {
        Args: { p_lead_id: string; p_message_id: string }
        Returns: undefined
      }
      rpc_mark_mail_failed_v2: {
        Args: { p_campaign_lead_id: string; p_reason: string }
        Returns: undefined
      }
      rpc_mark_mail_sent_v2: {
        Args: {
          p_campaign_lead_id: string
          p_message_id: string
          p_sender_account_id: string
          p_subject: string
        }
        Returns: undefined
      }
      rpc_mark_replied: { Args: { p_message_id: string }; Returns: undefined }
      rpc_mark_reply_detected_v2: {
        Args: { p_campaign_lead_id: string }
        Returns: undefined
      }
      rpc_mark_sent:
        | { Args: { p_lead_id: string; p_subject: string }; Returns: undefined }
        | {
            Args: { p_lead_id: string; p_message_id: string; p_subject: string }
            Returns: undefined
          }
      rpc_sync_warmup_mode: {
        Args: never
        Returns: {
          changed: boolean
          next_mode: string
          previous_mode: string
        }[]
      }
      rpc_upsert_lead: {
        Args: {
          p_company: string
          p_email: string
          p_name: string
          p_role: string
          p_source: string
        }
        Returns: undefined
      }
      sync_campaign_leads: {
        Args: { p_campaign_id: string; p_lead_ids: string[] }
        Returns: undefined
      }
      www_sync_campaign_leads: {
        Args: { p_campaign_id: string; p_lead_ids: string[] }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
