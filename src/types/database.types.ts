export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          phone: string;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          phone: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          phone?: string;
          avatar_url?: string | null;
          updated_at?: string;
        };
      };
      shops: {
        Row: {
          id: string;
          name: string;
          shop_type: string;
          phone: string;
          email: string | null;
          address: string;
          city: string;
          state: string;
          country: string;
          pincode: string;
          latitude: number | null;
          longitude: number | null;
          logo_url: string | null;
          currency_code: string;
          timezone: string;
          gst_enabled: boolean;
          gst_rate: number;
          gst_number: string | null;
          round_off_enabled: boolean;
          daily_backup_enabled: boolean;
          printer_enabled: boolean;
          printer_name: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
      };
      bills: {
        Row: {
          id: string;
          shop_id: string;
          bill_number: string;
          customer_id: string | null;
          customer_name: string | null;
          customer_phone: string | null;
          status: string;
          subtotal: number;
          gst_rate: number;
          gst_amount: number;
          total_amount: number;
          paid_amount: number;
          pending_amount: number;
          payment_mode: string;
          client_operation_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          completed_at: string;
        };
      };
      customers: {
        Row: {
          id: string;
          shop_id: string;
          name: string;
          phone: string | null;
          location: string | null;
          notes: string | null;
          total_bills: number;
          pending_balance: number;
          status_tag: string | null;
          is_active: boolean;
          is_vip: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          name: string;
          phone?: string | null;
          location?: string | null;
          notes?: string | null;
          total_bills?: number;
          pending_balance?: number;
          status_tag?: string | null;
          is_active?: boolean;
          is_vip?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          name?: string;
          phone?: string | null;
          location?: string | null;
          notes?: string | null;
          total_bills?: number;
          pending_balance?: number;
          status_tag?: string | null;
          is_active?: boolean;
          is_vip?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      account_deletions: {
        Row: {
          id: string;
          user_id: string | null;
          shop_id: string | null;
          shop_name: string | null;
          owner_name: string | null;
          phone: string | null;
          reason: string;
          feedback: string | null;
          deleted_at: string;
          metadata: Json;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          shop_id?: string | null;
          shop_name?: string | null;
          owner_name?: string | null;
          phone?: string | null;
          reason: string;
          feedback?: string | null;
          deleted_at?: string;
          metadata?: Json;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          shop_id?: string | null;
          shop_name?: string | null;
          owner_name?: string | null;
          phone?: string | null;
          reason?: string;
          feedback?: string | null;
          deleted_at?: string;
          metadata?: Json;
        };
      };
      subscriptions: {
        Row: {
          id: string;
          shop_id: string;
          plan: string;
          status: string;
          amount: number;
          interval: string;
          trial_start_at?: string | null;
          trial_end_at?: string | null;
          subscription_start_at?: string | null;
          subscription_end_at?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          payment_reference?: string | null;
          cashfree_order_id?: string | null;
          currency?: string | null;
          duration_months?: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          plan?: string;
          status?: string;
          amount?: number;
          interval?: string;
          trial_start_at?: string | null;
          trial_end_at?: string | null;
          subscription_start_at?: string | null;
          subscription_end_at?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          payment_reference?: string | null;
          cashfree_order_id?: string | null;
          currency?: string | null;
          duration_months?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          plan?: string;
          status?: string;
          amount?: number;
          interval?: string;
          trial_start_at?: string | null;
          trial_end_at?: string | null;
          subscription_start_at?: string | null;
          subscription_end_at?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          payment_reference?: string | null;
          cashfree_order_id?: string | null;
          currency?: string | null;
          duration_months?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Functions: {
      create_bill_atomic: {
        Args: {
          p_shop_id: string;
          p_bill_number: string;
          p_items: Json;
          p_subtotal: number;
          p_gst_rate: number;
          p_gst_amount: number;
          p_total_amount: number;
          p_payment_mode: string;
          p_customer_name?: string;
          p_customer_phone?: string;
          p_client_operation_id?: string;
        };
        Returns: Json;
      };
      seed_starter_catalog: {
        Args: {
          p_shop_id: string;
          p_shop_type: string;
        };
        Returns: void;
      };
      is_shop_member: {
        Args: { target_shop_id: string };
        Returns: boolean;
      };
      has_shop_permission: {
        Args: { target_shop_id: string; perm_key: string };
        Returns: boolean;
      };
    };
  };
}
