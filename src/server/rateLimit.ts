const startWindows = new Map<string, number>();
const hitCounts = new Map<string, number>();

export function checkRateLimit(ip: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const windowStart = startWindows.get(ip) || now;

    // If window expired, reset
    if (now - windowStart > windowMs) {
        startWindows.set(ip, now);
        hitCounts.set(ip, 1);
        return false; // Not limited
    }

    const count = hitCounts.get(ip) || 0;
    if (count >= limit) return true; // Limited

    hitCounts.set(ip, count + 1);
    return false;
}
