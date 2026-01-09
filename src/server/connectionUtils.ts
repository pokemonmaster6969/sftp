import { NextRequest } from 'next/server';
import { runSessionOp, SftpSession } from './sessionStore';

const withTimeout = <T>(promise: Promise<T>, ms: number, errMsg?: string): Promise<T> => {
    let timer: NodeJS.Timeout;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(errMsg || `Operation timed out after ${ms}ms`)), ms);
    });
    return Promise.race([
        promise.then(val => { clearTimeout(timer); return val; }),
        timeout
    ]);
};

export async function testFtpConnection(config: any) {
    const { Client: FtpClient } = await import('basic-ftp');
    const client = new FtpClient();
    client.ftp.verbose = false;
    const start = Date.now();
    try {
        await withTimeout(client.access({
            host: config.host,
            port: config.port,
            user: config.username,
            password: config.password,
            secure: false
        }), config.timeout || 8000, 'FTP connect timeout');

        // lightweight check
        const pwd = await withTimeout(client.pwd(), 2000, 'FTP pwd timeout');
        const took = Date.now() - start;
        return { ok: true, client, pwd, took };
    } catch (err: any) {
        client.close();
        return { ok: false, error: err.message || String(err) };
    }
}

export async function testSftpConnection(config: any) {
    const SftpClient = (await import('ssh2-sftp-client')).default;
    const client = new SftpClient();
    const start = Date.now();
    try {
        await withTimeout(client.connect({
            host: config.host,
            port: config.port,
            username: config.username,
            password: config.password,
            readyTimeout: config.timeout || 8000
        }), config.timeout || 8000, 'SFTP connect timeout');

        // lightweight check
        const cwd = await withTimeout(client.cwd(), 2000, 'SFTP cwd timeout');
        const took = Date.now() - start;
        return { ok: true, client, cwd, took };
    } catch (err: any) {
        try { await client.end(); } catch { }
        return { ok: false, error: err.message || String(err) };
    }
}

export function attachClientHandlersToSession(session: SftpSession) {
    const { client, id } = session;
    if (!client) return;

    // We can't easily attach generic 'on' handlers to ssh2-sftp-client as it wraps ssh2.
    // But for basic-ftp (ftp), we can.
    // For sftp, we usually rely on the underlying ssh client if accessible, but ssh2-sftp-client hides it mostly.
    // However, ssh2-sftp-client instance emits 'close', 'error', 'end'.

    try {
        // @ts-ignore
        if (typeof client.on === 'function') {
            // @ts-ignore
            client.on('error', (err: any) => {
                console.error(`[SESSION][${id}] client error`, err);
                // We don't verify strict removal here, simpler to let session timeout or user disconnect handles it
            });
            // @ts-ignore
            client.on('close', () => {
                console.log(`[SESSION][${id}] client closed`);
            });
            // @ts-ignore
            client.on('end', () => {
                console.log(`[SESSION][${id}] client ended`);
            });
        }
    } catch (e) {
        console.warn(`[SESSION][${id}] failed to attach handlers`, e);
    }
}
