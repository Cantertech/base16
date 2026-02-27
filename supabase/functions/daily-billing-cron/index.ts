// import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

// serve(async (req) => {
//     // Use Service Role Key to bypass RLS for system operations
//     const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
//     const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
//     const supabase = createClient(supabaseUrl, supabaseKey)

//     // 1. Target subscriptions expiring within the next 24 hours (or past due that haven't errored out)
//     const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

//     const { data: expiringSubs, error: subError } = await supabase
//         .from('school_subscriptions')
//         .select('id, school_id, module_id, expires_at')
//         .eq('status', 'active')
//         .eq('auto_renew', true)
//         .lte('expires_at', tomorrow)

//     if (subError) {
//         console.error("Failed to fetch subscriptions:", subError.message);
//         return new Response(JSON.stringify({ error: subError.message }), { status: 500, headers: { "Content-Type": "application/json" } })
//     }

//     const batchResults = []

//     // 2. Loop through and execute renewals by calling our secure Postgres RPC
//     for (const sub of expiringSubs) {
//         const { data: rpcResult, error: rpcError } = await supabase.rpc('activate_module', {
//             p_school_id: sub.school_id,
//             p_module_id: sub.module_id
//         })

//         if (rpcError || !rpcResult?.success) {
//             // Wallet lacked funds or RPC failed: Mark subscription as inactive to lock them out
//             const { error: lockError } = await supabase
//                 .from('school_subscriptions')
//                 .update({ status: 'inactive' })
//                 .eq('id', sub.id)

//             batchResults.push({
//                 school_id: sub.school_id,
//                 module_id: sub.module_id,
//                 status: 'failed_deactivated',
//                 reason: rpcError?.message || rpcResult?.message,
//             })
//         } else {
//             // Success! Auto-renewal deducted funds and added 30 days
//             batchResults.push({
//                 school_id: sub.school_id,
//                 module_id: sub.module_id,
//                 status: 'renewed_successfully',
//                 new_balance: rpcResult.new_balance
//             })
//         }
//     }

//     return new Response(JSON.stringify({
//         message: "Daily cron finished processing.",
//         processed_count: expiringSubs.length,
//         results: batchResults
//     }), {
//         headers: { "Content-Type": "application/json" }
//     })
// })
