'use client';

import React from 'react';
import { useSftp, DownloadTask } from '@/context/SftpContext';
import { Play, Pause, X, File, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

export default function DownloadsPage() {
    const { downloadTasks, pauseDownload, resumeDownload, cancelDownload, clearCompleted } = useSftp();

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatSpeed = (bytesPerSec: number) => {
        return formatSize(bytesPerSec) + '/s';
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Downloads</h1>
                {downloadTasks.some(t => t.status === 'completed') && (
                    <button
                        onClick={clearCompleted}
                        className="text-sm text-primary hover:underline"
                    >
                        Clear Completed
                    </button>
                )}
            </div>

            {downloadTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 border border-border border-dashed rounded-[--radius-lg] text-muted-foreground card">
                    <File className="w-12 h-12 mb-4 opacity-30" />
                    <p>No active downloads</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {downloadTasks.map((task) => (
                        <div key={task.id} className="card p-4 flex items-center gap-4">
                            <div className="p-3 bg-muted rounded-[--radius-md]">
                                {task.status === 'downloading' ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> :
                                    task.status === 'completed' ? <CheckCircle2 className="w-6 h-6 text-green-600" /> :
                                        task.status === 'error' ? <AlertCircle className="w-6 h-6 text-red-600" /> :
                                            <File className="w-6 h-6 text-muted-foreground" />
                                }
                            </div>

                            <div className="flex-1 min-w-0 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="text-sm font-medium truncate pr-4" title={task.name}>{task.name}</div>
                                    <div className="text-xs text-muted-foreground font-mono">
                                        {task.status === 'downloading' && `${Math.round(task.progress)}% • ${formatSpeed(task.speed)}`}
                                        {(task.status === 'pending' || task.status === 'paused') && task.status.toUpperCase()}
                                        {task.status === 'completed' && formatSize(task.size)}
                                        {task.status === 'error' && 'FAILED'}
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className={clsx("h-full transition-all duration-300",
                                            task.status === 'completed' ? 'bg-green-600' :
                                                task.status === 'error' ? 'bg-red-600' : 'bg-primary'
                                        )}
                                        style={{ width: `${task.progress}%` }}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {task.status === 'downloading' && (
                                    <button onClick={() => pauseDownload(task.id)} className="p-2 hover:bg-muted rounded-[--radius-md]">
                                        <Pause className="w-4 h-4" />
                                    </button>
                                )}
                                {(task.status === 'paused' || task.status === 'error') && (
                                    <button onClick={() => resumeDownload(task.id)} className="p-2 hover:bg-muted rounded-[--radius-md]">
                                        <Play className="w-4 h-4" />
                                    </button>
                                )}
                                <button onClick={() => cancelDownload(task.id)} className="p-2 hover:bg-muted rounded-[--radius-md] text-muted-foreground hover:text-destructive">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
