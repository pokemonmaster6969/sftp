import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Download, FileText, FolderOpen, RefreshCw, Search } from 'lucide-react'
import { sftpApi } from '../api/sftp'
import type { SFTPFile } from '../types'
import { formatBytes as formatBytesUtil } from '../utils'
import type { ProjectInfo } from './OverviewPage'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'

type ArtifactKind = 'multiqc' | 'dge_summary' | 'kegg_stats' | 'excel' | 'table' | 'pdf' | 'image' | 'other'

function formatBytes(bytes: number) {
    return formatBytesUtil(bytes)
}

function extOf(fileName: string) {
    const idx = fileName.lastIndexOf('.')
    if (idx === -1) return ''
    return fileName.slice(idx + 1).toLowerCase() || ''
}

function classifyArtifact(name: string): ArtifactKind {
    const lower = name.toLowerCase()

    if (lower.endsWith('multiqc_report.html') || lower.includes('multiqc')) return 'multiqc'
    if ((lower.includes('dge') || lower.includes('deg') || lower.includes('diff')) && (lower.includes('summary') || lower.includes('overview')) && (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv') || lower.endsWith('.tsv'))) {
        return 'dge_summary'
    }
    if ((lower.includes('kegg') || lower.includes('pathway')) && (lower.includes('stat') || lower.includes('summary')) && (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv') || lower.endsWith('.tsv'))) {
        return 'kegg_stats'
    }

    const ext = extOf(lower)
    if (ext === 'xlsx' || ext === 'xls') return 'excel'
    if (ext === 'csv' || ext === 'tsv' || ext === 'txt') return 'table'
    if (ext === 'pdf') return 'pdf'
    if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'svg') return 'image'
    return 'other'
}

function normalizePathJoin(base: string, next: string) {
    const b = base.endsWith('/') ? base.slice(0, -1) : base
    const n = next.startsWith('/') ? next.slice(1) : next
    return `${b}/${n}`
}

function renderTreeFromFiles(projectPath: string, files: SFTPFile[]) {
    const prefix = projectPath.endsWith('/') ? projectPath : `${projectPath}/`
    const rels = files
        .filter(f => !f.isDirectory)
        .map(f => (f.path.startsWith(prefix) ? f.path.slice(prefix.length) : f.path.replace(/^\/+/, '')))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))

    const root = { name: 'Deliverables', children: new Map<string, any>(), isFile: false }

    for (const rel of rels) {
        const segs = rel.split('/').filter(Boolean)
        let cur = root
        for (let i = 0; i < segs.length; i++) {
            const seg = segs[i]
            const isLast = i === segs.length - 1
            if (!cur.children.has(seg)) {
                cur.children.set(seg, { name: seg, children: new Map<string, any>(), isFile: isLast })
            }
            const next = cur.children.get(seg)
            if (isLast) {
                next.isFile = true
            }
            cur = next
        }
    }

    const lines: string[] = ['Deliverables', '.']

    const walk = (node: any, depth: number, isLast: boolean, prefixParts: boolean[]) => {
        const connectors = prefixParts
            .slice(0, depth)
            .map(p => (p ? '    ' : '│   '))
            .join('')

        const conn = depth === 0 ? '' : (isLast ? '└── ' : '├── ')
        if (depth > 0) lines.push(`${connectors}${conn}${node.name}`)

        const children = [...node.children.values()].sort((a, b) => {
            if (a.isFile !== b.isFile) return a.isFile ? 1 : -1
            return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        })

        children.forEach((c, idx) => {
            const last = idx === children.length - 1
            walk(c, depth + 1, last, [...prefixParts, last])
        })
    }

    const topChildren = [...root.children.values()].sort((a, b) => {
        if (a.isFile !== b.isFile) return a.isFile ? 1 : -1
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    })

    topChildren.forEach((c, idx) => {
        const last = idx === topChildren.length - 1
        walk(c, 0, last, [])
    })

    return lines.join('\n')
}

interface ReportPageProps {
    sessionId: string
    project: ProjectInfo
    onBack: () => void
    onOpenFiles: (projectPath: string) => void
}

export const ReportPage: React.FC<ReportPageProps> = ({ sessionId, project, onBack, onOpenFiles }) => {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [files, setFiles] = useState<SFTPFile[]>([])
    const [query, setQuery] = useState('')

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await sftpApi.listRecursive(sessionId, project.path)
            const items = (res.data?.files as SFTPFile[] | undefined) || []
            const normalized = items.map(i => ({
                name: i.name,
                size: i.size,
                isDirectory: Boolean(i.isDirectory),
                path: i.path,
                type: (i as any).type || '',
                modifyTime: (i as any).modifyTime || 0,
            }))
            normalized.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: 'base' }))
            setFiles(normalized)
        } catch (err) {
            const e = (typeof err === 'object' && err !== null ? (err as Record<string, any>) : {})
            const msg = (typeof e.message === 'string' ? e.message : null) || 'Failed to load deliverables'
            setError(msg)
            setFiles([])
        } finally {
            setLoading(false)
        }
    }, [project.path, sessionId])

    useEffect(() => {
        void load()
    }, [load])

    const filteredFiles = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return files
        return files.filter(f => f.path.toLowerCase().includes(q) || f.name.toLowerCase().includes(q))
    }, [files, query])

    const artifacts = useMemo(() => {
        const grouped: Record<ArtifactKind, SFTPFile[]> = {
            multiqc: [],
            dge_summary: [],
            kegg_stats: [],
            excel: [],
            table: [],
            pdf: [],
            image: [],
            other: [],
        }

        for (const f of files) {
            if (f.isDirectory) continue
            const kind = classifyArtifact(f.name)
            grouped[kind].push(f)
        }

        const sortByName = (a: SFTPFile, b: SFTPFile) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        ;(Object.keys(grouped) as ArtifactKind[]).forEach(k => grouped[k].sort(sortByName))

        return grouped
    }, [files])

    const computedTree = useMemo(() => {
        if (files.length === 0) return ''
        return renderTreeFromFiles(project.path, files)
    }, [files, project.path])

    const md = project.metadata || {}
    const title = md.projectId || project.name

    const readmeDownloadPath = project.readmePath || normalizePathJoin(project.path, 'Readme.txt')

    return (
        <div className="flex-1 flex flex-col bg-slate-50 overflow-y-auto custom-scrollbar">
            <header className="h-24 flex items-center justify-between px-4 sm:px-6 md:px-8 lg:px-10 bg-slate-50">
                <div className="flex items-center gap-3 min-w-0">
                    <Button type="button" onClick={onBack} variant="ghost" size="icon" aria-label="Back">
                        <ArrowLeft className="w-5 h-5 text-slate-600" aria-hidden="true" />
                    </Button>
                    <div className="min-w-0">
                        <h2 className="text-2xl font-display font-medium text-slate-900 tracking-tight truncate">Live Report</h2>
                        <p className="text-sm text-slate-400 mt-1 font-light tracking-wide truncate">{title}</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" onClick={() => onOpenFiles(project.path)} variant="default" size="sm">
                        <FolderOpen className="w-4 h-4" aria-hidden="true" />
                        <span className="hidden sm:inline">Open Files</span>
                        <span className="sm:hidden">Files</span>
                    </Button>
                    <Button asChild variant="secondary" size="sm">
                        <a href={sftpApi.getDownloadUrl(sessionId, readmeDownloadPath)}>
                            <Download className="w-4 h-4" aria-hidden="true" />
                            <span className="hidden sm:inline">Download Readme</span>
                            <span className="sm:hidden">Readme</span>
                        </a>
                    </Button>
                    <Button type="button" onClick={() => void load()} disabled={loading} variant="secondary" size="sm" aria-label="Refresh" className="disabled:opacity-60">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
                        <span className="hidden sm:inline">Refresh</span>
                    </Button>
                </div>
            </header>

            <div className="px-4 sm:px-6 md:px-8 lg:px-10 pb-10 space-y-6">
                {error && (
                    <Card>
                        <CardContent className="p-6">
                            <p className="text-sm text-red-600">{error}</p>
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Metadata</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                            <div>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Project ID</p>
                                <p className="text-slate-700 font-medium">{md.projectId || '--'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">PI</p>
                                <p className="text-slate-700 font-medium truncate" title={md.projectPi}>{md.projectPi || '--'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Application</p>
                                <p className="text-slate-700 font-medium">{md.application || '--'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">No. of Samples</p>
                                <p className="text-slate-700 font-medium">{md.samples || '--'}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <CardTitle className="text-sm">Known Artifacts</CardTitle>
                                <CardDescription>Downloads only</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="border border-slate-200 rounded-xl p-4">
                            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">MultiQC</div>
                            {artifacts.multiqc.length === 0 ? (
                                <p className="text-sm text-slate-500">Not found</p>
                            ) : (
                                <div className="space-y-2">
                                    {artifacts.multiqc.slice(0, 5).map(f => (
                                        <a key={f.path} className="flex items-center justify-between gap-3 text-sm hover:underline" href={sftpApi.getDownloadUrl(sessionId, f.path)}>
                                            <span className="truncate">{f.name}</span>
                                            <span className="text-xs text-slate-500 flex-shrink-0">{formatBytes(f.size || 0)}</span>
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="border border-slate-200 rounded-xl p-4">
                            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">DGE Summary</div>
                            {artifacts.dge_summary.length === 0 ? (
                                <p className="text-sm text-slate-500">Not found</p>
                            ) : (
                                <div className="space-y-2">
                                    {artifacts.dge_summary.slice(0, 8).map(f => (
                                        <a key={f.path} className="flex items-center justify-between gap-3 text-sm hover:underline" href={sftpApi.getDownloadUrl(sessionId, f.path)}>
                                            <span className="truncate">{f.name}</span>
                                            <span className="text-xs text-slate-500 flex-shrink-0">{formatBytes(f.size || 0)}</span>
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="border border-slate-200 rounded-xl p-4">
                            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">KEGG / Pathway Stats</div>
                            {artifacts.kegg_stats.length === 0 ? (
                                <p className="text-sm text-slate-500">Not found</p>
                            ) : (
                                <div className="space-y-2">
                                    {artifacts.kegg_stats.slice(0, 8).map(f => (
                                        <a key={f.path} className="flex items-center justify-between gap-3 text-sm hover:underline" href={sftpApi.getDownloadUrl(sessionId, f.path)}>
                                            <span className="truncate">{f.name}</span>
                                            <span className="text-xs text-slate-500 flex-shrink-0">{formatBytes(f.size || 0)}</span>
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <CardTitle className="text-sm">Deliverables Tree</CardTitle>
                                <CardDescription>Derived from folder listing</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <pre className="text-xs bg-slate-50 text-slate-800 border border-slate-200 rounded-xl p-4 overflow-auto font-mono">{computedTree || 'No files found'}</pre>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-3">
                            <CardTitle className="text-sm">All Files</CardTitle>
                            <div className="relative max-w-md w-full">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
                                <Input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    className="pl-9 w-full"
                                    placeholder="Search files…"
                                    aria-label="Search files"
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>

                    {filteredFiles.length === 0 ? (
                        <p className="text-sm text-slate-500">No matching files.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs text-slate-500">
                                        <th className="py-2 pr-4">File</th>
                                        <th className="py-2 pr-4">Type</th>
                                        <th className="py-2 pr-4">Size</th>
                                        <th className="py-2 pr-4">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredFiles.slice(0, 500).map(f => {
                                        const kind = classifyArtifact(f.name)
                                        return (
                                            <tr key={f.path} className="border-t border-slate-100">
                                                <td className="py-2 pr-4">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" aria-hidden="true" />
                                                        <span className="truncate" title={f.path}>{f.path.startsWith(project.path) ? f.path.slice(project.path.length) : f.path}</span>
                                                    </div>
                                                </td>
                                                <td className="py-2 pr-4 text-slate-600">{kind}</td>
                                                <td className="py-2 pr-4 text-slate-700">{formatBytes(f.size || 0)}</td>
                                                <td className="py-2 pr-4">
                                                    <Button asChild variant="secondary" size="sm" className="h-8 px-3 text-xs">
                                                        <a href={sftpApi.getDownloadUrl(sessionId, f.path)}>
                                                            <Download className="w-4 h-4" aria-hidden="true" />
                                                            <span>Download</span>
                                                        </a>
                                                    </Button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                            {filteredFiles.length > 500 && (
                                <p className="text-xs text-slate-500 mt-3">Showing first 500 results. Refine your search to narrow down.</p>
                            )}
                        </div>
                    )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

export default ReportPage
