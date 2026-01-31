import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
    Download,
    X,
    CheckCircle2,
    FileText,
    ChevronDown,
    ChevronUp
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatBytes, formatEtaSeconds, formatSpeed } from '../utils'

export interface TransferTask {
    id: string
    queueId?: string // Link to the server-side batch/queue ID
    name: string
    url: string
    size: number
    progress: number
    status: 'downloading' | 'paused' | 'completed' | 'error' | 'canceled' | 'ready'
    startTime: number
    bytesDownloaded: number
    speed: number
    browserStarted?: boolean // Tracking flag for browser-level download
    errorMessage?: string
    // Folder streaming support
    mode?: 'file' | 'folder_stream'
    files?: Array<{ path: string; size: number }>
    folderHandle?: any // FileSystemDirectoryHandle
    sessionId?: string
    basePath?: string
    skipped?: number
}

interface TransferManagerProps {
    tasks: TransferTask[]
    onCancel: (id: string) => void
    onTaskUpdate: (id: string, updates: Partial<TransferTask>) => void
    isOpen: boolean
    onToggle: () => void
    sessionId: string // Required for constructing download URLs
}

export const TransferManager: React.FC<TransferManagerProps> = ({
    tasks,
    onCancel,
    onTaskUpdate,
    isOpen,
    onToggle,
    sessionId: _sessionId
}) => {
    const [isMinimized, setIsMinimized] = useState(false)

    const STREAM_DOWNLOAD_MAX_BYTES = 256 * 1024 * 1024

    const tasksRef = useRef<TransferTask[]>(tasks)
    const activeTasksRef = useRef<Set<string>>(new Set())
    const abortControllersRef = useRef<Map<string, AbortController>>(new Map())
    const MAX_CONCURRENT_TASKS = 6

    useEffect(() => {
        tasksRef.current = tasks
    }, [tasks])

    useEffect(() => {
        return () => {
            abortControllersRef.current.forEach(c => c.abort())
        }
    }, [])

    const taskStateSignature = useMemo(() => {
        return tasks.map(t => `${t.id}:${t.status}`).join('|')
    }, [tasks])

    useEffect(() => {
        const currentTasks = tasksRef.current

        // Use a loop to fill available slots up to MAX_CONCURRENT_TASKS
        const activeCount = activeTasksRef.current.size
        if (activeCount >= MAX_CONCURRENT_TASKS) return

        // Identifying tasks that are marked 'downloading' but not in our active set (e.g. from page reload or persistent state)
        // or finding new 'ready' tasks
        const candidates = currentTasks.filter(t => t.status === 'ready' && !activeTasksRef.current.has(t.id))

        if (candidates.length === 0) return

        // Take enough candidates to fill the slots
        const slotsAvailable = MAX_CONCURRENT_TASKS - activeCount
        const nextTasks = candidates.slice(0, slotsAvailable)

        nextTasks.forEach(nextTask => {
            const controller = new AbortController()
            abortControllersRef.current.set(nextTask.id, controller)
            activeTasksRef.current.add(nextTask.id)

            const processFileTask = async () => {
                const startTime = Date.now()
                onTaskUpdate(nextTask.id, { status: 'downloading', startTime })

                const shouldUseNativeDownload =
                    nextTask.browserStarted === true ||
                    !Number.isFinite(nextTask.size) ||
                    nextTask.size <= 0 ||
                    nextTask.size >= STREAM_DOWNLOAD_MAX_BYTES

                try {
                    if (shouldUseNativeDownload) {
                        onTaskUpdate(nextTask.id, {
                            browserStarted: true,
                            status: 'completed',
                            progress: 100,
                            bytesDownloaded: nextTask.size > 0 ? nextTask.size : 0,
                            speed: 0,
                        })
                        triggerNativeDownload(nextTask.url, nextTask.name)
                        return
                    }

                    const response = await fetch(nextTask.url, { signal: controller.signal })
                    if (!response.ok) throw new Error('Download failed')
                    if (!response.body) throw new Error('Response body is null')

                    const reader = response.body.getReader()
                    const contentLength = +(response.headers.get('Content-Length') || 0)
                    let receivedLength = 0
                    const chunks: ArrayBuffer[] = []

                    while (true) {
                        const stillExists = tasksRef.current.some(t => t.id === nextTask.id)
                        if (!stillExists) {
                            controller.abort()
                            break
                        }

                        const { done, value } = await reader.read()
                        if (done) break
                        if (!value) continue

                        chunks.push(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength))
                        receivedLength += value.byteLength

                        const progress = contentLength > 0 ? (receivedLength / contentLength) * 100 : 0
                        const speed = receivedLength / ((Date.now() - startTime) / 1000)
                        onTaskUpdate(nextTask.id, { progress, bytesDownloaded: receivedLength, speed })
                    }

                    if (controller.signal.aborted) {
                        const stillExists = tasksRef.current.some(t => t.id === nextTask.id)
                        if (stillExists) {
                            onTaskUpdate(nextTask.id, { status: 'canceled' })
                        }
                        return
                    }

                    const blob = new Blob(chunks)
                    const url = window.URL.createObjectURL(blob)
                    triggerFileSave(url, nextTask.name)
                    window.URL.revokeObjectURL(url)
                    onTaskUpdate(nextTask.id, { status: 'completed', progress: 100 })
                } catch (err: unknown) {
                    if (!controller.signal.aborted) {
                        const msg = typeof err === 'object' && err !== null && 'message' in err
                            ? String((err as { message?: unknown }).message || 'Download failed')
                            : 'Download failed'
                        onTaskUpdate(nextTask.id, { status: 'error', errorMessage: msg })
                    }
                }
            }

            const processFolderTask = async () => {
                if (!nextTask.files || !nextTask.folderHandle || !nextTask.sessionId) {
                    onTaskUpdate(nextTask.id, { status: 'error', errorMessage: 'Invalid folder task configuration' })
                    return
                }

                const startTime = Date.now()
                onTaskUpdate(nextTask.id, { status: 'downloading', startTime })

                let totalBytesDownloaded = 0
                const totalSize = nextTask.size
                let completedFiles = 0

                try {
                    // Parallel downloads with concurrency limit (increased to 50 for better speed)
                    const CONCURRENCY = 50
                    const queue = [...nextTask.files]

                    const downloadFile = async (file: { path: string; size: number }) => {
                        if (controller.signal.aborted) return

                        // 1. Get relative path parts
                        let relativePath = file.path
                        if (nextTask.basePath && relativePath.startsWith(nextTask.basePath)) {
                            relativePath = relativePath.slice(nextTask.basePath.length)
                        }
                        if (relativePath.startsWith('/')) relativePath = relativePath.slice(1)

                        const parts = relativePath.split('/')
                        const filename = parts.pop() || 'unknown'

                        // 2. Traverse/Create directories
                        let currentHandle = nextTask.folderHandle
                        for (const part of parts) {
                            currentHandle = await currentHandle.getDirectoryHandle(part, { create: true })
                        }

                        // 3. Create file handle
                        const fileHandle = await currentHandle.getFileHandle(filename, { create: true })
                        const writable = await fileHandle.createWritable()

                        // 4. Stream download with progress tracking
                        const downloadUrl = `/api/sftp/download?sessionId=${encodeURIComponent(nextTask.sessionId || '')}&file=${encodeURIComponent(file.path)}`

                        try {
                            const response = await fetch(downloadUrl, { signal: controller.signal })
                            if (!response.ok) throw new Error(`Failed to fetch ${filename}`)
                            if (!response.body) throw new Error('No body')

                            const reader = response.body.getReader()
                            let lastUpdateTime = Date.now()

                            // Manual pipe with throttled progress tracking
                            while (true) {
                                const { done, value } = await reader.read()
                                if (done) break

                                await writable.write(value)
                                totalBytesDownloaded += value.byteLength

                                // Throttle updates to every 200ms for smooth UI
                                const now = Date.now()
                                if (now - lastUpdateTime >= 200) {
                                    const progress = totalSize > 0 ? Math.min(99, (totalBytesDownloaded / totalSize) * 100) : 0
                                    const elapsed = (now - startTime) / 1000
                                    const speed = totalBytesDownloaded / Math.max(1, elapsed)

                                    onTaskUpdate(nextTask.id, {
                                        progress,
                                        bytesDownloaded: totalBytesDownloaded,
                                        speed
                                    })
                                    lastUpdateTime = now
                                }
                            }

                            await writable.close()
                            completedFiles++

                            // Final update for this file
                            const progress = totalSize > 0 ? Math.min(99, (totalBytesDownloaded / totalSize) * 100) : 0
                            const elapsed = (Date.now() - startTime) / 1000
                            const speed = totalBytesDownloaded / Math.max(1, elapsed)
                            onTaskUpdate(nextTask.id, { progress, bytesDownloaded: totalBytesDownloaded, speed })

                        } catch (err) {
                            await writable.abort()
                            console.error(`Failed to download ${filename}`, err)
                            // Continue with other files
                        }
                    }

                    // Process files with concurrency limit
                    const workers = Array(CONCURRENCY).fill(0).map(async () => {
                        while (queue.length > 0) {
                            const file = queue.shift()
                            if (!file) break
                            await downloadFile(file)
                        }
                    })

                    await Promise.all(workers)

                    if (controller.signal.aborted) {
                        onTaskUpdate(nextTask.id, { status: 'canceled' })
                        return
                    }

                    onTaskUpdate(nextTask.id, { status: 'completed', progress: 100 })

                } catch (err: unknown) {
                    if (!controller.signal.aborted) {
                        const msg = typeof err === 'object' && err !== null && 'message' in err
                            ? String((err as { message?: unknown }).message || 'Folder download failed')
                            : 'Folder download failed'
                        onTaskUpdate(nextTask.id, { status: 'error', errorMessage: msg })
                    }
                }
            }

            if (nextTask.mode === 'folder_stream') {
                void processFolderTask().finally(() => {
                    activeTasksRef.current.delete(nextTask.id)
                    abortControllersRef.current.delete(nextTask.id)
                })
            } else {
                void processFileTask().finally(() => {
                    activeTasksRef.current.delete(nextTask.id)
                    abortControllersRef.current.delete(nextTask.id)
                })
            }
        })

    }, [taskStateSignature, onTaskUpdate])

    // Helper to force the browser to trigger the 'Save As' / Download action
    const triggerFileSave = (url: string, fileName: string) => {
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const triggerNativeDownload = (url: string, fileName: string) => {
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', fileName)
        link.setAttribute('rel', 'noopener')
        document.body.appendChild(link)
        link.click()
        link.remove()
    }

    const calculateETA = (task: TransferTask) => {
        if (task.status !== 'downloading' || task.speed === 0) return '--:--'
        const remaining = task.size - task.bytesDownloaded
        const seconds = Math.floor(remaining / task.speed)
        return formatEtaSeconds(seconds)
    }

    if (tasks.length === 0) return null

    const activeTasks = tasks.filter(t => t.status === 'downloading')
    const downloadingLabel = activeTasks.length === 1 ? 'Downloading 1 item' : `Downloading ${activeTasks.length} items`
    const activeEta = activeTasks.length === 1 ? calculateETA(activeTasks[0]) : null

    return (
        <motion.div
            initial={{ y: 400 }}
            animate={{ y: isOpen ? 0 : 400 }}
            className="fixed bottom-0 right-8 z-50 pointer-events-auto"
        >
            <div className="flex flex-col items-end gap-3">
                {/* Floating pill trigger */}
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setIsMinimized(!isMinimized)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setIsMinimized(!isMinimized)
                        }
                    }}
                    className="bg-slate-900 text-white pl-4 pr-2 py-2 rounded-full shadow-2xl flex items-center gap-4 hover:scale-[1.02] transition-transform cursor-pointer"
                    aria-label="Toggle downloads panel"
                >
                    <div className="relative w-5 h-5 flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
                        <Download className="w-4 h-4 text-white" aria-hidden="true" />
                    </div>
                    <div className="flex flex-col items-start">
                        <span className="text-xs font-medium">{downloadingLabel}</span>
                        <span className="text-[10px] text-white/60">
                            {activeEta ? `${activeEta} remaining` : 'Transfers in queue'}
                        </span>
                    </div>
                    <div className="h-6 w-px bg-white/10 mx-1" />
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            onToggle()
                        }}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                        aria-label="Close transfer manager"
                    >
                        <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            setIsMinimized(!isMinimized)
                        }}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                        aria-label={isMinimized ? 'Expand transfers' : 'Collapse transfers'}
                    >
                        {isMinimized ? (
                            <ChevronUp className="w-5 h-5" aria-hidden="true" />
                        ) : (
                            <ChevronDown className="w-5 h-5" aria-hidden="true" />
                        )}
                    </button>
                </div>

                {/* Expanded panel */}
                <AnimatePresence>
                    {!isMinimized && (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 8 }}
                            className="w-96 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
                        >
                            <div className="max-h-80 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                <AnimatePresence>
                                    {tasks.map(task => (
                                        <motion.div
                                            key={task.id}
                                            layout
                                            initial={{ opacity: 0, x: 12 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 12 }}
                                            className="bg-slate-50 border border-slate-200 rounded-xl p-3"
                                        >
                                            <div className="flex items-start gap-3 mb-2">
                                                <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${task.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                                                    task.status === 'error' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                                                    }`}>
                                                    {task.status === 'completed' ? (
                                                        <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                                                    ) : (
                                                        <FileText className="w-4 h-4" aria-hidden="true" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-sm font-semibold text-slate-900 truncate" title={task.name}>{task.name}</h4>
                                                    <p className="text-xs text-slate-500 mt-0.5">
                                                        {formatBytes(task.bytesDownloaded)} / {formatBytes(task.size)}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => onCancel(task.id)}
                                                        className="p-1 hover:bg-red-50 rounded"
                                                        aria-label={`Remove ${task.name}`}
                                                    >
                                                        <X className="w-3 h-3 text-red-500" aria-hidden="true" />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                    <motion.div
                                                        className={`h-full ${task.status === 'completed' ? 'bg-emerald-500' :
                                                            task.status === 'error' ? 'bg-red-500' : 'bg-blue-500'
                                                            }`}
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${task.progress}%` }}
                                                    />
                                                </div>
                                                {task.status === 'downloading' && (
                                                    <div className="flex items-center justify-between text-xs text-slate-500">
                                                        <span>{task.progress}%</span>
                                                        <span>{formatSpeed(task.speed)}</span>
                                                        <span>{calculateETA(task)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    )
}