'use client';

import React, { useEffect, useState } from 'react';
import { useSftp, FileItem } from '@/context/SftpContext';
import { useRouter } from 'next/navigation';
import { Folder, ExternalLink, RefreshCw, Layers, Database, FileText } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import AnalyticsView from './AnalyticsView';

interface Project {
    path: string;
    name: string;
    readme?: string;
    metadata?: Record<string, string>;
    tree?: string;
    stats?: {
        files: number;
        size: number;
        extensions: Record<string, number>;
    };
}

export default function OverviewPage() {
    const { session, setCurrentPath } = useSftp();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [projects, setProjects] = useState<Project[]>([]);
    const [rootPath, setRootPath] = useState('/');

    useEffect(() => {
        if (!session) return;
        loadProjects();
    }, [session]);

    const loadProjects = async () => {
        setLoading(true);
        setProjects([]);
        try {
            // 1. Detect Root
            const res = await fetch(`/api/sftp/list?sessionId=${session?.sessionId}&path=/`);
            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            let effectiveRoot = '/';
            const rootFiles: FileItem[] = data.files;

            const deliverablesDir = rootFiles.find(f => f.isDirectory && f.name.match(/deliverables/i));
            if (deliverablesDir) {
                effectiveRoot = deliverablesDir.path;
            }

            // Check if root itself is a project (has Readme.txt)
            const rootReadme = rootFiles.find(f => f.name.toLowerCase() === 'readme.txt');
            let projectPaths: string[] = [];

            if (rootReadme && !deliverablesDir) {
                // Single project at root
                projectPaths = ['/'];
                effectiveRoot = '/';
            } else {
                // List effective root to get projects
                if (effectiveRoot !== '/') {
                    const subRes = await fetch(`/api/sftp/list?sessionId=${session?.sessionId}&path=${encodeURIComponent(effectiveRoot)}`);
                    const subData = await subRes.json();
                    if (subData.success) {
                        projectPaths = subData.files.filter((f: FileItem) => f.isDirectory).map((f: FileItem) => f.path);
                    }
                } else {
                    // Safety: if root is '/', limit projects to first 5 folders
                    projectPaths = rootFiles
                        .filter(f => f.isDirectory && !['proc', 'sys', 'dev', 'run', 'boot', 'etc', 'var', 'usr', 'bin', 'lib', 'lib64', 'sbin', 'tmp', 'mnt', 'media'].includes(f.name))
                        .slice(0, 5)
                        .map(f => f.path);
                }
            }

            setRootPath(effectiveRoot);

            // 2. Load basic info for each project (Sequential)
            const projectData: Project[] = [];

            for (const p of projectPaths) {
                const name = p === '/' ? 'Root Project' : p.split('/').pop() || 'Project';

                let readme = '';
                let metadata: any = {};
                let tree = '';
                // Default stats (will be enriched if scan succeeds)
                let stats = { files: 0, size: 0, extensions: {} as any };

                try {
                    const lRes = await fetch(`/api/sftp/list?sessionId=${session?.sessionId}&path=${encodeURIComponent(p)}`);
                    const lData = await lRes.json();
                    if (lData.success) {
                        const readmeFile = lData.files.find((f: FileItem) => f.name.toLowerCase() === 'readme.txt');

                        // Calc Stats (Recursive - lightweight attempt)
                        try {
                            const controller = new AbortController();
                            const timeoutId = setTimeout(() => controller.abort(), 8000);

                            const rRes = await fetch(`/api/sftp/list-recursive?sessionId=${session?.sessionId}&path=${encodeURIComponent(p)}`, {
                                signal: controller.signal
                            });
                            clearTimeout(timeoutId);

                            if (rRes.ok) {
                                const rData = await rRes.json();
                                if (rData.success) {
                                    const files = rData.files as FileItem[];
                                    stats.files = files.length;
                                    stats.size = files.reduce((acc, f) => acc + f.size, 0);
                                    files.forEach(f => {
                                        const ext = f.name.split('.').pop() || 'unknown';
                                        stats.extensions[ext] = (stats.extensions[ext] || 0) + 1;
                                    });
                                }
                            }
                        } catch (e) {
                            console.warn("Recursive stats failed for", p, e);
                        }

                        if (readmeFile) {
                            const rRes = await fetch(`/api/sftp/download?sessionId=${session?.sessionId}&file=${encodeURIComponent(readmeFile.path)}`);
                            if (rRes.ok) {
                                const text = await rRes.text();
                                readme = text;

                                const lines = text.split('\n');
                                lines.forEach(line => {
                                    const match = line.match(/^([^:]+):\s*(.+)$/);
                                    if (match && match[1].length < 30) {
                                        metadata[match[1]] = match[2].trim();
                                    }
                                });

                                const treeStart = lines.findIndex(l => l.trim() === '.');
                                if (treeStart !== -1) {
                                    tree = lines.slice(treeStart).join('\n');
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.warn("Project load failed for", p, e);
                }

                projectData.push({ path: p, name, readme, metadata, tree, stats });
            }

            setProjects(projectData);

        } catch (err: any) {
            toast.error(`Overview load failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const openProject = (path: string) => {
        setCurrentPath(path);
        router.push('/dashboard/files');
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="space-y-8 pb-20 animate-fade-in">

            {/* 1. Dashboard Section */}
            <section className="space-y-6">
                <AnalyticsView />
            </section>

            {/* 2. Projects Section */}
            <section className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                            <Layers className="w-6 h-6 text-primary" /> Workspaces
                        </h2>
                        <p className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
                            Root: <span className="font-mono text-xs bg-muted text-muted-foreground px-2 py-1 rounded border border-border">{rootPath}</span>
                        </p>
                    </div>
                    <button
                        onClick={loadProjects}
                        disabled={loading}
                        className="p-2 bg-accent hover:bg-accent/80 border border-border hover:border-border rounded-[--radius-md] text-primary transition-all"
                        title="Refresh Projects"
                    >
                        <RefreshCw className={clsx("w-5 h-5", loading && "animate-spin")} />
                    </button>
                </div>

                {loading && projects.length === 0 ? (
                    <div className="grid gap-6">
                        {[1, 2].map((i) => (
                            <div key={i} className="h-48 rounded-[--radius-lg] bg-muted/50 animate-pulse border border-border"></div>
                        ))}
                    </div>
                ) : (
                    <div className="grid gap-6">
                        {projects.map((proj, idx) => (
                            <motion.div
                                key={proj.path}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className="card group relative overflow-hidden hover:shadow-md transition-all"
                            >
                                <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8">
                                    {/* Left: Info */}
                                    <div className="flex-1 space-y-6">
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-1">
                                                <h3 className="text-xl font-bold text-foreground flex items-center gap-3">
                                                    <Folder className="w-5 h-5 text-primary" />
                                                    {proj.name}
                                                </h3>
                                                <p className="text-muted-foreground text-sm font-mono truncate max-w-md">{proj.path}</p>
                                            </div>
                                            <button
                                                onClick={() => openProject(proj.path)}
                                                className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground rounded-[--radius-md] text-sm font-semibold transition-all"
                                            >
                                                Browse <ExternalLink className="w-4 h-4" />
                                            </button>
                                        </div>

                                        {/* Metadata Badges */}
                                        {proj.metadata && Object.keys(proj.metadata).length > 0 && (
                                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                                {Object.entries(proj.metadata).slice(0, 6).map(([key, val]) => (
                                                    <div key={key} className="bg-muted border border-border rounded-[--radius-md] px-3 py-2">
                                                        <div className="text-xs-tight mb-0.5">{key}</div>
                                                        <div className="text-foreground text-sm font-medium truncate" title={val as string}>{val as string}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Quick Stats */}
                                        <div className="flex gap-6 mt-4 pt-4 border-t border-border">
                                            <div>
                                                <div className="text-xs-tight mb-1">Size</div>
                                                <div className="text-foreground font-mono">{formatSize(proj.stats?.size || 0)}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs-tight mb-1">Files</div>
                                                <div className="text-foreground font-mono">{proj.stats?.files || 0}</div>
                                            </div>
                                            {/* Top Exts */}
                                            <div>
                                                <div className="text-xs-tight mb-1">Type</div>
                                                <div className="flex gap-2">
                                                    {Object.entries(proj.stats?.extensions || {})
                                                        .sort(([, a], [, b]) => (b as number) - (a as number))
                                                        .slice(0, 2)
                                                        .map(([ext]) => (
                                                            <span key={ext} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20">
                                                                {ext}
                                                            </span>
                                                        ))
                                                    }
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Structure / Preview */}
                                    {proj.tree ? (
                                        <div className="md:w-[320px] shrink-0 bg-muted rounded-[--radius-lg] border border-border p-4 font-mono text-[11px] text-muted-foreground overflow-hidden relative">
                                            <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-muted to-transparent z-10 flex items-center justify-between">
                                                <span className="font-semibold text-muted-foreground">Structure</span>
                                                <FileText className="w-3 h-3 text-muted-foreground" />
                                            </div>
                                            <div className="overflow-auto max-h-[220px] pt-8 scrollbar-thin">
                                                <pre className="whitespace-pre">{proj.tree}</pre>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="md:w-[320px] shrink-0 flex items-center justify-center bg-muted/50 rounded-[--radius-lg] border border-dashed border-border">
                                            <div className="text-center text-muted-foreground">
                                                <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                                <span className="text-sm">No Preview</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ))}

                        {projects.length === 0 && !loading && (
                            <div className="text-center p-12 bg-muted/50 rounded-[--radius-lg] border border-border border-dashed">
                                <Folder className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                                <h3 className="text-muted-foreground font-medium text-lg">No Projects Detected</h3>
                                <p className="text-muted-foreground mt-2 text-sm">Could not find recognized project deliverables in <span className="font-mono">{rootPath}</span></p>
                            </div>
                        )}
                    </div>
                )}
            </section>
        </div>
    );
}
