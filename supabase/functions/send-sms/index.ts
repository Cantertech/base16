
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { phoneNumbers, message, hubtelKeys } = await req.json()

        if (!phoneNumbers || !message) {
            throw new Error('Missing phoneNumbers or message')
        }

        // Prioritize Deno.env (Server Secrets), fallback to passed keys (Frontend .env)
        const clientId = Deno.env.get('HUBTEL_CLIENT_ID') || hubtelKeys?.clientId;
        const clientSecret = Deno.env.get('HUBTEL_CLIENT_SECRET') || hubtelKeys?.clientSecret;
        const senderId = Deno.env.get('HUBTEL_SENDER_ID') || hubtelKeys?.senderId || 'Orbit';

        if (!clientId || !clientSecret) {
            throw new Error('Hubtel Credentials (clientid, clientsecret) missing. Please set them in Supabase Secrets or .env');
        }

        // Join numbers for Hubtel (comma separated)
        // Hubtel format: 23320..., 020...
        const to = Array.isArray(phoneNumbers) ? phoneNumbers.join(',') : phoneNumbers;

        console.log(`Sending Hubtel SMS to ${to.length > 50 ? to.substring(0, 50) + '...' : to}`);

        // Hubtel API URL
        const url = new URL("https://smsc.hubtel.com/v1/messages/send");
        url.searchParams.append("clientid", clientId);
        url.searchParams.append("clientsecret", clientSecret);
        url.searchParams.append("from", senderId);
        url.searchParams.append("to", to);
        url.searchParams.append("content", message);

        // Making the GET request
        const response = await fetch(url.toString(), { method: 'GET' });

        // Handle Hubtel JSON response
        const data = await response.json();
        console.log('Hubtel Response:', data);

        // Check if Hubtel request was successful in their terms (status usually in response)
        // Hubtel response example: { "status": "0", "data": ... } or List of messages
        // Assuming simplistic check or just returning data for client to parse

        return new Response(JSON.stringify({ success: true, apiResponse: data }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        console.error('Error sending SMS:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
