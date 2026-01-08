
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

Deno.serve(async (req) => {
    // 1. Handle CORS Preflight (OPTIONS)
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 2. Parse Request Body
        const { phoneNumbers, message, hubtelKeys } = await req.json()

        if (!phoneNumbers || !message) {
            throw new Error('Missing phoneNumbers or message')
        }

        // 3. Get Credentials
        const clientId = Deno.env.get('HUBTEL_CLIENT_ID') || hubtelKeys?.clientId;
        const clientSecret = Deno.env.get('HUBTEL_CLIENT_SECRET') || hubtelKeys?.clientSecret;
        const senderId = Deno.env.get('HUBTEL_SENDER_ID') || hubtelKeys?.senderId || 'Orbit';

        if (!clientId || !clientSecret) {
            throw new Error('Hubtel Credentials missing.')
        }

        // 4. Format & Log
        const to = Array.isArray(phoneNumbers) ? phoneNumbers.join(',') : phoneNumbers;
        console.log(`Sending to ${to}...`);

        // 5. Hubtel API URL
        const url = new URL("https://smsc.hubtel.com/v1/messages/send");
        url.searchParams.append("clientid", clientId);
        url.searchParams.append("clientsecret", clientSecret);
        url.searchParams.append("from", senderId);
        url.searchParams.append("to", to);
        url.searchParams.append("content", message);

        // 6. Request
        const response = await fetch(url.toString(), { method: 'GET' });
        const data = await response.json();
        console.log('Hubtel Response:', data);

        return new Response(JSON.stringify({ success: true, apiResponse: data }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        console.error('Error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
