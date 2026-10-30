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
      categories: {
        Row: {
          color: string
          created_at: string
          id: string
          is_custom: boolean
          key: string
          label: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_custom?: boolean
          key: string
          label: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_custom?: boolean
          key?: string
          label?: string
        }
        Relationships: []
      }
      client_categories: {
        Row: {
          category_id: string
          client_id: string
          id: string
          quantity: number
        }
        Insert: {
          category_id: string
          client_id: string
          id?: string
          quantity?: number
        }
        Update: {
          category_id?: string
          client_id?: string
          id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_categories_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          active: boolean
          address: string | null
          comments: string | null
          created_at: string
          custom_frequency_days: number | null
          custom_frequency_label: string | null
          filters_no: number | null
          frequency: Database["public"]["Enums"]["frequency_type"]
          id: string
          job_details: string | null
          key_no: boolean
          name: string
          next_service_date: string
          phone: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          suburb: string | null
          time_notes: string | null
          updated_at: string
          van_id: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          comments?: string | null
          created_at?: string
          custom_frequency_days?: number | null
          custom_frequency_label?: string | null
          filters_no?: number | null
          frequency?: Database["public"]["Enums"]["frequency_type"]
          id?: string
          job_details?: string | null
          key_no?: boolean
          name: string
          next_service_date?: string
          phone?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          suburb?: string | null
          time_notes?: string | null
          updated_at?: string
          van_id?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          comments?: string | null
          created_at?: string
          custom_frequency_days?: number | null
          custom_frequency_label?: string | null
          filters_no?: number | null
          frequency?: Database["public"]["Enums"]["frequency_type"]
          id?: string
          job_details?: string | null
          key_no?: boolean
          name?: string
          next_service_date?: string
          phone?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          suburb?: string | null
          time_notes?: string | null
          updated_at?: string
          van_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_van_id_fkey"
            columns: ["van_id"]
            isOneToOne: false
            referencedRelation: "vans"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          client_id: string
          comments: string | null
          completed_at: string | null
          created_at: string
          driver_id: string | null
          finalized: boolean
          finalized_at: string | null
          finalized_by: string | null
          id: string
          invoice_amount: number | null
          invoice_number: string | null
          manual: boolean
          payment_amount: number | null
          photo_urls: string[]
          resolved: boolean
          scheduled_date: string
          status: Database["public"]["Enums"]["job_status"]
          van_id: string | null
        }
        Insert: {
          client_id: string
          comments?: string | null
          completed_at?: string | null
          created_at?: string
          driver_id?: string | null
          finalized?: boolean
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          invoice_amount?: number | null
          invoice_number?: string | null
          manual?: boolean
          payment_amount?: number | null
          photo_urls?: string[]
          resolved?: boolean
          scheduled_date: string
          status: Database["public"]["Enums"]["job_status"]
          van_id?: string | null
        }
        Update: {
          client_id?: string
          comments?: string | null
          completed_at?: string | null
          created_at?: string
          driver_id?: string | null
          finalized?: boolean
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          invoice_amount?: number | null
          invoice_number?: string | null
          manual?: boolean
          payment_amount?: number | null
          photo_urls?: string[]
          resolved?: boolean
          scheduled_date?: string
          status?: Database["public"]["Enums"]["job_status"]
          van_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_van_id_fkey"
            columns: ["van_id"]
            isOneToOne: false
            referencedRelation: "vans"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          data: Json
          id: string
          message: string | null
          read: boolean
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          message?: string | null
          read?: boolean
          title: string
          type: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          message?: string | null
          read?: boolean
          title?: string
          type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approved: boolean
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      runs: {
        Row: {
          created_at: string
          driver_id: string | null
          id: string
          notes: string | null
          run_date: string
          run_number: number
          status: string
          updated_at: string
          van_id: string | null
        }
        Insert: {
          created_at?: string
          driver_id?: string | null
          id?: string
          notes?: string | null
          run_date: string
          run_number: number
          status?: string
          updated_at?: string
          van_id?: string | null
        }
        Update: {
          created_at?: string
          driver_id?: string | null
          id?: string
          notes?: string | null
          run_date?: string
          run_number?: number
          status?: string
          updated_at?: string
          van_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "runs_van_id_fkey"
            columns: ["van_id"]
            isOneToOne: false
            referencedRelation: "vans"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_entries: {
        Row: {
          client_id: string
          created_at: string
          driver_id: string | null
          id: string
          job_id: string | null
          notes: string | null
          position: number
          run_id: string | null
          scheduled_date: string
          status: string
          updated_at: string
          van_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          driver_id?: string | null
          id?: string
          job_id?: string | null
          notes?: string | null
          position?: number
          run_id?: string | null
          scheduled_date: string
          status?: string
          updated_at?: string
          van_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          driver_id?: string | null
          id?: string
          job_id?: string | null
          notes?: string | null
          position?: number
          run_id?: string | null
          scheduled_date?: string
          status?: string
          updated_at?: string
          van_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_entries_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_entries_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_entries_van_id_fkey"
            columns: ["van_id"]
            isOneToOne: false
            referencedRelation: "vans"
            referencedColumns: ["id"]
          },
        ]
      }
      service_pauses: {
        Row: {
          client_id: string
          created_at: string
          end_date: string
          id: string
          reason: string | null
          start_date: string
        }
        Insert: {
          client_id: string
          created_at?: string
          end_date: string
          id?: string
          reason?: string | null
          start_date: string
        }
        Update: {
          client_id?: string
          created_at?: string
          end_date?: string
          id?: string
          reason?: string | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_pauses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
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
      vans: {
        Row: {
          created_at: string
          driver_id: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          driver_id?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          driver_id?: string | null
          id?: string
          name?: string
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
      app_role: "admin" | "driver"
      frequency_type:
        | "weekly"
        | "fortnightly"
        | "3weekly"
        | "monthly"
        | "6weekly"
        | "2monthly"
        | "3monthly"
        | "oncall"
        | "custom"
      job_status: "completed" | "missed"
      priority_level: "low" | "medium" | "high"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "driver"],
      frequency_type: [
        "weekly",
        "fortnightly",
        "3weekly",
        "monthly",
        "6weekly",
        "2monthly",
        "3monthly",
        "oncall",
        "custom",
      ],
      job_status: ["completed", "missed"],
      priority_level: ["low", "medium", "high"],
    },
  },
} as const
