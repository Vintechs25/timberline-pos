/**
 * Cloud-backed store for per-branch inventory, customers, and sales.
 * Replaces the local-only zustand store. Uses Supabase as the source of truth.
 */
import { useEffect, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth-context";
import { create } from "zustand";

// Active branch selection (per user, per device)
const ACTIVE_BRANCH_KEY = "ty_active_branch";

interface BranchSelectionState {
  activeBranchId: string | null;
  setActiveBranchId: (id: string | null) => void;
}

export const useBranchSelection = create<BranchSelectionState>((set) => ({
  activeBranchId: typeof window !== "undefined" ? localStorage.getItem(ACTIVE_BRANCH_KEY) : null,
  setActiveBranchId: (id) => {
    if (typeof window !== "undefined") {
      if (id) localStorage.setItem(ACTIVE_BRANCH_KEY, id);
      else localStorage.removeItem(ACTIVE_BRANCH_KEY);
    }
    set({ activeBranchId: id });
  },
}));

export interface Branch {
  id: string;
  name: string;
  code: string;
  business_id: string;
}

export interface CloudHardware {
  id: string;
  business_id: string;
  branch_id: string;
  name: string;
  sku: string | null;
  category: string | null;
  unit: string;
  price: number;
  cost: number;
  stock: number;
  low_stock_threshold: number;
  supplier: string | null;
}

export interface CloudTimber {
  id: string;
  business_id: string;
  branch_id: string;
  species: string;
  grade: string | null;
  thickness: number;
  width: number;
  length: number;
  dim_unit: string;
  length_unit: string;
  price_per_unit: number;
  price_unit: string;
  pieces: number;
  low_stock_threshold: number;
}

export interface CloudCustomer {
  id: string;
  business_id: string;
  name: string;
  phone: string | null;
  type: string;
  credit_limit: number;
  balance: number;
  loyalty_discount_pct: number;
}

export interface CloudSale {
  id: string;
  business_id: string;
  branch_id: string;
  customer_id: string | null;
  customer_name: string | null;
  receipt_no: string | null;
  subtotal: number;
  discount: number;
  total: number;
  payment_method: string;
  status: string;
  created_at: string;
}

export function useBranches() {
  const { activeBusinessId } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeBusinessId) {
      setBranches([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("branches")
      .select("id,name,code,business_id")
      .eq("business_id", activeBusinessId)
      .order("name");
    setBranches((data as Branch[]) ?? []);
    setLoading(false);
  }, [activeBusinessId]);

  useEffect(() => {
    load();
  }, [load]);

  return { branches, loading, reload: load };
}

export function useHardware(branchId: string | null) {
  const [items, setItems] = useState<CloudHardware[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!branchId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("hardware_products")
      .select("*")
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .order("name");
    setItems((data as CloudHardware[]) ?? []);
    setLoading(false);
  }, [branchId]);

  useEffect(() => {
    load();
  }, [load]);

  return { items, loading, reload: load };
}

export function useTimber(branchId: string | null) {
  const [items, setItems] = useState<CloudTimber[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!branchId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("timber_products")
      .select("*")
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .order("species");
    setItems((data as CloudTimber[]) ?? []);
    setLoading(false);
  }, [branchId]);

  useEffect(() => {
    load();
  }, [load]);

  return { items, loading, reload: load };
}

export function useCustomers() {
  const { activeBusinessId } = useAuth();
  const [items, setItems] = useState<CloudCustomer[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeBusinessId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("business_id", activeBusinessId)
      .order("name");
    setItems((data as CloudCustomer[]) ?? []);
    setLoading(false);
  }, [activeBusinessId]);

  useEffect(() => {
    load();
  }, [load]);

  return { items, loading, reload: load };
}

export function useSales(branchId: string | null, allBranches = false) {
  const { activeBusinessId } = useAuth();
  const [items, setItems] = useState<CloudSale[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeBusinessId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let q = supabase
      .from("sales")
      .select("*")
      .eq("business_id", activeBusinessId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (!allBranches && branchId) q = q.eq("branch_id", branchId);
    const { data } = await q;
    setItems((data as CloudSale[]) ?? []);
    setLoading(false);
  }, [activeBusinessId, branchId, allBranches]);

  useEffect(() => {
    load();
  }, [load]);

  return { items, loading, reload: load };
}

export const formatKsh = (n: number) =>
  `KSh ${n.toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
