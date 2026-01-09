'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
    PieChart, BarChart2, File, Folder, HardDrive,
    RefreshCw, Clock, AlertCircle, FileText, Image as ImageIcon,
    Code, Music, Video, Archive
} from 'lucide-react';
import { useSftp } from '@/context/SftpContext';
import { clsx } from 'clsx';

interface Stats {
    totalFiles: number;
    totalFolders: number;
    totalSize: number;
    extensions: Record<string, number>;
    recentFiles: any[]; // FileItem[]
    largeFiles: any[]; // FileItem[]
    loading: boolean;
    error?: string;
}

const COLORS = [
    '#6366f1', // Indigo
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#f43f5e', // Rose
    '#f97316', // Orange
    '#eab308', // Yellow
    '#22c55e', // Green
    '#06b6d4', // Cyan
];

const getFileIcon = (ext: string) => {
    switch (ext) {
        case 'jpg': case 'jpeg': case 'png': case 'gif': case 'svg': case 'webp': return <ImageIcon className="w-4 h-4" />;
        case 'mp4': case 'mov': case 'avi': case 'webm': return <Video className="w-4 h-4" />;
        case 'mp3': case 'wav': case 'ogg': return <Music className="w-4 h-4" />;
        case 'zip': case 'tar': case 'gz': case 'rar': case '7z': return <Archive className="w-4 h-4" />;
        case 'js': case 'ts': case 'jsx': case 'tsx': case 'py': case 'html': case 'css': case 'json': return <Code className="w-4 h-4" />;
        default: return <FileText className="w-4 h-4" />;
    }
};

const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function AnalyticsView() {
    const { session, currentPath } = useSftp();
    const [stats, setStats] = useState<Stats>({
        totalFiles: 0,
        totalFolders: 0,
        totalSize: 0,
        extensions: {},
        recentFiles: [],
        largeFiles: [],
        loading: false
    });

    const [triggerScan, setTriggerScan] = useState(0);

    useEffect(() => {
        if (!session) return;
        fetchStats();
    }, [session, currentPath, triggerScan]);

    const fetchStats = async () => {
        setStats(prev => ({ ...prev, loading: true, error: undefined }));
        try {
            // Using list-recursive to get everything for deep stats
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s limit

            const res = await fetch(`/api/sftp/list-recursive?sessionId=${session?.sessionId}&path=${encodeURIComponent(currentPath)}`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!res.ok) throw new Error('Failed to fetch folder stats');
            const data = await res.json();

            if (!data.success) throw new Error(data.error || 'API Error');

            const files: any[] = data.files;

            // Process Stats
            let size = 0;
            let fileCount = 0;
            let folderCount = 0;
            const exts: Record<string, number> = {};
            const filesList: any[] = [];

            files.forEach(f => {
                if (f.isDirectory) {
                    folderCount++;
                } else {
                    fileCount++;
                    size += f.size;
                    const ext = f.name.split('.').pop()?.toLowerCase() || 'unknown';
                    exts[ext] = (exts[ext] || 0) + 1;
                    filesList.push(f);
                }
            });

            // Sort for lists
            const sortedByDate = [...filesList].sort((a, b) => new Date(b.modifyTime || 0).getTime() - new Date(a.modifyTime || 0).getTime()).slice(0, 5);
            const sortedBySize = [...filesList].sort((a, b) => b.size - a.size).slice(0, 5);

            setStats({
                totalFiles: fileCount,
                totalFolders: folderCount,
                totalSize: size,
                extensions: exts,
                recentFiles: sortedByDate,
                largeFiles: sortedBySize,
                loading: false
            });

        } catch (err: any) {
            setStats(prev => ({
                ...prev,
                loading: false,
                error: err.name === 'AbortError' ? 'Scan timed out - folder too large' : err.message
            }));
        }
    };

    // Prepare Chart Data
    const chartData = useMemo(() => {
        const sortedExts = Object.entries(stats.extensions)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 6);

        const total = sortedExts.reduce((acc, [, c]) => acc + c, 0);

        let currentAngle = 0;
        return sortedExts.map(([name, value], index) => {
            const percentage = value / stats.totalFiles; // relative to TOTAL files, not just top 6
            // actually for a pie we usually want relative to slice sum or total? 
            // Let's make it relative to the sum of these top 6 + others maybe?
            // Simple Pie: 
            const angle = (value / total) * 360; // relative to displayed
            const start = currentAngle;
            currentAngle += angle;
            return { name, value, percentage: (value / stats.totalFiles) * 100, angle, start, color: COLORS[index % COLORS.length] };
        });
    }, [stats.extensions, stats.totalFiles]);

    if (stats.loading && stats.totalFiles === 0) {
        return (
            <div className="w-full h-64 flex flex-col items-center justify-center text-muted-foreground bg-muted rounded-[--radius-lg] border border-border">
                <RefreshCw className="w-8 h-8 animate-spin mb-3 text-primary" />
                <span className="text-sm font-medium">Analyzing folder content...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header / Controls */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <HardDrive className="w-5 h-5 text-primary" />
                        Directory Analytics
                    </h3>
                    <p className="text-muted-foreground text-sm mt-1 font-mono">{currentPath}</p>
                </div>
                <button
                    onClick={fetchStats}
                    disabled={stats.loading}
                    className="p-2 bg-accent hover:bg-accent/80 text-primary rounded-[--radius-md] transition-all border border-border"
                >
                    <RefreshCw className={clsx("w-5 h-5", stats.loading && "animate-spin")} />
                </button>
            </div>

            {stats.error ? (
                <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-[--radius-lg] flex items-center gap-3 text-destructive">
                    <AlertCircle className="w-6 h-6 shrink-0" />
                    <div>
                        <p className="font-semibold">Analysis Failed</p>
                        <p className="text-sm opacity-80">{stats.error}</p>
                    </div>
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="card bg-primary/5 p-5 relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-5"><HardDrive className="w-16 h-16 text-primary" /></div>
                            <div className="text-muted-foreground text-sm font-medium mb-1">Total Size</div>
                            <div className="text-3xl font-bold text-foreground tracking-tight">{formatSize(stats.totalSize)}</div>
                            <div className="mt-2 text-xs text-primary bg-primary/10 inline-block px-2 py-1 rounded-full border border-primary/20">
                                Inclusive
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="card p-5"
                        >
                            <div className="text-muted-foreground text-sm font-medium mb-1">Files</div>
                            <div className="text-3xl font-bold text-foreground tracking-tight">{stats.totalFiles.toLocaleString()}</div>
                            <div className="h-1 w-full bg-muted mt-4 rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full" style={{ width: '70%' }}></div>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="card p-5"
                        >
                            <div className="text-muted-foreground text-sm font-medium mb-1">Folders</div>
                            <div className="text-3xl font-bold text-foreground tracking-tight">{stats.totalFolders.toLocaleString()}</div>
                            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                                <Folder className="w-3 h-3" /> Structure
                            </div>
                        </motion.div>
                    </div>

                    {/* Content Viz */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* File Distribution Pie */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.3 }}
                            className="col-span-1 card p-6"
                        >
                            <h4 className="text-lg font-semibold text-foreground mb-6 flex items-center gap-2">
                                <PieChart className="w-5 h-5 text-primary" /> File Types
                            </h4>

                            <div className="flex flex-col items-center justify-center relative">
                                {/* CSS Conic Gradient Pie Chart */}
                                {chartData.length > 0 ? (
                                    <div className="relative w-48 h-48 rounded-full shadow-sm"
                                        style={{
                                            background: `conic-gradient(${chartData.map(d => `${d.color} 0 ${d.start + d.angle}deg`).join(', ')}, transparent 0)`
                                        }}
                                    >
                                        <div className="absolute inset-4 bg-card rounded-full flex items-center justify-center border border-border">
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-foreground">{stats.totalFiles}</div>
                                                <div className="text-xs text-muted-foreground uppercase tracking-widest">Files</div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-48 h-48 rounded-full border-4 border-border border-dashed flex items-center justify-center text-muted-foreground">
                                        No Data
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-8 w-full">
                                    {chartData.map(d => (
                                        <div key={d.name} className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }}></span>
                                                <span className="text-foreground uppercase">{d.name}</span>
                                            </div>
                                            <span className="text-muted-foreground">{Math.round(d.percentage)}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>

                        {/* Large Files */}
                        <div className="col-span-1 lg:col-span-2">
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.4 }}
                                className="card p-6 h-full"
                            >
                                <h4 className="text-lg font-semibold text-foreground mb-6 flex items-center gap-2">
                                    <BarChart2 className="w-5 h-5 text-secondary" /> Largest Files
                                </h4>
                                <div className="space-y-3">
                                    {stats.largeFiles.map((f, i) => (
                                        <div key={i} className="group flex items-center gap-3 p-2 hover:bg-muted rounded-[--radius-md] transition-colors cursor-default">
                                            <div className="w-8 h-8 flex items-center justify-center bg-muted rounded-[--radius-md] text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                                                {getFileIcon(f.name.split('.').pop() || '')}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-foreground truncate">{f.name}</div>
                                                <div className="text-xs text-muted-foreground truncate">{f.path}</div>
                                            </div>
                                            <div className="text-sm font-mono text-secondary bg-secondary/10 px-2 py-0.5 rounded border border-secondary/20">
                                                {formatSize(f.size)}
                                            </div>
                                        </div>
                                    ))}
                                    {stats.largeFiles.length === 0 && <div className="text-muted-foreground text-sm italic">No files found.</div>}
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
