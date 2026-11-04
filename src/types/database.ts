export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      cover_letters: {
        Row: {
          company_name: string;
          created_at: string;
          id: string;
          job_title: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          company_name: string;
          created_at?: string;
          id?: string;
          job_title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          company_name?: string;
          created_at?: string;
          id?: string;
          job_title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      essay_items: {
        Row: {
          answer: string;
          cover_letter_id: string;
          created_at: string;
          id: string;
          position: number;
          question: string;
        };
        ComputedFields: never;
        Insert: {
          answer?: string;
          cover_letter_id: string;
          created_at?: string;
          id?: string;
          position?: number;
          question: string;
        };
        Update: {
          answer?: string;
          cover_letter_id?: string;
          created_at?: string;
          id?: string;
          position?: number;
          question?: string;
        };
        Relationships: [
          {
            foreignKeyName: "essay_items_cover_letter_id_fkey";
            columns: ["cover_letter_id"];
            isOneToOne: false;
            referencedRelation: "cover_letters";
            referencedColumns: ["id"];
          },
        ];
      };
      experiences: {
        Row: {
          content: string;
          cover_letter_id: string;
          created_at: string;
          id: string;
          position: number;
        };
        ComputedFields: never;
        Insert: {
          content: string;
          cover_letter_id: string;
          created_at?: string;
          id?: string;
          position?: number;
        };
        Update: {
          content?: string;
          cover_letter_id?: string;
          created_at?: string;
          id?: string;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "experiences_cover_letter_id_fkey";
            columns: ["cover_letter_id"];
            isOneToOne: false;
            referencedRelation: "cover_letters";
            referencedColumns: ["id"];
          },
        ];
      };
      interview_questions: {
        Row: {
          answer_audio_path: string | null;
          answer_transcript: string | null;
          answered_at: string | null;
          asked_at: string | null;
          id: string;
          interview_id: string;
          order_index: number;
          parent_question_id: string | null;
          question_text: string;
          type: string;
        };
        ComputedFields: never;
        Insert: {
          answer_audio_path?: string | null;
          answer_transcript?: string | null;
          answered_at?: string | null;
          asked_at?: string | null;
          id?: string;
          interview_id: string;
          order_index: number;
          parent_question_id?: string | null;
          question_text: string;
          type: string;
        };
        Update: {
          answer_audio_path?: string | null;
          answer_transcript?: string | null;
          answered_at?: string | null;
          asked_at?: string | null;
          id?: string;
          interview_id?: string;
          order_index?: number;
          parent_question_id?: string | null;
          question_text?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "interview_questions_interview_id_fkey";
            columns: ["interview_id"];
            isOneToOne: false;
            referencedRelation: "interviews";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "interview_questions_parent_question_id_interview_id_fkey";
            columns: ["parent_question_id", "interview_id"];
            isOneToOne: false;
            referencedRelation: "interview_questions";
            referencedColumns: ["id", "interview_id"];
          },
        ];
      };
      interviews: {
        Row: {
          cover_letter_id: string;
          created_at: string;
          duration_seconds: number | null;
          ended_at: string | null;
          id: string;
          recording_path: string | null;
          started_at: string;
          status: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          cover_letter_id: string;
          created_at?: string;
          duration_seconds?: number | null;
          ended_at?: string | null;
          id?: string;
          recording_path?: string | null;
          started_at?: string;
          status?: string;
          user_id: string;
        };
        Update: {
          cover_letter_id?: string;
          created_at?: string;
          duration_seconds?: number | null;
          ended_at?: string | null;
          id?: string;
          recording_path?: string | null;
          started_at?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "interviews_cover_letter_id_user_id_fkey";
            columns: ["cover_letter_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "cover_letters";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
