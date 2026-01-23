import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string
          name: string
          email: string
          phone: string
          company_name?: string
          address?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          phone: string
          company_name?: string
          address?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          phone?: string
          company_name?: string
          address?: string
          updated_at?: string
        }
      }
      vehicles: {
        Row: {
          id: string
          customer_id: string
          vehicle_number: string
          vehicle_type: string
          model: string
          year?: number
          status: string
          entry_date: string
          expected_completion?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          vehicle_number: string
          vehicle_type: string
          model: string
          year?: number
          status?: string
          entry_date?: string
          expected_completion?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          vehicle_number?: string
          vehicle_type?: string
          model?: string
          year?: number
          status?: string
          expected_completion?: string
          updated_at?: string
        }
      }
      work_orders: {
        Row: {
          id: string
          vehicle_id: string
          service_type: string
          description: string
          assigned_to?: string
          status: string
          estimated_cost: number
          actual_cost?: number
          start_date?: string
          completion_date?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          vehicle_id: string
          service_type: string
          description: string
          assigned_to?: string
          status?: string
          estimated_cost: number
          actual_cost?: number
          started_at?: string
          completed_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          vehicle_id?: string
          service_type?: string
          description?: string
          assigned_to?: string
          status?: string
          estimated_cost?: number
          actual_cost?: number
          started_at?: string
          completed_at?: string
          updated_at?: string
        }
      }
      inventory: {
        Row: {
          id: string
          part_name: string
          part_number: string
          category: string
          current_stock: number
          minimum_stock: number
          unit_cost: number
          supplier?: string
          location?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          part_name: string
          part_number: string
          category: string
          current_stock: number
          minimum_stock: number
          unit_cost: number
          supplier?: string
          location?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          part_name?: string
          part_number?: string
          category?: string
          current_stock?: number
          minimum_stock?: number
          unit_cost?: number
          supplier?: string
          location?: string
          updated_at?: string
        }
      }
      invoices: {
        Row: {
          id: string
          work_order_id: string
          customer_id: string
          invoice_number: string
          total_amount: number
          tax_amount: number
          discount?: number
          payment_status: string
          payment_date?: string
          due_date: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          work_order_id: string
          customer_id: string
          invoice_number: string
          total_amount: number
          tax_amount: number
          discount?: number
          payment_status?: string
          payment_date?: string
          due_date: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          work_order_id?: string
          customer_id?: string
          invoice_number?: string
          total_amount?: number
          tax_amount?: number
          discount?: number
          payment_status?: string
          payment_date?: string
          due_date?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          role: string
          department?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          role?: string
          department?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          role?: string
          department?: string
          updated_at?: string
        }
      }
    }
  }
}