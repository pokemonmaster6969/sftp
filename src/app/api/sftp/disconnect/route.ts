import { NextRequest, NextResponse } from 'next/server';
import { removeSession, getSession } from '@/server/sessionStore';

export async function POST(req: NextRequest) {
    try {
        const { sessionId } = await req.json();
        if (sessionId && getSession(sessionId)) {
            removeSession(sessionId);
        }
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
}
