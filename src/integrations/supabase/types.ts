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
      branches: {
        Row: {
          address: string | null
          business_id: string
          code: string
          created_at: string
          id: string
          name: string
          phone: string | null
        }
        Insert: {
          address?: string | null
          business_id: string
          code: string
          created_at?: string
          id?: string
          name: string
          phone?: string | null
        }
        Update: {
          address?: string | null
          business_id?: string
          code?: string
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_users: {
        Row: {
          business_id: string
          created_at: string
          default_branch_id: string | null
          id: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          default_branch_id?: string | null
          id?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          default_branch_id?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_users_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_users_default_branch_id_fkey"
            columns: ["default_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          created_at: string
          features: Json
          id: string
          license_expires_at: string | null
          license_key: string
          name: string
          owner_user_id: string | null
          slug: string
          status: Database["public"]["Enums"]["business_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          features?: Json
          id?: string
          license_expires_at?: string | null
          license_key?: string
          name: string
          owner_user_id?: string | null
          slug: string
          status?: Database["public"]["Enums"]["business_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          features?: Json
          id?: string
          license_expires_at?: string | null
          license_key?: string
          name?: string
          owner_user_id?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["business_status"]
          updated_at?: string
        }
        Relationships: []
      }
      customer_requests: {
        Row: {
          branch_id: string
          business_id: string
          created_at: string
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          description: string | null
          fulfilled_at: string | null
          id: string
          item_name: string
          notes: string | null
          quantity: number
          recorded_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          business_id: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          fulfilled_at?: string | null
          id?: string
          item_name: string
          notes?: string | null
          quantity?: number
          recorded_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          business_id?: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          fulfilled_at?: string | null
          id?: string
          item_name?: string
          notes?: string | null
          quantity?: number
          recorded_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          balance: number
          business_id: string
          created_at: string
          credit_limit: number
          email: string | null
          id: string
          loyalty_discount_pct: number
          name: string
          notes: string | null
          phone: string | null
          type: string
          updated_at: string
        }
        Insert: {
          balance?: number
          business_id: string
          created_at?: string
          credit_limit?: number
          email?: string | null
          id?: string
          loyalty_discount_pct?: number
          name: string
          notes?: string | null
          phone?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          balance?: number
          business_id?: string
          created_at?: string
          credit_limit?: number
          email?: string | null
          id?: string
          loyalty_discount_pct?: number
          name?: string
          notes?: string | null
          phone?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      hardware_products: {
        Row: {
          branch_id: string
          business_id: string
          category: string | null
          cost: number
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          low_stock_threshold: number
          name: string
          price: number
          sku: string | null
          stock: number
          supplier: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          business_id: string
          category?: string | null
          cost?: number
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          low_stock_threshold?: number
          name: string
          price?: number
          sku?: string | null
          stock?: number
          supplier?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          business_id?: string
          category?: string | null
          cost?: number
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          low_stock_threshold?: number
          name?: string
          price?: number
          sku?: string | null
          stock?: number
          supplier?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hardware_products_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hardware_products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      mpesa_configs: {
        Row: {
          business_id: string
          callback_url: string | null
          consumer_key: string
          consumer_secret: string
          created_at: string
          environment: string
          id: string
          is_active: boolean
          passkey: string
          shortcode: string
          updated_at: string
        }
        Insert: {
          business_id: string
          callback_url?: string | null
          consumer_key: string
          consumer_secret: string
          created_at?: string
          environment?: string
          id?: string
          is_active?: boolean
          passkey: string
          shortcode: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          callback_url?: string | null
          consumer_key?: string
          consumer_secret?: string
          created_at?: string
          environment?: string
          id?: string
          is_active?: boolean
          passkey?: string
          shortcode?: string
          updated_at?: string
        }
        Relationships: []
      }
      mpesa_transactions: {
        Row: {
          amount: number
          branch_id: string
          business_id: string
          checkout_request_id: string | null
          created_at: string
          id: string
          initiated_by: string | null
          merchant_request_id: string | null
          mpesa_receipt: string | null
          phone: string
          raw_callback: Json | null
          result_code: number | null
          result_desc: string | null
          sale_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          branch_id: string
          business_id: string
          checkout_request_id?: string | null
          created_at?: string
          id?: string
          initiated_by?: string | null
          merchant_request_id?: string | null
          mpesa_receipt?: string | null
          phone: string
          raw_callback?: Json | null
          result_code?: number | null
          result_desc?: string | null
          sale_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          branch_id?: string
          business_id?: string
          checkout_request_id?: string | null
          created_at?: string
          id?: string
          initiated_by?: string | null
          merchant_request_id?: string | null
          mpesa_receipt?: string | null
          phone?: string
          raw_callback?: Json | null
          result_code?: number | null
          result_desc?: string | null
          sale_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          created_at: string
          description: string
          id: string
          meta: Json
          product_id: string | null
          product_kind: string
          purchase_order_id: string
          quantity: number
          received_qty: number
          total: number
          unit_cost: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          meta?: Json
          product_id?: string | null
          product_kind: string
          purchase_order_id: string
          quantity?: number
          received_qty?: number
          total?: number
          unit_cost?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          meta?: Json
          product_id?: string | null
          product_kind?: string
          purchase_order_id?: string
          quantity?: number
          received_qty?: number
          total?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          amount_paid: number
          branch_id: string
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          ordered_at: string | null
          po_number: string | null
          received_at: string | null
          status: string
          subtotal: number
          supplier_id: string
          total: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          branch_id: string
          business_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          ordered_at?: string | null
          po_number?: string | null
          received_at?: string | null
          status?: string
          subtotal?: number
          supplier_id: string
          total?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          branch_id?: string
          business_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          ordered_at?: string | null
          po_number?: string | null
          received_at?: string | null
          status?: string
          subtotal?: number
          supplier_id?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          description: string
          id: string
          meta: Json
          product_id: string | null
          product_kind: string
          quantity: number
          sale_id: string
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          meta?: Json
          product_id?: string | null
          product_kind: string
          quantity?: number
          sale_id: string
          total?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          meta?: Json
          product_id?: string | null
          product_kind?: string
          quantity?: number
          sale_id?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          branch_id: string
          business_id: string
          cashier_id: string | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          discount: number
          id: string
          original_total: number | null
          payment_method: string
          price_override: boolean
          receipt_no: string | null
          refund_reason: string | null
          refunded_at: string | null
          refunded_by: string | null
          status: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          business_id: string
          cashier_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          discount?: number
          id?: string
          original_total?: number | null
          payment_method?: string
          price_override?: boolean
          receipt_no?: string | null
          refund_reason?: string | null
          refunded_at?: string | null
          refunded_by?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          business_id?: string
          cashier_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          discount?: number
          id?: string
          original_total?: number | null
          payment_method?: string
          price_override?: boolean
          receipt_no?: string | null
          refund_reason?: string | null
          refunded_at?: string | null
          refunded_by?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          amount: number
          branch_id: string | null
          business_id: string
          created_at: string
          id: string
          method: string
          notes: string | null
          paid_by: string | null
          reference: string | null
          supplier_id: string
        }
        Insert: {
          amount: number
          branch_id?: string | null
          business_id: string
          created_at?: string
          id?: string
          method?: string
          notes?: string | null
          paid_by?: string | null
          reference?: string | null
          supplier_id: string
        }
        Update: {
          amount?: number
          branch_id?: string | null
          business_id?: string
          created_at?: string
          id?: string
          method?: string
          notes?: string | null
          paid_by?: string | null
          reference?: string | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          balance: number
          business_id: string
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          balance?: number
          business_id: string
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          balance?: number
          business_id?: string
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      timber_products: {
        Row: {
          branch_id: string
          business_id: string
          created_at: string
          dim_unit: string
          grade: string | null
          id: string
          is_active: boolean
          length: number
          length_unit: string
          low_stock_threshold: number
          pieces: number
          price_per_unit: number
          price_unit: string
          species: string
          thickness: number
          updated_at: string
          width: number
        }
        Insert: {
          branch_id: string
          business_id: string
          created_at?: string
          dim_unit?: string
          grade?: string | null
          id?: string
          is_active?: boolean
          length: number
          length_unit?: string
          low_stock_threshold?: number
          pieces?: number
          price_per_unit?: number
          price_unit?: string
          species: string
          thickness: number
          updated_at?: string
          width: number
        }
        Update: {
          branch_id?: string
          business_id?: string
          created_at?: string
          dim_unit?: string
          grade?: string | null
          id?: string
          is_active?: boolean
          length?: number
          length_unit?: string
          low_stock_threshold?: number
          pieces?: number
          price_per_unit?: number
          price_unit?: string
          species?: string
          thickness?: number
          updated_at?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "timber_products_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timber_products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          branch_id: string | null
          business_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          business_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          branch_id?: string | null
          business_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_mpesa_status: {
        Args: { _business_id: string }
        Returns: {
          active: boolean
          configured: boolean
          environment: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_business_admin: {
        Args: { _business_id: string; _user_id: string }
        Returns: boolean
      }
      is_business_license_valid: {
        Args: { _business_id: string }
        Returns: boolean
      }
      is_business_member: {
        Args: { _business_id: string; _user_id: string }
        Returns: boolean
      }
      pay_supplier: {
        Args: {
          _amount: number
          _branch_id: string
          _method: string
          _notes: string
          _reference: string
          _supplier_id: string
        }
        Returns: string
      }
      receive_purchase_order: { Args: { _po_id: string }; Returns: undefined }
      refund_sale: {
        Args: { _reason: string; _sale_id: string }
        Returns: undefined
      }
      user_can_access_branch: {
        Args: { _branch_id: string; _business_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "system_owner"
        | "business_admin"
        | "staff"
        | "supervisor"
        | "cashier"
      business_status: "active" | "suspended" | "revoked"
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
      app_role: [
        "system_owner",
        "business_admin",
        "staff",
        "supervisor",
        "cashier",
      ],
      business_status: ["active", "suspended", "revoked"],
    },
  },
} as const
