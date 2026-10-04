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
      announcements: {
        Row: {
          audience: string
          body: string
          branch_id: string | null
          created_at: string
          created_by: string | null
          id: string
          title: string
        }
        Insert: {
          audience?: string
          body: string
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          title: string
        }
        Update: {
          audience?: string
          body?: string
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity: string | null
          entity_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      batches: {
        Row: {
          branch_id: string
          capacity: number | null
          classroom: string | null
          created_at: string
          end_time: string | null
          id: string
          is_active: boolean
          name: string
          start_time: string | null
          subject: string | null
          updated_at: string
        }
        Insert: {
          branch_id: string
          capacity?: number | null
          classroom?: string | null
          created_at?: string
          end_time?: string | null
          id?: string
          is_active?: boolean
          name: string
          start_time?: string | null
          subject?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string
          capacity?: number | null
          classroom?: string | null
          created_at?: string
          end_time?: string | null
          id?: string
          is_active?: boolean
          name?: string
          start_time?: string | null
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          city: string | null
          code: string
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          manager_name: string | null
          name: string
          phone: string | null
          updated_at: string
          working_hours: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          code: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          manager_name?: string | null
          name: string
          phone?: string | null
          updated_at?: string
          working_hours?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          manager_name?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
          working_hours?: string | null
        }
        Relationships: []
      }
      homework: {
        Row: {
          attachment_url: string | null
          batch_id: string
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          subject: string | null
          title: string
          updated_at: string
        }
        Insert: {
          attachment_url?: string | null
          batch_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          subject?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          attachment_url?: string | null
          batch_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          subject?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          attachment_url: string | null
          created_at: string
          end_date: string
          id: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason: string
          remarks: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          teacher_id: string
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string
          end_date: string
          id?: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason: string
          remarks?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["leave_status"]
          teacher_id: string
        }
        Update: {
          attachment_url?: string | null
          created_at?: string
          end_date?: string
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type"]
          reason?: string
          remarks?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_status"]
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      lectures: {
        Row: {
          acknowledged_at: string | null
          batch_id: string
          branch_id: string
          classroom: string | null
          created_at: string
          created_by: string | null
          end_time: string
          id: string
          lecture_date: string
          start_time: string
          status: Database["public"]["Enums"]["lecture_status"]
          subject: string
          teacher_id: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          batch_id: string
          branch_id: string
          classroom?: string | null
          created_at?: string
          created_by?: string | null
          end_time: string
          id?: string
          lecture_date: string
          start_time: string
          status?: Database["public"]["Enums"]["lecture_status"]
          subject: string
          teacher_id: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          batch_id?: string
          branch_id?: string
          classroom?: string | null
          created_at?: string
          created_by?: string | null
          end_time?: string
          id?: string
          lecture_date?: string
          start_time?: string
          status?: Database["public"]["Enums"]["lecture_status"]
          subject?: string
          teacher_id?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lectures_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lectures_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lectures_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          batch_id: string
          created_at: string
          description: string | null
          file_url: string | null
          id: string
          subject: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          batch_id: string
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          subject?: string | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          batch_id?: string
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          subject?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notes_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id: string
          phone?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      salary_payments: {
        Row: {
          base_salary: number
          bonus: number
          created_at: string
          created_by: string | null
          deductions: number
          id: string
          is_paid: boolean
          month: number
          net_amount: number
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          teacher_id: string
          updated_at: string
          year: number
        }
        Insert: {
          base_salary?: number
          bonus?: number
          created_at?: string
          created_by?: string | null
          deductions?: number
          id?: string
          is_paid?: boolean
          month: number
          net_amount?: number
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          teacher_id: string
          updated_at?: string
          year: number
        }
        Update: {
          base_salary?: number
          bonus?: number
          created_at?: string
          created_by?: string | null
          deductions?: number
          id?: string
          is_paid?: boolean
          month?: number
          net_amount?: number
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          teacher_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "salary_payments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      student_attendance: {
        Row: {
          attendance_date: string
          batch_id: string | null
          created_at: string
          id: string
          marked_by: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Insert: {
          attendance_date: string
          batch_id?: string | null
          created_at?: string
          id?: string
          marked_by?: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Update: {
          attendance_date?: string
          batch_id?: string | null
          created_at?: string
          id?: string
          marked_by?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_attendance_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_parents: {
        Row: {
          created_at: string
          id: string
          relationship: string | null
          student_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          relationship?: string | null
          student_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          relationship?: string | null
          student_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_parents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_transfers: {
        Row: {
          from_branch_id: string | null
          id: string
          reason: string | null
          student_id: string
          to_branch_id: string | null
          transferred_at: string
          transferred_by: string | null
        }
        Insert: {
          from_branch_id?: string | null
          id?: string
          reason?: string | null
          student_id: string
          to_branch_id?: string | null
          transferred_at?: string
          transferred_by?: string | null
        }
        Update: {
          from_branch_id?: string | null
          id?: string
          reason?: string | null
          student_id?: string
          to_branch_id?: string | null
          transferred_at?: string
          transferred_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_transfers_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          address: string | null
          admission_date: string | null
          batch_id: string | null
          branch_id: string | null
          created_at: string
          email: string | null
          full_name: string
          guardian_name: string | null
          guardian_phone: string | null
          guardian_whatsapp: string | null
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          admission_date?: string | null
          batch_id?: string | null
          branch_id?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          guardian_name?: string | null
          guardian_phone?: string | null
          guardian_whatsapp?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          admission_date?: string | null
          batch_id?: string | null
          branch_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          guardian_name?: string | null
          guardian_phone?: string | null
          guardian_whatsapp?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      syllabus_topics: {
        Row: {
          batch_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_completed: boolean
          sort_order: number
          subject: string | null
          title: string
          updated_at: string
        }
        Insert: {
          batch_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_completed?: boolean
          sort_order?: number
          subject?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          batch_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_completed?: boolean
          sort_order?: number
          subject?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "syllabus_topics_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_attendance: {
        Row: {
          attendance_date: string
          created_at: string
          id: string
          marked_by: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          teacher_id: string
        }
        Insert: {
          attendance_date: string
          created_at?: string
          id?: string
          marked_by?: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          teacher_id: string
        }
        Update: {
          attendance_date?: string
          created_at?: string
          id?: string
          marked_by?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_attendance_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_branches: {
        Row: {
          branch_id: string
          id: string
          teacher_id: string
        }
        Insert: {
          branch_id: string
          id?: string
          teacher_id: string
        }
        Update: {
          branch_id?: string
          id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_branches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_branches_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          joining_date: string | null
          monthly_salary: number | null
          phone: string | null
          photo_url: string | null
          qualifications: string | null
          subjects: string[]
          updated_at: string
          user_id: string | null
          whatsapp_number: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          joining_date?: string | null
          monthly_salary?: number | null
          phone?: string | null
          photo_url?: string | null
          qualifications?: string | null
          subjects?: string[]
          updated_at?: string
          user_id?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          joining_date?: string | null
          monthly_salary?: number | null
          phone?: string | null
          photo_url?: string | null
          qualifications?: string | null
          subjects?: string[]
          updated_at?: string
          user_id?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      test_marks: {
        Row: {
          created_at: string
          entered_by: string | null
          id: string
          is_absent: boolean
          marks_obtained: number | null
          remarks: string | null
          student_id: string
          test_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entered_by?: string | null
          id?: string
          is_absent?: boolean
          marks_obtained?: number | null
          remarks?: string | null
          student_id: string
          test_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entered_by?: string | null
          id?: string
          is_absent?: boolean
          marks_obtained?: number | null
          remarks?: string | null
          student_id?: string
          test_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_marks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_marks_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      tests: {
        Row: {
          batch_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          max_marks: number
          subject: string | null
          test_date: string
          title: string
          updated_at: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          max_marks?: number
          subject?: string | null
          test_date: string
          title: string
          updated_at?: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          max_marks?: number
          subject?: string | null
          test_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tests_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
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
      current_user_is_parent_of_batch: {
        Args: { _batch_id: string }
        Returns: boolean
      }
      current_user_is_parent_of_branch: {
        Args: { _branch_id: string }
        Returns: boolean
      }
      ensure_profile: { Args: { _full_name?: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_parent_of: {
        Args: { _student_id: string; _user_id: string }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      teaches_batch: {
        Args: { _batch_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "branch_admin"
        | "teacher"
        | "student"
        | "parent"
      attendance_status: "present" | "absent" | "late" | "half_day" | "leave"
      leave_status: "pending" | "approved" | "rejected"
      leave_type: "sick" | "casual" | "emergency" | "half_day"
      lecture_status: "scheduled" | "rescheduled" | "cancelled" | "completed"
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
      app_role: ["super_admin", "branch_admin", "teacher", "student", "parent"],
      attendance_status: ["present", "absent", "late", "half_day", "leave"],
      leave_status: ["pending", "approved", "rejected"],
      leave_type: ["sick", "casual", "emergency", "half_day"],
      lecture_status: ["scheduled", "rescheduled", "cancelled", "completed"],
    },
  },
} as const
