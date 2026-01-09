import { v4 as uuidv4 } from 'uuid';
import SftpClient from 'ssh2-sftp-client';
import { Client as FtpClient } from 'basic-ftp';
import { attachClientHandlersToSession } from './connectionUtils';

export type ProtocolType = 'ftp' | 'sftp';

export interface SftpSession {
    id: string;
    type: ProtocolType;
    client: SftpClient | FtpClient;
    server: string;
    username: string;
    isAdmin: boolean;
    lastActivity: number;
    timeout: number;
    queue: Promise<any>;
}

const globalForSessions = global as unknown as { sftpSessions: Map<string, SftpSession> };
export const sessions = globalForSessions.sftpSessions || new Map<string, SftpSession>();
if (process.env.NODE_ENV !== 'production') globalForSessions.sftpSessions = sessions;

export function createSession(data: Omit<SftpSession, 'id' | 'lastActivity' | 'queue' | 'timeout'> & { timeout?: number }): string {
    const id = uuidv4();
    const session: SftpSession = {
        ...data,
        id,
        lastActivity: Date.now(),
        timeout: data.timeout || 120000,
        queue: Promise.resolve(),
    };

    attachClientHandlersToSession(session);
    sessions.set(id, session);
    return id;
}

export function getSession(id: string): SftpSession | undefined {
    const sess = sessions.get(id);
    if (sess) {
        sess.lastActivity = Date.now();
    }
    return sess;
}

export function removeSession(id: string) {
    const sess = sessions.get(id);
    if (sess) {
        if (sess.type === 'sftp') {
            try { (sess.client as SftpClient).end(); } catch (e) { /* ignore */ }
        } else {
            try { (sess.client as FtpClient).close(); } catch (e) { /* ignore */ }
        }
    }
    sessions.delete(id);
}

// Robust serialization helper from reference
export async function runSessionOp<T>(sessionId: string, op: (client: any) => Promise<T>, opTimeout?: number): Promise<T> {
    const sess = getSession(sessionId);
    if (!sess) throw new Error("Session expired");

    // Reset queue if needed? 
    // Reference: "if (!session._queue) session._queue = Promise.resolve();"
    // We initialize it in createSession, but good to check.

    const timeoutMs = typeof opTimeout === 'number' ? opTimeout : sess.timeout;

    // The serialized chain
    const prev = sess.queue;

    const opPromise = prev.then(async () => {
        sess.lastActivity = Date.now();

        // With timeout
        let timer: NodeJS.Timeout;
        const timeoutPromise = new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error(`Session operation timed out after ${timeoutMs}ms`)), timeoutMs);
        });

        return Promise.race([
            op(sess.client).then(val => { clearTimeout(timer); return val; }),
            timeoutPromise
        ]);
    });

    // Catch errors to keep queue healthy
    sess.queue = opPromise.catch(err => {
        console.error(`[SESSION-OP] error in ${sessionId}:`, err);
        // We swallow here so the NEXT op can run.
        // The caller of THIS op still gets the rejection from opPromise.
    }) as Promise<any>;

    return opPromise;
}

// Cleanup interval
if (!global.hasOwnProperty('__sftp_cleanup_interval')) {
    // @ts-ignore
    global.__sftp_cleanup_interval = setInterval(() => {
        const now = Date.now();
        for (const [id, s] of sessions) {
            if (now - s.lastActivity > 30 * 60 * 1000) { // 30 mins
                removeSession(id);
                console.log(`[SESSION] ${id} expired due to inactivity`);
            }
        }
    }, 5 * 60 * 1000);
}
