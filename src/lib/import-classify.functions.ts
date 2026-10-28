/**
 * AI-assisted bulk import: maps free-form spreadsheet rows into a normalized
 * inventory schema (hardware OR timber) using Lovable AI Gateway (Gemini).
 * Returns suggestions only — user reviews & confirms before commit.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  headers: z.array(z.string()).max(50),
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))).max(500),
});

interface NormalizedItem {
  kind: "hardware" | "timber";
  // shared
  name: string;
  price: number;
  stock: number;
  unit?: string;
  category?: string;
  sku?: string;
  supplier?: string;
  // timber-only (parsed measurements)
  species?: string;
  grade?: string;
  thickness?: number;
  width?: number;
  length?: number;
  dim_unit?: string;
  length_unit?: string;
  pieces?: number;
  source_row: number;
  confidence: number; // 0..1
}

export const classifyImportRows = createServerFn({ method: "POST" })
  .inputValidator((d) => InputSchema.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not set");

    const sample = data.rows.slice(0, 100);
    const sys = `You are an inventory data normalizer for a hardware + timber yard.
Classify each row as either "hardware" or "timber". Timber rows describe wood/lumber
(species like Pine/Cypress/Mahogany, with thickness x width x length measurements).
Hardware rows describe nails, paint, tools, fixtures, cement, etc.

Extract these fields (use null when unknown):
- name (hardware) or species (timber)
- price (numeric, no currency symbol)
- stock (hardware count) or pieces (timber count)
- unit ("pcs","kg","m","box","bag","ft","l")
- category (for hardware)
- sku (if present, else null — caller will auto-generate)
- supplier
- For timber: thickness, width, length, dim_unit ("in"/"mm"/"cm"), length_unit ("ft"/"m")
- grade (timber, optional)

Return strictly JSON: { items: NormalizedItem[] }. No prose.`;

    const userPrompt = `Headers: ${JSON.stringify(data.headers)}
Rows (index → object):
${sample.map((r, i) => `${i}: ${JSON.stringify(r)}`).join("\n")}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "submit_items",
            description: "Submit normalized items.",
            parameters: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      kind: { type: "string", enum: ["hardware", "timber"] },
                      name: { type: "string" },
                      price: { type: "number" },
                      stock: { type: "number" },
                      unit: { type: "string" },
                      category: { type: "string" },
                      sku: { type: "string" },
                      supplier: { type: "string" },
                      species: { type: "string" },
                      grade: { type: "string" },
                      thickness: { type: "number" },
                      width: { type: "number" },
                      length: { type: "number" },
                      dim_unit: { type: "string" },
                      length_unit: { type: "string" },
                      pieces: { type: "number" },
                      source_row: { type: "number" },
                      confidence: { type: "number" },
                    },
                    required: ["kind", "source_row", "confidence"],
                  },
                },
              },
              required: ["items"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "submit_items" } },
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      if (res.status === 429) throw new Error("Rate limit exceeded — try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted. Please top up Lovable AI.");
      throw new Error(`AI error ${res.status}: ${t.slice(0, 200)}`);
    }

    const json = await res.json() as {
      choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }>;
    };
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return { items: [] as NormalizedItem[] };
    try {
      const parsed = JSON.parse(args) as { items: NormalizedItem[] };
      return { items: parsed.items ?? [] };
    } catch {
      return { items: [] as NormalizedItem[] };
    }
  });
