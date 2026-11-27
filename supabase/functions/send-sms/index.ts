// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

function formatGhanaPhone(raw: string): string {
    if (!raw) return '';
    let cleaned = String(raw).replace(/[^0-9]/g, '');
    if (cleaned.startsWith('0') && cleaned.length === 10) {
        cleaned = '233' + cleaned.slice(1);
    } else if (cleaned.length === 9) {
        cleaned = '233' + cleaned;
    }
    return cleaned;
}

async function parseJsonSafe(res: Response) {
    const rawText = await res.text();
    try {
        return { json: JSON.parse(rawText), rawText };
    } catch {
        return { json: null, rawText };
    }
}

async function sendViaArkesel(apiKey: string, sender: string, recipients: string[], message: string) {
    const res = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
        method: 'POST',
        headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({ sender, message, recipients }),
    });
    const { json, rawText } = await parseJsonSafe(res);
    if (!res.ok || json?.status === 'error') {
        throw new Error(`Arkesel HTTP ${res.status}: ${json?.message || rawText.slice(0, 150)}`);
    }
    return json;
}

async function sendViaHubtel(clientId: string, clientSecret: string, sender: string, toCommaList: string, message: string) {
    const url = new URL('https://smsc.hubtel.com/v1/messages/send');
    url.searchParams.append('clientid', clientId);
    url.searchParams.append('clientsecret', clientSecret);
    url.searchParams.append('from', sender);
    url.searchParams.append('to', toCommaList);
    url.searchParams.append('content', message);

    const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Base16Orbit/1.0)',
            'Accept': 'application/json',
        },
    });
    const { json, rawText } = await parseJsonSafe(res);
    if (!res.ok) {
        throw new Error(`Hubtel HTTP ${res.status}: ${json?.statusDescription || rawText.slice(0, 150)}`);
    }
    return json;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const authHeader = req.headers.get('Authorization') || '';
        const token = authHeader.replace(/^Bearer\s+/i, '').trim();

        if (!token || !supabaseUrl || !serviceRoleKey) {
            return new Response(JSON.stringify({ error: 'Authentication required.' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 401,
            });
        }

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });
        const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
        if (userErr || !userData?.user) {
            return new Response(JSON.stringify({ error: 'Invalid or expired session.' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 401,
            });
        }

        const { data: callerProfile } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', userData.user.id)
            .single();
        if (!callerProfile || !['admin', 'teacher', 'super_admin'].includes(callerProfile.role)) {
            return new Response(JSON.stringify({ error: 'Unauthorized to send SMS.' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 403,
            });
        }

        const { recipients, phoneNumbers, message, senderId: requestedSenderId } = await req.json();

        const arkeselApiKey = Deno.env.get('ARKESEL_API_KEY');
        const arkeselSender = Deno.env.get('ARKESEL_SENDER_ID') || requestedSenderId || 'Base16';

        const hubtelId = Deno.env.get('HUBTEL_CLIENT_ID');
        const hubtelSecret = Deno.env.get('HUBTEL_CLIENT_SECRET');
        const hubtelSender = Deno.env.get('HUBTEL_SENDER_ID') || requestedSenderId || 'Base16';

        const useArkesel = Boolean(arkeselApiKey);
        if (!useArkesel && (!hubtelId || !hubtelSecret)) {
            throw new Error('SMS credentials missing. Set ARKESEL_API_KEY (or HUBTEL_CLIENT_ID + HUBTEL_CLIENT_SECRET) in Supabase Edge Function secrets.');
        }

        // MODE A: Personalized Blast (Recipients Array with Vars)
        if (recipients && Array.isArray(recipients) && recipients.length > 0) {
            const hasVars = recipients.some((r) => r?.vars && Object.keys(r.vars).length > 0);

            // Fast batch path when using Arkesel and all recipients share the same message
            if (useArkesel && !hasVars) {
                const formatted = recipients.map((r) => formatGhanaPhone(r.phone)).filter((p) => p.length >= 10);
                if (formatted.length === 0) throw new Error('No valid phone numbers provided.');
                const data = await sendViaArkesel(arkeselApiKey, arkeselSender, formatted, message);
                return new Response(JSON.stringify({ success: true, provider: 'arkesel', count: formatted.length, data }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200,
                });
            }

            const results = await Promise.all(recipients.map(async (r) => {
                let personalizedMsg = message;
                if (r.vars) {
                    for (const [key, val] of Object.entries(r.vars)) {
                        personalizedMsg = personalizedMsg.split(key).join(String(val));
                    }
                }
                const to = formatGhanaPhone(r.phone);
                if (!to || to.length < 10) {
                    return { to: r.phone, error: 'Invalid phone format' };
                }
                try {
                    const data = useArkesel
                        ? await sendViaArkesel(arkeselApiKey, arkeselSender, [to], personalizedMsg)
                        : await sendViaHubtel(hubtelId, hubtelSecret, hubtelSender, to, personalizedMsg);
                    return { to, status: data?.status || 'sent', data };
                } catch (e) {
                    return { to, error: e.message };
                }
            }));

            return new Response(JSON.stringify({ success: true, provider: useArkesel ? 'arkesel' : 'hubtel', count: results.length, sample: results[0] }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        // MODE B: Standard Bulk (Same content to many numbers)
        if (phoneNumbers && phoneNumbers.length > 0 && message) {
            const rawList = Array.isArray(phoneNumbers) ? phoneNumbers : [phoneNumbers];
            const formatted = rawList.map(formatGhanaPhone).filter((p) => p.length >= 10);
            if (formatted.length === 0) throw new Error('No valid phone numbers provided.');

            const data = useArkesel
                ? await sendViaArkesel(arkeselApiKey, arkeselSender, formatted, message)
                : await sendViaHubtel(hubtelId, hubtelSecret, hubtelSender, formatted.join(','), message);

            return new Response(JSON.stringify({ success: true, provider: useArkesel ? 'arkesel' : 'hubtel', count: formatted.length, apiResponse: data }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        throw new Error('Invalid Payload. Provide "recipients" array or "phoneNumbers" array.');
    } catch (error) {
        console.error('Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
