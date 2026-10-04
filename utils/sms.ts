import { supabase } from './supabaseClient';

/**
 * Normalizes phone numbers to standard Ghana format (233XXXXXXXXX).
 * Handles numbers like 0241234567, +233241234567, 233 24 123 4567, etc.
 */
export function formatGhanaPhone(raw: string | undefined | null): string {
    if (!raw) return '';
    let cleaned = String(raw).replace(/[^0-9]/g, '');
    if (cleaned.startsWith('0') && cleaned.length === 10) {
        return '233' + cleaned.slice(1);
    }
    if (cleaned.startsWith('233') && cleaned.length === 12) {
        return cleaned;
    }
    if (cleaned.length === 9) {
        return '233' + cleaned;
    }
    return cleaned;
}

/**
 * Validates if the phone number is a valid Ghana mobile number.
 */
export function isValidGhanaPhone(raw: string | undefined | null): boolean {
    const formatted = formatGhanaPhone(raw);
    return formatted.length === 12 && formatted.startsWith('233');
}

export interface HubtelSMSRecipient {
    phone: string;
    vars?: Record<string, string | number>;
}

export interface SendSmsParams {
    recipients: HubtelSMSRecipient[];
    message: string;
    schoolName?: string;
}

/**
 * Dispatches SMS via Supabase Edge Function 'send-sms' connecting to Hubtel.
 * Provides clear and actionable diagnostics if the edge function is not deployed.
 */
export async function sendHubtelSms(params: SendSmsParams): Promise<{ count: number; data?: any }> {
    const { recipients, message, schoolName } = params;

    // Filter and format recipients
    const validRecipients = recipients
        .map(r => ({
            ...r,
            phone: formatGhanaPhone(r.phone)
        }))
        .filter(r => r.phone && r.phone.length >= 10);

    if (validRecipients.length === 0) {
        throw new Error('No valid Ghana phone numbers found among the selected recipients.');
    }

    const clientId = (import.meta as any).env.VITE_HUBTEL_CLIENT_ID;
    const clientSecret = (import.meta as any).env.VITE_HUBTEL_CLIENT_SECRET;
    const senderId = (import.meta as any).env.VITE_HUBTEL_SENDER_ID || schoolName?.slice(0, 11) || 'Orbit';

    const finalMessage = schoolName ? `${schoolName}\n${message}` : message;

    // Dispatches SMS via the deployed Supabase Edge Function 'send-sms'
    try {
        const { data, error } = await supabase.functions.invoke('send-sms', {
            body: {
                recipients: validRecipients,
                message: finalMessage,
                hubtelKeys: {
                    clientId,
                    clientSecret,
                    senderId
                }
            }
        });

        if (error) {
            console.error('Supabase Edge Function "send-sms" invocation error:', error);
            throw new Error(`SMS delivery error: ${error.message || 'Failed to dispatch via Hubtel'}`);
        }

        return { count: validRecipients.length, data };
    } catch (err: any) {
        if (err.message && err.message.includes('pending deployment')) {
            throw err;
        }
        console.error('Hubtel SMS Dispatch failure:', err);
        throw new Error(
            err.message ||
            "Unable to reach the SMS gateway. Please check your Hubtel credentials in .env and ensure the 'send-sms' function is deployed."
        );
    }
}
