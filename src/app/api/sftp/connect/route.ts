import { NextRequest, NextResponse } from 'next/server';
import { createSession, runSessionOp } from '@/server/sessionStore';
import { checkRateLimit } from '@/server/rateLimit';
import { testSftpConnection, testFtpConnection } from '@/server/connectionUtils';
import { listFiles } from '@/server/fileUtils';

export async function POST(req: NextRequest) {
    // Fix NextRequest.ip access
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : 'unknown'; // Fallback usage

    if (checkRateLimit(ip, 30, 15 * 60 * 1000)) {
        return NextResponse.json({ error: 'Too many connection attempts' }, { status: 429 });
    }

    let body;
    try {
        body = await req.json();
    } catch (e) {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { server, port, username, password, path: initialPath, protocol, isAdmin } = body;

    if (!server || !username) {
        return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    console.log(`[CONNECT] attempt ${username}@${server}:${port || '(default)'} protocol=${protocol || 'auto'}`);

    const portNum = port ? parseInt(port, 10) : undefined;
    let finalType: 'sftp' | 'ftp' = 'sftp';
    let usedPort = portNum;
    let client: any = null;

    try {
        if (protocol === 'ftp') {
            finalType = 'ftp';
            usedPort = portNum || 21;
            const res = await testFtpConnection({ host: server, port: usedPort, username, password, timeout: 8000 });
            if (!res.ok) throw new Error(res.error);
            client = res.client;
        } else if (protocol === 'sftp') {
            finalType = 'sftp';
            usedPort = portNum || 22;
            const res = await testSftpConnection({ host: server, port: usedPort, username, password, timeout: 8000 });
            if (!res.ok) throw new Error(res.error);
            client = res.client;
        } else {
            // AUTO
            // Try SFTP
            let sftpRes = await testSftpConnection({ host: server, port: portNum || 22, username, password, timeout: 8000 });
            if (sftpRes.ok) {
                finalType = 'sftp';
                usedPort = portNum || 22;
                client = sftpRes.client;
            } else {
                // Check if fallback appropriate
                const msg = (sftpRes.error || '').toLowerCase();
                // Reference logic: if error suggests non-SSH banner OR unsupported protocol OR user passed non-22 (maybe means they wanted FTP on 21 but didn't specify?)
                // Actually reference says: if error suggests ... OR port != 22
                // If port is 21, SFTP fails. We try FTP.
                const seemsLikeAuthError = msg.includes('authentication') || msg.includes('permission') || msg.includes('access denied');

                if (seemsLikeAuthError && (usedPort === 22 || !usedPort)) {
                    // Auth failed on SFTP 22 -> probably just bad password, don't fallback to FTP?
                    // Reference doesn't explicitly block auth fallback, but "Auto-detect" usually implies protocol check.
                    // Reference implementation: "if sres.error suggests non-SSH... try FTP"
                    // It falls back if "Expected SSH banner", "Unsupported protocol", OR "Number(port) !== 22".
                }

                const shouldFallback = msg.includes('banner') || msg.includes('protocol') || msg.includes('garbage') || (portNum && portNum !== 22) || (!seemsLikeAuthError);

                if (shouldFallback) {
                    console.log(`Fallback to FTP (SFTP err: ${msg})`);
                    const ftpRes = await testFtpConnection({ host: server, port: portNum || 21, username, password, timeout: 8000 });
                    if (!ftpRes.ok) throw new Error(`FTP failed: ${ftpRes.error} (SFTP: ${sftpRes.error})`);
                    finalType = 'ftp';
                    usedPort = portNum || 21;
                    client = ftpRes.client;
                } else {
                    throw new Error(sftpRes.error);
                }
            }
        }

        const sessionId = createSession({
            type: finalType,
            client,
            server,
            username,
            isAdmin: !!isAdmin
        });

        // List files
        let files = [];
        try {
            files = await runSessionOp(sessionId, (c) => listFiles(c, finalType, initialPath || '/'));
        } catch (e) {
            console.error("Initial list failed, returning empty", e);
        }

        return NextResponse.json({
            success: true,
            sessionId,
            type: finalType,
            files
        });

    } catch (err: any) {
        console.error('Connect failed:', err.message);
        return NextResponse.json({ error: err.message || 'Connection failed' }, { status: 502 });
    }
}
