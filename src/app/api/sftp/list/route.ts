import { NextRequest, NextResponse } from 'next/server';
import { getSession, runSessionOp } from '@/server/sessionStore';
import { listFiles } from '@/server/fileUtils';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    const path = searchParams.get('path') || '/';

    if (!sessionId || !getSession(sessionId)) {
        return NextResponse.json({ error: 'Session expired' }, { status: 404 });
    }

    const session = getSession(sessionId)!;
    try {
        const files = await runSessionOp(sessionId, (client) => listFiles(client, session.type, path));
        return NextResponse.json({ success: true, files });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
