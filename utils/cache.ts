export const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

export const getCachedData = <T>(key: string): T | null => {
    const cached = sessionStorage.getItem(key);
    if (!cached) return null;
    try {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
            return data;
        }
        return null; // Expired
    } catch {
        return null;
    }
};

export const setCachedData = (key: string, data: any) => {
    sessionStorage.setItem(key, JSON.stringify({
        data,
        timestamp: Date.now()
    }));
};

export const clearCache = (key: string) => {
    sessionStorage.removeItem(key);
};
