// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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

serve(async (req) => {
    // 1. Handle CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { recipients, phoneNumbers, message, hubtelKeys } = await req.json()

        // 2. Get Credentials
        const clientId = Deno.env.get('HUBTEL_CLIENT_ID') || hubtelKeys?.clientId;
        const clientSecret = Deno.env.get('HUBTEL_CLIENT_SECRET') || hubtelKeys?.clientSecret;
        const senderId = Deno.env.get('HUBTEL_SENDER_ID') || hubtelKeys?.senderId || 'Orbit';

        if (!clientId || !clientSecret) {
            throw new Error('Hubtel Credentials missing. Please ensure HUBTEL_CLIENT_ID and HUBTEL_CLIENT_SECRET are provided.');
        }

        // MODE A: Personalized Blast (Recipients Array with Vars)
        // Frontend sends: recipients: [{ phone: '...', vars: { '{Parent Name}': 'John' } }]
        if (recipients && Array.isArray(recipients) && recipients.length > 0) {
            console.log(`Processing ${recipients.length} personalized messages via Hubtel...`);

            // Limit concurrency if needed, but for <500 Promise.all is usually fine on Deno Deploy
            const promises = recipients.map(async (r) => {
                let personalizedMsg = message;

                // Replace variables
                if (r.vars) {
                    for (const [key, val] of Object.entries(r.vars)) {
                        // Replace all occurrences of the variable
                        personalizedMsg = personalizedMsg.split(key).join(String(val));
                    }
                }

                // Send Single SMS to Hubtel
                // Format to Ghana 233 format
                const to = formatGhanaPhone(r.phone);
                if (!to || to.length < 10) {
                    return { to: r.phone, error: 'Invalid phone format' };
                }

                const url = new URL("https://smsc.hubtel.com/v1/messages/send");
                url.searchParams.append("clientid", clientId);
                url.searchParams.append("clientsecret", clientSecret);
                url.searchParams.append("from", senderId);
                url.searchParams.append("to", to);
                url.searchParams.append("content", personalizedMsg);

                try {
                    const res = await fetch(url.toString(), { method: 'GET' });
                    const json = await res.json();
                    return { to, status: json.status || 'sent', data: json };
                } catch (e) {
                    return { to, error: e.message };
                }
            });

            // Wait for all to finish
            const results = await Promise.all(promises);
            console.log(`Sent ${results.length} messages.`);

            return new Response(JSON.stringify({ success: true, count: results.length, sample: results[0] }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        }

        // MODE B: Standard Bulk (Same content to many numbers) - Fallback
        // Used if frontend sends old payload format
        if ((phoneNumbers && phoneNumbers.length > 0) && message) {
            const rawList = Array.isArray(phoneNumbers) ? phoneNumbers : [phoneNumbers];
            const formatted = rawList.map(formatGhanaPhone).filter(Boolean);
            const to = formatted.join(',');
            console.log(`Sending Bulk SMS to ${formatted.length} numbers via Hubtel...`);

            const url = new URL("https://smsc.hubtel.com/v1/messages/send");
            url.searchParams.append("clientid", clientId);
            url.searchParams.append("clientsecret", clientSecret);
            url.searchParams.append("from", senderId);
            url.searchParams.append("to", to);
            url.searchParams.append("content", message);

            const response = await fetch(url.toString(), { method: 'GET' });
            const data = await response.json();

            return new Response(JSON.stringify({ success: true, apiResponse: data }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        }

        throw new Error('Invalid Payload. Provide "recipients" array or "phoneNumbers" array.');

    } catch (error) {
        console.error('Error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
