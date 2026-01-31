import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    PieChart,
    Pie,
    Cell,
} from 'recharts'
import {
    Folder,
    File,
    Search,
    Download,
    RefreshCw,
    Upload,
    LogOut,
    HardDrive,
    Activity,
    ArrowLeft,
    X,
    Shield,
    Eye,
    ClipboardList,
    Settings,
    LayoutGrid,
    LayoutList,
} from 'lucide-react'
import { sftpApi } from '../api/sftp'
import type { SFTPFile, SessionInfo } from '../types'
import { motion, AnimatePresence } from 'framer-motion'
import { TransferManager, type TransferTask } from './TransferManager'
import JSZip from 'jszip'
import { DownloadsPage } from './DownloadsPage'
import { dbApi } from '../api/db'
import OverviewPage, { type ProjectInfo } from './OverviewPage'
import ReactReportPage from './ReactReportPage'
import unigenomeLogo from '../assets/unigenome.png'
import toast from 'react-hot-toast'
import { useDebouncedValue } from '../hooks'
import { formatBytes as formatBytesUtil, isImageFile as isImageFileUtil, isTextFile as isTextFileUtil } from '../utils'
import { ActionIcon, Alert, Anchor, AppShell, Badge as MBadge, Box, Breadcrumbs, Button as MButton, Burger, Center, Checkbox, Drawer, Group, Menu, Paper, Progress, ScrollArea, Select, SimpleGrid, Stack, Table, Tabs, Text, TextInput, Title } from '@mantine/core'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import DashboardMock from './DashboardMock'

interface DashboardStats {
    folders: number
    files: number
    size: number
}

interface SubfolderSummary {
    name: string
    path: string
    files: number
    size: number
    topTypes: Array<{ ext: string; count: number }>
}

type FolderCategory = 'Raw Data' | 'Reference/Annotation' | 'Assembly/Mapping' | 'Plots/Correlation' | 'Differential Expression' | 'Enrichment/GO' | 'Pathways' | 'Other'

interface CategorySummary {
    category: FolderCategory
    folders: number
    files: number
    size: number
}

interface FileCardProps {
    file: SFTPFile
    onClick: () => void
    onDownload: () => void
    formatBytes: (bytes: number) => string
    selected: boolean
    onSelect: () => void
}

interface DashboardProps {
    session: SessionInfo
    onLogout: () => void
}


export const Dashboard: React.FC<DashboardProps> = ({ session, onLogout }) => {
    const [view, setView] = useState<'overview' | 'dashboard' | 'files' | 'downloads' | 'audit' | 'report' | 'settings' | 'mock'>('overview')
    const [navOpened, setNavOpened] = useState(false)
    const [lastMainView, setLastMainView] = useState<'overview' | 'dashboard' | 'files'>('overview')
    const [reportProject, setReportProject] = useState<ProjectInfo | null>(null)
    const [files, setFiles] = useState<SFTPFile[]>([])
    const [loading, setLoading] = useState(true)
    const [currentPath, setCurrentPath] = useState(session.currentPath)
    const [search, setSearch] = useState('')
    const [fileViewMode, setFileViewMode] = useState<'grid' | 'list'>('grid')
    const debouncedSearch = useDebouncedValue(search, 200)
    const [stats, setStats] = useState<DashboardStats>({ folders: 0, files: 0, size: 0 })
    const [deepFiles, setDeepFiles] = useState<SFTPFile[]>([])
    const [deepLoading, setDeepLoading] = useState(false)
    const [deepError, setDeepError] = useState<string | null>(null)
    const [deepLastRefreshedAt, setDeepLastRefreshedAt] = useState<number | null>(null)
    const [deepFolderCount, setDeepFolderCount] = useState(0)
    const [deepFolderSummaries, setDeepFolderSummaries] = useState<SubfolderSummary[]>([])
    const [selectedSubfolder, setSelectedSubfolder] = useState<SubfolderSummary | null>(null)

    const uploadFilesInputRef = useRef<HTMLInputElement | null>(null)
    const uploadFolderInputRef = useRef<HTMLInputElement | null>(null)
    const [uploading, setUploading] = useState(false)

    const [dashboardCategoryFilter, setDashboardCategoryFilter] = useState<FolderCategory | null>(null)
    const [dashboardExtFilter, setDashboardExtFilter] = useState<string | null>(null)
    const [folderBatchRunning, setFolderBatchRunning] = useState(false)
    const [folderBatchIndex, setFolderBatchIndex] = useState(0)
    const [folderBatchTotal, setFolderBatchTotal] = useState(0)
    const [folderBatchCurrentName, setFolderBatchCurrentName] = useState<string | null>(null)
    const [tasks, setTasks] = useState<TransferTask[]>(() => {
        try {
            const savedTasks = localStorage.getItem('sftp-download-tasks');
            if (savedTasks) {
                const tasks = JSON.parse(savedTasks) as TransferTask[];
                return tasks.map(task => (
                    task.status === 'downloading' ? { ...task, status: 'ready' } : task
                ));
            }
            return [];
        } catch {
            return [];
        }
    });

    useEffect(() => {
        localStorage.setItem('sftp-download-tasks', JSON.stringify(tasks));
    }, [tasks]);

    const dbSyncTimerRef = useRef<number | null>(null)
    const dbSnapshotTimerRef = useRef<number | null>(null)
    const dbDisabledRef = useRef(false)
    const auditTimerRef = useRef<number | null>(null)
    const auditAbortRef = useRef<AbortController | null>(null)
    const auditInFlightRef = useRef(false)

    const [auditLoading, setAuditLoading] = useState(false)
    const [auditError, setAuditError] = useState<string | null>(null)
    const [auditData, setAuditData] = useState<{ connections: any[]; downloads: any[]; logs: any[] } | null>(null)

    const [auditType, setAuditType] = useState<'all' | 'connections' | 'downloads' | 'logs'>('all')
    const [auditUser, setAuditUser] = useState('')
    const [auditServer, setAuditServer] = useState('')
    const [auditQuery, setAuditQuery] = useState('')
    const [auditFrom, setAuditFrom] = useState('')
    const [auditTo, setAuditTo] = useState('')
    const [auditSelected, setAuditSelected] = useState<{ type: string; id: string; createdAt?: string; payload: any } | null>(null)

    const checkDbOnce = useCallback(async () => {
        if (dbDisabledRef.current) return false
        try {
            await dbApi.health()
            return true
        } catch {
            dbDisabledRef.current = true
            return false
        }
    }, [])

    useEffect(() => {
        if (!session.isAdmin) return
        if (view !== 'audit') return

        let cancelled = false

        const load = async () => {
            if (auditInFlightRef.current) return
            auditInFlightRef.current = true

            auditAbortRef.current?.abort()
            const controller = new AbortController()
            auditAbortRef.current = controller

            setAuditLoading(true)
            setAuditError(null)

            try {
                const res = await dbApi.auditRecent(session.sessionId, 100, { signal: controller.signal })
                if (cancelled) return
                const data = (res && res.data && typeof res.data === 'object' ? (res.data as Record<string, any>) : {})
                setAuditData({
                    connections: Array.isArray(data.connections) ? data.connections : [],
                    downloads: Array.isArray(data.downloads) ? data.downloads : [],
                    logs: Array.isArray(data.logs) ? data.logs : [],
                })
            } catch (err) {
                if (cancelled) return
                const e = (typeof err === 'object' && err !== null ? (err as Record<string, any>) : {})
                const name = typeof e.name === 'string' ? e.name : ''
                if (name === 'CanceledError' || name === 'AbortError') return
                const msg = (typeof e.message === 'string' ? e.message : null) || 'Failed to load audit logs'
                setAuditError(msg)
            } finally {
                auditInFlightRef.current = false
                if (!cancelled) setAuditLoading(false)
            }
        }

        void load()
        if (auditTimerRef.current) window.clearInterval(auditTimerRef.current)
        auditTimerRef.current = window.setInterval(() => {
            void load()
        }, 20000)

        if (!auditFrom && !auditTo) {
            const to = new Date()
            const from = new Date()
            from.setDate(from.getDate() - 7)
            const fmt = (d: Date) => d.toISOString().slice(0, 10)
            setAuditFrom(fmt(from))
            setAuditTo(fmt(to))
        }

        return () => {
            cancelled = true
            if (auditTimerRef.current) window.clearInterval(auditTimerRef.current)
            auditTimerRef.current = null
            auditAbortRef.current?.abort()
            auditAbortRef.current = null
            auditInFlightRef.current = false
        }
    }, [view, session.isAdmin, session.sessionId, auditFrom, auditTo])

    useEffect(() => {
        // Debounced task persistence (client-side tasks telemetry)
        if (dbSyncTimerRef.current) window.clearTimeout(dbSyncTimerRef.current)
        dbSyncTimerRef.current = window.setTimeout(async () => {
            const ok = await checkDbOnce()
            if (!ok) return
            try {
                await dbApi.upsertTasks(session.sessionId, tasks as unknown as any[])
            } catch {
                // do not surface DB errors to UI
            }
        }, 600)
        return () => {
            if (dbSyncTimerRef.current) window.clearTimeout(dbSyncTimerRef.current)
        }
    }, [tasks, session.sessionId, checkDbOnce])

    useEffect(() => {
        return () => {
            if (dbSnapshotTimerRef.current) window.clearTimeout(dbSnapshotTimerRef.current)
        }
    }, [])
    const [isTransferManagerOpen, setIsTransferManagerOpen] = useState(false)
    const [selectedPaths, setSelectedPaths] = useState<string[]>([])
    const [previewFile, setPreviewFile] = useState<SFTPFile | null>(null)
    const [previewContent, setPreviewContent] = useState<string | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [previewLoading, setPreviewLoading] = useState(false)
    const [uiError, setUiError] = useState<string | null>(null)

    const previewPanelRef = useRef<HTMLElement | null>(null)
    const previewCloseButtonRef = useRef<HTMLButtonElement | null>(null)

    const listAbortRef = useRef<AbortController | null>(null)
    const previewAbortRef = useRef<AbortController | null>(null)
    const listRequestIdRef = useRef(0)
    const previewRequestIdRef = useRef(0)
    const deepAbortRef = useRef<AbortController | null>(null)
    const deepRequestIdRef = useRef(0)
    const deepCacheRef = useRef<
        Map<string, { files: SFTPFile[]; folderCount: number; folderSummaries: SubfolderSummary[]; at: number }>
    >(new Map())

    const folderBatchAbortRef = useRef<AbortController | null>(null)

    const listCacheRef = useRef<Map<string, { files: SFTPFile[]; at: number }>>(new Map())
    const currentPathRef = useRef(currentPath)

    useEffect(() => {
        currentPathRef.current = currentPath
    }, [currentPath])

    const clearPreview = useCallback(() => {
        previewAbortRef.current?.abort()
        setPreviewFile(null)
        setPreviewContent(null)
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl)
            setPreviewUrl(null)
        }
    }, [previewUrl])

    const fetchFiles = useCallback(async (path: string, options?: { force?: boolean }) => {
        const cacheKey = `${session.sessionId}:${path}`
        const TTL_MS = 15_000

        if (!options?.force) {
            const cached = listCacheRef.current.get(cacheKey)
            if (cached && Date.now() - cached.at < TTL_MS) {
                const sortedFiles = [...cached.files].sort((a: SFTPFile, b: SFTPFile) => {
                    if (a.isDirectory && !b.isDirectory) return -1
                    if (!a.isDirectory && b.isDirectory) return 1
                    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
                })

                setFiles(sortedFiles)
                setCurrentPath(path)

                const folders = sortedFiles.filter((f: SFTPFile) => f.isDirectory).length
                const fileCount = sortedFiles.length - folders
                const totalSize = sortedFiles.reduce((acc: number, f: SFTPFile) => acc + (f.size || 0), 0)
                setStats({ folders, files: fileCount, size: totalSize })
                setUiError(null)
                setLoading(false)
                return
            }
        }

        const requestId = ++listRequestIdRef.current
        listAbortRef.current?.abort()
        const controller = new AbortController()
        listAbortRef.current = controller

        setLoading(true)
        try {
            const response = await sftpApi.list(session.sessionId, path, { signal: controller.signal })
            const respFiles = (response.data?.files as SFTPFile[] | undefined) || []
            const sortedFiles = [...respFiles].sort((a: SFTPFile, b: SFTPFile) => {
                if (a.isDirectory && !b.isDirectory) return -1
                if (!a.isDirectory && b.isDirectory) return 1
                return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
            })

            listCacheRef.current.set(cacheKey, { files: sortedFiles, at: Date.now() })

            setFiles(sortedFiles)
            setCurrentPath(path)

            const folders = sortedFiles.filter((f: SFTPFile) => f.isDirectory).length
            const fileCount = sortedFiles.length - folders
            const totalSize = sortedFiles.reduce((acc: number, f: SFTPFile) => acc + (f.size || 0), 0)
            setStats({ folders, files: fileCount, size: totalSize })
        } catch (err) {
            const e = err as Error
            if (e?.name === 'CanceledError' || e?.name === 'AbortError') return
            console.error('Failed to fetch files', err)
            setUiError('Failed to fetch files. Please try again.')
        } finally {
            const isLatest = requestId === listRequestIdRef.current
            if (isLatest) {
                setLoading(false)

                // Only clear selection/preview when navigating to a different directory.
                // Refreshing the same directory should not wipe user context.
                if (path !== currentPathRef.current) {
                    setSelectedPaths([])
                    clearPreview()
                }
            }
        }
    }, [session.sessionId, clearPreview])

    const handleUpload = useCallback(async (pickedFiles: File[]) => {
        if (pickedFiles.length === 0) return
        if (uploading) return

        setUploading(true)
        const toastId = 'upload'
        toast.loading(`Uploading ${pickedFiles.length} item${pickedFiles.length === 1 ? '' : 's'}…`, { id: toastId })

        try {
            const formData = new FormData()
            formData.append('sessionId', session.sessionId)
            formData.append('path', currentPathRef.current)

            if (pickedFiles.length === 1) {
                formData.append('file', pickedFiles[0])
            } else {
                for (const f of pickedFiles) {
                    formData.append('files', f)
                    formData.append('paths', (f as any).webkitRelativePath || f.name)
                }
            }

            await sftpApi.upload(formData, {
                onUploadProgress: (evt: any) => {
                    const total = evt?.total
                    const loaded = evt?.loaded
                    if (typeof total === 'number' && total > 0 && typeof loaded === 'number') {
                        const pct = Math.min(100, Math.round((loaded / total) * 100))
                        toast.loading(`Uploading… ${pct}%`, { id: toastId })
                    }
                },
            })

            toast.success('Upload complete', { id: toastId })
            await fetchFiles(currentPathRef.current, { force: true })
        } catch (err) {
            const msg = (err as any)?.response?.data?.error || (err as any)?.message || 'Upload failed'
            toast.error(msg, { id: toastId })
        } finally {
            setUploading(false)
        }
    }, [fetchFiles, session.sessionId, uploading])

    const onPickUploadFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const list = e.target.files
        const picked = list ? Array.from(list) : []
        e.target.value = ''
        void handleUpload(picked)
    }, [handleUpload])

    const onPickUploadFolder = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const list = e.target.files
        const picked = list ? Array.from(list) : []
        e.target.value = ''
        void handleUpload(picked)
    }, [handleUpload])

    const fetchDeepFiles = useCallback(async (path: string, force?: boolean) => {
        const cacheKey = `${session.sessionId}:${path}`
        if (!force) {
            const cached = deepCacheRef.current.get(cacheKey)
            if (cached) {
                setDeepFiles(cached.files)
                setDeepFolderCount(cached.folderCount)
                setDeepFolderSummaries(cached.folderSummaries)
                setDeepLastRefreshedAt(cached.at)
                setDeepError(null)
                return
            }
        }

        const requestId = ++deepRequestIdRef.current
        deepAbortRef.current?.abort()
        const controller = new AbortController()
        deepAbortRef.current = controller

        setDeepLoading(true)
        setDeepError(null)
        try {
            const response = await sftpApi.list(session.sessionId, path, { signal: controller.signal })
            const topLevel = (response.data?.files as SFTPFile[] | undefined) || []
            const folders = topLevel.filter(f => f.isDirectory)
            const topFiles = topLevel.filter(f => !f.isDirectory)

            const concurrency = 6
            const queue = [...folders]
            const collectedFiles: SFTPFile[] = [...topFiles]
            const summaries: SubfolderSummary[] = []

            const workers = new Array(Math.min(concurrency, queue.length)).fill(0).map(async () => {
                while (queue.length > 0) {
                    if (controller.signal.aborted) return
                    const folder = queue.shift()
                    if (!folder) return
                    try {
                        const resp = await sftpApi.list(session.sessionId, folder.path, { signal: controller.signal })
                        const entries = (resp.data?.files as SFTPFile[] | undefined) || []
                        const filesOnly = entries.filter(e => !e.isDirectory)
                        for (const f of filesOnly) collectedFiles.push(f)

                        const typeMap = new Map<string, number>()
                        for (const f of filesOnly) {
                            const extRaw = (f.name.split('.').pop() || '').toLowerCase()
                            const ext = extRaw && extRaw !== f.name.toLowerCase() ? extRaw : '(none)'
                            typeMap.set(ext, (typeMap.get(ext) || 0) + 1)
                        }
                        const topTypes = [...typeMap.entries()]
                            .map(([ext, count]) => ({ ext, count }))
                            .sort((a, b) => b.count - a.count)
                            .slice(0, 3)

                        summaries.push({
                            name: folder.name,
                            path: folder.path,
                            files: filesOnly.length,
                            size: filesOnly.reduce((acc, f) => acc + (f.size || 0), 0),
                            topTypes,
                        })
                    } catch {
                        summaries.push({
                            name: folder.name,
                            path: folder.path,
                            files: 0,
                            size: 0,
                            topTypes: [],
                        })
                    }
                }
            })

            await Promise.all(workers)
            summaries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))

            const next = collectedFiles
            const at = Date.now()
            deepCacheRef.current.set(cacheKey, { files: next, folderCount: folders.length, folderSummaries: summaries, at })

            setDeepFiles(next)
            setDeepFolderCount(folders.length)
            setDeepFolderSummaries(summaries)
            setDeepLastRefreshedAt(at)

            // Persist a lightweight snapshot for analytics (best-effort)
            if (dbSnapshotTimerRef.current) window.clearTimeout(dbSnapshotTimerRef.current)
            dbSnapshotTimerRef.current = window.setTimeout(async () => {
                const ok = await checkDbOnce()
                if (!ok) return
                try {
                    await dbApi.insertSnapshot(session.sessionId, 'deep_scan', cacheKey, {
                        at,
                        folderCount: folders.length,
                        fileCount: next.length,
                        totalSize: next.reduce((acc, f) => acc + (f.size || 0), 0),
                        folderSummaries: summaries,
                    })
                } catch {
                    // ignore
                }
            }, 800)
        } catch (err) {
            const e = err as Error
            if (e?.name === 'CanceledError' || e?.name === 'AbortError') return
            console.error('Failed to fetch recursive files', err)
            setDeepError(e?.message || 'Failed to scan subfolders')
        } finally {
            const isLatest = requestId === deepRequestIdRef.current
            if (isLatest) {
                setDeepLoading(false)
            }
        }
    }, [session.sessionId, checkDbOnce])

    const openPreview = useCallback(async (file: SFTPFile) => {
        const requestId = ++previewRequestIdRef.current
        previewAbortRef.current?.abort()
        const controller = new AbortController()
        previewAbortRef.current = controller

        setPreviewFile(file)
        setPreviewContent(null)
        if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null) }
        setPreviewLoading(true)

        const isText = isTextFileUtil(file.name)
        const isImage = isImageFileUtil(file.name)

        try {
            // Guard: don't attempt to preview very large files in-browser
            const MAX_PREVIEW = 2 * 1024 * 1024 // 2 MB
            if (file.size && file.size > MAX_PREVIEW) {
                setPreviewContent('File too large to preview in the browser (over 2 MB). Please download to view it locally.')
                setPreviewLoading(false)
                return
            }
            if (isText) {
                const resp = await sftpApi.preview(session.sessionId, file.path, { signal: controller.signal })
                setPreviewContent(resp.data || '')
            } else if (isImage) {
                const resp = await sftpApi.download(session.sessionId, file.path, { responseType: 'blob', signal: controller.signal })
                const url = window.URL.createObjectURL(new Blob([resp.data]))
                setPreviewUrl(url)
            } else {
                setPreviewContent('Preview not available for this file type.')
            }
        } catch (err) {
            const e = err as Error
            if (e?.name === 'CanceledError' || e?.name === 'AbortError') return
            console.error('Preview failed', err)
            setPreviewContent('Failed to load preview.')
            setUiError('Preview failed. Please try again.')
        } finally {
            const isLatest = requestId === previewRequestIdRef.current
            if (isLatest) {
                setPreviewLoading(false)
            }
        }
    }, [session.sessionId, previewUrl])

    useEffect(() => {
        fetchFiles(currentPath)
    }, [currentPath, fetchFiles])

    useEffect(() => {
        if (view !== 'dashboard') return
        fetchDeepFiles(currentPath)
    }, [view, currentPath, fetchDeepFiles])

    useEffect(() => {
        if (view === 'files') return
        setSelectedPaths([])
        clearPreview()
    }, [view, clearPreview])

    useEffect(() => {
        if (!previewFile) return
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') clearPreview()
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [previewFile, clearPreview])

    useEffect(() => {
        if (!previewFile) return

        const prevActive = document.activeElement as HTMLElement | null
        const focusTarget = previewCloseButtonRef.current
        if (focusTarget) {
            window.setTimeout(() => focusTarget.focus(), 0)
        }

        const rootContains = (root: HTMLElement | null, node: HTMLElement) => {
            if (!root) return false
            return root === node || root.contains(node)
        }

        const getFocusable = () => {
            const root = previewPanelRef.current
            if (!root) return [] as HTMLElement[]
            const nodes = root.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
            )
            return Array.from(nodes).filter(el => !el.hasAttribute('disabled') && el.tabIndex !== -1)
        }

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault()
                clearPreview()
                return
            }
            if (e.key !== 'Tab') return

            const focusable = getFocusable()
            if (focusable.length === 0) return
            const first = focusable[0]
            const last = focusable[focusable.length - 1]
            const active = document.activeElement as HTMLElement | null

            if (e.shiftKey) {
                if (!active || active === first || !rootContains(previewPanelRef.current, active)) {
                    e.preventDefault()
                    last.focus()
                }
            } else {
                if (!active || active === last || !rootContains(previewPanelRef.current, active)) {
                    e.preventDefault()
                    first.focus()
                }
            }
        }

        window.addEventListener('keydown', onKeyDown)
        return () => {
            window.removeEventListener('keydown', onKeyDown)
            if (prevActive && typeof prevActive.focus === 'function') prevActive.focus()
        }
    }, [previewFile, clearPreview])

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (view !== 'files') return
            if (previewFile) return
            if (loading) return

            const active = document.activeElement as HTMLElement | null
            if (!active || !active.classList.contains('file-card')) return

            const cards = Array.from(document.querySelectorAll<HTMLElement>('.file-card'))
            if (cards.length === 0) return
            const idx = cards.findIndex(el => el === active)
            if (idx < 0) return

            const cur = cards[idx]
            const curRect = cur.getBoundingClientRect()

            const moveToIndex = (nextIdx: number) => {
                const target = cards[Math.max(0, Math.min(cards.length - 1, nextIdx))]
                if (target) target.focus()
            }

            if (e.key === 'ArrowLeft') return moveToIndex(idx - 1)
            if (e.key === 'ArrowRight') return moveToIndex(idx + 1)

            const dir = e.key === 'ArrowUp' ? -1 : 1
            const candidates = cards
                .map((el, i) => ({ el, i, r: el.getBoundingClientRect() }))
                .filter(x => (dir < 0 ? x.r.top < curRect.top - 1 : x.r.top > curRect.top + 1))

            if (candidates.length === 0) return

            const best = candidates
                .map(x => {
                    const dy = Math.abs(x.r.top - curRect.top)
                    const dx = Math.abs((x.r.left + x.r.width / 2) - (curRect.left + curRect.width / 2))
                    return { ...x, score: dy * 1000 + dx }
                })
                .sort((a, b) => a.score - b.score)[0]

            if (best) best.el.focus()
        }

        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [view, previewFile, loading])


    const handleCancelTransfer = useCallback((id: string) => {
        setTasks(prev => {
            const t = prev.find(x => x.id === id)
            if (t) toast.success(`Removed: ${t.name}`)
            return prev.filter(x => x.id !== id)
        })
    }, []);

    const clearCompletedDownloads = useCallback(() => {
        setTasks(prev => prev.filter(t => t.status !== 'completed'))
        toast.success('Cleared completed downloads')
    }, [])

    const onTaskUpdate = useCallback((id: string, updates: Partial<TransferTask>) => {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    }, []);

    const formatBytes = useCallback((bytes: number): string => formatBytesUtil(bytes), [])

    const formatModifyTime = useCallback((t?: number) => {
        if (!t) return '--'
        const ms = t > 1_000_000_000_000 ? t : t * 1000
        const d = new Date(ms)
        if (Number.isNaN(d.getTime())) return '--'
        return d.toLocaleString()
    }, [])

    const toggleSelectPath = useCallback((path: string) => {
        setSelectedPaths(prev => prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path])
    }, [])

    const selectAll = useCallback(() => {
        const all = files.filter(f => !f.isDirectory).map(f => f.path)
        setSelectedPaths(all)
    }, [files])

    const selectVisible = useCallback(() => {
        // Compute visible files from current `files` and `search` instead of
        // relying on `filteredFiles` which is declared later (avoids TDZ error).
        const vis = files
            .filter(f => f.name.toLowerCase().includes(debouncedSearch.toLowerCase()))
            .filter(f => !f.isDirectory)
            .map(f => f.path)
        setSelectedPaths(vis)
    }, [files, debouncedSearch])

    const clearSelection = useCallback(() => setSelectedPaths([]), [])

    const handleZipAndDownload = useCallback(async (
        directoryPath: string,
        directoryName: string,
        filesToZip: SFTPFile[],
        options?: { signal?: AbortSignal; concurrency?: number }
    ) => {
        const zip = new JSZip();
        const taskId = Math.random().toString(36).substr(2, 9);

        const toastId = toast.loading(`Preparing ${directoryName}.zip…`)

        const zipTask: TransferTask = {
            id: taskId,
            name: `${directoryName}.zip`,
            size: filesToZip.reduce((acc, f) => acc + (f.size || 0), 0),
            url: '', // No direct URL for zip
            progress: 0,
            status: 'downloading',
            startTime: Date.now(),
            bytesDownloaded: 0,
            speed: 0,
        };

        setTasks(prev => [zipTask, ...prev]);

        let downloadedBytes = 0;
        const basePrefix = directoryPath.endsWith('/') ? directoryPath : `${directoryPath}/`

        const concurrency = Math.max(1, Math.min(50, options?.concurrency ?? 20))
        const queue = [...filesToZip]
        const signal = options?.signal

        const workers = new Array(Math.min(concurrency, queue.length)).fill(0).map(async () => {
            while (queue.length > 0) {
                if (signal?.aborted) return
                const file = queue.shift()
                if (!file) return
                try {
                    const response = await sftpApi.download(session.sessionId, file.path, { signal })
                    const relative = file.path.startsWith(basePrefix) ? file.path.substring(basePrefix.length) : file.name
                    zip.file(relative, response.data)
                    downloadedBytes += (file.size || 0)
                    const progress = zipTask.size > 0 ? (downloadedBytes / zipTask.size) * 100 : 0
                    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, progress, bytesDownloaded: downloadedBytes } : t))
                } catch (error) {
                    const e = error as Error
                    if (e?.name === 'CanceledError' || e?.name === 'AbortError') return
                    console.error(`Failed to download ${file.name}`, error)
                }
            }
        })

        await Promise.all(workers)
        if (signal?.aborted) {
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'canceled' } : t))
            toast.dismiss(toastId)
            toast('Zip canceled', { id: toastId })
            return
        }
        const content = await zip.generateAsync({ type: 'blob' })
        const url = window.URL.createObjectURL(content);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${directoryName}.zip`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed', progress: 100 } : t));
        toast.dismiss(toastId)
        toast.success(`${directoryName}.zip ready`)
    }, [session.sessionId]);

    const handleQueueDownloads = useCallback(async (pathsToQueue?: string[]) => {
        const paths = pathsToQueue && pathsToQueue.length > 0 ? pathsToQueue : selectedPaths;
        if (paths.length === 0) return;

        const byPath = new Map<string, SFTPFile>()
        for (const f of files) byPath.set(f.path, f)
        for (const f of deepFiles) if (!byPath.has(f.path)) byPath.set(f.path, f)

        const filesToProcess = paths.map(p => byPath.get(p)).filter(Boolean) as SFTPFile[]
        const individualFilesToQueue: SFTPFile[] = [];

        for (const file of filesToProcess) {
            if (file.isDirectory) {
                try {
                    const response = await sftpApi.listRecursive(session.sessionId, file.path)
                    const recursiveFiles = (response.data?.files as SFTPFile[] | undefined) || []
                    await handleZipAndDownload(file.path, file.name, recursiveFiles)
                } catch {
                    toast.error(`Failed to prepare zip: ${file.name}`)
                }
            } else {
                individualFilesToQueue.push(file);
            }
        }

        if (individualFilesToQueue.length > 0) {
            const newTasks: TransferTask[] = individualFilesToQueue.map(file => ({
                id: Math.random().toString(36).substr(2, 9),
                name: file.name,
                size: file.size,
                url: sftpApi.getDownloadUrl(session.sessionId, file.path),
                progress: 0,
                status: 'ready',
                startTime: Date.now(),
                bytesDownloaded: 0,
                speed: 0,
            }));
            setTasks(prev => [...newTasks, ...prev]);
            toast.success(`${newTasks.length} download${newTasks.length === 1 ? '' : 's'} queued`)
        }

        if (filesToProcess.length > 0) {
            setLastMainView('files');
            setView('downloads');
            setSelectedPaths([]);
        }
    }, [selectedPaths, files, deepFiles, session.sessionId, handleZipAndDownload]);

    const filteredFiles = files.filter(f => f.name.toLowerCase().includes(debouncedSearch.toLowerCase()))
    const breadcrumbs = currentPath.split('/').filter(p => p)
    const atRoot = breadcrumbs.length === 0
    const parentPath = atRoot ? '/' : '/' + breadcrumbs.slice(0, -1).join('/')

    const auditEvents = useMemo(() => {
        const rows: Array<{ type: 'connections' | 'downloads' | 'logs'; id: string; createdAt?: string; payload: any }> = []

        for (const c of auditData?.connections || []) {
            rows.push({ type: 'connections', id: String(c.id ?? ''), createdAt: c.created_at, payload: c })
        }
        for (const d of auditData?.downloads || []) {
            rows.push({ type: 'downloads', id: String(d.id ?? ''), createdAt: d.created_at, payload: d })
        }
        for (const l of auditData?.logs || []) {
            rows.push({ type: 'logs', id: String(l.id ?? ''), createdAt: l.created_at, payload: l })
        }

        const toMs = (iso?: string) => {
            if (!iso) return 0
            const t = Date.parse(iso)
            return Number.isFinite(t) ? t : 0
        }

        return rows.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))
    }, [auditData])

    const filteredAuditEvents = useMemo(() => {
        const userNeedle = auditUser.trim().toLowerCase()
        const serverNeedle = auditServer.trim().toLowerCase()
        const qNeedle = auditQuery.trim().toLowerCase()
        const fromMs = auditFrom ? Date.parse(`${auditFrom}T00:00:00`) : null
        const toMs = auditTo ? Date.parse(`${auditTo}T23:59:59`) : null

        const includesNeedle = (raw: unknown, needle: string) => {
            if (!needle) return true
            if (raw == null) return false
            return String(raw).toLowerCase().includes(needle)
        }

        const withinRange = (iso?: string) => {
            if (!fromMs && !toMs) return true
            const t = iso ? Date.parse(iso) : NaN
            if (!Number.isFinite(t)) return false
            if (fromMs != null && t < fromMs) return false
            if (toMs != null && t > toMs) return false
            return true
        }

        return auditEvents.filter(e => {
            if (auditType !== 'all' && e.type !== auditType) return false
            if (!withinRange(e.createdAt)) return false

            const p = e.payload || {}
            const userRaw = (p.username ?? p.user ?? p.user_name) as unknown
            const serverRaw = (p.server ?? p.host) as unknown

            if (!includesNeedle(userRaw, userNeedle)) return false
            if (!includesNeedle(serverRaw, serverNeedle)) return false

            if (qNeedle) {
                const hay = JSON.stringify(p).toLowerCase()
                if (!hay.includes(qNeedle)) return false
            }

            return true
        })
    }, [auditEvents, auditType, auditFrom, auditTo, auditUser, auditServer, auditQuery])

    const exportAuditCsv = useCallback(() => {
        const esc = (v: unknown) => {
            const s = v == null ? '' : String(v)
            return `"${s.replace(/"/g, '""')}"`
        }

        const rows = filteredAuditEvents.map(e => {
            const p = e.payload || {}
            const username = p.username ?? p.user ?? p.user_name ?? ''
            const server = p.server ?? p.host ?? ''
            const action = e.type === 'connections'
                ? (p.success ? 'connect_ok' : 'connect_fail')
                : e.type === 'downloads'
                    ? 'download'
                    : (p.level ?? 'log')
            const message = e.type === 'downloads'
                ? (p.remote_path ?? '')
                : (p.message ?? p.error_message ?? '')

            return [
                e.createdAt ?? '',
                e.type,
                username,
                server,
                action,
                message,
            ]
        })

        const header = ['created_at', 'type', 'username', 'server', 'action', 'message']
        const csv = [header.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        const fromPart = auditFrom || 'all'
        const toPart = auditTo || 'all'
        a.href = url
        a.download = `audit_${fromPart}_${toPart}.csv`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
        toast.success('Exported audit CSV')
    }, [filteredAuditEvents, auditFrom, auditTo])

    const deriveCategory = useCallback((folderName: string): FolderCategory => {
        const n = folderName.toLowerCase()
        if (/(raw[_\s-]?data|fastq|reads)/.test(n)) return 'Raw Data'
        if (/(reference|genome|annotation|gtf|gff)/.test(n)) return 'Reference/Annotation'
        if (/(transcript[_\s-]?assembly|assembly|mapping|alignment|bam|sam)/.test(n)) return 'Assembly/Mapping'
        if (/(correlation|pearson|plot|plots|pca|heatmap|qc)/.test(n)) return 'Plots/Correlation'
        if (/(differential|dge|de[_\s-]?genes|expression)/.test(n)) return 'Differential Expression'
        if (/(enrichment|go)/.test(n)) return 'Enrichment/GO'
        if (/(pathway|pathways|kegg|reactome)/.test(n)) return 'Pathways'
        return 'Other'
    }, [])

    const deepStats = useMemo(() => {
        const totalSize = deepFiles.reduce((acc: number, f: SFTPFile) => acc + (f.size || 0), 0)
        return { folders: deepFolderCount, files: deepFiles.length, size: totalSize }
    }, [deepFiles, deepFolderCount])

    const filteredTopLevelFolders = useMemo(() => {
        if (!dashboardCategoryFilter) return deepFolderSummaries
        const want = dashboardCategoryFilter
        return deepFolderSummaries.filter(s => deriveCategory(s.name) === want)
    }, [dashboardCategoryFilter, deepFolderSummaries, deriveCategory])

    const filteredFilesByCategory = useMemo(() => {
        if (!dashboardCategoryFilter) return deepFiles
        if (filteredTopLevelFolders.length === 0) return []
        const prefixes = filteredTopLevelFolders.map(s => (s.path.endsWith('/') ? s.path : `${s.path}/`))
        return deepFiles.filter(f => prefixes.some(p => f.path.startsWith(p) || f.path === p.slice(0, -1)))
    }, [dashboardCategoryFilter, deepFiles, filteredTopLevelFolders])

    const filteredNonDirFiles = useMemo(() => {
        const base = filteredFilesByCategory.filter(f => !f.isDirectory)
        if (!dashboardExtFilter) return base

        const extFilter = dashboardExtFilter.toLowerCase()
        if (extFilter === 'other') {
            // "other" is relative to top extensions in the current category-filtered set.
            const map = new Map<string, number>()
            for (const f of base) {
                const extRaw = (f.name.split('.').pop() || '').toLowerCase()
                const ext = extRaw && extRaw !== f.name.toLowerCase() ? extRaw : '(none)'
                map.set(ext, (map.get(ext) || 0) + 1)
            }
            const top = [...map.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([k]) => k)
            return base.filter(f => {
                const extRaw = (f.name.split('.').pop() || '').toLowerCase()
                const ext = extRaw && extRaw !== f.name.toLowerCase() ? extRaw : '(none)'
                return !top.includes(ext)
            })
        }

        return base.filter(f => {
            const extRaw = (f.name.split('.').pop() || '').toLowerCase()
            const ext = extRaw && extRaw !== f.name.toLowerCase() ? extRaw : '(none)'
            return ext === extFilter
        })
    }, [dashboardExtFilter, filteredFilesByCategory])

    const nonDirFiles = filteredNonDirFiles

    const sizeDistribution = useMemo(() => {
        const defs = [
            { key: '0-1MB', min: 0, max: 1 * 1024 * 1024 },
            { key: '1-10MB', min: 1 * 1024 * 1024, max: 10 * 1024 * 1024 },
            { key: '10-100MB', min: 10 * 1024 * 1024, max: 100 * 1024 * 1024 },
            { key: '100MB-1GB', min: 100 * 1024 * 1024, max: 1024 * 1024 * 1024 },
            { key: '1GB+', min: 1024 * 1024 * 1024, max: Infinity },
        ]
        const bins = defs.map(d => ({ label: d.key, count: 0, size: 0 }))

        for (const f of nonDirFiles) {
            const s = f.size || 0
            const idx = defs.findIndex(d => s >= d.min && s < d.max)
            const i = idx >= 0 ? idx : 0
            bins[i].count += 1
            bins[i].size += s
        }

        const maxCount = bins.reduce((m, b) => Math.max(m, b.count), 0)
        return { bins, maxCount }
    }, [nonDirFiles])

    const largestFiles = useMemo(() => {
        return [...nonDirFiles]
            .sort((a, b) => (b.size || 0) - (a.size || 0))
            .slice(0, 8)
    }, [nonDirFiles])

    const fileTypeStats = useMemo(() => {
        const map = new Map<string, { count: number; size: number }>()
        for (const f of nonDirFiles) {
            const extRaw = (f.name.split('.').pop() || '').toLowerCase()
            const ext = extRaw && extRaw !== f.name.toLowerCase() ? extRaw : '(none)'
            const prev = map.get(ext) || { count: 0, size: 0 }
            map.set(ext, { count: prev.count + 1, size: prev.size + (f.size || 0) })
        }
        const byCount = [...map.entries()]
            .map(([ext, v]) => ({ ext, ...v }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8)
        const bySize = [...map.entries()]
            .map(([ext, v]) => ({ ext, ...v }))
            .sort((a, b) => b.size - a.size)
            .slice(0, 8)
        return { byCount, bySize }
    }, [nonDirFiles])

    const fileTypeSegments = useMemo(() => {
        const top = fileTypeStats.byCount.slice(0, 5)
        const topSum = top.reduce((acc, x) => acc + x.count, 0)
        const other = nonDirFiles.length - topSum
        const colors = [
            'hsl(var(--chart-1))',
            'hsl(var(--chart-2))',
            'hsl(var(--chart-3))',
            'hsl(var(--chart-4))',
            'hsl(var(--chart-5))',
            'hsl(var(--muted-foreground))',
        ]
        const segments = top.map((x, idx) => ({ label: x.ext, value: x.count, color: colors[idx] }))
        if (other > 0) segments.push({ label: 'other', value: other, color: colors[5] })
        return segments
    }, [fileTypeStats.byCount, nonDirFiles.length])

    const categorySummaries = useMemo((): CategorySummary[] => {
        const map = new Map<FolderCategory, CategorySummary>()
        for (const s of deepFolderSummaries) {
            const cat = deriveCategory(s.name)
            const prev = map.get(cat) || { category: cat, folders: 0, files: 0, size: 0 }
            map.set(cat, { category: cat, folders: prev.folders + 1, files: prev.files + s.files, size: prev.size + s.size })
        }
        return [...map.values()].sort((a, b) => b.size - a.size)
    }, [deepFolderSummaries, deriveCategory])


    const filteredFolderSummaries = useMemo(() => {
        return filteredTopLevelFolders
    }, [filteredTopLevelFolders])

    const drilldown = useMemo(() => {
        if (!selectedSubfolder) return null
        const prefix = selectedSubfolder.path.endsWith('/') ? selectedSubfolder.path : `${selectedSubfolder.path}/`
        const inFolder = deepFiles.filter(f => f.path.startsWith(prefix) && !f.isDirectory)

        const typeMap = new Map<string, { count: number; size: number }>()
        for (const f of inFolder) {
            const extRaw = (f.name.split('.').pop() || '').toLowerCase()
            const ext = extRaw && extRaw !== f.name.toLowerCase() ? extRaw : '(none)'
            const prev = typeMap.get(ext) || { count: 0, size: 0 }
            typeMap.set(ext, { count: prev.count + 1, size: prev.size + (f.size || 0) })
        }
        const byCount = [...typeMap.entries()]
            .map(([ext, v]) => ({ ext, ...v }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8)

        const segTop = byCount.slice(0, 5)
        const segSum = segTop.reduce((acc, x) => acc + x.count, 0)
        const segOther = inFolder.length - segSum
        const colors = [
            'hsl(var(--chart-1))',
            'hsl(var(--chart-2))',
            'hsl(var(--chart-3))',
            'hsl(var(--chart-4))',
            'hsl(var(--chart-5))',
            'hsl(var(--muted-foreground))',
        ]
        const segments = segTop.map((x, idx) => ({ label: x.ext, value: x.count, color: colors[idx] }))
        if (segOther > 0) segments.push({ label: 'other', value: segOther, color: colors[5] })

        const largest = [...inFolder].sort((a, b) => (b.size || 0) - (a.size || 0)).slice(0, 10)
        const totalSize = inFolder.reduce((acc, f) => acc + (f.size || 0), 0)

        return { files: inFolder, totalSize, byCount, segments, largest }
    }, [selectedSubfolder, deepFiles])

    const cancelAllDownloads = useCallback(() => {
        setTasks(prev => {
            if (prev.length > 0) toast.success('Cleared downloads')
            return []
        })
    }, [])

    const cancelFolderBatch = useCallback(() => {
        folderBatchAbortRef.current?.abort()
        folderBatchAbortRef.current = null
        setFolderBatchRunning(false)
        setFolderBatchCurrentName(null)
    }, [])

    const downloadFoldersOneByOne = useCallback(async () => {
        if (folderBatchRunning) return
        if (deepFolderSummaries.length === 0) return

        const controller = new AbortController()
        folderBatchAbortRef.current?.abort()
        folderBatchAbortRef.current = controller

        setFolderBatchRunning(true)
        setFolderBatchIndex(0)
        setFolderBatchTotal(deepFolderSummaries.length)
        setFolderBatchCurrentName(null)

        try {
            for (let i = 0; i < deepFolderSummaries.length; i++) {
                if (controller.signal.aborted) break
                const folder = deepFolderSummaries[i]
                setFolderBatchIndex(i + 1)
                setFolderBatchCurrentName(folder.name)

                try {
                    const resp = await sftpApi.listRecursive(session.sessionId, folder.path, { signal: controller.signal })
                    const filesToZip = (resp.data?.files as SFTPFile[] | undefined) || []
                    await handleZipAndDownload(folder.path, folder.name, filesToZip, { signal: controller.signal, concurrency: 50 })
                } catch (err) {
                    const e = err as Error
                    if (e?.name === 'CanceledError' || e?.name === 'AbortError') break
                    toast.error(`Failed to prepare: ${folder.name}`)
                }
            }
        } finally {
            folderBatchAbortRef.current = null
            setFolderBatchRunning(false)
            setFolderBatchCurrentName(null)
        }
    }, [deepFolderSummaries, folderBatchRunning, handleZipAndDownload, session.sessionId])


    const goToProjects = useCallback(() => {
        setReportProject(null)
        setView('overview')
    }, [])

    const goToDashboard = useCallback(() => {
        setReportProject(null)
        setView('dashboard')
    }, [])

    const goToTransferQueue = useCallback(() => {
        if (view === 'overview' || view === 'dashboard' || view === 'files') setLastMainView(view)
        if (view === 'report') setLastMainView('overview')
        setView('downloads')
    }, [view])

    const goToFiles = useCallback(() => {
        setReportProject(null)
        setLastMainView('files')
        setView('files')
        void fetchFiles(currentPath)
    }, [currentPath, fetchFiles])

    const goToAudit = useCallback(() => {
        if (!session.isAdmin) return
        if (view === 'overview' || view === 'dashboard' || view === 'files') setLastMainView(view)
        setView('audit')
    }, [session.isAdmin, view])

    const goToSettings = useCallback(() => {
        setReportProject(null)
        setView('settings')
    }, [])

    const goToMock = useCallback(() => {
        setReportProject(null)
        setView('mock')
    }, [])

    return (
        <AppShell
            header={{ height: 56 }}
            navbar={{
                width: 250,
                breakpoint: 'sm',
                collapsed: { desktop: true, mobile: !navOpened }
            }}
            padding={0}
        >
            <AppShell.Header className="bg-white border-b border-slate-200 sticky top-0 z-50">
                <Group h="100%" px={{ base: 12, sm: 16 }} justify="space-between" wrap="nowrap" gap="xs">
                    <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                        <Burger
                            opened={navOpened}
                            onClick={() => setNavOpened(!navOpened)}
                            hiddenFrom="sm"
                            size="sm"
                        />
                        <Box
                            className="hidden xs:flex"
                            style={{
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '10px 14px',
                                borderRadius: 16,
                                background: 'white',
                                boxShadow: '0 8px 16px rgba(0,0,0,0.06)',
                                border: '1px solid var(--mantine-color-slate-100)',
                            }}
                        >
                            <img
                                src={unigenomeLogo}
                                alt="Unigenome"
                                className="h-6 w-auto object-contain select-none"
                                draggable={false}
                            />
                        </Box>
                        <Box style={{ minWidth: 0 }}>
                            <Text size="sm" fw={900} c="slate.900" style={{ letterSpacing: -0.2 }}>
                                GENOMICS SFTP
                            </Text>
                            <Text size="10px" fw={700} c="blue.5" tt="uppercase" lts={1} className="hidden sm:block">
                                {session.username} / {session.server}
                            </Text>
                        </Box>
                    </Group>

                    <Tabs
                        value={view === 'report' ? 'projects' : (view as string)}
                        onChange={(val) => {
                            if (!val) return
                            if (val === 'dashboard') goToDashboard()
                            else if (val === 'projects') goToProjects()
                            else if (val === 'files') goToFiles()
                            else if (val === 'transfer') goToTransferQueue()
                            else if (val === 'settings') goToSettings()
                            else if (val === 'audit') goToAudit()
                            else if (val === 'mock') goToMock()
                        }}
                        variant="default"
                        visibleFrom="sm"
                    >
                        <Tabs.List>
                            <Tabs.Tab value="dashboard">Dashboard</Tabs.Tab>
                            <Tabs.Tab value="projects">Projects</Tabs.Tab>
                            <Tabs.Tab value="files">Files</Tabs.Tab>
                            <Tabs.Tab value="transfer">Transfer</Tabs.Tab>
                            <Tabs.Tab value="settings">Settings</Tabs.Tab>
                            {session.isAdmin && <Tabs.Tab value="audit">Audit</Tabs.Tab>}
                            <Tabs.Tab value="mock">Mock</Tabs.Tab>
                        </Tabs.List>
                    </Tabs>

                    <Group gap="xs" wrap="nowrap">
                        <Group gap="sm" wrap="nowrap" visibleFrom="lg" mr="xs">
                            <TextInput
                                placeholder="Global search..."
                                leftSection={<Search size={14} className="text-slate-400" />}
                                size="sm"
                                radius="xl"
                                value={search}
                                onChange={(e) => setSearch(e.currentTarget.value)}
                                w={220}
                                styles={{
                                    input: { backgroundColor: 'var(--mantine-color-slate-50)', border: 'none' }
                                }}
                            />
                        </Group>

                        <MButton
                            onClick={onLogout}
                            variant="light"
                            size="xs"
                            leftSection={<LogOut size={14} aria-hidden="true" />}
                            radius="md"
                        >
                            <span className="hidden sm:inline">Logout</span>
                            <span className="sm:hidden">Exit</span>
                        </MButton>
                    </Group>
                </Group>
            </AppShell.Header>

            <AppShell.Navbar p="lg" style={{ borderRight: '1px solid var(--mantine-color-slate-100)' }}>
                <Stack gap="xs">
                    <Text size="xs" fw={900} c="slate.400" tt="uppercase" lts={1.5} mb={8}>Infrastructure Gateway</Text>
                    <MButton variant={view === 'dashboard' ? 'filled' : 'subtle'} color="blue" radius="lg" justify="flex-start" leftSection={<Activity size={18} />} onClick={() => { goToDashboard(); setNavOpened(false); }}>Operational Intel</MButton>
                    <MButton variant={view === 'overview' ? 'filled' : 'subtle'} color="blue" radius="lg" justify="flex-start" leftSection={<Folder size={18} />} onClick={() => { goToProjects(); setNavOpened(false); }}>Project Explorer</MButton>
                    <MButton variant={view === 'files' ? 'filled' : 'subtle'} color="blue" radius="lg" justify="flex-start" leftSection={<File size={18} />} onClick={() => { goToFiles(); setNavOpened(false); }}>Core Repository</MButton>
                    <MButton variant={view === 'downloads' ? 'filled' : 'subtle'} color="blue" radius="lg" justify="flex-start" leftSection={<Download size={18} />} onClick={() => { goToTransferQueue(); setNavOpened(false); }}>Transfer Center</MButton>
                    <MButton variant={view === 'settings' ? 'filled' : 'subtle'} color="blue" radius="lg" justify="flex-start" leftSection={<Settings size={18} />} onClick={() => { goToSettings(); setNavOpened(false); }}>Config Space</MButton>
                    {session.isAdmin && <MButton variant={view === 'audit' ? 'filled' : 'subtle'} color="blue" radius="lg" justify="flex-start" leftSection={<ClipboardList size={18} />} onClick={() => { goToAudit(); setNavOpened(false); }}>Audit Ledger</MButton>}
                </Stack>
            </AppShell.Navbar>

            <AppShell.Main>
                <Box className="flex-1 flex flex-col h-[calc(100vh-56px)] min-h-0 bg-slate-50 overflow-hidden relative w-full">

                    {/* Main Content */}
                    {view === 'settings' ? (
                        <main className="flex-1 bg-slate-50">
                            <div className="max-w-5xl mx-auto px-6 py-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                                        <Settings className="w-5 h-5 text-slate-700" aria-hidden="true" />
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="text-2xl font-semibold text-slate-900 tracking-tight truncate">Settings</h2>
                                        <p className="text-sm text-slate-500 truncate">Session details and admin tools</p>
                                    </div>
                                </div>

                                <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className="card p-6">
                                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Connection</div>
                                        <div className="mt-4 space-y-3">
                                            <div>
                                                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Server</div>
                                                <div className="mt-1 text-sm font-mono text-slate-700 break-all">{session.server}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">User</div>
                                                <div className="mt-1 text-sm font-semibold text-slate-700 break-all">{session.username}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Current path</div>
                                                <div className="mt-1 text-sm font-mono text-slate-700 break-all">{currentPath}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="card p-6">
                                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tools</div>
                                        <div className="mt-4 space-y-3">
                                            {session.isAdmin ? (
                                                <button type="button" onClick={() => setView('audit')} className="btn-secondary w-full py-2 text-sm font-semibold">
                                                    <ClipboardList className="w-4 h-4" aria-hidden="true" />
                                                    Audit logs
                                                </button>
                                            ) : (
                                                <div className="text-sm text-slate-600">No admin tools available for this session.</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </main>
                    ) : view === 'overview' ? (
                        <main className="flex-1 min-h-0 flex flex-col overflow-hidden bg-slate-50">
                            <OverviewPage
                                sessionId={session.sessionId}
                                isAdmin={session.isAdmin}
                                deliverablesRoot={currentPath}
                                currentPath={currentPath}
                                onOpenFiles={(projectPath) => {
                                    setLastMainView('files')
                                    setView('files')
                                    fetchFiles(projectPath)
                                }}
                                onOpenReport={(project: ProjectInfo) => {
                                    setReportProject(project)
                                    setView('report')
                                }}
                            />
                        </main>
                    ) : view === 'report' ? (
                        reportProject ? (
                            <ReactReportPage
                                sessionId={session.sessionId}
                                project={reportProject}
                                onBack={() => {
                                    setView('overview')
                                    setReportProject(null)
                                }}
                                onOpenFiles={(projectPath) => {
                                    setLastMainView('files')
                                    setView('files')
                                    fetchFiles(projectPath)
                                }}
                            />
                        ) : (
                            <main className="flex-1 bg-slate-50">
                                <div className="max-w-3xl mx-auto px-6 py-10">
                                    <div className="card p-6">
                                        <div className="text-sm text-slate-600">No project selected for report.</div>
                                        <button
                                            type="button"
                                            onClick={() => setView('overview')}
                                            className="btn-primary px-4 py-2 text-sm font-semibold mt-4"
                                        >
                                            Back to Projects
                                        </button>
                                    </div>
                                </div>
                            </main>
                        )
                    ) : view === 'downloads' ? (
                        <main className="flex-1 bg-slate-50">
                            <DownloadsPage
                                tasks={tasks}
                                onCancel={handleCancelTransfer}
                                onCancelAll={cancelAllDownloads}
                                onClearCompleted={clearCompletedDownloads}
                                onPause={(id: string) => setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'paused' } : t))}
                                onResume={(id: string) => setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'ready' } : t))}
                                onClose={() => setView(lastMainView)}
                            />
                        </main>
                    ) : view === 'audit' ? (
                        <main className="flex-1 min-h-0 flex flex-col relative overflow-hidden bg-slate-50">
                            <Paper withBorder radius={0} px="md" py="sm" bg="var(--mantine-color-gray-0)">
                                <Group justify="space-between" wrap="nowrap">
                                    <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                                        <Box
                                            w={40}
                                            h={40}
                                            style={{
                                                borderRadius: 12,
                                                background: 'var(--mantine-color-blue-0)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                            }}
                                        >
                                            <ClipboardList size={20} color="var(--mantine-color-blue-6)" aria-hidden="true" />
                                        </Box>
                                        <Box style={{ minWidth: 0 }}>
                                            <Title order={2} size="h3" lineClamp={1}>
                                                Audit Logs
                                            </Title>
                                            <Text size="sm" c="dimmed" lineClamp={1}>
                                                Recent client actions and server events
                                            </Text>
                                        </Box>
                                    </Group>

                                    <MButton
                                        onClick={() => setView(lastMainView)}
                                        variant="light"
                                        color="blue"
                                        leftSection={<ArrowLeft size={16} aria-hidden="true" />}
                                        aria-label="Back"
                                    >
                                        Back
                                    </MButton>
                                </Group>
                            </Paper>

                            <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-8 custom-scrollbar">
                                <div>
                                    {auditError && (
                                        <Alert color="red" variant="light" mb="md">
                                            {auditError}
                                        </Alert>
                                    )}

                                    {auditLoading && !auditData ? (
                                        <div className="card p-6">
                                            <div className="h-4 w-48 bg-slate-100 rounded animate-pulse" />
                                            <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
                                                {new Array(3).fill(0).map((_, i) => (
                                                    <div key={i} className="card p-6 border border-slate-100">
                                                        <div className="h-4 w-28 bg-slate-100 rounded animate-pulse" />
                                                        <div className="mt-4 space-y-3">
                                                            {new Array(6).fill(0).map((__, j) => (
                                                                <div key={j} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <Paper withBorder radius="lg" p="md" mb="md">
                                                <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
                                                    <Box style={{ flex: 1 }}>
                                                        <SimpleGrid cols={{ base: 1, sm: 2, lg: 6 }} spacing="sm">
                                                            <Select
                                                                label="Type"
                                                                value={auditType}
                                                                onChange={(v) => setAuditType((v || 'all') as any)}
                                                                data={[
                                                                    { value: 'all', label: 'All' },
                                                                    { value: 'connections', label: 'Connections' },
                                                                    { value: 'downloads', label: 'Downloads' },
                                                                    { value: 'logs', label: 'Logs' },
                                                                ]}
                                                                allowDeselect={false}
                                                            />
                                                            <TextInput label="User" value={auditUser} onChange={(e) => setAuditUser(e.target.value)} placeholder="e.g. lab_user" />
                                                            <TextInput label="Server" value={auditServer} onChange={(e) => setAuditServer(e.target.value)} placeholder="e.g. 10.0.0.10" />
                                                            <TextInput label="From" type="date" value={auditFrom} onChange={(e) => setAuditFrom(e.target.value)} />
                                                            <TextInput label="To" type="date" value={auditTo} onChange={(e) => setAuditTo(e.target.value)} />
                                                            <TextInput label="Search" value={auditQuery} onChange={(e) => setAuditQuery(e.target.value)} placeholder="Search in payload…" />
                                                        </SimpleGrid>
                                                    </Box>

                                                    <Group gap="sm" justify="flex-end">
                                                        <MButton
                                                            type="button"
                                                            onClick={exportAuditCsv}
                                                            disabled={filteredAuditEvents.length === 0}
                                                            variant="light"
                                                            color="blue"
                                                            leftSection={<Download size={16} aria-hidden="true" />}
                                                            aria-label="Export CSV"
                                                        >
                                                            Export CSV
                                                        </MButton>
                                                        <MButton
                                                            type="button"
                                                            onClick={() => {
                                                                setAuditType('all')
                                                                setAuditUser('')
                                                                setAuditServer('')
                                                                setAuditQuery('')
                                                            }}
                                                            variant="light"
                                                            color="blue"
                                                            aria-label="Reset filters"
                                                        >
                                                            Reset
                                                        </MButton>
                                                    </Group>
                                                </Group>
                                                <Text size="xs" c="dimmed" mt="sm">
                                                    Showing <Text span fw={600} c="dark">{filteredAuditEvents.length}</Text> of{' '}
                                                    <Text span fw={600} c="dark">{auditEvents.length}</Text> events
                                                </Text>
                                            </Paper>

                                            <Paper withBorder radius="lg" p="md">
                                                <Group justify="space-between" align="center" wrap="wrap" gap="sm">
                                                    <Tabs value={auditType} onChange={(v) => setAuditType((v || 'all') as any)} color="blue">
                                                        <Tabs.List>
                                                            <Tabs.Tab value="all">All ({filteredAuditEvents.length})</Tabs.Tab>
                                                            <Tabs.Tab value="connections">Connections ({filteredAuditEvents.filter(x => x.type === 'connections').length})</Tabs.Tab>
                                                            <Tabs.Tab value="downloads">Downloads ({filteredAuditEvents.filter(x => x.type === 'downloads').length})</Tabs.Tab>
                                                            <Tabs.Tab value="logs">Logs ({filteredAuditEvents.filter(x => x.type === 'logs').length})</Tabs.Tab>
                                                        </Tabs.List>
                                                    </Tabs>
                                                    <Text size="xs" c="dimmed">Click a row for full details</Text>
                                                </Group>

                                                <ScrollArea mt="md" type="auto">
                                                    <Table striped highlightOnHover withTableBorder={false} withColumnBorders={false} verticalSpacing="sm">
                                                        <Table.Thead>
                                                            <Table.Tr>
                                                                <Table.Th>Time</Table.Th>
                                                                <Table.Th>Type</Table.Th>
                                                                <Table.Th>User</Table.Th>
                                                                <Table.Th>Server</Table.Th>
                                                                <Table.Th>IP</Table.Th>
                                                                <Table.Th>Device</Table.Th>
                                                                <Table.Th>Summary</Table.Th>
                                                                <Table.Th>Status</Table.Th>
                                                            </Table.Tr>
                                                        </Table.Thead>
                                                        <Table.Tbody>
                                                            {filteredAuditEvents.slice(0, 100).map((e: any) => {
                                                                const p = e.payload || {}
                                                                const username = p.username ?? p.user ?? p.user_name ?? '--'
                                                                const server = p.server ?? p.host ?? '--'
                                                                const ip = p.ip ?? p.client_ip ?? '--'
                                                                const userAgent = p.user_agent ?? p.userAgent ?? p.ua ?? '--'
                                                                const summary = e.type === 'downloads'
                                                                    ? (p.remote_path ?? '--')
                                                                    : e.type === 'connections'
                                                                        ? `${p.protocol || p.requested_protocol || '--'} connect`
                                                                        : (p.message ?? p.error_message ?? '--')
                                                                const status = e.type === 'connections'
                                                                    ? (p.success ? 'OK' : 'FAIL')
                                                                    : e.type === 'logs'
                                                                        ? String((p.level || 'log')).toUpperCase()
                                                                        : 'OK'

                                                                return (
                                                                    <Table.Tr
                                                                        key={`${e.type}:${e.id}`}
                                                                        style={{ cursor: 'pointer' }}
                                                                        onClick={() => setAuditSelected({ type: e.type, id: e.id, createdAt: e.createdAt, payload: p })}
                                                                    >
                                                                        <Table.Td>{e.createdAt ? new Date(e.createdAt).toLocaleString() : '--'}</Table.Td>
                                                                        <Table.Td>{String(e.type).slice(0, 1).toUpperCase() + String(e.type).slice(1)}</Table.Td>
                                                                        <Table.Td style={{ maxWidth: 220 }}>
                                                                            <Text size="sm" lineClamp={1} title={String(username)}>
                                                                                {String(username)}
                                                                            </Text>
                                                                        </Table.Td>
                                                                        <Table.Td style={{ maxWidth: 220 }}>
                                                                            <Text size="sm" lineClamp={1} title={String(server)}>
                                                                                {String(server)}
                                                                            </Text>
                                                                        </Table.Td>
                                                                        <Table.Td style={{ maxWidth: 180 }}>
                                                                            <Text size="sm" lineClamp={1} title={String(ip)}>
                                                                                {String(ip)}
                                                                            </Text>
                                                                        </Table.Td>
                                                                        <Table.Td style={{ maxWidth: 260 }}>
                                                                            <Text size="sm" lineClamp={1} title={String(userAgent)}>
                                                                                {String(userAgent)}
                                                                            </Text>
                                                                        </Table.Td>
                                                                        <Table.Td style={{ maxWidth: 360 }}>
                                                                            <Text size="sm" lineClamp={1} title={String(summary)}>
                                                                                {String(summary)}
                                                                            </Text>
                                                                        </Table.Td>
                                                                        <Table.Td>
                                                                            <MBadge
                                                                                size="sm"
                                                                                variant="light"
                                                                                color={status === 'FAIL' || status === 'ERROR' ? 'red' : status === 'OK' ? 'green' : 'gray'}
                                                                            >
                                                                                {status}
                                                                            </MBadge>
                                                                        </Table.Td>
                                                                    </Table.Tr>
                                                                )
                                                            })}
                                                            {filteredAuditEvents.length === 0 && (
                                                                <Table.Tr>
                                                                    <Table.Td colSpan={8} style={{ textAlign: 'center' }}>
                                                                        <Text size="sm" c="dimmed" py="xl">
                                                                            No audit events match your filters.
                                                                        </Text>
                                                                    </Table.Td>
                                                                </Table.Tr>
                                                            )}
                                                        </Table.Tbody>
                                                    </Table>
                                                </ScrollArea>

                                                {filteredAuditEvents.length > 100 && (
                                                    <Text size="xs" c="dimmed" mt="sm">
                                                        Showing first <Text span fw={600} c="dark">100</Text> results. Narrow filters to refine.
                                                    </Text>
                                                )}
                                            </Paper>

                                            <Drawer
                                                opened={!!auditSelected}
                                                onClose={() => setAuditSelected(null)}
                                                position="right"
                                                size="lg"
                                                withCloseButton={false}
                                                overlayProps={{ opacity: 0.35, blur: 1 }}
                                                trapFocus
                                                returnFocus
                                            >
                                                {auditSelected && (
                                                    <Box>
                                                        <Group justify="space-between" align="flex-start" wrap="nowrap" mb="sm">
                                                            <Box style={{ minWidth: 0 }}>
                                                                <Text fw={600}>Audit event</Text>
                                                                <Text size="xs" c="dimmed" mt={4}>
                                                                    {auditSelected.type} · {auditSelected.createdAt ? new Date(auditSelected.createdAt).toLocaleString() : '--'}
                                                                </Text>
                                                            </Box>
                                                            <ActionIcon
                                                                variant="subtle"
                                                                color="gray"
                                                                onClick={() => setAuditSelected(null)}
                                                                aria-label="Close details"
                                                            >
                                                                <X size={18} aria-hidden="true" />
                                                            </ActionIcon>
                                                        </Group>

                                                        <Paper withBorder radius="md" p="md" bg="var(--mantine-color-gray-0)">
                                                            <pre className="whitespace-pre-wrap text-xs text-slate-700 font-mono">
                                                                {JSON.stringify(auditSelected.payload, null, 2)}
                                                            </pre>
                                                        </Paper>
                                                    </Box>
                                                )}
                                            </Drawer>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </main>
                    ) : view === 'dashboard' ? (
                        <main className="flex-1 min-h-0 flex flex-col relative overflow-hidden bg-slate-50/50">
                            <div className="px-6 py-3 border-b border-slate-200 bg-white/50 backdrop-blur-md sticky top-0 z-20">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight leading-none group flex items-center gap-2">
                                            <Activity size={20} className="text-blue-500" />
                                            Overview
                                        </h2>
                                        <p className="text-[10px] sm:text-xs text-slate-500 mt-1 truncate">Live analytics for <span className="font-mono bg-slate-100 px-1 rounded text-blue-600">{currentPath}</span></p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <MButton
                                            variant="light"
                                            color="blue"
                                            size="xs"
                                            radius="md"
                                            className="hidden xs:flex"
                                            leftSection={<RefreshCw size={14} className={deepLoading ? 'animate-spin' : ''} />}
                                            onClick={() => fetchDeepFiles(currentPath, true)}
                                        >
                                            Refresh
                                        </MButton>
                                        <MButton
                                            variant="filled"
                                            color="blue"
                                            size="xs"
                                            radius="md"
                                            leftSection={<Folder size={14} />}
                                            onClick={() => setView('files')}
                                        >
                                            Files
                                        </MButton>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 sm:px-4 py-3 bg-slate-50/40 w-full max-w-none custom-scrollbar">
                                <div className="w-full min-h-0">
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 xl:grid-rows-2 gap-3 lg:gap-4 w-full max-w-none xl:h-[calc(100vh-140px)]">

                                        <Card className="xl:col-span-5 xl:row-span-1 h-full flex flex-col min-h-0 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                                            <CardHeader className="px-4 py-3 border-b border-slate-100 flex flex-row items-center justify-between space-y-0">
                                                <div>
                                                    <CardTitle className="text-sm font-semibold text-slate-900">File types</CardTitle>
                                                    <CardDescription className="text-xs text-slate-500">Distribution by count</CardDescription>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="flex-1 min-h-0 overflow-hidden px-2 py-2">
                                                {deepLoading ? (
                                                    <div className="flex h-full items-center justify-center">
                                                        <div className="h-32 w-32 rounded-full border-4 border-slate-100 border-t-blue-500 animate-spin" />
                                                    </div>
                                                ) : nonDirFiles.length === 0 ? (
                                                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                                        <File size={32} strokeWidth={1.5} className="mb-2 opacity-50" />
                                                        <span className="text-sm">No files found</span>
                                                    </div>
                                                ) : (
                                                    <div className="h-full flex flex-row items-center gap-1">
                                                        {/* Chart Area - Left side */}
                                                        <div className="flex-[6] h-full relative min-w-0">
                                                            <ResponsiveContainer width="100%" height="100%">
                                                                <PieChart>
                                                                    <Pie
                                                                        data={fileTypeSegments}
                                                                        cx="50%"
                                                                        cy="50%"
                                                                        innerRadius={55}
                                                                        outerRadius={75}
                                                                        paddingAngle={4}
                                                                        cornerRadius={5}
                                                                        dataKey="value"
                                                                        onClick={(data) => {
                                                                            if (data.name === 'other') return;
                                                                            setDashboardExtFilter(prev => (prev === data.label ? null : data.label));
                                                                        }}
                                                                        cursor="pointer"
                                                                        animationDuration={1000}
                                                                        animationBegin={0}
                                                                    >
                                                                        {fileTypeSegments.map((entry, index) => (
                                                                            <Cell
                                                                                key={`cell-${index}`}
                                                                                fill={entry.color}
                                                                                stroke="#fff"
                                                                                strokeWidth={2}
                                                                                opacity={dashboardExtFilter && dashboardExtFilter !== entry.label ? 0.3 : 1}
                                                                                style={{ outline: 'none' }}
                                                                            />
                                                                        ))}
                                                                    </Pie>
                                                                    <RechartsTooltip
                                                                        content={({ active, payload }) => {
                                                                            if (active && payload && payload.length) {
                                                                                const data = payload[0].payload;
                                                                                return (
                                                                                    <div className="bg-slate-900/95 backdrop-blur-sm text-white text-[11px] rounded-lg px-3 py-2 shadow-2xl border border-slate-700">
                                                                                        <div className="flex items-center gap-2 mb-1">
                                                                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: data.color }} />
                                                                                            <span className="font-bold">{data.label} (file type)</span>
                                                                                        </div>
                                                                                        <div className="flex justify-between gap-4">
                                                                                            <span className="text-slate-400">Count:</span>
                                                                                            <span className="font-mono">{data.value}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            }
                                                                            return null;
                                                                        }}
                                                                    />
                                                                </PieChart>
                                                            </ResponsiveContainer>
                                                            {/* Center Stats */}
                                                            <div className="absolute inset-0 flex flex-col items-center justify-center p-2 pointer-events-none -mt-1">
                                                                <span className="text-2xl font-black text-slate-900 leading-none">{nonDirFiles.length}</span>
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Files</span>
                                                            </div>
                                                        </div>

                                                        {/* Legend Section - Right side */}
                                                        <div className="flex-[4] min-w-[150px] max-w-[190px] h-full overflow-y-auto px-2 space-y-1.5 custom-scrollbar border-l border-slate-50 py-1">
                                                            {fileTypeStats.byCount.slice(0, 10).map(item => {
                                                                const pct = nonDirFiles.length ? Math.round((item.count / nonDirFiles.length) * 100) : 0
                                                                const color = fileTypeSegments.find(s => s.label === item.ext)?.color || 'hsl(var(--muted-foreground))'
                                                                const isSelected = dashboardExtFilter === item.ext;
                                                                return (
                                                                    <div
                                                                        key={item.ext}
                                                                        onClick={() => setDashboardExtFilter(prev => (prev === item.ext ? null : item.ext))}
                                                                        className={`flex flex-col p-2 rounded-lg cursor-pointer transition-all duration-200 ${isSelected ? 'bg-blue-50 ring-1 ring-blue-100 shadow-sm' : 'hover:bg-slate-50'}`}
                                                                    >
                                                                        <div className="flex items-center gap-2 mb-1">
                                                                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                                                                            <span className="text-[11px] font-bold text-slate-700 truncate">{item.ext}</span>
                                                                        </div>
                                                                        <div className="flex justify-between items-center pl-3">
                                                                            <span className="text-[10px] text-slate-500 font-mono">{pct}%</span>
                                                                            <span className="text-[10px] text-slate-900 font-bold font-mono">{item.count}</span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>


                                        <Card className="xl:col-span-4 xl:row-span-1 h-full flex flex-col min-h-0 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                                            <CardHeader className="px-4 py-3 border-b border-slate-100 flex flex-row items-center justify-between space-y-0">
                                                <div>
                                                    <CardTitle className="text-sm font-semibold text-slate-900">Inventory</CardTitle>
                                                    <CardDescription className="text-xs text-slate-500">Summary & distribution</CardDescription>
                                                </div>
                                                <Badge variant="outline" className="text-[10px] font-bold h-5 px-1.5 uppercase border-slate-200 text-slate-500">
                                                    Snapshot
                                                </Badge>
                                            </CardHeader>
                                            <CardContent className="flex-1 min-h-0 flex flex-col p-0">
                                                <div className="flex flex-col h-full divide-y divide-slate-100">
                                                    {/* Stats Row - Fixed */}
                                                    <div className="px-4 py-3 grid grid-cols-3 gap-2 bg-slate-50/50 flex-shrink-0">
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Folders</span>
                                                            <span className="text-lg font-bold text-slate-900">{deepStats.folders}</span>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Files</span>
                                                            <span className="text-lg font-bold text-slate-900">{deepStats.files}</span>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Size</span>
                                                            <span className="text-lg font-bold text-slate-900">{formatBytes(deepStats.size)}</span>
                                                        </div>
                                                    </div>
                                                    {/* Chart Area - Flexible */}
                                                    <div className="px-4 py-3 flex-1 min-h-0 flex flex-col gap-2">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[10px] font-bold text-slate-900 uppercase tracking-tight">Size distribution</span>
                                                        </div>
                                                        <div className="flex-1 w-full min-h-0">
                                                            <ResponsiveContainer width="100%" height="100%">
                                                                <BarChart data={sizeDistribution.bins} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                                    <XAxis
                                                                        dataKey="label"
                                                                        axisLine={false}
                                                                        tickLine={false}
                                                                        tick={{ fontSize: 9, fill: '#94a3b8' }}
                                                                    />
                                                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                                                                    <RechartsTooltip
                                                                        cursor={{ fill: '#f8fafc' }}
                                                                        content={({ active, payload }) => {
                                                                            if (active && payload && payload.length) {
                                                                                const data = payload[0].payload;
                                                                                return (
                                                                                    <div className="bg-slate-800 text-white text-[10px] rounded px-2 py-1 shadow-xl">
                                                                                        {data.label}: <span className="font-bold">{data.count} files</span>
                                                                                    </div>
                                                                                );
                                                                            }
                                                                            return null;
                                                                        }}
                                                                    />
                                                                    <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} barSize={24} />
                                                                </BarChart>
                                                            </ResponsiveContainer>
                                                        </div>
                                                    </div>
                                                    {/* Actions - Fixed bottom */}
                                                    <div className="p-3 bg-white border-t border-slate-50 flex-shrink-0">
                                                        <MButton
                                                            fullWidth
                                                            size="sm"
                                                            radius="md"
                                                            color="blue"
                                                            onClick={downloadFoldersOneByOne}
                                                            disabled={deepFolderSummaries.length === 0 || folderBatchRunning}
                                                            leftSection={<Download size={16} />}
                                                        >
                                                            {folderBatchRunning ? 'Running batch...' : 'Download all folders'}
                                                        </MButton>

                                                        {folderBatchRunning && (
                                                            <div className="mt-2 p-3 rounded-lg bg-blue-50 border border-blue-100 flex flex-col gap-2">
                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-[10px] font-bold text-blue-800 uppercase">Progress</span>
                                                                    <span className="text-[10px] font-bold text-blue-800">{folderBatchIndex}/{folderBatchTotal}</span>
                                                                </div>
                                                                <Progress value={(folderBatchIndex / folderBatchTotal) * 100} size="sm" color="blue" animated />
                                                                {folderBatchCurrentName && (
                                                                    <span className="text-[10px] text-blue-600 truncate font-medium">Currently: {folderBatchCurrentName}</span>
                                                                )}
                                                                <MButton size="compact-xs" color="red" variant="subtle" fullWidth onClick={cancelFolderBatch}>
                                                                    Cancel batch
                                                                </MButton>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card className="xl:col-span-3 xl:row-span-1 h-full flex flex-col min-h-0 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                                            <CardHeader className="px-4 py-3 border-b border-slate-100 flex flex-row items-center justify-between space-y-0">
                                                <div>
                                                    <CardTitle className="text-sm font-semibold text-slate-900">File types (size)</CardTitle>
                                                    <CardDescription className="text-xs text-slate-500">Storage usage by extension</CardDescription>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="flex-1 min-h-0 overflow-hidden px-2 py-2">
                                                {deepLoading ? (
                                                    <div className="flex h-full items-center justify-center">
                                                        <div className="h-8 w-8 rounded-full border-2 border-slate-200 border-t-blue-500 animate-spin" />
                                                    </div>
                                                ) : nonDirFiles.length === 0 ? (
                                                    <div className="text-sm text-slate-500 text-center mt-10">No files</div>
                                                ) : (
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart
                                                            layout="vertical"
                                                            data={fileTypeStats.bySize.slice(0, 7).map(item => ({
                                                                name: item.ext,
                                                                size: item.size,
                                                                sizeLabel: formatBytes(item.size)
                                                            }))}
                                                            margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                                                        >
                                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                                            <XAxis type="number" hide />
                                                            <YAxis
                                                                dataKey="name"
                                                                type="category"
                                                                tick={{ fontSize: 11, fill: '#64748b' }}
                                                                width={50}
                                                            />
                                                            <RechartsTooltip
                                                                cursor={{ fill: '#f1f5f9' }}
                                                                content={({ active, payload }) => {
                                                                    if (active && payload && payload.length) {
                                                                        const data = payload[0].payload;
                                                                        return (
                                                                            <div className="bg-slate-800 text-white text-xs rounded px-2 py-1 shadow-xl">
                                                                                <span className="font-semibold">{data.name}</span>: {data.sizeLabel}
                                                                            </div>
                                                                        );
                                                                    }
                                                                    return null;
                                                                }}
                                                            />
                                                            <Bar dataKey="size" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                )}
                                            </CardContent>
                                        </Card>

                                        <Card className="xl:col-span-4 xl:row-span-1 h-full flex flex-col min-h-0 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                                            <CardHeader className="px-4 py-3 border-b border-slate-100 flex flex-row items-center justify-between space-y-0">
                                                <div>
                                                    <CardTitle className="text-sm font-semibold text-slate-900">Category insights</CardTitle>
                                                    <CardDescription className="text-xs text-slate-500">Folder groups by deliverable type</CardDescription>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="flex-1 min-h-0 overflow-hidden px-2 py-2">
                                                {categorySummaries.length === 0 ? (
                                                    <div className="text-sm text-slate-500 text-center mt-10">No categories</div>
                                                ) : (
                                                    <div className="h-full flex items-center">
                                                        <div className="flex-1 h-full min-w-0">
                                                            <ResponsiveContainer width="100%" height="100%">
                                                                <PieChart>
                                                                    <Pie
                                                                        data={categorySummaries.slice(0, 6)}
                                                                        cx="50%"
                                                                        cy="50%"
                                                                        innerRadius={55}
                                                                        outerRadius={80}
                                                                        paddingAngle={5}
                                                                        cornerRadius={6}
                                                                        dataKey="size"
                                                                        nameKey="category"
                                                                        cursor="pointer"
                                                                        onClick={(data) => {
                                                                            setDashboardCategoryFilter(prev => (prev === data.category ? null : data.category as FolderCategory));
                                                                        }}
                                                                        animationDuration={1200}
                                                                    >
                                                                        {categorySummaries.slice(0, 6).map((entry, index) => (
                                                                            <Cell
                                                                                key={`cell-${index}`}
                                                                                fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1'][index % 6]}
                                                                                stroke="#fff"
                                                                                strokeWidth={2}
                                                                                opacity={dashboardCategoryFilter && dashboardCategoryFilter !== entry.category ? 0.3 : 1}
                                                                                style={{ outline: 'none' }}
                                                                            />
                                                                        ))}
                                                                    </Pie>
                                                                    <RechartsTooltip
                                                                        content={({ active, payload }) => {
                                                                            if (active && payload && payload.length) {
                                                                                const data = payload[0].payload;
                                                                                return (
                                                                                    <div className="bg-slate-900/95 backdrop-blur-sm text-white text-[11px] rounded-lg px-3 py-2 shadow-2xl border border-slate-700">
                                                                                        <div className="font-bold mb-1">{data.category}</div>
                                                                                        <div className="flex justify-between gap-4">
                                                                                            <span className="text-slate-400">Total size:</span>
                                                                                            <span className="font-mono text-blue-400">{formatBytes(data.size)}</span>
                                                                                        </div>
                                                                                        <div className="flex justify-between gap-4">
                                                                                            <span className="text-slate-400">Items:</span>
                                                                                            <span className="font-mono">{data.files + data.folders}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            }
                                                                            return null;
                                                                        }}
                                                                    />
                                                                </PieChart>
                                                            </ResponsiveContainer>
                                                            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 pointer-events-none mb-1">
                                                                <Activity size={20} className="text-blue-500 mb-1 opacity-20" />
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Insights</span>
                                                            </div>
                                                        </div>
                                                        {/* Legend */}
                                                        <div className="w-[160px] flex-shrink-0 text-xs space-y-1.5 overflow-y-auto max-h-full pl-3 custom-scrollbar border-l border-slate-50">
                                                            {categorySummaries.slice(0, 10).map((cat, i) => {
                                                                const color = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1'][i % 6] || '#94a3b8';
                                                                const isSelected = dashboardCategoryFilter === cat.category;
                                                                return (
                                                                    <div
                                                                        key={cat.category}
                                                                        className={`flex flex-col p-2 rounded-lg cursor-pointer transition-all duration-200 ${isSelected ? 'bg-blue-50 ring-1 ring-blue-100 shadow-sm' : 'hover:bg-slate-50'}`}
                                                                        onClick={() => setDashboardCategoryFilter(prev => (prev === cat.category ? null : cat.category as FolderCategory))}
                                                                    >
                                                                        <div className="flex items-center gap-2 mb-1">
                                                                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                                                                            <span className="font-bold text-slate-700 truncate text-[11px]" title={cat.category}>{cat.category}</span>
                                                                        </div>
                                                                        <div className="flex justify-between items-center pl-3">
                                                                            <span className="text-[10px] text-slate-500 font-medium">{formatBytes(cat.size)}</span>
                                                                            <span className="text-[9px] text-slate-400 bg-slate-100 px-1 rounded">{cat.files + cat.folders} items</span>
                                                                        </div>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>


                                        <Card className="xl:col-span-4 xl:row-span-1 h-full flex flex-col min-h-0 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                                            <CardHeader className="px-4 py-3 border-b border-slate-100 flex flex-row items-center justify-between space-y-0">
                                                <div className="min-w-0">
                                                    <CardTitle className="text-sm font-semibold text-slate-900 truncate">Subfolder insights</CardTitle>
                                                    <CardDescription className="text-xs text-slate-500 truncate">Direct child folder metrics</CardDescription>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="flex-1 min-h-0 overflow-auto custom-scrollbar p-0">
                                                {deepLoading ? (
                                                    <div className="p-4 space-y-3">
                                                        {[...Array(5)].map((_, i) => (
                                                            <div key={i} className="h-10 bg-slate-50 rounded-lg animate-pulse" />
                                                        ))}
                                                    </div>
                                                ) : filteredFolderSummaries.length === 0 ? (
                                                    <div className="flex flex-col items-center justify-center h-full p-8 text-slate-400">
                                                        <Folder size={32} className="opacity-20 mb-2" />
                                                        <span className="text-xs">No subfolders identified</span>
                                                    </div>
                                                ) : (
                                                    <div className="w-full">
                                                        <Table className="w-full border-collapse">
                                                            <Table.Thead className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10">
                                                                <Table.Tr>
                                                                    <Table.Th className="px-4 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">Folder</Table.Th>
                                                                    <Table.Th className="px-4 py-2 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">Files</Table.Th>
                                                                    <Table.Th className="px-4 py-2 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">Size</Table.Th>
                                                                    <Table.Th className="px-4 py-2 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">Actions</Table.Th>
                                                                </Table.Tr>
                                                            </Table.Thead>
                                                            <Table.Tbody className="divide-y divide-slate-50">
                                                                {filteredFolderSummaries.map((s) => (
                                                                    <Table.Tr
                                                                        key={s.path}
                                                                        className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                                                                        onClick={() => setSelectedSubfolder(s)}
                                                                    >
                                                                        <Table.Td className="px-4 py-3">
                                                                            <div className="flex items-center gap-2">
                                                                                <Folder size={14} className="text-blue-500 fill-blue-50" />
                                                                                <span className="text-xs font-semibold text-slate-700 truncate max-w-[120px]" title={s.name}>{s.name}</span>
                                                                            </div>
                                                                        </Table.Td>
                                                                        <Table.Td className="px-4 py-3 text-right text-xs font-mono text-slate-500">{s.files}</Table.Td>
                                                                        <Table.Td className="px-4 py-3 text-right text-xs font-mono text-slate-500">{formatBytes(s.size)}</Table.Td>
                                                                        <Table.Td className="px-4 py-3 text-right">
                                                                            <MButton
                                                                                variant="subtle"
                                                                                size="compact-xs"
                                                                                onClick={(e) => { e.stopPropagation(); setView('files'); fetchFiles(s.path) }}
                                                                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                                                            >
                                                                                Open
                                                                            </MButton>
                                                                        </Table.Td>
                                                                    </Table.Tr>
                                                                ))}
                                                            </Table.Tbody>
                                                        </Table>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>

                                        <Card className="xl:col-span-4 xl:row-span-1 h-full flex flex-col min-h-0 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                                            <CardHeader className="px-4 py-3 border-b border-slate-100 flex flex-row items-center justify-between space-y-0">
                                                <div>
                                                    <CardTitle className="text-sm font-semibold text-slate-900">Largest files</CardTitle>
                                                    <CardDescription className="text-xs text-slate-500">Resource intensive files</CardDescription>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="flex-1 min-h-0 overflow-auto custom-scrollbar p-0">
                                                {largestFiles.length === 0 ? (
                                                    <div className="flex flex-col items-center justify-center h-full p-8 text-slate-400">
                                                        <File size={32} className="opacity-20 mb-2" />
                                                        <span className="text-xs">No files available</span>
                                                    </div>
                                                ) : (
                                                    <div className="divide-y divide-slate-50">
                                                        {largestFiles.map(f => (
                                                            <div
                                                                key={f.path}
                                                                className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors group"
                                                            >
                                                                <div className="flex items-center gap-3 min-w-0 pr-4">
                                                                    <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-white transition-colors">
                                                                        <File size={14} className="text-slate-400" />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="text-xs font-semibold text-slate-900 truncate" title={f.name}>{f.name}</p>
                                                                        <p className="text-[10px] text-slate-500 font-mono">{formatBytes(f.size || 0)}</p>
                                                                    </div>
                                                                </div>
                                                                <MButton
                                                                    variant="light"
                                                                    size="compact-xs"
                                                                    onClick={() => handleQueueDownloads([f.path])}
                                                                    leftSection={<Download size={14} />}
                                                                >
                                                                    Queue
                                                                </MButton>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>

                                        <AnimatePresence>
                                            {selectedSubfolder && drilldown && (
                                                <motion.div
                                                    className="fixed inset-0 z-50 flex items-center justify-center p-6"
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    role="dialog"
                                                    aria-modal="true"
                                                    aria-label="Subfolder insights"
                                                    onMouseDown={(e) => {
                                                        if (e.target === e.currentTarget) setSelectedSubfolder(null)
                                                    }}
                                                >
                                                    <div className="absolute inset-0 bg-slate-900/40" />

                                                    <motion.div
                                                        className="relative w-full max-w-5xl bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden"
                                                        initial={{ y: 12, scale: 0.98, opacity: 0 }}
                                                        animate={{ y: 0, scale: 1, opacity: 1 }}
                                                        exit={{ y: 12, scale: 0.98, opacity: 0 }}
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                    >
                                                        <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between gap-4">
                                                            <div className="min-w-0">
                                                                <h3 className="text-lg font-bold text-slate-900 truncate" title={selectedSubfolder.name}>{selectedSubfolder.name}</h3>
                                                                <p className="text-xs text-slate-500 truncate" title={selectedSubfolder.path}>{selectedSubfolder.path}</p>
                                                                <p className="text-xs text-slate-500 mt-2">
                                                                    Category:{' '}
                                                                    <span className="font-semibold text-slate-700">{deriveCategory(selectedSubfolder.name)}</span>
                                                                    {' '}· Files:{' '}
                                                                    <span className="font-semibold text-slate-700">{drilldown.files.length}</span>
                                                                    {' '}· Size:{' '}
                                                                    <span className="font-semibold text-slate-700">{formatBytes(drilldown.totalSize)}</span>
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                                <MButton
                                                                    onClick={() => handleQueueDownloads(drilldown.files.map(f => f.path))}
                                                                    disabled={drilldown.files.length === 0}
                                                                    color="blue"
                                                                    leftSection={<Download size={16} aria-hidden="true" />}
                                                                    aria-label="Queue all files in this folder"
                                                                >
                                                                    Queue all
                                                                </MButton>
                                                                <MButton
                                                                    onClick={() => { setView('files'); fetchFiles(selectedSubfolder.path); setSelectedSubfolder(null) }}
                                                                    variant="light"
                                                                    color="blue"
                                                                    leftSection={<Folder size={16} aria-hidden="true" />}
                                                                    aria-label="Open folder in file manager"
                                                                >
                                                                    Open
                                                                </MButton>
                                                                <ActionIcon
                                                                    variant="subtle"
                                                                    color="gray"
                                                                    onClick={() => setSelectedSubfolder(null)}
                                                                    aria-label="Close"
                                                                >
                                                                    <X size={18} aria-hidden="true" />
                                                                </ActionIcon>
                                                            </div>
                                                        </div>

                                                        <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
                                                            <div className="card p-5 lg:col-span-5 flex flex-col min-h-0">
                                                                <h4 className="text-xs font-bold text-slate-900 mb-4 uppercase tracking-wider">File types distribution</h4>
                                                                {drilldown.files.length === 0 ? (
                                                                    <div className="text-sm text-slate-500">No files found in this folder.</div>
                                                                ) : (
                                                                    <div className="flex-1 min-h-0 flex flex-col">
                                                                        <div className="h-[200px] w-full relative">
                                                                            <ResponsiveContainer width="100%" height="100%">
                                                                                <PieChart>
                                                                                    <Pie
                                                                                        data={drilldown.segments}
                                                                                        cx="50%"
                                                                                        cy="50%"
                                                                                        innerRadius={65}
                                                                                        outerRadius={90}
                                                                                        paddingAngle={4}
                                                                                        cornerRadius={5}
                                                                                        dataKey="value"
                                                                                        animationDuration={1000}
                                                                                    >
                                                                                        {drilldown.segments.map((entry, index) => (
                                                                                            <Cell
                                                                                                key={`drill-cell-${index}`}
                                                                                                fill={entry.color}
                                                                                                stroke="#fff"
                                                                                                strokeWidth={2}
                                                                                            />
                                                                                        ))}
                                                                                    </Pie>
                                                                                    <RechartsTooltip
                                                                                        content={({ active, payload }) => {
                                                                                            if (active && payload && payload.length) {
                                                                                                const data = payload[0].payload;
                                                                                                return (
                                                                                                    <div className="bg-slate-800 text-white text-[10px] rounded px-2 py-1 shadow-xl">
                                                                                                        <span className="font-semibold">{data.label}</span>: {data.value} files
                                                                                                    </div>
                                                                                                );
                                                                                            }
                                                                                            return null;
                                                                                        }}
                                                                                    />
                                                                                </PieChart>
                                                                            </ResponsiveContainer>
                                                                            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 pointer-events-none">
                                                                                <span className="text-xl font-bold text-slate-900">{drilldown.files.length}</span>
                                                                                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Files</span>
                                                                            </div>
                                                                        </div>

                                                                        <div className="mt-4 space-y-2 max-h-[160px] overflow-y-auto custom-scrollbar pr-2">
                                                                            {drilldown.byCount.slice(0, 8).map(x => {
                                                                                const pct = drilldown.files.length ? Math.round((x.count / drilldown.files.length) * 100) : 0;
                                                                                const color = drilldown.segments.find(s => s.label === x.ext)?.color || 'hsl(var(--muted-foreground))';
                                                                                return (
                                                                                    <div key={x.ext} className="flex items-center justify-between text-[11px]">
                                                                                        <div className="flex items-center gap-2 min-w-0">
                                                                                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                                                                                            <span className="text-slate-700 font-medium truncate">{x.ext}</span>
                                                                                        </div>
                                                                                        <div className="flex items-center gap-3 font-mono">
                                                                                            <span className="text-slate-400">{pct}%</span>
                                                                                            <span className="text-slate-900 font-bold">{x.count}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="card p-5 lg:col-span-7">
                                                                <h4 className="text-sm font-bold text-slate-900 mb-4">Largest files</h4>
                                                                {drilldown.largest.length === 0 ? (
                                                                    <div className="text-sm text-slate-500">No files found in this folder.</div>
                                                                ) : (
                                                                    <div className="space-y-3 max-h-80 overflow-auto pr-2 custom-scrollbar">
                                                                        {drilldown.largest.map(f => (
                                                                            <div key={f.path} className="flex items-center gap-3">
                                                                                <File className="w-4 h-4 text-slate-400 flex-shrink-0" aria-hidden="true" />
                                                                                <div className="flex-1 min-w-0">
                                                                                    <p className="text-sm font-semibold text-slate-900 truncate" title={f.name}>{f.name}</p>
                                                                                    <p className="text-xs text-slate-500">{formatBytes(f.size || 0)}</p>
                                                                                </div>
                                                                                <MButton
                                                                                    onClick={() => handleQueueDownloads([f.path])}
                                                                                    variant="light"
                                                                                    color="blue"
                                                                                    size="xs"
                                                                                    leftSection={<Download size={16} aria-hidden="true" />}
                                                                                    aria-label={`Queue download for ${f.name}`}
                                                                                >
                                                                                    Queue
                                                                                </MButton>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            </div >
                        </main >
                    ) : view === 'mock' ? (
                        <DashboardMock
                            session={session}
                            currentPath={currentPath}
                            deepFiles={deepFiles}
                            deepLoading={deepLoading}
                            deepError={deepError}
                            deepLastRefreshedAt={deepLastRefreshedAt}
                            deepFolderCount={deepFolderCount}
                            deepFolderSummaries={deepFolderSummaries}
                            tasks={tasks}
                            onRefresh={() => fetchDeepFiles(currentPath, true)}
                            onQueueDownload={(paths: string[]) => { void handleQueueDownloads(paths) }}
                        />
                    ) : (
                        <main className="flex-1 min-h-0 flex flex-col relative overflow-hidden bg-slate-50">
                            {/* Header */}
                            {/* Consolidated Toolbar */}
                            <Paper withBorder radius={0} px="xl" py="sm" bg="white" className="sticky top-0 z-20 border-b border-slate-100">
                                <Group justify="space-between" align="center" wrap="nowrap" gap="xl">
                                    <Group gap="md" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                                        <ActionIcon
                                            variant="light"
                                            color="blue"
                                            radius="xl"
                                            size="lg"
                                            onClick={() => fetchFiles(parentPath)}
                                            disabled={atRoot}
                                            aria-label="Back"
                                        >
                                            <ArrowLeft size={18} aria-hidden="true" />
                                        </ActionIcon>

                                        <Breadcrumbs separatorMargin="sm" style={{ flex: 1, minWidth: 0 }} styles={{
                                            separator: { color: 'var(--mantine-color-slate-200)', fontWeight: 900 }
                                        }}>
                                            <Anchor component="button" type="button" onClick={() => fetchFiles('/')} c={atRoot ? 'blue.7' : 'slate.400'} fw={900} size="sm" tt="uppercase" lts={1}>ROOT</Anchor>
                                            {breadcrumbs.map((part, i) => (
                                                <Anchor
                                                    key={`${part}-${i}`}
                                                    component="button"
                                                    type="button"
                                                    onClick={() => fetchFiles('/' + breadcrumbs.slice(0, i + 1).join('/'))}
                                                    title={part}
                                                    c={i === breadcrumbs.length - 1 ? 'blue.7' : 'slate.400'}
                                                    fw={900}
                                                    size="sm"
                                                    tt="uppercase"
                                                    lts={1}
                                                    className="truncate max-w-[160px]"
                                                >
                                                    {part}
                                                </Anchor>
                                            ))}
                                        </Breadcrumbs>

                                        <Group gap="xs" wrap="nowrap" visibleFrom="xl">
                                            <MBadge color="blue.0" c="blue.7" variant="filled" radius="sm" size="sm" fw={800}>{stats.folders} FOLDERS</MBadge>
                                            <MBadge color="indigo.0" c="indigo.7" variant="filled" radius="sm" size="sm" fw={800}>{stats.files} ASSETS</MBadge>
                                            <MBadge color="slate.0" c="slate.7" variant="filled" radius="sm" size="sm" fw={800}>{formatBytes(stats.size)}</MBadge>
                                        </Group>
                                    </Group>

                                    <Group gap="sm" wrap="nowrap" style={{ flexShrink: 0 }}>
                                        <div className="flex bg-slate-100 p-1 rounded-lg">
                                            <button
                                                type="button"
                                                onClick={() => setFileViewMode('list')}
                                                className={`p-1.5 rounded-md transition-all ${fileViewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                                aria-label="List view"
                                                title="List view"
                                            >
                                                <LayoutList size={16} aria-hidden="true" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFileViewMode('grid')}
                                                className={`p-1.5 rounded-md transition-all ${fileViewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                                aria-label="Grid view"
                                                title="Grid view"
                                            >
                                                <LayoutGrid size={16} aria-hidden="true" />
                                            </button>
                                        </div>

                                        <div className="h-6 w-px bg-slate-200 mx-1" />

                                        <ActionIcon
                                            variant="subtle"
                                            color="slate"
                                            radius="xl"
                                            size="lg"
                                            onClick={() => fetchFiles(currentPath, { force: true })}
                                            aria-label="Refresh"
                                        >
                                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
                                        </ActionIcon>

                                        <input ref={uploadFilesInputRef} type="file" multiple className="hidden" onChange={onPickUploadFiles} />
                                        <input ref={uploadFolderInputRef} type="file" multiple className="hidden" onChange={onPickUploadFolder} {...({ webkitdirectory: 'true' } as any)} />

                                        <Menu withinPortal position="bottom-end" radius="md">
                                            <Menu.Target>
                                                <MButton variant="light" color="blue" radius="xl" size="sm" leftSection={<Upload size={16} aria-hidden="true" />} disabled={uploading}>Upload</MButton>
                                            </Menu.Target>
                                            <Menu.Dropdown>
                                                <Menu.Label>Ingest Local Data</Menu.Label>
                                                <Menu.Item onClick={() => uploadFilesInputRef.current?.click()} leftSection={<File size={16} />}>Single Assets</Menu.Item>
                                                <Menu.Item onClick={() => uploadFolderInputRef.current?.click()} leftSection={<Folder size={16} />}>Directory Structure</Menu.Item>
                                            </Menu.Dropdown>
                                        </Menu>

                                        <MButton
                                            onClick={() => handleQueueDownloads()}
                                            disabled={selectedPaths.length === 0}
                                            color="blue"
                                            radius="xl"
                                            size="sm"
                                            style={{ boxShadow: selectedPaths.length > 0 ? '0 8px 16px rgba(59,130,246,0.3)' : 'none' }}
                                            leftSection={<Download size={16} aria-hidden="true" />}
                                        >
                                            {selectedPaths.length ? `Transfer (${selectedPaths.length})` : 'Transfer'}
                                        </MButton>
                                    </Group>
                                </Group>
                            </Paper>

                            {/* Selection Bar */}
                            {selectedPaths.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    className="selection-bar sticky top-24 z-10"
                                >
                                    <Paper withBorder radius={0} px="md" py="sm" bg="rgba(255,255,255,0.92)" style={{ backdropFilter: 'blur(8px)' }}>
                                        <Group justify="space-between" align="center" wrap="wrap" gap="sm">
                                            <Group gap="sm" wrap="wrap">
                                                <MBadge color="blue" variant="light">
                                                    {selectedPaths.length} selected
                                                </MBadge>
                                                <MButton type="button" onClick={clearSelection} variant="light" color="blue" size="xs" aria-label="Clear selection">
                                                    Clear
                                                </MButton>
                                                <Group gap="xs" wrap="wrap">
                                                    <MButton type="button" onClick={selectVisible} variant="light" color="blue" size="xs" aria-label="Select visible files">
                                                        Select visible
                                                    </MButton>
                                                    <MButton type="button" onClick={selectAll} variant="light" color="blue" size="xs" aria-label="Select all files">
                                                        Select all
                                                    </MButton>
                                                </Group>
                                            </Group>

                                            <MButton type="button" onClick={() => handleQueueDownloads()} color="blue" leftSection={<Download size={16} aria-hidden="true" />} aria-label="Queue selected files">
                                                Queue selected
                                            </MButton>
                                        </Group>
                                    </Paper>
                                </motion.div>
                            )}

                            {/* Files Grid */}
                            <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8 custom-scrollbar bg-slate-50">
                                {loading ? (
                                    <FileGridSkeleton />
                                ) : uiError ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center">
                                        <HardDrive className="w-12 h-12 text-slate-300 mb-4" aria-hidden="true" />
                                        <p className="text-lg font-semibold text-slate-600">Unable to load files</p>
                                        <p className="text-sm text-slate-500 mt-1">{uiError}</p>
                                        <div className="mt-6 flex gap-3">
                                            <MButton
                                                type="button"
                                                onClick={() => void fetchFiles(currentPath, { force: true })}
                                                color="blue"
                                                leftSection={<RefreshCw size={16} aria-hidden="true" />}
                                            >
                                                Retry
                                            </MButton>
                                        </div>
                                    </div>
                                ) : filteredFiles.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center">
                                        <HardDrive className="w-12 h-12 text-slate-300 mb-4" aria-hidden="true" />
                                        <p className="text-lg font-semibold text-slate-600">{debouncedSearch.trim() ? 'No files match your search' : 'This folder is empty'}</p>
                                        <p className="text-sm text-slate-500 mt-1">{debouncedSearch.trim() ? 'Try a different search term or clear the search filter' : 'Try navigating to a different folder'}</p>
                                    </div>
                                ) : (
                                    fileViewMode === 'list' ? (
                                        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left text-sm">
                                                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                                                        <tr>
                                                            <th className="px-4 py-3 w-10" aria-label="Select" />
                                                            <th className="px-4 py-3 w-12" aria-label="Type" />
                                                            <th className="px-4 py-3 text-xs uppercase tracking-wider">Name</th>
                                                            <th className="px-4 py-3 w-36 text-xs uppercase tracking-wider">Size</th>
                                                            <th className="px-4 py-3 w-28 text-xs uppercase tracking-wider">Type</th>
                                                            <th className="px-4 py-3 w-56 text-xs uppercase tracking-wider">Modified</th>
                                                            <th className="px-4 py-3 w-24 text-right text-xs uppercase tracking-wider">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50 bg-white">
                                                        {!atRoot && (
                                                            <tr
                                                                onClick={() => fetchFiles(parentPath)}
                                                                className="hover:bg-slate-50 cursor-pointer group"
                                                            >
                                                                <td className="px-4 py-3" />
                                                                <td className="px-4 py-3 text-slate-400">
                                                                    <Folder size={18} className="text-blue-500 fill-blue-50" aria-hidden="true" />
                                                                </td>
                                                                <td className="px-4 py-3 font-medium text-slate-800">..</td>
                                                                <td className="px-4 py-3" colSpan={4} />
                                                            </tr>
                                                        )}

                                                        {filteredFiles.map((file) => {
                                                            const ext = file.isDirectory ? 'DIR' : ((file.name.split('.').pop() || '').toUpperCase())
                                                            const selected = selectedPaths.includes(file.path)
                                                            return (
                                                                <tr
                                                                    key={file.path}
                                                                    onClick={() => file.isDirectory ? fetchFiles(file.path) : openPreview(file)}
                                                                    className={`group transition-colors ${file.isDirectory ? 'cursor-pointer' : 'cursor-pointer'} ${selected ? 'bg-blue-50/40' : 'hover:bg-slate-50'}`}
                                                                >
                                                                    <td className="px-4 py-3">
                                                                        <Checkbox
                                                                            size="xs"
                                                                            checked={selected}
                                                                            onChange={(e) => {
                                                                                e.stopPropagation()
                                                                                toggleSelectPath(file.path)
                                                                            }}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            styles={{ input: { cursor: 'pointer' } }}
                                                                        />
                                                                    </td>
                                                                    <td className="px-4 py-3 text-slate-400">
                                                                        {file.isDirectory ? (
                                                                            <Folder size={18} className="text-blue-500 fill-blue-50" aria-hidden="true" />
                                                                        ) : (
                                                                            <File size={18} className="text-slate-400" aria-hidden="true" />
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-3 font-medium text-slate-700 group-hover:text-blue-700 transition-colors" title={file.name}>
                                                                        {file.name}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                                                                        {file.isDirectory ? '--' : formatBytes(file.size || 0)}
                                                                    </td>
                                                                    <td className="px-4 py-3">
                                                                        <span
                                                                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                                                                                file.isDirectory
                                                                                    ? 'bg-blue-50 text-blue-700 border-blue-100'
                                                                                    : 'bg-slate-50 text-slate-600 border-slate-200'
                                                                            }`}
                                                                        >
                                                                            {ext || 'FILE'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-slate-500 text-xs font-mono">
                                                                        {formatModifyTime(file.modifyTime)}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right">
                                                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation()
                                                                                    void handleQueueDownloads([file.path])
                                                                                }}
                                                                                className="p-1.5 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"
                                                                                title="Queue download"
                                                                                aria-label="Queue download"
                                                                            >
                                                                                <Download size={18} aria-hidden="true" />
                                                                            </button>
                                                                            {!file.isDirectory && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation()
                                                                                        openPreview(file)
                                                                                    }}
                                                                                    className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
                                                                                    title="Preview"
                                                                                    aria-label="Preview"
                                                                                >
                                                                                    <Eye size={18} aria-hidden="true" />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ) : (
                                        <motion.div
                                            variants={{
                                                hidden: { opacity: 0 },
                                                show: {
                                                    opacity: 1,
                                                    transition: {
                                                        staggerChildren: 0.04
                                                    }
                                                }
                                            }}
                                            initial="hidden"
                                            animate="show"
                                            className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 lg:gap-6 pb-20"
                                        >
                                            <AnimatePresence mode="popLayout">
                                                {filteredFiles.map((file) => (
                                                    <FileCard
                                                        key={file.path}
                                                        file={file}
                                                        onClick={() => file.isDirectory ? fetchFiles(file.path) : openPreview(file)}
                                                        onDownload={() => handleQueueDownloads([file.path])}
                                                        formatBytes={formatBytes}
                                                        selected={selectedPaths.includes(file.path)}
                                                        onSelect={() => toggleSelectPath(file.path)}
                                                    />
                                                ))}
                                            </AnimatePresence>
                                        </motion.div>
                                    )
                                )}
                            </div>
                        </main>
                    )}

                    {/* Preview Sidebar */}
                    <Drawer
                        opened={!!previewFile}
                        onClose={clearPreview}
                        position="right"
                        size="md"
                        withCloseButton={false}
                        overlayProps={{ opacity: 0.35, blur: 1 }}
                        trapFocus
                        returnFocus
                    >
                        {previewFile && (
                            <Box ref={(el) => { previewPanelRef.current = el as unknown as HTMLElement | null }}>
                                <Group justify="space-between" align="flex-start" wrap="nowrap" mb="sm">
                                    <Box style={{ minWidth: 0 }}>
                                        <Text fw={600} lineClamp={1} title={previewFile.name}>
                                            {previewFile.name}
                                        </Text>
                                        <Text size="xs" c="dimmed" mt={4}>
                                            {previewFile.isDirectory ? 'Folder' : formatBytes(previewFile.size)}
                                        </Text>
                                    </Box>
                                    <ActionIcon
                                        variant="subtle"
                                        color="gray"
                                        onClick={clearPreview}
                                        aria-label="Close preview"
                                        ref={previewCloseButtonRef}
                                    >
                                        <X size={18} aria-hidden="true" />
                                    </ActionIcon>
                                </Group>

                                <Paper withBorder radius="md" p="md" bg="var(--mantine-color-gray-0)" style={{ minHeight: 280 }}>
                                    {previewLoading ? (
                                        <Center style={{ height: 240 }}>
                                            <Text size="sm" c="dimmed">
                                                Loading...
                                            </Text>
                                        </Center>
                                    ) : previewUrl ? (
                                        <img src={previewUrl} alt={previewFile.name} className="w-full h-auto object-contain rounded-lg bg-white" />
                                    ) : previewContent ? (
                                        <pre className="whitespace-pre-wrap text-xs text-slate-700 font-mono bg-white p-4 rounded-lg">{previewContent.slice(0, 1000)}</pre>
                                    ) : (
                                        <Center style={{ height: 240 }}>
                                            <Stack gap={4} align="center">
                                                <Eye className="w-8 h-8 text-slate-300" aria-hidden="true" />
                                                <Text size="sm" fw={500} c="dimmed">
                                                    No preview available
                                                </Text>
                                            </Stack>
                                        </Center>
                                    )}
                                </Paper>

                                <MButton
                                    type="button"
                                    onClick={() => previewFile && handleQueueDownloads([previewFile.path])}
                                    color="blue"
                                    fullWidth
                                    mt="md"
                                    leftSection={<Download size={16} aria-hidden="true" />}
                                    aria-label="Download file"
                                >
                                    Download
                                </MButton>
                            </Box>
                        )}
                    </Drawer>

                    <TransferManager
                        tasks={tasks}
                        onCancel={handleCancelTransfer}
                        onTaskUpdate={onTaskUpdate}
                        sessionId={session.sessionId}
                        isOpen={view !== 'downloads' && isTransferManagerOpen}
                        onToggle={() => setIsTransferManagerOpen(!isTransferManagerOpen)}
                    />

                </Box >
            </AppShell.Main >
        </AppShell >
    )
}

function FileGridSkeleton() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
            {new Array(16).fill(0).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 h-48 flex flex-col justify-between animate-pulse shadow-sm">
                    <div className="flex justify-between items-start">
                        <div className="w-10 h-10 rounded-xl bg-slate-100" />
                        <div className="w-4 h-4 rounded bg-slate-100" />
                    </div>
                    <div className="space-y-2">
                        <div className="h-4 w-full bg-slate-100 rounded" />
                        <div className="h-3 w-2/3 bg-slate-100 rounded" />
                    </div>
                    <div className="h-8 w-full bg-slate-100 rounded-lg mt-4" />
                </div>
            ))}
        </div>
    )
}

const getFileIcon = (fileName: string, isDirectory: boolean, compact?: boolean) => {
    const size = compact ? "w-5 h-5" : "w-6 h-6";
    if (isDirectory) return <Folder className={`${size} fill-current text-blue-600`} aria-hidden="true" />
    const ext = fileName.toLowerCase().split('.').pop()
    if (['fastq', 'fq', 'gz'].includes(ext || '')) return <Activity className={`${size} text-emerald-600`} aria-hidden="true" />
    if (['bam', 'sam', 'bai'].includes(ext || '')) return <HardDrive className={`${size} text-blue-600`} aria-hidden="true" />
    if (['vcf', 'bcf', 'bed'].includes(ext || '')) return <Shield className={`${size} text-purple-600`} aria-hidden="true" />
    if (['pdf', 'doc', 'docx', 'txt'].includes(ext || '')) return <File className={`${size} text-orange-600`} aria-hidden="true" />
    return <File className={`${size} text-slate-400`} aria-hidden="true" />
}

function FileCard({ file, onClick, onDownload, formatBytes, selected, onSelect }: FileCardProps) {
    const ext = !file.isDirectory ? (file.name.split('.').pop() || '').toUpperCase() : 'DIR'

    return (
        <motion.div
            layout
            variants={{
                hidden: { opacity: 0, y: 12, scale: 0.96 },
                show: { opacity: 1, y: 0, scale: 1 }
            }}
            whileHover={{
                y: -4,
                transition: { duration: 0.2, ease: "easeOut" }
            }}
            whileTap={{ scale: 0.98 }}
            className={`
                group relative flex flex-col h-full min-h-[180px]
                bg-white border transition-all duration-300
                rounded-2xl overflow-hidden cursor-pointer
                ${selected
                    ? 'ring-2 ring-blue-500 border-blue-500 shadow-blue-100/50 shadow-lg'
                    : 'border-slate-200 hover:border-blue-200 hover:shadow-xl hover:shadow-slate-200/50'
                }
            `}
            onClick={onClick}
        >
            {/* Header / Selection Area */}
            <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-start justify-between mb-4">
                    <div className={`
                        p-2.5 rounded-xl shadow-sm transition-transform group-hover:scale-110 duration-300
                        ${file.isDirectory
                            ? 'bg-amber-50 text-amber-600 ring-1 ring-amber-100'
                            : 'bg-blue-50 text-blue-600 ring-1 ring-blue-100'
                        }
                    `}>
                        {getFileIcon(file.name, file.isDirectory, false)}
                    </div>

                    <Checkbox
                        size="xs"
                        checked={!!selected}
                        onChange={(e) => {
                            e.stopPropagation()
                            onSelect()
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className={`transition-opacity duration-200 ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                        styles={{
                            input: { cursor: 'pointer' }
                        }}
                    />
                </div>

                {/* File Info */}
                <div className="space-y-1">
                    <Text
                        className="text-sm font-bold text-slate-900 leading-tight line-clamp-2 group-hover:text-blue-600 transition-colors"
                        title={file.name}
                    >
                        {file.name}
                    </Text>
                    <div className="flex items-center gap-2">
                        <Badge
                            variant="secondary"
                            className="h-4 px-1 text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 border-none"
                        >
                            {ext}
                        </Badge>
                        <span className="text-[11px] font-medium text-slate-400">
                            {file.isDirectory ? 'Folder' : formatBytes(file.size || 0)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="px-3 py-3 bg-slate-50/50 border-t border-slate-100 group-hover:bg-white transition-colors flex items-center gap-2">
                <MButton
                    fullWidth
                    size="compact-xs"
                    radius="md"
                    color="blue"
                    variant="filled"
                    onClick={(e) => {
                        e.stopPropagation()
                        onDownload()
                    }}
                    leftSection={<Download size={14} />}
                    className="opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 shadow-sm"
                >
                    Download
                </MButton>

                {!file.isDirectory && (
                    <ActionIcon
                        variant="subtle"
                        color="slate"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                            e.stopPropagation()
                            onClick()
                        }}
                    >
                        <Eye size={14} />
                    </ActionIcon>
                )}
            </div>

            {/* Selection Overlay Tint */}
            {selected && (
                <div className="absolute inset-0 bg-blue-500/5 pointer-events-none" />
            )}
        </motion.div>
    )
}
