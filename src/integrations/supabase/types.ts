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
      alert_deliveries: {
        Row: {
          alert_id: string
          channel: string
          delivered_at: string
          id: string
          read_at: string | null
          source_id: string
        }
        Insert: {
          alert_id: string
          channel: string
          delivered_at?: string
          id?: string
          read_at?: string | null
          source_id: string
        }
        Update: {
          alert_id?: string
          channel?: string
          delivered_at?: string
          id?: string
          read_at?: string | null
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_deliveries_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_deliveries_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          channels: string[]
          created_at: string
          created_by: string
          frequency: Database["public"]["Enums"]["alert_frequency"]
          id: string
          is_active: boolean
          keyword_query: string | null
          last_run_at: string | null
          name: string
          priority: Database["public"]["Enums"]["alert_priority"]
          source_types: Database["public"]["Enums"]["source_type"][] | null
          topic_tags: string[]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          channels?: string[]
          created_at?: string
          created_by: string
          frequency?: Database["public"]["Enums"]["alert_frequency"]
          id?: string
          is_active?: boolean
          keyword_query?: string | null
          last_run_at?: string | null
          name: string
          priority?: Database["public"]["Enums"]["alert_priority"]
          source_types?: Database["public"]["Enums"]["source_type"][] | null
          topic_tags?: string[]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          channels?: string[]
          created_at?: string
          created_by?: string
          frequency?: Database["public"]["Enums"]["alert_frequency"]
          id?: string
          is_active?: boolean
          keyword_query?: string | null
          last_run_at?: string | null
          name?: string
          priority?: Database["public"]["Enums"]["alert_priority"]
          source_types?: Database["public"]["Enums"]["source_type"][] | null
          topic_tags?: string[]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          embedding: string | null
          id: string
          model_version: string
          section_ref: string | null
          source_id: string
          token_count: number | null
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          model_version?: string
          section_ref?: string | null
          source_id: string
          token_count?: number | null
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          model_version?: string
          section_ref?: string | null
          source_id?: string
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chunks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          author_id: string
          body: string | null
          created_at: string
          id: string
          is_pinned: boolean
          linked_source_id: string | null
          tags: string[]
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          author_id: string
          body?: string | null
          created_at?: string
          id?: string
          is_pinned?: boolean
          linked_source_id?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          author_id?: string
          body?: string | null
          created_at?: string
          id?: string
          is_pinned?: boolean
          linked_source_id?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_linked_source_id_fkey"
            columns: ["linked_source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          job_title: string | null
          organization: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          job_title?: string | null
          organization?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          job_title?: string | null
          organization?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      saved_searches: {
        Row: {
          created_at: string
          filters: Json
          id: string
          query: string
          results_count: number | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          query: string
          results_count?: number | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          query?: string
          results_count?: number | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_searches_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      search_logs: {
        Row: {
          created_at: string
          id: string
          latency_ms: number | null
          query: string
          results_count: number | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          latency_ms?: number | null
          query: string
          results_count?: number | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          latency_ms?: number | null
          query?: string
          results_count?: number | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "search_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          document_number: string | null
          excerpt: string | null
          external_id: string | null
          fts: unknown
          full_text: string | null
          id: string
          ingested_at: string
          official_url: string
          publication_date: string
          related_source_ids: string[] | null
          source_type: Database["public"]["Enums"]["source_type"]
          summary: string | null
          title: string
          topic_tags: string[]
          updated_at: string
        }
        Insert: {
          document_number?: string | null
          excerpt?: string | null
          external_id?: string | null
          fts?: unknown
          full_text?: string | null
          id?: string
          ingested_at?: string
          official_url: string
          publication_date: string
          related_source_ids?: string[] | null
          source_type: Database["public"]["Enums"]["source_type"]
          summary?: string | null
          title: string
          topic_tags?: string[]
          updated_at?: string
        }
        Update: {
          document_number?: string | null
          excerpt?: string | null
          external_id?: string | null
          fts?: unknown
          full_text?: string | null
          id?: string
          ingested_at?: string
          official_url?: string
          publication_date?: string
          related_source_ids?: string[] | null
          source_type?: Database["public"]["Enums"]["source_type"]
          summary?: string | null
          title?: string
          topic_tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      topics: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["workspace_member_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workspace_member_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workspace_member_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          plan: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          plan?: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          plan?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_workspace_with_owner: {
        Args: { _name: string; _slug: string }
        Returns: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          plan: string
          slug: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "workspaces"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      match_chunks: {
        Args: {
          filter_topics?: string[]
          match_count?: number
          query_embedding: string
        }
        Returns: {
          chunk_id: string
          content: string
          document_number: string
          official_url: string
          publication_date: string
          section_ref: string
          similarity: number
          source_id: string
          source_title: string
          source_type: Database["public"]["Enums"]["source_type"]
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      workspace_role: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: Database["public"]["Enums"]["workspace_member_role"]
      }
    }
    Enums: {
      alert_frequency: "immediata" | "giornaliera" | "settimanale"
      alert_priority: "alta" | "media" | "bassa"
      app_role: "admin" | "editor" | "viewer"
      source_type:
        | "circolare"
        | "messaggio"
        | "decreto"
        | "pagina_servizio"
        | "normativa"
      workspace_member_role: "owner" | "admin" | "member"
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
      alert_frequency: ["immediata", "giornaliera", "settimanale"],
      alert_priority: ["alta", "media", "bassa"],
      app_role: ["admin", "editor", "viewer"],
      source_type: [
        "circolare",
        "messaggio",
        "decreto",
        "pagina_servizio",
        "normativa",
      ],
      workspace_member_role: ["owner", "admin", "member"],
    },
  },
} as const
