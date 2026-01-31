import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    AlertCircle,
    ArrowLeft,
    Folder,
    FolderOpen,
    LayoutGrid,
    Loader2,
    RefreshCw,
    Search,
    FileText,
    Files,
    MoreHorizontal,
    User,
    Database,
    ChevronRight,
    ChevronDown,
    FileArchive,
    FileSpreadsheet,
    FileCode,
    Image as ImageIcon,
    Activity,
    CheckCircle2,
    Clock,
    UserCheck,
    FlaskConical
} from 'lucide-react'
import { sftpApi } from '../api/sftp'
import type { SFTPFile } from '../types'
import { formatBytes as formatBytesUtil } from '../utils'
import { motion } from 'framer-motion'
import { Badge, Button, Card, Progress, Text, Title, Group, Stack, SimpleGrid, TextInput, ActionIcon, Paper, ThemeIcon, Box, Grid } from '@mantine/core'

type ProjectStatus = 'Live' | 'Archived'

type ProjectMetadata = {
    projectId?: string
    projectPi?: string
    application?: string
    samples?: string
}

export type ProjectInfo = {
    name: string
    path: string
    readmePath: string
    status: ProjectStatus
    readmeText?: string
    metadata?: ProjectMetadata
    treeSections?: TreeSection[]
}

type TreeSection = {
    title: string
    lines: string[]
}

type DeliverableNode = {
    id: string
    name: string
    children: DeliverableNode[]
}

type FileNode = {
    label: string
    children?: FileNode[]
}

function getFileIcon(name: string) {
    const lower = name.toLowerCase()
    if (lower.endsWith('.gz') || lower.endsWith('.zip')) return <FileArchive size={16} className="text-purple-500" />
    if (lower.endsWith('.xlsx') || lower.endsWith('.csv')) return <FileSpreadsheet size={16} className="text-emerald-600" />
    if (lower.endsWith('.gtf') || lower.endsWith('.gff') || lower.endsWith('.fna') || lower.endsWith('.fasta')) return <FileCode size={16} className="text-orange-500" />
    if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp')) return <ImageIcon size={16} className="text-pink-500" />
    return <FileText size={16} className="text-slate-400" />
}

const FileNodeItem = ({ node, level = 0 }: { node: FileNode; level?: number }) => {
    const [isOpen, setIsOpen] = useState(false)
    const isFolder = Boolean(node.children && node.children.length > 0)

    return (
        <div className="select-none">
            <div
                onClick={() => isFolder && setIsOpen(!isOpen)}
                className={`flex items-center gap-2 py-1.5 px-2 hover:bg-slate-100 rounded cursor-pointer transition-colors text-sm ${isOpen ? 'bg-slate-50 font-medium' : ''}`}
                style={{ paddingLeft: `${level * 16 + 8}px` }}
            >
                {isFolder ? (
                    <span className="text-slate-400 transition-transform">
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                ) : (
                    <span className="w-[14px]" />
                )}

                {isFolder ? (
                    <Folder size={16} className={isOpen ? 'text-blue-500' : 'text-blue-400'} />
                ) : (
                    getFileIcon(node.label)
                )}

                <span className={`truncate ${isFolder ? 'text-slate-900 font-bold' : 'text-slate-600'}`}>{node.label}</span>
            </div>

            {isFolder && isOpen && node.children && (
                <div className="border-l-2 border-slate-100 ml-[15px] my-0.5">
                    {node.children.map((child, i) => (
                        <FileNodeItem key={i} node={child} level={level + 1} />
                    ))}
                </div>
            )}
        </div>
    )
}

const TreeSectionBlock = ({ sec, treeQuery }: { sec: TreeSection; treeQuery: string }) => {
    const [open, setOpen] = useState(false)
    const q = treeQuery.trim().toLowerCase()

    useEffect(() => {
        if (q) setOpen(true)
    }, [q])

    const tree = useMemo(() => buildDeliverableTree(sec.title, sec.lines), [sec.lines, sec.title])
    const filteredTree = useMemo(() => filterTree(tree, q), [q, tree])
    const nodes = useMemo(() => toFileNodes(filteredTree), [filteredTree])

    return (
        <div className="mb-6">
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between gap-2 mb-3 px-3 hover:bg-slate-50 rounded-xl py-2 group transition-all"
            >
                <Group gap="sm">
                    <span className="text-slate-400 group-hover:text-blue-500 transition-colors">{open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</span>
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">{sec.title}</h4>
                </Group>
                <Badge variant="light" color="slate" radius="sm" size="xs">{sec.lines.length} items</Badge>
            </button>

            {open && (
                <div className="bg-white border border-slate-100 rounded-2xl p-2 shadow-sm">
                    {nodes.length === 0 ? (
                        <div className="px-4 py-4 text-sm text-slate-400 italic">No matches in this section.</div>
                    ) : (
                        nodes.map((n, i) => <FileNodeItem key={i} node={n} />)
                    )}
                </div>
            )}
        </div>
    )
}

function toFileNodes(tree: DeliverableNode | null): FileNode[] {
    if (!tree) return []
    if (!tree.children || tree.children.length === 0) return []

    let effectiveTree = tree
    if (
        effectiveTree.children.length === 1 &&
        effectiveTree.children[0] &&
        effectiveTree.children[0].name === effectiveTree.name
    ) {
        effectiveTree = effectiveTree.children[0]
    }

    const mapNode = (n: DeliverableNode): FileNode => ({
        label: n.name,
        children: n.children && n.children.length > 0 ? n.children.map(mapNode) : undefined,
    })
    return effectiveTree.children.map(mapNode)
}

function nodeMatchesQuery(node: DeliverableNode, q: string): boolean {
    if (!q) return true
    return node.name.toLowerCase().includes(q)
}

function filterTree(node: DeliverableNode, q: string): DeliverableNode | null {
    if (!q) return node
    const keptChildren: DeliverableNode[] = []
    for (const c of node.children) {
        const kept = filterTree(c, q)
        if (kept) keptChildren.push(kept)
    }
    if (nodeMatchesQuery(node, q) || keptChildren.length > 0) {
        return { ...node, children: keptChildren }
    }
    return null
}

function buildDeliverableTree(sectionTitle: string, lines: string[]): DeliverableNode {
    const root: DeliverableNode = { id: sectionTitle, name: sectionTitle, children: [] }

    const stack: DeliverableNode[] = [root]
    for (const rawLine of lines) {
        const line = rawLine.replace(/\r$/, '')
        const connectorIdx = Math.max(line.indexOf('├'), line.indexOf('└'))
        if (connectorIdx === -1) continue
        const depth = Math.max(0, Math.floor(connectorIdx / 4))

        const nameMatch = line.match(/(?:├──|└──)\s*(.+)$/)
        const name = (nameMatch?.[1] || '').trim()
        if (!name) continue

        while (stack.length > depth + 1) stack.pop()
        const parent = stack[stack.length - 1] || root

        const node: DeliverableNode = {
            id: `${parent.id}/${name}`,
            name,
            children: [],
        }

        parent.children.push(node)
        stack.push(node)
    }

    return root
}

type FolderSummary = {
    name: string
    files: number
    size: number
    topTypes: Array<{ ext: string; count: number }>
}

interface OverviewPageProps {
    sessionId: string
    deliverablesRoot: string
    currentPath?: string
    isAdmin?: boolean
    onOpenFiles: (path: string) => void
    onOpenReport?: (project: ProjectInfo) => void
}

function normalizePathJoin(base: string, next: string) {
    const b = base.endsWith('/') ? base.slice(0, -1) : base
    const n = next.startsWith('/') ? next.slice(1) : next
    return `${b}/${n}`
}

function extOf(fileName: string) {
    const idx = fileName.lastIndexOf('.')
    if (idx === -1) return 'none'
    return fileName.slice(idx + 1).toLowerCase() || 'none'
}

function parseMetadata(readmeText: string): ProjectMetadata {
    const out: ProjectMetadata = {}
    const lines = readmeText.split(/\r?\n/)
    for (const line of lines) {
        const m = line.match(/^\s*([A-Za-z0-9 _/-]+?)\s*:\s*(.+?)\s*$/)
        if (!m) continue
        const key = m[1].trim().toLowerCase()
        const value = m[2].trim()
        if (key === 'project id') out.projectId = value
        else if (key === 'project pi') out.projectPi = value
        else if (key === 'application') out.application = value
        else if (key === 'no of samples' || key === 'number of samples' || key === 'no. of samples') out.samples = value
    }
    return out
}

function parseTreeSections(readmeText: string): TreeSection[] {
    const lines = readmeText.split(/\r?\n/)
    const startIdx = lines.findIndex(l => l.trim() === '.')
    if (startIdx === -1) return []
    const treeLines = lines.slice(startIdx)

    const sections: TreeSection[] = []
    let current: TreeSection | null = { title: 'Root', lines: [] }

    for (const line of treeLines) {
        const topLevelMatch = line.match(/^(├──|└──)\s+(.+)$/)
        if (topLevelMatch) {
            const name = topLevelMatch[2].trim()
            const isFolder = !name.toLowerCase().endsWith('.txt') && !name.includes('.')
            if (isFolder) {
                if (current && current.lines.length > 0) sections.push(current)
                current = { title: name, lines: [line] }
                continue
            }
        }
        current?.lines.push(line)
    }

    if (current && current.lines.length > 0) sections.push(current)
    return sections
}

const ProjectCard = ({
    project,
    onClick,
    onOpenFiles,
    onOpenReport,
}: {
    project: ProjectInfo
    onClick: () => void
    onOpenFiles: (path: string) => void
    onOpenReport?: (project: ProjectInfo) => void
}) => {
    const md = project.metadata || {}
    return (
        <motion.div
            layout
            variants={{
                hidden: { opacity: 0, y: 20 },
                show: { opacity: 1, y: 0 }
            }}
            whileHover={{ y: -8, transition: { duration: 0.2 } }}
            className="group"
        >
            <Card
                padding="lg"
                radius="xl"
                withBorder
                onClick={onClick}
                className="h-full flex flex-col transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/10 hover:border-blue-400 cursor-pointer bg-white"
            >
                <div className="flex justify-between items-start mb-6">
                    <Badge
                        variant="filled"
                        color={project.status === 'Live' ? 'emerald' : 'slate'}
                        radius="sm"
                        className="font-black tracking-tighter"
                    >
                        {project.status.toUpperCase()}
                    </Badge>
                    <ActionIcon variant="subtle" color="slate" radius="xl" onClick={(e) => e.stopPropagation()}>
                        <MoreHorizontal size={18} />
                    </ActionIcon>
                </div>

                <div className="mb-6 flex-1 min-w-0">
                    <Text fw={900} size="xl" className="leading-tight text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                        Project {md.projectId || project.name}
                    </Text>
                    <Text size="xs" fw={800} tt="uppercase" lts={1.5} className="mt-2 text-blue-500/80">
                        {md.application || 'Bioinformatics Analysis'}
                    </Text>

                    <Group gap={8} mt={20}>
                        <div className="p-2 bg-slate-50 rounded-lg">
                            <User size={14} className="text-slate-500" />
                        </div>
                        <div className="min-w-0">
                            <Text size="xs" fw={700} c="slate.400" tt="uppercase">Principal Investigator</Text>
                            <Text size="sm" fw={800} className="truncate text-slate-700">{md.projectPi || 'N/A'}</Text>
                        </div>
                    </Group>
                </div>

                <div className="pt-5 border-t border-slate-50 grid grid-cols-2 gap-3 mt-auto">
                    <Button
                        variant="light"
                        color="blue"
                        size="xs"
                        radius="md"
                        leftSection={<Files size={14} />}
                        onClick={(e) => {
                            e.stopPropagation()
                            onOpenFiles(project.path)
                        }}
                        className="font-bold"
                    >
                        Explorer
                    </Button>
                    <Button
                        variant="filled"
                        color="indigo"
                        size="xs"
                        radius="md"
                        leftSection={<FileText size={14} />}
                        disabled={!onOpenReport}
                        onClick={(e) => {
                            e.stopPropagation()
                            onOpenReport?.(project)
                        }}
                        className="font-bold"
                    >
                        View Report
                    </Button>
                </div>
            </Card>
        </motion.div>
    )
}

const OverviewPage: React.FC<OverviewPageProps> = ({ sessionId, deliverablesRoot, currentPath, isAdmin, onOpenFiles, onOpenReport }) => {
    const [view, setView] = useState<'list' | 'details'>('list')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [projects, setProjects] = useState<ProjectInfo[]>([])
    const [query, setQuery] = useState('')
    const [selected, setSelected] = useState<ProjectInfo | null>(null)
    const [rootPath, setRootPath] = useState(deliverablesRoot)
    const [hasSearched, setHasSearched] = useState(false)
    const [treeQuery, setTreeQuery] = useState('')
    const [folderSummaries, setFolderSummaries] = useState<FolderSummary[]>([])
    const [, setSummariesLoading] = useState(false)
    const [summariesStatus, setSummariesStatus] = useState<'idle' | 'computing' | 'done'>('idle')
    const [summariesProgress, setSummariesProgress] = useState(0)

    const summaryAbortRef = useRef<AbortController | null>(null)
    const summariesProgressTimerRef = useRef<number | null>(null)

    const detectDeliverablesRoot = useCallback(async () => {
        if (currentPath) return rootPath

        const tryList = async (p: string) => {
            const r = await sftpApi.list(sessionId, p)
            const entries = (r.data?.files as SFTPFile[] | undefined) || []
            return entries
        }

        const tryListFirst = async (candidates: string[]) => {
            for (const p of candidates) {
                try {
                    const entries = await tryList(p)
                    return { path: p, entries }
                } catch {
                }
            }
            return null
        }

        try {
            const entries = await tryList(rootPath)
            if (entries.length > 0) return rootPath
        } catch {
        }

        try {
            const rootListed = await tryListFirst(['/', '.', ''])
            if (!rootListed) return rootPath

            const entries = rootListed.entries
            const hasRootReadme = entries.some(e => !e.isDirectory && /^readme\.txt$/i.test(e.name))
            if (hasRootReadme) return rootListed.path

            const candidates = entries
                .filter(e => e.isDirectory)
                .filter(e => /deliverables/i.test(e.name))
                .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
            if (candidates.length > 0) return candidates[0].path
        } catch {
        }

        return rootPath
    }, [currentPath, rootPath, sessionId])

    const loadProjects = useCallback(async () => {
        setLoading(true)
        setError(null)
        setHasSearched(true)
        try {
            const effectiveRoot = (currentPath || rootPath) || (await detectDeliverablesRoot())
            if (effectiveRoot !== rootPath) setRootPath(effectiveRoot)

            let entries: SFTPFile[] = []
            try {
                const listRes = await sftpApi.list(sessionId, effectiveRoot)
                entries = (listRes.data?.files as SFTPFile[] | undefined) || []
            } catch {
                setProjects([])
                setError('Unable to list this folder. Navigate to your Deliverables folder in File Manager, then click Search Projects.')
                return
            }

            const dirs = entries.filter(e => e.isDirectory)
            const results: ProjectInfo[] = []

            const rootReadme = entries.find(e => !e.isDirectory && /^readme\.txt$/i.test(e.name))
            if (rootReadme) {
                const readmePath = normalizePathJoin(effectiveRoot, rootReadme.name)
                try {
                    const readmeRes = await sftpApi.preview(sessionId, readmePath)
                    const readmeText = typeof readmeRes.data === 'string' ? readmeRes.data : String(readmeRes.data)
                    results.push({
                        name: effectiveRoot.split('/').filter(Boolean).pop() || effectiveRoot,
                        path: effectiveRoot,
                        readmePath,
                        status: 'Live',
                        readmeText,
                        metadata: parseMetadata(readmeText),
                        treeSections: parseTreeSections(readmeText),
                    })
                } catch {
                }
            }

            const queue = [...dirs]
            const workers = new Array(Math.min(4, queue.length)).fill(0).map(async () => {
                while (queue.length > 0) {
                    const dir = queue.shift()
                    if (!dir) return

                    try {
                        const childListRes = await sftpApi.list(sessionId, dir.path)
                        const childEntries = (childListRes.data?.files as SFTPFile[] | undefined) || []
                        const readme = childEntries.find(e => !e.isDirectory && /^readme\.txt$/i.test(e.name))
                        if (!readme) continue

                        const readmePath = normalizePathJoin(dir.path, readme.name)
                        try {
                            const readmeRes = await sftpApi.preview(sessionId, readmePath)
                            const readmeText = typeof readmeRes.data === 'string' ? readmeRes.data : String(readmeRes.data)
                            results.push({
                                name: dir.name,
                                path: dir.path,
                                readmePath,
                                status: 'Live',
                                readmeText,
                                metadata: parseMetadata(readmeText),
                                treeSections: parseTreeSections(readmeText),
                            })
                        } catch {
                        }
                    } catch {
                    }
                }
            })
            await Promise.all(workers)

            results.sort((a, b) => {
                const ap = a.metadata?.projectId || a.name
                const bp = b.metadata?.projectId || b.name
                return ap.localeCompare(bp, undefined, { numeric: true, sensitivity: 'base' })
            })

            setProjects(results)
        } catch {
            setProjects([])
            setError('Unable to search this folder. Navigate to your Deliverables folder in File Manager, then click Search Projects.')
        } finally {
            setLoading(false)
        }
    }, [currentPath, detectDeliverablesRoot, rootPath, sessionId])

    useEffect(() => {
        if (isAdmin) return
        if (hasSearched) return
        if (loading) return
        void loadProjects()
    }, [hasSearched, isAdmin, loadProjects, loading])

    useEffect(() => {
        if (!currentPath) return
        if (currentPath === rootPath) return
        setRootPath(currentPath)
        setSelected(null)
        setProjects([])
        setHasSearched(false)
        setQuery('')
        setFolderSummaries([])
        setTreeQuery('')
    }, [currentPath, rootPath])

    useEffect(() => {
        return () => {
            summaryAbortRef.current?.abort()
            if (summariesProgressTimerRef.current) {
                window.clearInterval(summariesProgressTimerRef.current)
                summariesProgressTimerRef.current = null
            }
        }
    }, [loadProjects])

    const filteredProjects = useMemo(() => {
        const q = query.toLowerCase()
        return projects.filter(p =>
            (p.metadata?.projectId || p.name).toLowerCase().includes(q) ||
            (p.metadata?.projectPi || '').toLowerCase().includes(q)
        )
    }, [projects, query])

    const openDetails = useCallback((p: ProjectInfo) => {
        setSelected(p)
        setView('details')
        setFolderSummaries([])
        setSummariesStatus('idle')
        setSummariesProgress(0)
        setTreeQuery('')
    }, [])

    const computeFolderSummaries = useCallback(async (p: ProjectInfo) => {
        setSummariesLoading(true)
        setSummariesStatus('computing')
        setSummariesProgress(0)

        if (summariesProgressTimerRef.current) {
            window.clearInterval(summariesProgressTimerRef.current)
            summariesProgressTimerRef.current = null
        }
        summariesProgressTimerRef.current = window.setInterval(() => {
            setSummariesProgress((old) => {
                if (old >= 92) return old
                const next = old + 6 + Math.random() * 12
                return Math.min(92, next)
            })
        }, 250)

        summaryAbortRef.current?.abort()
        const controller = new AbortController()
        summaryAbortRef.current = controller

        try {
            const res = await sftpApi.listRecursive(sessionId, p.path, { signal: controller.signal })
            const items = (res.data?.files as SFTPFile[] | undefined) || []
            const files = items.filter(i => !i.isDirectory)

            const map = new Map<string, { files: number; size: number; extCounts: Map<string, number> }>()
            for (const f of files) {
                const rel = f.path.startsWith(p.path) ? f.path.slice(p.path.length) : f.path
                const seg = rel.replace(/^\/+/, '').split('/')[0] || 'Root'
                const cur = map.get(seg) || { files: 0, size: 0, extCounts: new Map<string, number>() }
                cur.files += 1
                cur.size += f.size || 0
                const ext = extOf(f.name)
                cur.extCounts.set(ext, (cur.extCounts.get(ext) || 0) + 1)
                map.set(seg, cur)
            }

            const summaries: FolderSummary[] = [...map.entries()].map(([name, v]) => {
                const topTypes = [...v.extCounts.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([ext, count]) => ({ ext, count }))
                return { name, files: v.files, size: v.size, topTypes }
            })

            summaries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
            setFolderSummaries(summaries)
            setSummariesProgress(100)
            setSummariesStatus('done')
        } catch {
        } finally {
            setSummariesLoading(false)
            if (summariesProgressTimerRef.current) {
                window.clearInterval(summariesProgressTimerRef.current)
                summariesProgressTimerRef.current = null
            }
        }
    }, [sessionId])

    const refreshSelectedReadme = useCallback(async () => {
        if (!selected) return
        try {
            const readmeRes = await sftpApi.preview(sessionId, selected.readmePath)
            const readmeText = typeof readmeRes.data === 'string' ? readmeRes.data : String(readmeRes.data)
            setSelected(prev => {
                if (!prev) return prev
                return {
                    ...prev,
                    readmeText,
                    metadata: parseMetadata(readmeText),
                    treeSections: parseTreeSections(readmeText),
                }
            })
        } catch {
        }
    }, [selected, sessionId])

    if (error) {
        return (
            <div className="flex-1 min-h-0 bg-slate-50 p-6 flex items-center justify-center">
                <Paper withBorder radius="xl" p={40} maw={520} className="text-center shadow-xl">
                    <ThemeIcon size={64} radius="xl" color="red.1" mb={20} className="mx-auto">
                        <AlertCircle size={32} className="text-red-500" />
                    </ThemeIcon>
                    <Title order={3} mb={8}>Project Sync Interrupted</Title>
                    <Text size="sm" c="slate.500" mb={32}>{error}</Text>
                    <Group justify="center">
                        <Button variant="filled" color="blue" radius="xl" onClick={() => onOpenFiles(rootPath)}>Open Explorer</Button>
                        <Button variant="light" color="blue" radius="xl" onClick={() => void loadProjects()}>Retry Sync</Button>
                    </Group>
                </Paper>
            </div>
        )
    }

    if (view === 'list') {
        return (
            <div className="h-full flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="min-h-full bg-slate-50/50 p-4 sm:p-8 lg:p-12 font-sans">
                        <div className="max-w-[1440px] mx-auto">

                            {/* Page Header */}
                            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                >
                                    <Group gap={12} mb={10}>
                                        <Badge variant="filled" color="blue" radius="sm">ECOSYSTEM LIVE</Badge>
                                        <Text size="xs" fw={900} c="slate.400" tt="uppercase" lts={1}>Session Active</Text>
                                    </Group>
                                    <Title order={1} style={{ fontSize: 42, fontWeight: 900, letterSpacing: -1.5 }}>
                                        Deliverables <Text component="span" variant="gradient" gradient={{ from: 'blue.6', to: 'indigo.5' }} inherit>Overview</Text>
                                    </Title>
                                    <Text size="lg" c="slate.500" fw={500} maw={520} className="mt-2">
                                        Seamless access to your precision analyses. Research progress, mapped and indexed.
                                    </Text>
                                </motion.div>

                                <div className="flex gap-3 flex-wrap">
                                    <Button
                                        variant="white"
                                        radius="xl"
                                        size="md"
                                        leftSection={<FolderOpen size={18} />}
                                        onClick={() => onOpenFiles(rootPath)}
                                        className="shadow-sm border-slate-200 font-bold"
                                    >
                                        Open File Manager
                                    </Button>
                                    <Button
                                        variant="filled"
                                        color="blue"
                                        radius="xl"
                                        size="md"
                                        leftSection={loading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                                        onClick={() => void loadProjects()}
                                        className="font-bold shadow-lg shadow-blue-500/20"
                                    >
                                        {loading ? 'Scanning Infrastructure...' : 'Sync Projects'}
                                    </Button>
                                </div>
                            </div>

                            {/* Stats Section */}
                            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing={24} mb={48}>
                                {[
                                    { icon: LayoutGrid, label: 'Linked Projects', value: projects.length, color: 'blue' },
                                    { icon: CheckCircle2, label: 'Live Delivery', value: projects.filter(p => p.status === 'Live').length, color: 'emerald' },
                                    { icon: Clock, label: 'Historical Audit', value: projects.filter(p => p.status === 'Archived').length, color: 'indigo' }
                                ].map((stat, i) => (
                                    <motion.div
                                        key={stat.label}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.1 * i }}
                                    >
                                        <Paper withBorder radius="20px" p={24} className="group hover:border-blue-400 transition-colors bg-white">
                                            <Group justify="space-between">
                                                <Stack gap={0}>
                                                    <Text size="xs" fw={900} tt="uppercase" lts={1.5} c="slate.400">{stat.label}</Text>
                                                    <Text size="24px" fw={900} className="text-slate-900">{stat.value}</Text>
                                                </Stack>
                                                <ThemeIcon size={48} radius="lg" variant="light" color={stat.color}>
                                                    <stat.icon size={26} />
                                                </ThemeIcon>
                                            </Group>
                                        </Paper>
                                    </motion.div>
                                ))}
                            </SimpleGrid>

                            {/* Search Bar */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.4 }}
                                className="mb-8"
                            >
                                <TextInput
                                    placeholder="Filter by Project ID or Principal Investigator..."
                                    size="lg"
                                    radius="xl"
                                    leftSection={<Search size={20} className="text-slate-300 ml-2" />}
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    className="max-w-md shadow-sm"
                                    styles={{
                                        input: {
                                            border: '1px solid var(--mantine-color-slate-200)',
                                            fontWeight: 600,
                                            '&:focus': { borderColor: 'var(--mantine-color-blue-500)' }
                                        }
                                    }}
                                />
                            </motion.div>

                            {/* Main Grid */}
                            {!hasSearched ? (
                                <Paper withBorder radius="24px" p={60} style={{ background: 'white', borderStyle: 'dashed' }} className="text-center">
                                    <ThemeIcon size={80} radius="xl" color="slate.50" mb={24}>
                                        <Database size={40} className="text-slate-300" />
                                    </ThemeIcon>
                                    <Title order={3} mb={8}>Ready to Initialize</Title>
                                    <Text size="sm" c="slate.500" mb={32} maw={400} className="mx-auto">
                                        Search for project deliverables within the current directory. We'll look for folders containing valid documentation.
                                    </Text>
                                    <Button variant="filled" color="blue" radius="xl" size="md" onClick={() => void loadProjects()}>Search Infra</Button>
                                </Paper>
                            ) : loading ? (
                                <SimpleGrid cols={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing={24}>
                                    {[1, 2, 3, 4].map(i => (
                                        <Paper key={i} withBorder radius="xl" p={24} h={320} className="animate-pulse bg-white">
                                            <Box w={60} h={12} bg="slate.100" className="rounded-sm" mb={20} />
                                            <Box w="80%" h={24} bg="slate.100" className="rounded-sm" mb={10} />
                                            <Box w="50%" h={12} bg="slate.100" className="rounded-sm" mb={40} />
                                            <Box w="100%" h={80} bg="slate.50" className="rounded-xl" />
                                        </Paper>
                                    ))}
                                </SimpleGrid>
                            ) : filteredProjects.length === 0 ? (
                                <Paper withBorder radius="24px" p={60} style={{ background: 'white', borderStyle: 'dashed' }} className="text-center">
                                    <ThemeIcon size={80} radius="xl" color="slate.50" mb={24}>
                                        <Search size={40} className="text-slate-300" />
                                    </ThemeIcon>
                                    <Title order={3} mb={8}>No Matches Found</Title>
                                    <Text size="sm" c="slate.500" mb={32}>Try a different query or explore a different directory.</Text>
                                    <Button variant="light" color="blue" radius="xl" onClick={() => setQuery('')}>Clear Filter</Button>
                                </Paper>
                            ) : (
                                <motion.div
                                    variants={{
                                        hidden: { opacity: 0 },
                                        show: {
                                            opacity: 1,
                                            transition: { staggerChildren: 0.05 }
                                        }
                                    }}
                                    initial="hidden"
                                    animate="show"
                                    className="mb-20"
                                >
                                    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing={32} pb={60}>
                                        {filteredProjects.map(p => (
                                            <ProjectCard
                                                key={p.path}
                                                project={p}
                                                onClick={() => openDetails(p)}
                                                onOpenFiles={onOpenFiles}
                                                onOpenReport={onOpenReport}
                                            />
                                        ))}
                                    </SimpleGrid>
                                </motion.div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (!selected) return null

    // Details View
    const md = selected.metadata || {}

    return (
        <div className="h-full flex flex-col overflow-hidden bg-white font-sans">
            {/* Split Panel Header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-white sticky top-0 z-40">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                        <ActionIcon
                            variant="subtle"
                            color="slate"
                            radius="xl"
                            size="lg"
                            onClick={() => setView('list')}
                        >
                            <ArrowLeft size={20} />
                        </ActionIcon>
                        <div className="min-w-0">
                            <h2 className="text-xl font-black text-slate-900 truncate tracking-tight">Project {md.projectId || selected.name}</h2>
                            <Group gap={8} mt={2}>
                                <Badge variant="dot" color="blue" size="xs" radius="sm">{md.application || 'Genomics'}</Badge>
                                <span className="text-xs text-slate-400 font-mono truncate">{selected.path}</span>
                            </Group>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="light"
                            color="slate"
                            radius="xl"
                            leftSection={<RefreshCw size={16} />}
                            onClick={refreshSelectedReadme}
                        >
                            Refresh Specs
                        </Button>
                        <Button
                            variant="filled"
                            color="blue"
                            radius="xl"
                            leftSection={<FolderOpen size={16} />}
                            onClick={() => onOpenFiles(selected.path)}
                        >
                            Open Project Root
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30">
                <div className="max-w-[1240px] mx-auto p-4 sm:p-8">
                    <Grid gutter={32}>
                        {/* Summary Column */}
                        <Grid.Col span={{ base: 12, md: 5 }}>
                            <Stack gap={24}>
                                <Paper withBorder radius="24px" p={24} className="shadow-sm bg-white">
                                    <Title order={5} mb={20} tt="uppercase" lts={1.5} c="slate.400" className="text-[10px] font-black">Analysis Scope</Title>
                                    <Stack gap={16}>
                                        <div className="flex justify-between items-center py-3 border-b border-slate-50">
                                            <Group gap={12}>
                                                <ThemeIcon variant="light" color="blue" radius="md"><UserCheck size={16} /></ThemeIcon>
                                                <Text size="sm" fw={700}>Principal Investigator</Text>
                                            </Group>
                                            <Text size="sm" fw={800} className="text-slate-900">{md.projectPi || 'N/A'}</Text>
                                        </div>
                                        <div className="flex justify-between items-center py-3 border-b border-slate-50">
                                            <Group gap={12}>
                                                <ThemeIcon variant="light" color="indigo" radius="md"><FlaskConical size={16} /></ThemeIcon>
                                                <Text size="sm" fw={700}>Application</Text>
                                            </Group>
                                            <Text size="sm" fw={800} className="text-slate-900">{md.application || 'N/A'}</Text>
                                        </div>
                                        <div className="flex justify-between items-center py-3">
                                            <Group gap={12}>
                                                <ThemeIcon variant="light" color="emerald" radius="md"><Activity size={16} /></ThemeIcon>
                                                <Text size="sm" fw={700}>Sample Count</Text>
                                            </Group>
                                            <Text size="sm" fw={800} className="text-slate-900">{md.samples || 'N/A'}</Text>
                                        </div>
                                    </Stack>
                                </Paper>

                                <Paper withBorder radius="24px" p={24} className="shadow-sm bg-white">
                                    <Group justify="space-between" mb={20}>
                                        <Title order={5} tt="uppercase" lts={1.5} c="slate.400" className="text-[10px] font-black">Storage Footprint</Title>
                                        {summariesStatus === 'idle' && (
                                            <Button variant="subtle" size="compact-xs" color="blue" onClick={() => computeFolderSummaries(selected)}>Inventory Data</Button>
                                        )}
                                    </Group>

                                    {summariesStatus === 'idle' ? (
                                        <div className="text-center py-8">
                                            <Text size="xs" c="slate.400" fw={600} mb={12}>Storage metrics not computed</Text>
                                            <Button variant="light" color="blue" size="xs" radius="xl" onClick={() => computeFolderSummaries(selected)}>Scan Resource Usage</Button>
                                        </div>
                                    ) : summariesStatus === 'computing' ? (
                                        <div className="py-8">
                                            <Group justify="space-between" mb={8}>
                                                <Text size="xs" fw={700}>Indexing Assets...</Text>
                                                <Text size="xs" fw={700}>{Math.round(summariesProgress)}%</Text>
                                            </Group>
                                            <Progress value={summariesProgress} animated size="lg" radius="xl" color="blue" />
                                            <Text size="xs" c="slate.400" mt={12} ta="center">Calculating byte allocation and file counts.</Text>
                                        </div>
                                    ) : (
                                        <Stack gap={10}>
                                            <Group grow>
                                                <Paper bg="slate.50" p={12} radius="lg" className="text-center">
                                                    <Text size="xs" tt="uppercase" lts={1} fw={700} c="slate.400">Total Assets</Text>
                                                    <Text fw={900} size="xl">{folderSummaries.reduce((acc, s) => acc + s.files, 0)}</Text>
                                                </Paper>
                                                <Paper bg="slate.50" p={12} radius="lg" className="text-center">
                                                    <Text size="xs" tt="uppercase" lts={1} fw={700} c="slate.400">Storage Used</Text>
                                                    <Text fw={900} size="xl">{formatBytesUtil(folderSummaries.reduce((acc, s) => acc + s.size, 0))}</Text>
                                                </Paper>
                                            </Group>

                                            <div className="mt-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                                                {folderSummaries.map((s, i) => (
                                                    <Paper key={i} withBorder p={12} radius="lg" mb={8} className="hover:border-blue-200 transition-colors">
                                                        <Group justify="space-between" mb={4}>
                                                            <Text size="sm" fw={800} className="text-slate-800">{s.name}</Text>
                                                            <Text size="xs" fw={700} c="blue.5">{formatBytesUtil(s.size)}</Text>
                                                        </Group>
                                                        <Group gap={8}>
                                                            <Text size="xs" c="slate.400" fw={600}>{s.files} files</Text>
                                                            <Group gap={4}>
                                                                {s.topTypes.map(t => (
                                                                    <Badge key={t.ext} variant="light" color="slate" size="xs" radius="xs" className="text-[8px]">{t.ext}</Badge>
                                                                ))}
                                                            </Group>
                                                        </Group>
                                                    </Paper>
                                                ))}
                                            </div>
                                        </Stack>
                                    )}
                                </Paper>
                            </Stack>
                        </Grid.Col>

                        {/* Deliverables Column */}
                        <Grid.Col span={{ base: 12, md: 7 }}>
                            <Paper withBorder radius="24px" p={24} className="shadow-sm bg-white h-full">
                                <Group justify="space-between" mb={24}>
                                    <Stack gap={2}>
                                        <Title order={5} tt="uppercase" lts={1.5} c="slate.400" className="text-[10px] font-black">Project Deliverables</Title>
                                        <Text size="xs" c="slate.500">Documented hierarchy for biological datasets.</Text>
                                    </Stack>
                                    <TextInput
                                        placeholder="Filter tree..."
                                        size="xs"
                                        radius="xl"
                                        leftSection={<Search size={14} />}
                                        value={treeQuery}
                                        onChange={(e) => setTreeQuery(e.target.value)}
                                        w={160}
                                    />
                                </Group>

                                {selected.treeSections && selected.treeSections.length > 0 ? (
                                    <div className="space-y-2">
                                        {selected.treeSections.map((sec, i) => (
                                            <TreeSectionBlock key={i} sec={sec} treeQuery={treeQuery} />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-20 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                        <Box mb={16} className="mx-auto flex justify-center">
                                            <FileText size={40} className="text-slate-200" />
                                        </Box>
                                        <Text size="sm" fw={700} c="slate.400">Documentation Not Available</Text>
                                        <Text size="xs" c="slate.400" mt={4}>Readme.txt does not contain a valid directory mapping.</Text>
                                    </div>
                                )}
                            </Paper>
                        </Grid.Col>
                    </Grid>
                </div>
            </div>
        </div>
    )
}

export default OverviewPage
