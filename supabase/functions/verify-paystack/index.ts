// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!paystackSecret || !supabaseUrl || !serviceRoleKey) {
      throw new Error("Server payment configuration missing (PAYSTACK_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY).");
    }

    // 1. Authenticate caller from JWT
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing authorization token." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid or expired user session." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      reference,
      action, // 'wallet_topup' | 'sms_purchase' | 'subscription' | 'module_unlock'
      schoolId,
      expectedAmount,
      planCode,
      moduleCode,
      moduleName,
      smsQuantity,
      paymentMethod,
      description,
    } = body;

    if (!reference || !action || !schoolId || !expectedAmount || Number(expectedAmount) <= 0) {
      throw new Error("Missing required payment verification fields.");
    }

    // 2. Verify caller belongs to this school (or is super_admin)
    const { data: callerProfile, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("school_id, role")
      .eq("id", userData.user.id)
      .single();

    if (profErr || !callerProfile) {
      throw new Error("Caller profile not found.");
    }
    if (callerProfile.role !== "super_admin" && callerProfile.school_id !== schoolId) {
      return new Response(JSON.stringify({ error: "Unauthorized for this school." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Idempotency check — prevent replaying the same Paystack reference
    const [walletDup, smsDup, invoiceDup] = await Promise.all([
      supabaseAdmin.from("school_wallet_transactions").select("id").eq("payment_reference", reference).maybeSingle(),
      supabaseAdmin.from("sms_purchases").select("id").eq("payment_reference", reference).maybeSingle(),
      supabaseAdmin.from("school_billing_invoices").select("id").eq("reference", reference).maybeSingle(),
    ]);

    if (walletDup.data || smsDup.data || invoiceDup.data) {
      throw new Error("This payment reference has already been processed.");
    }

    // 4. Verify transaction directly with Paystack API
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        Accept: "application/json",
      },
    });

    const verifyJson = await verifyRes.json();
    if (!verifyRes.ok || !verifyJson?.status || verifyJson?.data?.status !== "success") {
      throw new Error(verifyJson?.message || "Paystack transaction verification failed.");
    }

    const paidPesewas = Number(verifyJson.data.amount || 0);
    const expectedPesewas = Math.round(Number(expectedAmount) * 100);
    if (paidPesewas < expectedPesewas) {
      throw new Error(`Amount mismatch: paid ${paidPesewas / 100} GHS, expected ${expectedAmount} GHS.`);
    }

    const methodLabel = paymentMethod || "Paystack MoMo/Card";

    // 5. Apply verified action server-side
    if (action === "wallet_topup") {
      const { error } = await supabaseAdmin.rpc("top_up_school_wallet", {
        p_school_id: schoolId,
        p_amount: Number(expectedAmount),
        p_payment_ref: reference,
        p_payment_method: methodLabel,
      });
      if (error) throw error;
    } else if (action === "sms_purchase") {
      if (!smsQuantity || Number(smsQuantity) <= 0) {
        throw new Error("Invalid SMS quantity.");
      }
      const { error } = await supabaseAdmin.rpc("top_up_school_sms", {
        p_school_id: schoolId,
        p_quantity: Number(smsQuantity),
        p_amount: Number(expectedAmount),
        p_payment_ref: reference,
        p_payment_method: methodLabel,
      });
      if (error) throw error;
    } else if (action === "subscription") {
      const { error } = await supabaseAdmin.rpc("activate_school_subscription", {
        p_school_id: schoolId,
        p_plan_code: planCode || "full_suite",
        p_amount: Number(expectedAmount),
        p_payment_method: methodLabel,
        p_payment_ref: reference,
        p_description: description || "Orbit Subscription Plan",
      });
      if (error) throw error;

      const { data: schoolRow } = await supabaseAdmin
        .from("schools")
        .select("current_term, academic_year")
        .eq("id", schoolId)
        .maybeSingle();
      if (schoolRow) {
        await supabaseAdmin
          .from("school_subscriptions")
          .update({
            term: schoolRow.current_term,
            academic_year: schoolRow.academic_year,
            status: "active",
            expires_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("school_id", schoolId);
      }
    } else if (action === "module_unlock") {
      if (!moduleCode) throw new Error("Missing moduleCode.");
      const [{ data: subData }, { data: schoolRow }] = await Promise.all([
        supabaseAdmin.from("school_subscriptions").select("*").eq("school_id", schoolId).maybeSingle(),
        supabaseAdmin.from("schools").select("current_term, academic_year").eq("id", schoolId).maybeSingle(),
      ]);

      const currentModules: string[] =
        subData?.status === "active" && Array.isArray(subData?.unlocked_modules)
          ? subData.unlocked_modules
          : [];
      const updatedModules = currentModules.includes(moduleCode)
        ? currentModules
        : [...currentModules, moduleCode];

      if (subData) {
        const { error: upErr } = await supabaseAdmin
          .from("school_subscriptions")
          .update({
            unlocked_modules: updatedModules,
            status: "active",
            term: schoolRow?.current_term || null,
            academic_year: schoolRow?.academic_year || null,
            expires_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("school_id", schoolId);
        if (upErr) throw upErr;
      } else {
        const { error: insErr } = await supabaseAdmin.from("school_subscriptions").insert({
          school_id: schoolId,
          plan_type: "modular",
          unlocked_modules: updatedModules,
          status: "active",
          term: schoolRow?.current_term || null,
          academic_year: schoolRow?.academic_year || null,
          expires_at: null,
        });
        if (insErr) throw insErr;
      }

      await supabaseAdmin.from("school_billing_invoices").insert({
        school_id: schoolId,
        amount: Number(expectedAmount),
        status: "paid",
        payment_method: methodLabel,
        reference,
        description: `Module Activation: ${moduleName || moduleCode}`,
      });
    } else {
      throw new Error(`Unsupported payment action: ${action}`);
    }

    return new Response(JSON.stringify({ success: true, reference, action }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("verify-paystack error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Payment verification failed." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
