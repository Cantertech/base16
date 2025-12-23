import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

export type CurrencyCode = 'GHS' | 'NGN' | 'KES' | 'USD' | 'ZAR' | 'UGX' | 'TZS' | 'RWF';

export interface Currency {
    code: CurrencyCode;
    symbol: string;
    name: string;
}

export const CURRENCIES: Currency[] = [
    { code: 'GHS', symbol: 'GH¢', name: 'Ghana Cedi' },
    { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
    { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
    { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling' },
    { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling' },
    { code: 'RWF', symbol: 'FRw', name: 'Rwandan Franc' },
];

interface CurrencyContextType {
    currency: Currency;
    setCurrencyCode: (code: CurrencyCode) => void;
    loading: boolean;
    formatAmount: (amount: number) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currency, setCurrency] = useState<Currency>(CURRENCIES[0]); // Default to GHS
    const [loading, setLoading] = useState(true);

    const fetchCurrency = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('school_id')
                .eq('id', user.id)
                .single();

            if (profile?.school_id) {
                const { data: school } = await supabase
                    .from('schools')
                    .select('currency')
                    .eq('id', profile.school_id)
                    .single();

                if (school?.currency) {
                    const found = CURRENCIES.find(c => c.code === school.currency);
                    if (found) setCurrency(found);
                }
            }
        } catch (error) {
            console.error('Error fetching currency:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCurrency();

        // Subscribe to auth changes to refetch if user logs in basically
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) {
                fetchCurrency();
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const setCurrencyCode = (code: CurrencyCode) => {
        const found = CURRENCIES.find(c => c.code === code);
        if (found) setCurrency(found);
    };

    const formatAmount = (amount: number) => {
        return `${currency.symbol} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    return (
        <CurrencyContext.Provider value={{ currency, setCurrencyCode, loading, formatAmount }}>
            {children}
        </CurrencyContext.Provider>
    );
};

export const useCurrency = () => {
    const context = useContext(CurrencyContext);
    if (context === undefined) {
        throw new Error('useCurrency must be used within a CurrencyProvider');
    }
    return context;
};
