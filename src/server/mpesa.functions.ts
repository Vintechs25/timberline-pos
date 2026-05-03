/**
 * M-Pesa Daraja STK Push server functions.
 * Sandbox + production. Reads mpesa_configs (service-role) and writes mpesa_transactions.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function baseUrl(env: string) {
  return env === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
}

function timestamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function normalizePhone(p: string) {
  const s = p.replace(/\D/g, "");
  if (s.startsWith("254")) return s;
  if (s.startsWith("0")) return "254" + s.slice(1);
  if (s.startsWith("7") || s.startsWith("1")) return "254" + s;
  return s;
}

async function getToken(consumerKey: string, consumerSecret: string, env: string) {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const res = await fetch(`${baseUrl(env)}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) throw new Error(`Daraja auth failed: ${res.status}`);
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

export const initiateStkPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      business_id: z.string().uuid(),
      branch_id: z.string().uuid(),
      phone: z.string().min(9).max(15),
      amount: z.number().positive(),
      reference: z.string().min(1).max(50).default("POS"),
      description: z.string().max(80).default("POS Sale"),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Verify caller is a business member
    const { data: member } = await supabase.rpc("is_business_member", {
      _user_id: context.userId,
      _business_id: data.business_id,
    });
    if (!member) throw new Error("Not authorized for business");

    const { data: cfg, error: cfgErr } = await supabaseAdmin
      .from("mpesa_configs")
      .select("*")
      .eq("business_id", data.business_id)
      .maybeSingle();
    if (cfgErr || !cfg) throw new Error("M-Pesa not configured for this business");
    if (!cfg.is_active) throw new Error("M-Pesa is disabled. Contact admin.");

    const env = cfg.environment;
    const ts = timestamp();
    const password = Buffer.from(`${cfg.shortcode}${cfg.passkey}${ts}`).toString("base64");
    const phone = normalizePhone(data.phone);
    const amount = Math.round(data.amount);

    const callbackUrl =
      cfg.callback_url ||
      `${process.env.SUPABASE_URL?.replace("supabase.co", "supabase.co")}/functions/v1/mpesa-callback`;

    const token = await getToken(cfg.consumer_key, cfg.consumer_secret, env);
    const stkRes = await fetch(`${baseUrl(env)}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        BusinessShortCode: cfg.shortcode,
        Password: password,
        Timestamp: ts,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: phone,
        PartyB: cfg.shortcode,
        PhoneNumber: phone,
        CallBackURL: callbackUrl,
        AccountReference: data.reference.slice(0, 12),
        TransactionDesc: data.description.slice(0, 13),
      }),
    });
    const stkJson = (await stkRes.json()) as Record<string, string>;

    const checkout = stkJson.CheckoutRequestID || null;
    const merchant = stkJson.MerchantRequestID || null;
    const ok = stkJson.ResponseCode === "0";

    const { data: inserted } = await supabaseAdmin
      .from("mpesa_transactions")
      .insert({
        business_id: data.business_id,
        branch_id: data.branch_id,
        amount,
        phone,
        status: ok ? "pending" : "failed",
        checkout_request_id: checkout,
        merchant_request_id: merchant,
        result_desc: stkJson.ResponseDescription || stkJson.errorMessage || null,
        initiated_by: context.userId,
      })
      .select()
      .single();

    if (!ok) {
      return { ok: false, error: stkJson.errorMessage || stkJson.ResponseDescription || "STK push failed", txn: inserted };
    }
    return { ok: true, txn: inserted };
  });

export const queryStkStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ txn_id: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const { data: txn } = await supabaseAdmin
      .from("mpesa_transactions")
      .select("*")
      .eq("id", data.txn_id)
      .maybeSingle();
    if (!txn) throw new Error("Transaction not found");

    // membership check
    const { data: member } = await context.supabase.rpc("is_business_member", {
      _user_id: context.userId,
      _business_id: txn.business_id,
    });
    if (!member) throw new Error("Not authorized");

    if (txn.status !== "pending" || !txn.checkout_request_id) return txn;

    const { data: cfg } = await supabaseAdmin
      .from("mpesa_configs")
      .select("*")
      .eq("business_id", txn.business_id)
      .maybeSingle();
    if (!cfg) return txn;

    try {
      const token = await getToken(cfg.consumer_key, cfg.consumer_secret, cfg.environment);
      const ts = timestamp();
      const password = Buffer.from(`${cfg.shortcode}${cfg.passkey}${ts}`).toString("base64");
      const res = await fetch(`${baseUrl(cfg.environment)}/mpesa/stkpushquery/v1/query`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          BusinessShortCode: cfg.shortcode,
          Password: password,
          Timestamp: ts,
          CheckoutRequestID: txn.checkout_request_id,
        }),
      });
      const json = (await res.json()) as Record<string, string>;
      const code = json.ResultCode != null ? Number(json.ResultCode) : null;
      let status = txn.status;
      if (code === 0) status = "success";
      else if (code != null && code !== 1032) status = "failed";

      const { data: updated } = await supabaseAdmin
        .from("mpesa_transactions")
        .update({
          status,
          result_code: code,
          result_desc: json.ResultDesc ?? json.errorMessage ?? null,
        })
        .eq("id", txn.id)
        .select()
        .single();
      return updated ?? txn;
    } catch (e) {
      console.error("STK query error", e);
      return txn;
    }
  });

export const attachMpesaToSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ txn_id: z.string().uuid(), sale_id: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const { data: txn } = await supabaseAdmin
      .from("mpesa_transactions")
      .select("business_id")
      .eq("id", data.txn_id)
      .maybeSingle();
    if (!txn) throw new Error("Transaction not found");
    const { data: member } = await context.supabase.rpc("is_business_member", {
      _user_id: context.userId,
      _business_id: txn.business_id,
    });
    if (!member) throw new Error("Not authorized");
    await supabaseAdmin.from("mpesa_transactions").update({ sale_id: data.sale_id }).eq("id", data.txn_id);
    return { ok: true };
  });
