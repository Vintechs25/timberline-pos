import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ProvisionSchema = z.object({
  businessName: z.string().min(1).max(120),
  slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/),
  ownerEmail: z.string().email().max(180),
  ownerPassword: z.string().min(8).max(120),
  ownerFullName: z.string().min(1).max(120),
  defaultBranchName: z.string().min(1).max(120).default("Main Branch"),
  defaultBranchCode: z.string().min(1).max(20).default("HQ"),
  licenseDays: z.number().int().min(1).max(3650).default(365),
});

export const provisionBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProvisionSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Ensure caller is system_owner
    const { data: callerRoles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isOwner = (callerRoles ?? []).some((r) => r.role === "system_owner");
    if (!isOwner) {
      throw new Error("Only the System Owner can provision businesses.");
    }

    // 1. Create auth user (admin)
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.ownerEmail,
      password: data.ownerPassword,
      email_confirm: true,
      user_metadata: { full_name: data.ownerFullName },
    });

    let ownerId: string | null = created?.user?.id ?? null;

    if (createErr) {
      // If user already exists, try to look them up
      if (/already.*registered|already exists|duplicate/i.test(createErr.message)) {
        const { data: list } = await supabaseAdmin.auth.admin.listUsers();
        const existing = list?.users.find((u) => u.email?.toLowerCase() === data.ownerEmail.toLowerCase());
        if (existing) ownerId = existing.id;
        else throw new Error(createErr.message);
      } else {
        throw new Error(createErr.message);
      }
    }

    if (!ownerId) throw new Error("Failed to obtain owner user id.");

    // Ensure profile row
    await supabaseAdmin.from("profiles").upsert({ id: ownerId, full_name: data.ownerFullName });

    // 2. Create business
    const expiresAt = new Date(Date.now() + data.licenseDays * 86400 * 1000).toISOString();
    const { data: biz, error: bizErr } = await supabaseAdmin
      .from("businesses")
      .insert({
        name: data.businessName,
        slug: data.slug,
        owner_user_id: ownerId,
        license_expires_at: expiresAt,
      })
      .select()
      .single();
    if (bizErr || !biz) throw new Error(bizErr?.message ?? "Failed to create business");

    // 3. Default branch
    const { data: branch, error: branchErr } = await supabaseAdmin
      .from("branches")
      .insert({
        business_id: biz.id,
        name: data.defaultBranchName,
        code: data.defaultBranchCode.toUpperCase(),
      })
      .select()
      .single();
    if (branchErr) throw new Error(branchErr.message);

    // 4. Assign business_admin role + business membership
    await supabaseAdmin.from("user_roles").insert({
      user_id: ownerId,
      role: "business_admin",
      business_id: biz.id,
    });
    await supabaseAdmin.from("business_users").insert({
      user_id: ownerId,
      business_id: biz.id,
      default_branch_id: branch?.id ?? null,
    });

    return {
      business: { id: biz.id, name: biz.name, slug: biz.slug, license_key: biz.license_key },
      branch: branch ? { id: branch.id, name: branch.name, code: branch.code } : null,
      owner: { id: ownerId, email: data.ownerEmail },
    };
  });

// Provision a staff (cashier/supervisor) account for a business
const ProvisionStaffSchema = z.object({
  businessId: z.string().uuid(),
  branchId: z.string().uuid().nullable(),
  email: z.string().email(),
  password: z.string().min(8).max(120),
  fullName: z.string().min(1).max(120),
  role: z.enum(["cashier", "supervisor", "business_admin"]),
});

export const provisionStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProvisionStaffSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Caller must be system_owner OR business_admin of that business
    const { data: callerRoles } = await context.supabase
      .from("user_roles")
      .select("role,business_id")
      .eq("user_id", context.userId);
    const isOwner = (callerRoles ?? []).some((r) => r.role === "system_owner");
    const isAdmin = (callerRoles ?? []).some(
      (r) => r.role === "business_admin" && r.business_id === data.businessId,
    );
    if (!isOwner && !isAdmin) throw new Error("Not authorized to add staff to this business.");

    // Create or fetch user
    let userId: string | null = null;
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (createErr) {
      if (/already.*registered|already exists|duplicate/i.test(createErr.message)) {
        const { data: list } = await supabaseAdmin.auth.admin.listUsers();
        const existing = list?.users.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());
        if (existing) userId = existing.id;
        else throw new Error(createErr.message);
      } else {
        throw new Error(createErr.message);
      }
    } else {
      userId = created?.user?.id ?? null;
    }
    if (!userId) throw new Error("Failed to obtain user id");

    await supabaseAdmin.from("profiles").upsert({ id: userId, full_name: data.fullName });

    await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role: data.role,
      business_id: data.businessId,
      branch_id: data.branchId,
    });
    await supabaseAdmin.from("business_users").upsert(
      {
        user_id: userId,
        business_id: data.businessId,
        default_branch_id: data.branchId,
      },
      { onConflict: "business_id,user_id" } as never,
    );

    return { userId, email: data.email };
  });
