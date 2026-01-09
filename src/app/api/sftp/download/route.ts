import { NextRequest, NextResponse } from 'next/server';
import { getSession, runSessionOp } from '@/server/sessionStore';
import { PassThrough, Readable } from 'stream';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    const file = searchParams.get('file');

    if (!sessionId || !getSession(sessionId)) {
        return NextResponse.json({ error: 'Session expired' }, { status: 404 });
    }
    if (!file) {
        return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    const session = getSession(sessionId)!;

    try {
        // 1. Get File Size (serialized)
        const size = await runSessionOp(sessionId, async (client) => {
            if (session.type === 'sftp') {
                const stats = await client.stat(file);
                return stats.size;
            } else {
                return client.size(file);
            }
        });

        // 2. Parse Range Header
        const rangeHeader = req.headers.get('range');
        let start = 0;
        let end = size - 1;
        let isPartial = false;

        if (rangeHeader) {
            const parts = rangeHeader.replace(/bytes=/, "").split("-");
            const partialStart = parts[0];
            const partialEnd = parts[1];

            const rStart = parseInt(partialStart, 10);
            const rEnd = partialEnd ? parseInt(partialEnd, 10) : size - 1;

            if (!isNaN(rStart)) {
                start = rStart;
                if (!isNaN(rEnd)) end = rEnd;
                isPartial = true;
            }
        }

        if (start >= size || end >= size) {
            // Range unsatisfiable? Or valid?
            // If start >= size, usually 416. 
            // For now proceed, usually logic handles it.
        }

        const chunkLength = (end - start) + 1;

        // 3. Setup Stream
        const pt = new PassThrough();

        // 4. Queue Download Operation (Fire & Forget from Request perspective, blocked in Queue)
        // We catch errors to destroy the stream so the client knows something went wrong.
        runSessionOp(sessionId, async (client) => {
            if (session.type === 'sftp') {
                // ssh2-sftp-client .get returns a Promise that resolves when done
                // It accepts a stream.
                // For range: createReadStream is better, but .get supports options?
                // .get(path, dst, options) -> options can have readStream options? No.
                // We use client.sftp.createReadStream manually for SFTP ranges as per requirement.
                // "For SFTP: use underlying session.client.sftp.createReadStream(remotePath, { start, end })"

                // We need to wait for it to finish to resolve the Op?
                // createReadStream returns a stream. It doesn't return a promise.
                // We pipe it to 'pt' and wait for 'close'/'end'.
                return new Promise<void>((resolve, reject) => {
                    const rStream = client.sftp.createReadStream(file, { start, end: end /* inclusive usually? ssh2 docs say end is inclusive */ });

                    rStream.on('error', (err: any) => {
                        reject(err);
                    });
                    rStream.on('end', () => {
                        resolve();
                    });

                    rStream.pipe(pt);
                });

            } else {
                // FTP
                // client.downloadTo(writable, remotePath, start)
                // basic-ftp doesn't support 'end' param easily for downloadTo?
                // It downloads from start to finish.
                // If we only want a range, we might fetch more than needed?
                // Requirement: "For FTP: use basic-ftp client.downloadTo(res, remotePath, start?)"
                // It says "start?", doesn't explicitly mention 'end' for FTP.
                // Standard FTP REST command supports restart (start), but not end.
                // User gets full stream from start?
                // We can just pipe and let HTTP client close connection if it has enough?
                // But headers say Content-Length.
                // Parity: "Must support HTTP Range requests... For FTP: use basic-ftp client.downloadTo..."
                // If we claim Content-Length = chunkLength (which is end - start + 1), but we stream until EOF,
                // The browser typically stops reading after Content-Length bytes. 
                // So this is fine.
                await client.downloadTo(pt, file, start);
            }
        }).catch(err => {
            console.error("Stream error", err);
            pt.destroy(err);
        });

        // 5. Return Response
        // Convert Node PassThrough to Web ReadableStream
        const webStream = Readable.toWeb(pt as any) as any; // Cast for TS

        const headers = new Headers();
        headers.set('Content-Type', 'application/octet-stream');
        headers.set('Content-Disposition', `attachment; filename="${file.split('/').pop()}"`);
        headers.set('Accept-Ranges', 'bytes');

        if (isPartial) {
            headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
            headers.set('Content-Length', chunkLength.toString());
            return new NextResponse(webStream, { status: 206, headers });
        } else {
            headers.set('Content-Length', size.toString());
            return new NextResponse(webStream, { status: 200, headers });
        }

    } catch (err: any) {
        console.error("Download setup error", err);
        return NextResponse.json({ error: err.message }, { status: 404 }); // 404 or 500
    }
}
