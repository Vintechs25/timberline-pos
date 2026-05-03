import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

interface CallbackPayload {
  Body?: {
    stkCallback?: {
      MerchantRequestID?: string;
      CheckoutRequestID?: string;
      ResultCode?: number;
      ResultDesc?: string;
      CallbackMetadata?: { Item?: Array<{ Name: string; Value?: string | number }> };
    };
  };
}

export const Route = createFileRoute("/api/public/mpesa-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: CallbackPayload = {};
        try { body = (await request.json()) as CallbackPayload; } catch { /* noop */ }
        const stk = body.Body?.stkCallback;
        if (!stk?.CheckoutRequestID) {
          return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "ok" }), {
            status: 200, headers: { "Content-Type": "application/json" },
          });
        }
        const items = stk.CallbackMetadata?.Item ?? [];
        const findItem = (n: string) => items.find((i) => i.Name === n)?.Value;
        const receipt = findItem("MpesaReceiptNumber") as string | undefined;
        const code = stk.ResultCode ?? null;
        const status = code === 0 ? "success" : "failed";

        await supabaseAdmin
          .from("mpesa_transactions")
          .update({
            status,
            result_code: code,
            result_desc: stk.ResultDesc ?? null,
            mpesa_receipt: receipt ?? null,
            raw_callback: body as unknown as Record<string, unknown>,
          })
          .eq("checkout_request_id", stk.CheckoutRequestID);

        return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "ok" }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
