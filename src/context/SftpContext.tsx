'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface SessionData {
    sessionId: string;
    server: string;
    username: string;
    isAdmin: boolean;
    type: 'ftp' | 'sftp';
}

export interface FileItem {
    name: string;
    size: number;
    isDirectory: boolean;
    path: string;
}

export type DownloadStatus = 'pending' | 'downloading' | 'paused' | 'completed' | 'error';

export interface DownloadTask {
    id: string;
    file: string; // Remote path
    name: string;
    size: number;
    status: DownloadStatus;
    progress: number;
    bytesDownloaded: number;
    speed: number; // bytes/sec
    startTime?: number;
    destUrl?: string; // Blob URL
    error?: string;
}

interface SftpContextType {
    session: SessionData | null;
    currentPath: string;
    files: FileItem[];
    loadingFiles: boolean;
    downloadTasks: DownloadTask[];

    // Actions
    setSession: (s: SessionData | null) => void;
    setCurrentPath: (path: string) => void;
    refreshFiles: () => void;
    disconnect: () => void;

    // Downloads
    queueDownload: (file: FileItem) => void;
    pauseDownload: (id: string) => void;
    resumeDownload: (id: string) => void;
    cancelDownload: (id: string) => void;
    clearCompleted: () => void;
}

const SftpContext = createContext<SftpContextType | undefined>(undefined);

export function SftpProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [session, setSessionState] = useState<SessionData | null>(null);
    const [currentPath, setCurrentPathState] = useState<string>('/');
    const [files, setFiles] = useState<FileItem[]>([]);
    const [loadingFiles, setLoadingFiles] = useState(false);

    // Downloads
    const [downloadTasks, setDownloadTasks] = useState<DownloadTask[]>([]);
    const abortControllers = useRef<Map<string, AbortController>>(new Map());

    // Load persistence
    useEffect(() => {
        try {
            const storedSession = localStorage.getItem('sftp_session');
            if (storedSession) {
                setSessionState(JSON.parse(storedSession));
            }
            const storedPath = localStorage.getItem('sftp_current_path');
            if (storedPath) setCurrentPathState(storedPath);

            const storedTasks = localStorage.getItem('sftp-download-tasks');
            if (storedTasks) {
                // Reset downloading -> pending/paused on reload
                const tasks = JSON.parse(storedTasks).map((t: DownloadTask) => ({
                    ...t,
                    status: t.status === 'downloading' ? 'pending' : t.status // "On reload: tasks with status 'downloading' should become 'ready' (parity)" -> 'ready' means 'pending'
                }));
                setDownloadTasks(tasks);
            }
        } catch (e) {
            console.error(e);
        }
    }, []);

    // Sync tasks to localStorage
    useEffect(() => {
        localStorage.setItem('sftp-download-tasks', JSON.stringify(downloadTasks));
    }, [downloadTasks]);

    // Sync Path
    useEffect(() => {
        localStorage.setItem('sftp_current_path', currentPath);
    }, [currentPath]);

    const setCurrentPath = (p: string) => {
        setCurrentPathState(p);
    };

    const setSession = (s: SessionData | null) => {
        setSessionState(s);
    };

    // Fetch files
    const refreshFiles = useCallback(async () => {
        if (!session) return;
        setLoadingFiles(true);
        try {
            const res = await fetch(`/api/sftp/list?sessionId=${session.sessionId}&path=${encodeURIComponent(currentPath)}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setFiles(data.files);
        } catch (err: any) {
            toast.error(err.message);
            if (err.message === 'Session expired') {
                disconnect();
            }
        } finally {
            setLoadingFiles(false);
        }
    }, [session, currentPath]);

    useEffect(() => {
        if (session) {
            refreshFiles();
        }
    }, [session, currentPath, refreshFiles]);

    const disconnect = useCallback(async () => {
        if (session) {
            try {
                await fetch('/api/sftp/disconnect', {
                    method: 'POST',
                    body: JSON.stringify({ sessionId: session.sessionId })
                });
            } catch { }
        }
        setSessionState(null);
        localStorage.removeItem('sftp_session');
        router.push('/');
    }, [session, router]);

    // Download Manager Logic
    const queueDownload = (file: FileItem) => {
        const id = Math.random().toString(36).substr(2, 9);
        const task: DownloadTask = {
            id,
            file: file.path,
            name: file.name,
            size: file.size,
            status: 'pending',
            progress: 0,
            bytesDownloaded: 0,
            speed: 0
        };
        setDownloadTasks(prev => [...prev, task]);
        toast.success('Added to downloads');
    };

    const cancelDownload = (id: string) => {
        if (abortControllers.current.has(id)) {
            abortControllers.current.get(id)?.abort();
            abortControllers.current.delete(id);
        }
        setDownloadTasks(prev => prev.filter(t => t.id !== id));
    };

    const pauseDownload = (id: string) => {
        if (abortControllers.current.has(id)) {
            abortControllers.current.get(id)?.abort();
            abortControllers.current.delete(id);
        }
        setDownloadTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'paused', speed: 0 } : t));
    };

    const resumeDownload = (id: string) => {
        setDownloadTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'pending' } : t));
    };

    const clearCompleted = () => {
        setDownloadTasks(prev => prev.filter(t => t.status !== 'completed'));
    };

    // Queue Processor
    useEffect(() => {
        if (!session) return;

        // Only one active download at a time (sequential)
        const active = downloadTasks.find(t => t.status === 'downloading');
        if (active) return;

        const next = downloadTasks.find(t => t.status === 'pending');
        if (!next) return;

        const processDownload = async (task: DownloadTask) => {
            // Start download logic
            setDownloadTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'downloading', startTime: Date.now() } : t));

            const controller = new AbortController();
            abortControllers.current.set(task.id, controller);

            try {
                const url = `/api/sftp/download?sessionId=${session.sessionId}&file=${encodeURIComponent(task.file)}`;
                // If resuming? Range check.
                // Simplified: we restart for now, or use Range if we tracked bytesDownloaded carefully.
                // Existing parity: "Fetch file URLs sequentially".
                // If we implement Paused/Resume, Range is needed.
                // I'll stick to full fetch for MVP unless bytesDownloaded > 0.

                const headers: any = {};
                if (task.bytesDownloaded > 0) {
                    headers['Range'] = `bytes=${task.bytesDownloaded}-`;
                }

                const res = await fetch(url, { headers, signal: controller.signal });
                if (!res.ok) throw new Error(`Fetch error: ${res.statusText}`);

                const reader = res.body?.getReader();
                const contentLength = +(res.headers.get('Content-Length') || '0');
                const totalSize = task.size || (contentLength + task.bytesDownloaded); // If range

                if (!reader) throw new Error("No reader");

                const chunks: Uint8Array[] = []; // Warning: memory heavy
                let received = 0;
                let lastUpdate = Date.now();
                let bytesSinceLast = 0;

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    chunks.push(value);
                    received += value.length;
                    bytesSinceLast += value.length;

                    const now = Date.now();
                    if (now - lastUpdate > 1000) {
                        const speed = bytesSinceLast / ((now - lastUpdate) / 1000);
                        setDownloadTasks(prev => prev.map(t => {
                            if (t.id !== task.id) return t;
                            return {
                                ...t,
                                bytesDownloaded: task.bytesDownloaded + received, // If range resumed, add
                                progress: Math.min(100, ((task.bytesDownloaded + received) / totalSize) * 100),
                                speed
                            };
                        }));
                        lastUpdate = now;
                        bytesSinceLast = 0;
                    }
                }

                // Finished
                const blob = new Blob(chunks as any);
                const blobUrl = URL.createObjectURL(blob);

                // Trigger auto download to disk?
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = task.name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                setDownloadTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'completed', destUrl: blobUrl, progress: 100, speed: 0 } : t));

            } catch (err: any) {
                if (err.name === 'AbortError') return; // Paused/Cancelled
                console.error(err);
                setDownloadTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'error', error: err.message, speed: 0 } : t));
            } finally {
                abortControllers.current.delete(task.id);
            }
        };

        processDownload(next);

    }, [downloadTasks, session]);

    return (
        <SftpContext.Provider value={{
            session,
            currentPath,
            files,
            loadingFiles,
            setSession,
            setCurrentPath,
            refreshFiles,
            disconnect,
            downloadTasks,
            queueDownload,
            pauseDownload,
            resumeDownload,
            cancelDownload,
            clearCompleted,
        }}>
            {children}
        </SftpContext.Provider>
    );
}

export function useSftp() {
    const context = useContext(SftpContext);
    if (context === undefined) {
        throw new Error('useSftp must be used within a SftpProvider');
    }
    return context;
}
