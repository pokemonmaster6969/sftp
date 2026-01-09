import { ProtocolType } from './sessionStore';
import * as pathPkg from 'path';

export async function listFiles(client: any, type: ProtocolType, remotePath: string) {
    const p = remotePath || '/';

    if (type === 'sftp') {
        const list = await client.list(p);
        // Filter out . and .. if present (ssh2-sftp-client usually filters them but good to be safe)
        // Actually standard ls might include them. 
        // The requirement says: "non-recursive list of remotePath || '/'" and "Return specific fields".
        return list
            .filter((i: any) => i.name !== '.' && i.name !== '..')
            .map((item: any) => ({
                name: item.name,
                size: item.size,
                isDirectory: item.type === 'd',
                path: pathPkg.posix.join(p, item.name)
            }));
    } else {
        // FTP
        // basic-ftp .list() returns FileInfo[] 
        // Requirement parity: "For FTP: isDirectory = (item.type === 2)"
        const list = await client.list(p);
        return list
            .filter((i: any) => i.name !== '.' && i.name !== '..')
            .map((item: any) => ({
                name: item.name,
                size: item.size,
                // parity logic
                isDirectory: item.type === 2,
                path: pathPkg.posix.join(p, item.name)
            }));
    }
}

export async function listRecursiveFiles(client: any, type: ProtocolType, remotePath: string, fileList: any[] = []) {
    const p = remotePath || '/';
    // Use listFiles to get current dir
    const items = await listFiles(client, type, p);

    for (const item of items) {
        if (item.isDirectory) {
            await listRecursiveFiles(client, type, item.path, fileList);
        } else {
            fileList.push({
                name: item.name,
                size: item.size,
                isDirectory: false,
                path: item.path
            });
        }
    }
    return fileList;
}

// For recursive listing, the requirement asks for "files ONLY (not directories)"
// The aggregated logic is better done iteratively if possible to avoid stack overflow, but recursive depth-first is explicitly allowed ("Depth-first recursion is fine").
