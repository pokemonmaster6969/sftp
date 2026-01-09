import { NextRequest, NextResponse } from 'next/server';
import { getSession, runSessionOp } from '@/server/sessionStore';

export async function POST(req: NextRequest) {
    try {
        const { sessionId, path, isDirectory } = await req.json();

        if (!sessionId || !getSession(sessionId)) {
            return NextResponse.json({ error: 'Session expired' }, { status: 404 });
        }

        const session = getSession(sessionId)!;

        await runSessionOp(sessionId, async (client) => {
            if (session.type === 'sftp') {
                if (isDirectory) {
                    // rmdir with recursive=true
                    await client.rmdir(path, true);
                } else {
                    await client.delete(path);
                }
            } else {
                // FTP
                if (isDirectory) {
                    await client.removeDir(path);
                } else {
                    await client.remove(path);
                }
            }
        });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
