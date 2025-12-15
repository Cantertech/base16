
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
        const { phoneNumbers, message } = await req.json()

        if (!phoneNumbers || !message) {
            throw new Error('Missing phoneNumbers or message')
        }

        const username = Deno.env.get('AFRICASTALKING_USERNAME') || 'sandbox'
        const apiKey = Deno.env.get('AFRICASTALKING_API_KEY')

        // Determine API URL based on username (sandbox vs prod)
        const isSandbox = username === 'sandbox';
        const apiUrl = isSandbox
            ? 'https://api.sandbox.africastalking.com/version1/messaging'
            : 'https://api.africastalking.com/version1/messaging';

        if (!apiKey) {
            throw new Error('AFRICASTALKING_API_KEY not set')
        }

        // Format phone numbers (ensure comma separated string)
        // Africa's Talking expects a comma-separated string of numbers like "+233...,+233..."
        const to = Array.isArray(phoneNumbers) ? phoneNumbers.join(',') : phoneNumbers

        const body = new URLSearchParams({
            username: username,
            to: to,
            message: message,
            // from: 'YourSenderID' // Optional, requires registration
        })

        console.log(`Sending SMS to ${to} via ${isSandbox ? 'Sandbox' : 'Live'}`);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'apiKey': apiKey,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: body.toString(),
        })

        const data = await response.json()
        console.log('AT Response:', data)

        return new Response(JSON.stringify(data), {
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
