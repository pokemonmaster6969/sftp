'use client';

import React, { useState, useRef, useMemo } from 'react';
import { useSftp, FileItem } from '@/context/SftpContext';
import { Folder, FileText, Download, Trash2, ArrowUp, Upload, RefreshCw, HardDrive, File as FileIcon, Archive, LayoutGrid, List as ListIcon } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import JSZip from 'jszip';

export default function FilesPage() {
    const { currentPath, setCurrentPath, files, loadingFiles, refreshFiles, queueDownload, session } = useSftp();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
    const [zipping, setZipping] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

    // Breadcrumbs
    const pathParts = currentPath.split('/').filter(Boolean);

    // Sorting
    const sortedFiles = useMemo(() => {
        let sorted = [...files];

        // 1. Folders first
        sorted.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            // 2. Alphabetical
            return a.name.localeCompare(b.name);
        });

        return sorted;
    }, [files]);

    const filteredFiles = sortedFiles.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));


    const handleNavigate = (path: string) => {
        setCurrentPath(path);
        setSelectedPaths(new Set());
    };

    const traverseUp = () => {
        if (currentPath === '/') return;
        const parent = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
        handleNavigate(parent);
    };

    const toggleSelection = (path: string) => {
        const next = new Set(selectedPaths);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        setSelectedPaths(next);
    };

    const selectAll = () => {
        if (selectedPaths.size === filteredFiles.length) {
            setSelectedPaths(new Set());
        } else {
            setSelectedPaths(new Set(filteredFiles.map(f => f.path)));
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !session) return;

        setUploading(true);
        const toastId = toast.loading(`Uploading ${file.name}...`);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('sessionId', session.sessionId);
            formData.append('path', currentPath);

            const res = await fetch('/api/sftp/upload', {
                method: 'POST',
                body: formData
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error);
            }

            toast.success('Upload complete', { id: toastId });
            refreshFiles();
        } catch (err: any) {
            toast.error(`Upload failed: ${err.message}`, { id: toastId });
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDelete = async (items: FileItem[]) => {
        if (!confirm(`Are you sure you want to delete ${items.length} item(s)?`)) return;

        const toastId = toast.loading('Deleting...');
        try {
            for (const item of items) {
                const res = await fetch('/api/sftp/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: session?.sessionId,
                        path: item.path,
                        isDirectory: item.isDirectory
                    })
                });
                if (!res.ok) throw new Error(`Failed to delete ${item.name}`);
            }
            toast.success('Deleted successfully', { id: toastId });
            refreshFiles();
            setSelectedPaths(new Set());
        } catch (err: any) {
            toast.error(err.message, { id: toastId });
        }
    };

    const handleBulkDownload = async () => {
        const selectedItems = files.filter(f => selectedPaths.has(f.path));
        if (selectedItems.length === 0) return;

        const toastId = toast.loading('Preparing ZIP archive...');
        setZipping(true);

        try {
            const zip = new JSZip();
            // We can't zip directories easily without recursive fetch. 
            // Parity implies downloading selected files.
            // If directory selected, we skip or warn? 
            // Existing dashboard likely skips dirs or recurses.
            // We'll skip directories for ZIP to avoid complexity/hangs unless "list-recursive" used.

            const filesOnly = selectedItems.filter(f => !f.isDirectory);
            if (filesOnly.length === 0 && selectedItems.some(f => f.isDirectory)) {
                throw new Error("Cannot zip directories directly.");
            }

            let processed = 0;
            for (const file of filesOnly) {
                toast.loading(`Zipping ${processed + 1}/${filesOnly.length}: ${file.name}`, { id: toastId });

                const res = await fetch(`/api/sftp/download?sessionId=${session?.sessionId}&file=${encodeURIComponent(file.path)}`);
                if (!res.ok) throw new Error(`Failed to fetch ${file.name}`);

                const blob = await res.blob();
                zip.file(file.name, blob);
                processed++;
            }

            toast.loading('Finalizing ZIP...', { id: toastId });
            const content = await zip.generateAsync({ type: 'blob' });

            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `files_archive_${Date.now()}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            toast.success('ZIP Downloaded', { id: toastId });
            setSelectedPaths(new Set());

        } catch (err: any) {
            toast.error(err.message, { id: toastId });
        } finally {
            setZipping(false);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Header */}
            <div className="card flex flex-col md:flex-row md:items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-2 overflow-hidden flex-1">
                    <button onClick={() => handleNavigate('/')} className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors">
                        <HardDrive className="w-5 h-5 text-primary" />
                    </button>
                    <span className="text-border">/</span>
                    {pathParts.map((part, index) => {
                        const path = '/' + pathParts.slice(0, index + 1).join('/');
                        return (
                            <React.Fragment key={path}>
                                <button
                                    onClick={() => handleNavigate(path)}
                                    className="hover:text-primary hover:underline truncate max-w-[100px] text-foreground font-medium"
                                >
                                    {part}
                                </button>
                                {index < pathParts.length - 1 && <span className="text-border">/</span>}
                            </React.Fragment>
                        )
                    })}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="input w-32 md:w-48"
                    />

                    {/* View Toggle */}
                    <div className="flex bg-muted p-0.5 rounded-[--radius-md] border border-border">
                        <button
                            onClick={() => setViewMode('list')}
                            className={clsx(
                                "p-1.5 rounded-[--radius-sm] transition-all",
                                viewMode === 'list' ? "bg-card text-primary shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <ListIcon className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            className={clsx(
                                "p-1.5 rounded-[--radius-sm] transition-all",
                                viewMode === 'grid' ? "bg-card text-primary shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                    </div>

                    {selectedPaths.size > 0 && (
                        <>
                            <button
                                onClick={handleBulkDownload}
                                disabled={zipping}
                                className="flex items-center gap-2 px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-sm font-medium rounded-[--radius-md] transition-colors border border-border"
                            >
                                <Archive className="w-4 h-4" />
                                Zip ({selectedPaths.size})
                            </button>
                            <button
                                onClick={() => handleDelete(files.filter(f => selectedPaths.has(f.path)))}
                                className="p-2 hover:bg-destructive/10 rounded-[--radius-md] text-destructive border border-transparent hover:border-destructive/20"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </>
                    )}

                    <button onClick={refreshFiles} className="p-2 hover:bg-muted rounded-[--radius-md] text-muted-foreground hover:text-foreground transition-colors border border-transparent hover:border-border">
                        <RefreshCw className={clsx("w-5 h-5", loadingFiles && "animate-spin")} />
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="btn btn-primary flex items-center gap-2 px-3 py-2"
                    >
                        <Upload className="w-4 h-4" />
                        Upload
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleUpload} />
                </div>
            </div>

            {/* File List */}
            <div className="card overflow-hidden min-h-[500px]">
                {/* Header Row for Select All */}
                {filteredFiles.length > 0 && viewMode === 'list' && (
                    <div className="flex items-center p-3 bg-muted border-b border-border text-xs-tight">
                        <div className="w-8 flex justify-center">
                            <input
                                type="checkbox"
                                checked={selectedPaths.size === filteredFiles.length && filteredFiles.length > 0}
                                onChange={selectAll}
                                className="rounded border-border bg-card text-primary focus:ring-primary"
                            />
                        </div>
                        <div className="flex-1">Name</div>
                        <div className="w-32 hidden sm:block">Size</div>
                        <div className="w-24 text-right">Actions</div>
                    </div>
                )}

                {/* Back Navigation */}
                {currentPath !== '/' && (
                    <div
                        onClick={traverseUp}
                        className="flex items-center gap-3 p-3 hover:bg-muted cursor-pointer border-b border-border transition-colors"
                    >
                        <div className="w-8"></div>
                        <div className="p-1 bg-muted rounded-[--radius-md]"><ArrowUp className="w-4 h-4 text-muted-foreground" /></div>
                        <span className="text-sm font-medium text-foreground">..</span>
                    </div>
                )}

                {loadingFiles && files.length === 0 ? (
                    <div className="p-12 flex justify-center"><RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                ) : filteredFiles.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground">No files found</div>
                ) : viewMode === 'grid' ? (
                    // GRID VIEW
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4">
                        {filteredFiles.map((file) => (
                            <div
                                key={file.name}
                                className={clsx(
                                    "group relative p-4 rounded-[--radius-lg] border transition-all cursor-pointer flex flex-col items-center text-center gap-3",
                                    selectedPaths.has(file.path)
                                        ? "bg-primary/5 border-primary/30 shadow-sm"
                                        : "bg-card border-border hover:border-primary/30 hover:shadow-sm"
                                )}
                                onClick={() => file.isDirectory ? handleNavigate(file.path) : toggleSelection(file.path)}
                            >
                                <div className="absolute top-2 left-2 z-10">
                                    <input
                                        type="checkbox"
                                        checked={selectedPaths.has(file.path)}
                                        onChange={(e) => { e.stopPropagation(); toggleSelection(file.path); }}
                                        className="rounded border-border bg-card text-primary focus:ring-primary"
                                    />
                                </div>

                                <div className={clsx(
                                    "p-3 rounded-[--radius-lg] mb-1",
                                    file.isDirectory ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"
                                )}>
                                    {file.isDirectory ? <Folder className="w-8 h-8 fill-current" /> : <FileIcon className="w-8 h-8 stroke-1.5" />}
                                </div>

                                <div className="w-full">
                                    <div className="text-sm font-medium text-foreground truncate w-full" title={file.name}>
                                        {file.name}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        {file.isDirectory ? 'Folder' : formatSize(file.size)}
                                    </div>
                                </div>

                                {!file.isDirectory && (
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); queueDownload(file); }}
                                            className="p-1.5 bg-card text-foreground rounded-[--radius-md] shadow-sm border border-border hover:text-primary"
                                            title="Queue Download"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    // LIST VIEW
                    <div className="divide-y divide-border">
                        {filteredFiles.map((file) => (
                            <div
                                key={file.name}
                                className={clsx(
                                    "group flex items-center p-3 hover:bg-muted transition-colors",
                                    selectedPaths.has(file.path) && "bg-primary/5"
                                )}
                            >
                                <div className="w-8 flex justify-center text-muted-foreground">
                                    <input
                                        type="checkbox"
                                        checked={selectedPaths.has(file.path)}
                                        onChange={() => toggleSelection(file.path)}
                                        className="rounded border-border bg-card text-primary focus:ring-primary"
                                    />
                                </div>

                                <div
                                    className="flex items-center gap-4 flex-1 cursor-pointer min-w-0"
                                    onClick={() => file.isDirectory ? handleNavigate(file.path) : toggleSelection(file.path)}
                                >
                                    <div className={clsx(
                                        "p-2 rounded-[--radius-md]",
                                        file.isDirectory ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"
                                    )}>
                                        {file.isDirectory ? <Folder className="w-5 h-5 fill-current" /> : <FileIcon className="w-5 h-5 stroke-2" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-medium text-foreground truncate group-hover:text-primary">{file.name}</div>
                                    </div>
                                </div>

                                <div className="w-32 text-muted-foreground text-sm hidden sm:block">
                                    {file.isDirectory ? '-' : formatSize(file.size)}
                                </div>

                                <div className="w-24 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {!file.isDirectory && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); queueDownload(file); }}
                                            className="p-2 hover:bg-accent border border-transparent hover:border-border rounded-[--radius-md] text-muted-foreground hover:text-primary transition-all"
                                            title="Queue Download"
                                        >
                                            <Download className="w-4 h-4" />
                                        </button>
                                    )}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete([file]); }}
                                        className="p-2 hover:bg-destructive/10 rounded-[--radius-md] text-muted-foreground hover:text-destructive"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
