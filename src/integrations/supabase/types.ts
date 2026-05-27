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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      campaign_leads: {
        Row: {
          campaign_id: string
          completed_at: string | null
          created_at: string
          current_step: number
          id: string
          last_sent_at: string | null
          lead_id: string
          next_send_at: string | null
          reserved_at: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          completed_at?: string | null
          created_at?: string
          current_step?: number
          id?: string
          last_sent_at?: string | null
          lead_id: string
          next_send_at?: string | null
          reserved_at?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          completed_at?: string | null
          created_at?: string
          current_step?: number
          id?: string
          last_sent_at?: string | null
          lead_id?: string
          next_send_at?: string | null
          reserved_at?: string | null
          status?: string
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
          created_at: string
          delay_days: number
          id: string
          step_number: number
          template_id: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          delay_days?: number
          id?: string
          step_number: number
          template_id?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          delay_days?: number
          id?: string
          step_number?: number
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_sequences_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_sequences_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          default_delay_days: number | null
          id: string
          max_steps: number | null
          name: string
          sender_account_id: string | null
          status: string
          template_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          default_delay_days?: number | null
          id?: string
          max_steps?: number | null
          name: string
          sender_account_id?: string | null
          status?: string
          template_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          default_delay_days?: number | null
          id?: string
          max_steps?: number | null
          name?: string
          sender_account_id?: string | null
          status?: string
          template_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_sender_account_id_fkey"
            columns: ["sender_account_id"]
            isOneToOne: false
            referencedRelation: "sender_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_events: {
        Row: {
          campaign_lead_id: string
          created_at: string
          event_type: string
          id: string
          message_id: string | null
          provider_response: string | null
          sender_account_id: string | null
          sequence_id: string | null
          subject: string | null
        }
        Insert: {
          campaign_lead_id: string
          created_at?: string
          event_type: string
          id?: string
          message_id?: string | null
          provider_response?: string | null
          sender_account_id?: string | null
          sequence_id?: string | null
          subject?: string | null
        }
        Update: {
          campaign_lead_id?: string
          created_at?: string
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
            foreignKeyName: "email_events_sender_account_id_fkey"
            columns: ["sender_account_id"]
            isOneToOne: false
            referencedRelation: "sender_accounts"
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
          body_html: string | null
          body_text: string | null
          created_at: string
          id: string
          name: string
          subject: string
          user_id: string
          variables: Json | null
        }
        Insert: {
          attachment_mime_type?: string | null
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          attachment_url?: string | null
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          id?: string
          name: string
          subject?: string
          user_id: string
          variables?: Json | null
        }
        Update: {
          attachment_mime_type?: string | null
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          attachment_url?: string | null
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          id?: string
          name?: string
          subject?: string
          user_id?: string
          variables?: Json | null
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
      leads: {
        Row: {
          company: string | null
          created_at: string | null
          email: string
          id: string
          last_contacted_at: string | null
          name: string | null
          private: boolean
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
          last_contacted_at?: string | null
          name?: string | null
          private?: boolean
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
          last_contacted_at?: string | null
          name?: string | null
          private?: boolean
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
          }
        ]
      }
      sender_accounts: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          encrypted_smtp_password: string | null
          health_score: number | null
          id: string
          last_sent_at: string | null
          live: string | null
          provider: string | null
          smtp_host: string | null
          smtp_port: number | null
          smtp_secure: boolean | null
          smtp_user_email: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          encrypted_smtp_password?: string | null
          health_score?: number | null
          id?: string
          last_sent_at?: string | null
          live?: string | null
          provider?: string | null
          smtp_host?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean | null
          smtp_user_email?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          encrypted_smtp_password?: string | null
          health_score?: number | null
          id?: string
          last_sent_at?: string | null
          live?: string | null
          provider?: string | null
          smtp_host?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean | null
          smtp_user_email?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      sender_warmup_state: {
        Row: {
          current_mode: string | null
          sender_account_id: string
          updated_at: string
          warmup_start_date: string | null
        }
        Insert: {
          current_mode?: string | null
          sender_account_id: string
          updated_at?: string
          warmup_start_date?: string | null
        }
        Update: {
          current_mode?: string | null
          sender_account_id?: string
          updated_at?: string
          warmup_start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sender_warmup_state_sender_account_id_fkey"
            columns: ["sender_account_id"]
            isOneToOne: true
            referencedRelation: "sender_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          name?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
