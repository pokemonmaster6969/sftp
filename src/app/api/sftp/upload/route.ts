import { NextRequest, NextResponse } from 'next/server';
import { getSession, runSessionOp } from '@/server/sessionStore';
import * as fs from 'fs/promises';
import * as pathPkg from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const sessionId = formData.get('sessionId') as string;
        const remoteDir = formData.get('path') as string;
        const file = formData.get('file') as File;

        if (!sessionId || !file || !getSession(sessionId)) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        // Convert File to Buffer
        const buffer = Buffer.from(await file.arrayBuffer());
        // Create temp file
        // Sanitizing filename for temp storage to avoid issues, but we keep original for remote
        const tempFileName = `upload-${uuidv4()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const tempPath = pathPkg.join(os.tmpdir(), tempFileName);

        await fs.writeFile(tempPath, buffer);

        const remotePath = pathPkg.posix.join(remoteDir || '/', file.name);
        const session = getSession(sessionId)!;

        try {
            await runSessionOp(sessionId, async (client) => {
                if (session.type === 'sftp') {
                    // ssh2-sftp-client put(local, remote)
                    await client.put(tempPath, remotePath);
                } else {
                    // basic-ftp uploadFrom(local, remote)
                    await client.uploadFrom(tempPath, remotePath);
                }
            });
        } finally {
            // Clean up temp file regardless of success/fail
            try { await fs.unlink(tempPath); } catch { }
        }

        return NextResponse.json({ success: true });

    } catch (err: any) {
        console.error('Upload error:', err);
        return NextResponse.json({ error: err.message || 'Upload failed' }, { status: 500 });
    }
}
