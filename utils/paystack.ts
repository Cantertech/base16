/**
 * Orbit Paystack Integration Utility
 * Supports Mobile Money (MTN, Telecel, AT) and Debit/Credit Cards in Ghana (GHS)
 */

declare global {
    interface Window {
        PaystackPop?: {
            setup: (options: any) => {
                openIframe: () => void;
            };
        };
    }
}

export interface PaystackPaymentConfig {
    amount: number; // in GHS (e.g. 100 for GH₵ 100)
    email: string;
    reference?: string;
    metadata?: Record<string, any>;
    channels?: string[]; // ['mobile_money', 'card']
    onSuccess: (response: { reference: string; status?: string; message?: string }) => void;
    onClose?: () => void;
}

export const loadPaystackScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
        if (typeof window !== 'undefined' && window.PaystackPop) {
            resolve(true);
            return;
        }
        if (typeof document === 'undefined') {
            resolve(false);
            return;
        }
        const existingScript = document.getElementById('paystack-inline-js');
        if (existingScript) {
            existingScript.addEventListener('load', () => resolve(true));
            return;
        }
        const script = document.createElement('script');
        script.id = 'paystack-inline-js';
        script.src = 'https://js.paystack.co/v1/inline.js';
        script.async = true;
        script.onload = () => resolve(true);
        script.onerror = () => {
            console.error('Failed to load Paystack inline script');
            resolve(false);
        };
        document.body.appendChild(script);
    });
};

export const payWithPaystack = async (config: PaystackPaymentConfig): Promise<boolean> => {
    const key = (import.meta as any).env.VITE_PAYSTACK_PUBLIC_KEY;
    if (!key || key === 'your_paystack_public_key') {
        alert('Paystack Public Key (VITE_PAYSTACK_PUBLIC_KEY) is not configured in .env. Please add your key to proceed with live payments.');
        return false;
    }

    const loaded = await loadPaystackScript();
    if (!loaded || !window.PaystackPop) {
        alert('Payment gateway could not be initialized. Please check your internet connection and try again.');
        return false;
    }

    const reference = config.reference || `ORBIT-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const amountInPesewas = Math.round(config.amount * 100);

    try {
        const handler = window.PaystackPop.setup({
            key,
            email: config.email && config.email.includes('@') ? config.email : 'school@orbit.edu.gh',
            amount: amountInPesewas,
            currency: 'GHS',
            ref: reference,
            channels: config.channels || ['mobile_money', 'card'],
            metadata: {
                custom_fields: [
                    { display_name: 'Platform', variable_name: 'platform', value: 'Orbit School Management' }
                ],
                ...(config.metadata || {})
            },
            callback: (response: any) => {
                config.onSuccess({
                    reference: response.reference || reference,
                    status: response.status || 'success',
                    message: response.message
                });
            },
            onClose: () => {
                if (config.onClose) config.onClose();
            }
        });

        handler.openIframe();
        return true;
    } catch (err: any) {
        console.error('Error opening Paystack iframe:', err);
        alert(`Could not initiate payment: ${err.message || 'Please check your connection'}`);
        return false;
    }
};
