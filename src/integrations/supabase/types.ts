export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          phone: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          phone?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          phone?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role: 'admin' | 'staff' | 'customer'
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role: 'admin' | 'staff' | 'customer'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          role?: 'admin' | 'staff' | 'customer'
          created_at?: string
        }
      }
      customers: {
        Row: {
          id: string
          user_id: string | null
          name: string
          email: string | null
          phone: string | null
          company_name: string | null
          address: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          name: string
          email?: string | null
          phone?: string | null
          company_name?: string | null
          address?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          name?: string
          email?: string | null
          phone?: string | null
          company_name?: string | null
          address?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      vehicles: {
        Row: {
          id: string
          customer_id: string
          vehicle_number: string
          vehicle_type: string
          model: string | null
          year: number | null
          status: string
          notes: string | null
          entry_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          vehicle_number: string
          vehicle_type: string
          model?: string | null
          year?: number | null
          status?: string
          notes?: string | null
          entry_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          vehicle_number?: string
          vehicle_type?: string
          model?: string | null
          year?: number | null
          status?: string
          notes?: string | null
          entry_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      work_orders: {
        Row: {
          id: string
          vehicle_id: string
          assigned_to: string | null
          service_type: string
          description: string
          status: string
          priority: string
          current_stage: string | null
          requires_approval: boolean | null
          approved_by: string | null
          approved_at: string | null
          actual_cost: number | null
          accepted_at: string | null
          customer_visible: boolean | null
          estimated_cost: number | null
          started_at: string | null
          completed_at: string | null
          // Dynamic workflow columns
          inspection_status: 'pending' | 'approved' | 'rejected' | null
          inspection_notes: string | null
          inspection_completed_at: string | null
          inspection_completed_by: string | null
          repairs_visible: boolean | null
          repairs_approved: boolean | null
          repairs_approved_at: string | null
          repairs_approved_by: string | null
          portal_updated_at: string | null
          repair_completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          vehicle_id: string
          assigned_to?: string | null
          service_type: string
          description: string
          status?: string
          priority?: string
          current_stage?: string | null
          requires_approval?: boolean | null
          approved_by?: string | null
          approved_at?: string | null
          actual_cost?: number | null
          accepted_at?: string | null
          customer_visible?: boolean | null
          estimated_cost?: number | null
          started_at?: string | null
          completed_at?: string | null
          // Dynamic workflow columns
          inspection_status?: 'pending' | 'approved' | 'rejected' | null
          inspection_notes?: string | null
          inspection_completed_at?: string | null
          inspection_completed_by?: string | null
          repairs_visible?: boolean | null
          repairs_approved?: boolean | null
          repairs_approved_at?: string | null
          repairs_approved_by?: string | null
          portal_updated_at?: string | null
          repair_completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          vehicle_id?: string
          assigned_to?: string | null
          service_type?: string
          description?: string
          status?: string
          priority?: string
          current_stage?: string | null
          requires_approval?: boolean | null
          approved_by?: string | null
          approved_at?: string | null
          actual_cost?: number | null
          accepted_at?: string | null
          customer_visible?: boolean | null
          estimated_cost?: number | null
          started_at?: string | null
          completed_at?: string | null
          // Dynamic workflow columns
          inspection_status?: 'pending' | 'approved' | 'rejected' | null
          inspection_notes?: string | null
          inspection_completed_at?: string | null
          inspection_completed_by?: string | null
          repairs_visible?: boolean | null
          repairs_approved?: boolean | null
          repairs_approved_at?: string | null
          repairs_approved_by?: string | null
          portal_updated_at?: string | null
          repair_completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      work_order_stages: {
        Row: {
          id: string
          work_order_id: string
          stage: string
          status: string
          started_at: string | null
          completed_at: string | null
          notes: string | null
          completed_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          work_order_id: string
          stage: string
          status?: string
          started_at?: string | null
          completed_at?: string | null
          notes?: string | null
          completed_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          work_order_id?: string
          stage?: string
          status?: string
          started_at?: string | null
          completed_at?: string | null
          notes?: string | null
          completed_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      work_order_assignments: {
        Row: {
          id: string
          work_order_id: string
          employee_id: string
          status: string
          assigned_at: string | null
          accepted_at: string | null
          completed_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          work_order_id: string
          employee_id: string
          status?: string
          assigned_at?: string | null
          accepted_at?: string | null
          completed_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          work_order_id?: string
          employee_id?: string
          status?: string
          assigned_at?: string | null
          accepted_at?: string | null
          completed_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      work_order_parts: {
        Row: {
          id: string
          work_order_id: string
          inventory_id: string | null
          part_name: string
          quantity: number
          unit_price: number
          total_price: number
          added_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          work_order_id: string
          inventory_id?: string | null
          part_name: string
          quantity?: number
          unit_price?: number
          added_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          work_order_id?: string
          inventory_id?: string | null
          part_name?: string
          quantity?: number
          unit_price?: number
          added_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      work_order_approvals: {
        Row: {
          id: string
          work_order_id: string
          approver_id: string
          approval_type: string
          status: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          work_order_id: string
          approver_id: string
          approval_type: string
          status?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          work_order_id?: string
          approver_id?: string
          approval_type?: string
          status?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      inventory: {
        Row: {
          id: string
          item_name: string
          category: string
          quantity: number
          unit_price: number
          reorder_level: number
          supplier: string | null
          location: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          item_name: string
          category: string
          quantity?: number
          unit_price: number
          reorder_level?: number
          supplier?: string | null
          location?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          item_name?: string
          category?: string
          quantity?: number
          unit_price?: number
          reorder_level?: number
          supplier?: string | null
          location?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      invoices: {
        Row: {
          id: string
          invoice_number: string
          customer_id: string
          work_order_id: string | null
          subtotal: number
          tax: number
          total: number
          status: string
          due_date: string | null
          paid_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          invoice_number: string
          customer_id: string
          work_order_id?: string | null
          subtotal?: number
          tax?: number
          total?: number
          status?: string
          due_date?: string | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          invoice_number?: string
          customer_id?: string
          work_order_id?: string | null
          subtotal?: number
          tax?: number
          total?: number
          status?: string
          due_date?: string | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      positions: {
        Row: {
          id: string
          name: string
          department: string
          access_level: 'admin' | 'manager' | 'staff'
          description: string | null
          base_salary: number | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          department: string
          access_level?: 'admin' | 'manager' | 'staff'
          description?: string | null
          base_salary?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          department?: string
          access_level?: 'admin' | 'manager' | 'staff'
          description?: string | null
          base_salary?: number | null
          created_at?: string
        }
      }
      employees: {
        Row: {
          id: string
          user_id: string | null
          name: string
          email: string
          phone: string | null
          position_id: string | null
          access_level: 'admin' | 'manager' | 'staff'
          salary: number | null
          status: string
          hire_date: string | null
          emergency_contact: string | null
          emergency_phone: string | null
          address: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          name: string
          email: string
          phone?: string | null
          position_id?: string | null
          access_level?: 'admin' | 'manager' | 'staff'
          salary?: number | null
          status?: string
          hire_date?: string | null
          emergency_contact?: string | null
          emergency_phone?: string | null
          address?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          name?: string
          email?: string
          phone?: string | null
          position_id?: string | null
          access_level?: 'admin' | 'manager' | 'staff'
          salary?: number | null
          status?: string
          hire_date?: string | null
          emergency_contact?: string | null
          emergency_phone?: string | null
          address?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      // Multi-service support tables
      work_order_services: {
        Row: {
          id: string
          work_order_id: string
          service_type: string
          display_order: number
          estimated_duration: string | null
          estimated_cost: number
          actual_cost: number
          status: string
          started_at: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          work_order_id: string
          service_type: string
          display_order?: number
          estimated_duration?: string | null
          estimated_cost?: number
          actual_cost?: number
          status?: string
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          work_order_id?: string
          service_type?: string
          display_order?: number
          estimated_duration?: string | null
          estimated_cost?: number
          actual_cost?: number
          status?: string
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      work_order_service_tasks: {
        Row: {
          id: string
          service_id: string
          task_name: string
          task_description: string | null
          is_predefined: boolean
          predefined_task_id: string | null
          estimated_effort: number | null
          effort_unit: string
          status: string
          priority: string
          sequence_order: number
          notes: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          service_id: string
          task_name: string
          task_description?: string | null
          is_predefined?: boolean
          predefined_task_id?: string | null
          estimated_effort?: number | null
          effort_unit?: string
          status?: string
          priority?: string
          sequence_order?: number
          notes?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          service_id?: string
          task_name?: string
          task_description?: string | null
          is_predefined?: boolean
          predefined_task_id?: string | null
          estimated_effort?: number | null
          effort_unit?: string
          status?: string
          priority?: string
          sequence_order?: number
          notes?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      work_order_service_employees: {
        Row: {
          id: string
          service_id: string
          employee_id: string
          role: string | null
          status: string
          assigned_at: string | null
          accepted_at: string | null
          completed_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          service_id: string
          employee_id: string
          role?: string | null
          status?: string
          assigned_at?: string | null
          accepted_at?: string | null
          completed_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          service_id?: string
          employee_id?: string
          role?: string | null
          status?: string
          assigned_at?: string | null
          accepted_at?: string | null
          completed_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      work_order_service_notes: {
        Row: {
          id: string
          service_id: string
          note_type: string | null
          note_content: string
          is_internal: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          service_id: string
          note_type?: string | null
          note_content: string
          is_internal?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          service_id?: string
          note_type?: string | null
          note_content?: string
          is_internal?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      custom_work_items: {
        Row: {
          id: string
          service_type: string
          task_name: string
          task_description: string | null
          estimated_effort: number | null
          effort_unit: string
          is_active: boolean
          usage_count: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          service_type: string
          task_name: string
          task_description?: string | null
          estimated_effort?: number | null
          effort_unit?: string
          is_active?: boolean
          usage_count?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          service_type?: string
          task_name?: string
          task_description?: string | null
          estimated_effort?: number | null
          effort_unit?: string
          is_active?: boolean
          usage_count?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      // Dynamic workflow repair tasks table
      repair_tasks: {
        Row: {
          id: string
          work_order_id: string
          task_name: string
          task_description: string | null
          task_category: string
          status: 'pending' | 'in_progress' | 'completed' | 'reopened'
          priority: 'Low' | 'Medium' | 'High' | 'Urgent'
          sequence_order: number
          notes: string | null
          completed_at: string | null
          completed_by: string | null
          reopened_at: string | null
          reopened_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          work_order_id: string
          task_name: string
          task_description?: string | null
          task_category?: string
          status?: 'pending' | 'in_progress' | 'completed' | 'reopened'
          priority?: 'Low' | 'Medium' | 'High' | 'Urgent'
          sequence_order?: number
          notes?: string | null
          completed_at?: string | null
          completed_by?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          work_order_id?: string
          task_name?: string
          task_description?: string | null
          task_category?: string
          status?: 'pending' | 'in_progress' | 'completed' | 'reopened'
          priority?: 'Low' | 'Medium' | 'High' | 'Urgent'
          sequence_order?: number
          notes?: string | null
          completed_at?: string | null
          completed_by?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      // Repair task history for audit trail
      repair_task_history: {
        Row: {
          id: string
          task_id: string
          action: 'created' | 'started' | 'completed' | 'reopened' | 'updated'
          performed_by: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          action: 'created' | 'started' | 'completed' | 'reopened' | 'updated'
          performed_by?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          action?: 'created' | 'started' | 'completed' | 'reopened' | 'updated'
          performed_by?: string | null
          notes?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      employee_details: {
        Row: {
          id: string
          name: string
          email: string
          phone: string | null
          salary: number | null
          status: string
          hire_date: string | null
          position_name: string | null
          department: string | null
          position_access_level: 'admin' | 'manager' | 'staff' | null
          created_at: string
        }
      }
    }
    Functions: {
      has_role: {
        Args: {
          _user_id: string
          _role: 'admin' | 'staff' | 'customer'
        }
        Returns: boolean
      }
      update_updated_at_column: {
        Args: Record<string, never>
        Returns: void
      }
      // Dynamic workflow functions
      get_staff_assigned_work: {
        Args: {
          p_user_id: string
        }
        Returns: any
      }
      approve_inspection: {
        Args: {
          p_work_order_id: string
          p_inspector_id: string
          p_notes?: string
        }
        Returns: void
      }
      reject_inspection: {
        Args: {
          p_work_order_id: string
          p_inspector_id: string
          p_notes: string
        }
        Returns: void
      }
      complete_repair_task: {
        Args: {
          p_task_id: string
          p_completed_by: string
        }
        Returns: void
      }
      reopen_repair_task: {
        Args: {
          p_task_id: string
          p_reopened_by: string
          p_reason?: string
        }
        Returns: void
      }
      approve_repairs: {
        Args: {
          p_work_order_id: string
          p_approver_id: string
        }
        Returns: void
      }
      reopen_repairs: {
        Args: {
          p_work_order_id: string
          p_reopened_by: string
          p_reason: string
        }
        Returns: void
      }
      start_repair_task: {
        Args: {
          p_task_id: string
          p_started_by: string
        }
        Returns: void
      }
    }
  }
}

