import React, { useEffect, useMemo } from 'react'
import {
    Activity,
    ArrowDownToLine,
    CheckCircle2,
    RefreshCw,
    XCircle,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import type { SessionInfo, SFTPFile } from '../types'
import type { TransferTask } from './TransferManager'
import { formatBytes } from '../utils'

interface SubfolderSummary {
    name: string
    path: string
    files: number
    size: number
    topTypes: Array<{ ext: string; count: number }>
}

interface DashboardMockProps {
    session: SessionInfo
    currentPath: string
    deepFiles: SFTPFile[]
    deepLoading: boolean
    deepError: string | null
    deepLastRefreshedAt: number | null
    deepFolderCount: number
    deepFolderSummaries: SubfolderSummary[]
    tasks: TransferTask[]
    onRefresh: () => void
    onQueueDownload: (paths: string[]) => void
}

const deriveCategory = (folderName: string): string => {
    const n = folderName.toLowerCase()
    if (/(raw[_\s-]?data|fastq|reads)/.test(n)) return 'Raw Data'
    if (/(reference|genome|annotation|gtf|gff)/.test(n)) return 'Reference/Annotation'
    if (/(transcript[_\s-]?assembly|assembly|mapping|alignment|bam|sam)/.test(n)) return 'Assembly/Mapping'
    if (/(correlation|pearson|plot|plots|pca|heatmap|qc)/.test(n)) return 'Plots/Correlation'
    if (/(differential|dge|de[_\s-]?genes|expression)/.test(n)) return 'Differential Expression'
    if (/(enrichment|go)/.test(n)) return 'Enrichment/GO'
    if (/(pathway|pathways|kegg|reactome)/.test(n)) return 'Pathways'
    return 'Other'
}

const categoryColors: Record<string, string> = {
    'Raw Data': 'bg-blue-500',
    'Differential Expression': 'bg-emerald-500',
    'Reference/Annotation': 'bg-indigo-500',
    'Assembly/Mapping': 'bg-purple-500',
    'Plots/Correlation': 'bg-pink-500',
    'Enrichment/GO': 'bg-cyan-500',
    'Pathways': 'bg-amber-500',
    'Other': 'bg-rose-500',
}

const Sparkline: React.FC<{ values: number[] }> = ({ values }) => {
    if (!values.length) return null
    const w = 80
    const h = 24
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = max - min || 1
    const points = values
        .map((v, i) => {
            const x = (i / Math.max(1, values.length - 1)) * w
            const y = h - ((v - min) / span) * h
            return `${x.toFixed(1)},${y.toFixed(1)}`
        })
        .join(' ')

    return (
        <svg viewBox={`0 0 ${w} ${h}`} className="w-20 h-6 text-slate-400">
            <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
            />
        </svg>
    )
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

const getExt = (name: string) => {
    const extRaw = (name.split('.').pop() || '').toLowerCase()
    const ext = extRaw && extRaw !== name.toLowerCase() ? extRaw : ''
    return ext
}

const hasAnyMatch = (haystack: string[], re: RegExp) => haystack.some(x => re.test(x))

const FootprintBar: React.FC<{ items: Array<{ label: string; value: number; colorClass: string; hint?: string }> }> = ({ items }) => {
    const total = items.reduce((acc, x) => acc + x.value, 0)
    return (
        <div className="space-y-1">
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
                {items.map((x) => {
                    const pct = total > 0 ? clamp01(x.value / total) : 0
                    return (
                        <div
                            key={x.label}
                            className={`${x.colorClass} h-full`}
                            style={{ width: `${Math.max(1, Math.round(pct * 100))}%` }}
                            title={`${x.label} · ${Math.round(pct * 100)}%${x.hint ? ` · ${x.hint}` : ''}`}
                        />
                    )
                })}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
                {items.slice(0, 6).map((x) => (
                    <div key={x.label} className="flex items-center gap-1.5 text-[10px] text-slate-600">
                        <span className={`h-1.5 w-1.5 rounded-sm ${x.colorClass}`} />
                        <span className="truncate" title={x.label}>{x.label}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

export const DashboardMock: React.FC<DashboardMockProps> = ({
    session,
    currentPath,
    deepFiles,
    deepLoading,
    deepError,
    deepLastRefreshedAt,
    deepFolderCount,
    deepFolderSummaries,
    tasks,
    onRefresh,
    onQueueDownload,
}) => {
    // Refresh when path changes
    useEffect(() => {
        onRefresh()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPath])

    // Compute stats from real data
    const deepStats = useMemo(() => {
        const totalSize = deepFiles.reduce((acc, f) => acc + (f.size || 0), 0)
        return { folders: deepFolderCount, files: deepFiles.length, size: totalSize }
    }, [deepFiles, deepFolderCount])

    const nonDirFiles = useMemo(() => deepFiles.filter(f => !f.isDirectory), [deepFiles])

    // Category summaries
    const categorySummaries = useMemo(() => {
        const map = new Map<string, { folders: number; files: number; size: number }>()
        for (const s of deepFolderSummaries) {
            const cat = deriveCategory(s.name)
            const prev = map.get(cat) || { folders: 0, files: 0, size: 0 }
            map.set(cat, { folders: prev.folders + 1, files: prev.files + s.files, size: prev.size + s.size })
        }
        return [...map.entries()]
            .map(([category, data]) => ({ category, ...data, color: categoryColors[category] || 'bg-slate-500' }))
            .sort((a, b) => b.size - a.size)
    }, [deepFolderSummaries])

    const totalCategorySize = useMemo(() => categorySummaries.reduce((acc, c) => acc + c.size, 0), [categorySummaries])

    // Size distribution
    const sizeDistribution = useMemo(() => {
        const defs = [
            { key: '0–1 MB', min: 0, max: 1 * 1024 * 1024 },
            { key: '1–10 MB', min: 1 * 1024 * 1024, max: 10 * 1024 * 1024 },
            { key: '10–100 MB', min: 10 * 1024 * 1024, max: 100 * 1024 * 1024 },
            { key: '100 MB–1 GB', min: 100 * 1024 * 1024, max: 1024 * 1024 * 1024 },
            { key: '1 GB+', min: 1024 * 1024 * 1024, max: Infinity },
        ]
        const bins = defs.map(d => ({ label: d.key, count: 0, size: 0 }))
        for (const f of nonDirFiles) {
            const s = f.size || 0
            const idx = defs.findIndex(d => s >= d.min && s < d.max)
            const i = idx >= 0 ? idx : 0
            bins[i].count += 1
            bins[i].size += s
        }
        return bins
    }, [nonDirFiles])

    // Largest files
    const largestFiles = useMemo(() => {
        return [...nonDirFiles]
            .sort((a, b) => (b.size || 0) - (a.size || 0))
            .slice(0, 4)
    }, [nonDirFiles])

    // Transfer stats
    const transferStats = useMemo(() => {
        const active = tasks.filter(t => t.status === 'downloading' || t.status === 'ready')
        const completed = tasks.filter(t => t.status === 'completed')
        const speeds = active.filter(t => t.speed && t.speed > 0).map(t => t.speed!)
        const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0
        return { active: active.length, completed: completed.length, avgSpeed }
    }, [tasks])

    const deepFileNames = useMemo(() => deepFiles.map(f => `${f.name} ${f.path} ${(f.type || '')}`.toLowerCase()), [deepFiles])
    const deepFolderNames = useMemo(() => deepFolderSummaries.map(s => `${s.name} ${s.path}`.toLowerCase()), [deepFolderSummaries])

    const folderFootprint = useMemo(() => {
        const top = [...deepFolderSummaries]
            .sort((a, b) => (b.size || 0) - (a.size || 0))
            .slice(0, 8)
            .map((s) => {
                const cat = deriveCategory(s.name)
                return {
                    label: s.name,
                    value: s.size || 0,
                    colorClass: categoryColors[cat] || 'bg-slate-500',
                    hint: formatBytes(s.size || 0),
                }
            })
        const otherSize = deepFolderSummaries
            .slice(8)
            .reduce((acc, s) => acc + (s.size || 0), 0)
        if (otherSize > 0) {
            top.push({ label: 'Other', value: otherSize, colorClass: 'bg-slate-300', hint: formatBytes(otherSize) })
        }
        return top
    }, [deepFolderSummaries])

    const readiness = useMemo(() => {
        const fileHay = deepFileNames
        const folderHay = deepFolderNames

        const checks = [
            {
                key: 'final_report',
                label: 'Final report',
                desc: 'PDF/DOCX report present',
                ok: hasAnyMatch(fileHay, /(final[_\s-]?report|report)\.(pdf|docx)$/),
            },
            {
                key: 'readme',
                label: 'Readme / metadata',
                desc: 'Readme / summary / metadata file',
                ok: hasAnyMatch(fileHay, /(readme|metadata|manifest)\.(txt|md|csv|json)$/),
            },
            {
                key: 'raw_data',
                label: 'Raw data',
                desc: 'FASTQ / raw reads folder or files',
                ok: hasAnyMatch(folderHay, /(raw[_\s-]?data|fastq|reads)/) || hasAnyMatch(fileHay, /\.(fastq|fq)(\.gz)?$/),
            },
            {
                key: 'de',
                label: 'Differential expression',
                desc: 'DE outputs detected',
                ok: hasAnyMatch(folderHay, /(differential|dge|expression)/) || hasAnyMatch(fileHay, /(deseq|edger|deg|differential)/),
            },
            {
                key: 'go',
                label: 'GO / enrichment',
                desc: 'GO/enrichment outputs detected',
                ok: hasAnyMatch(folderHay, /(go|enrichment)/) || hasAnyMatch(fileHay, /(go|enrich)/),
            },
            {
                key: 'pathways',
                label: 'Pathways',
                desc: 'KEGG/Reactome pathways outputs detected',
                ok: hasAnyMatch(folderHay, /(pathway|kegg|reactome)/) || hasAnyMatch(fileHay, /(kegg|reactome|pathway)/),
            },
            {
                key: 'plots',
                label: 'Plots / QC',
                desc: 'Plots folder or PNG/PDF plots detected',
                ok: hasAnyMatch(folderHay, /(plot|plots|qc|pca|heatmap)/) || hasAnyMatch(fileHay, /\.(png|jpg|jpeg|svg|pdf)$/),
            },
        ]

        const okCount = checks.filter(c => c.ok).length
        const score = checks.length ? Math.round((okCount / checks.length) * 100) : 0
        return { checks, okCount, score }
    }, [deepFileNames, deepFolderNames])

    const anomalies = useMemo(() => {
        const filesOnly = nonDirFiles
        const tooLarge = filesOnly.filter(f => (f.size || 0) >= 1024 * 1024 * 1024).sort((a, b) => (b.size || 0) - (a.size || 0)).slice(0, 3)
        const tinyCount = filesOnly.filter(f => (f.size || 0) > 0 && (f.size || 0) < 10 * 1024).length
        const extCounts = new Map<string, number>()
        for (const f of filesOnly) {
            const ext = getExt(f.name) || '(none)'
            extCounts.set(ext, (extCounts.get(ext) || 0) + 1)
        }
        const unknownExt = [...extCounts.entries()]
            .filter(([ext]) => !['pdf', 'docx', 'xlsx', 'csv', 'tsv', 'txt', 'md', 'png', 'jpg', 'jpeg', 'svg', 'html', 'zip', 'gz', 'fastq', 'fq', '(none)'].includes(ext))
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)

        const reportCandidates = filesOnly
            .filter(f => /\.(pdf|docx|xlsx|csv)$/i.test(f.name))
            .sort((a, b) => (b.size || 0) - (a.size || 0))
            .slice(0, 6)

        return { tooLarge, tinyCount, unknownExt, reportCandidates }
    }, [nonDirFiles])

    // KPIs
    const kpis = useMemo(() => {
        const bins = [...sizeDistribution]
        const counts = bins.map(b => b.count)
        const trendA = counts.slice(0, 5)
        const trendB = counts.slice().reverse().slice(0, 5)
        const speedTrend = tasks.slice(0, 6).map(t => (t.speed || 0) / (1024 * 1024)).reverse()

        return [
            {
                label: 'Total storage',
                value: formatBytes(deepStats.size),
                sublabel: `${deepFolderCount} folders`,
                trend: trendA,
            },
            {
                label: 'Files',
                value: deepStats.files > 1000 ? `${(deepStats.files / 1000).toFixed(1)}k` : String(deepStats.files),
                sublabel: `${deepFolderCount} folders`,
                trend: trendB,
            },
            {
                label: 'Readiness',
                value: `${readiness.score}%`,
                sublabel: `${readiness.okCount}/${readiness.checks.length} checks`,
                trend: readiness.checks.map(c => (c.ok ? 1 : 0)),
            },
            {
                label: 'Avg throughput',
                value: transferStats.avgSpeed > 0 ? `${formatBytes(transferStats.avgSpeed)}/s` : '--',
                sublabel: transferStats.avgSpeed > 0 ? 'Active transfers' : 'No active transfers',
                trend: speedTrend.length ? speedTrend : [0, 0, 0, 0, 0],
            },
        ]
    }, [deepStats, deepFolderCount, transferStats, sizeDistribution, tasks, readiness])

    return (
        <div className="h-screen bg-[#F5F5F7] flex flex-col overflow-hidden">
            <header className="border-b border-slate-100 bg-white/80 backdrop-blur flex-shrink-0">
                <div className="px-5 py-3 flex items-center justify-between gap-6">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                            <Activity className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                                Genomics SFTP
                            </p>
                            <p className="text-xs font-semibold text-slate-900 truncate">Dashboard</p>
                            <p className="text-[9px] text-slate-500 truncate" title={currentPath}>
                                {session.username}@{session.server} · {currentPath}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {!!deepError && (
                            <Badge
                                className="text-[10px] bg-red-100 text-red-800 border border-red-200"
                                variant="secondary"
                                title={deepError}
                            >
                                Error
                            </Badge>
                        )}
                        {deepLoading && (
                            <Badge className="text-[10px]" variant="secondary">
                                <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                                Scanning...
                            </Badge>
                        )}
                        {deepLastRefreshedAt && (
                            <Badge className="hidden sm:inline-flex text-[10px]" variant="secondary">
                                Updated {new Date(deepLastRefreshedAt).toLocaleTimeString()}
                            </Badge>
                        )}
                        <Button variant="secondary" size="sm" className="h-7 px-2.5 text-xs" onClick={onRefresh} disabled={deepLoading}>
                            <RefreshCw className={`w-3 h-3 ${deepLoading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-hidden p-5">
                <div className="h-full grid grid-rows-[auto_1fr] gap-6">
                    <section className="grid grid-cols-4 gap-3">
                        {kpis.map((kpi) => (
                            <Card
                                key={kpi.label}
                                className="border-slate-100 rounded-2xl bg-white/70 backdrop-blur shadow-none"
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                {kpi.label}
                                            </p>
                                            <p className="mt-0.5 text-lg font-semibold text-slate-900">{kpi.value}</p>
                                            <p className="mt-0.5 text-[10px] text-slate-500 truncate">{kpi.sublabel}</p>
                                        </div>
                                        <Sparkline values={kpi.trend} />
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </section>

                    <section className="grid grid-cols-12 gap-6 min-h-0">
                        <Card className="col-span-7 border-slate-100 rounded-3xl bg-white/70 backdrop-blur shadow-none flex flex-col min-h-0">
                            <CardHeader className="px-6 pt-6 pb-4 space-y-1">
                                <CardTitle className="text-sm">Overview</CardTitle>
                                <CardDescription className="text-xs">Footprint + categories</CardDescription>
                            </CardHeader>
                            <CardContent className="px-6 pb-6 pt-0 space-y-6 flex-1 min-h-0">
                                <div className="rounded-2xl border border-slate-100 bg-white/60 p-5">
                                    <div className="flex items-end justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold text-slate-900">Folder footprint</p>
                                            <p className="text-[11px] text-slate-500 truncate">Top subfolders by size</p>
                                        </div>
                                        <p className="text-xs font-semibold text-slate-700">{formatBytes(deepStats.size)}</p>
                                    </div>
                                    <div className="mt-3">
                                        {deepFolderSummaries.length === 0 ? (
                                            <div className="text-[11px] text-slate-500">No subfolders found.</div>
                                        ) : (
                                            <FootprintBar items={folderFootprint} />
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-end justify-between">
                                        <p className="text-xs font-semibold text-slate-900">Categories</p>
                                        <p className="text-[11px] text-slate-500">{categorySummaries.length} groups</p>
                                    </div>
                                    <div className="mt-2 space-y-2">
                                        {categorySummaries.slice(0, 6).map((c) => {
                                            const pct = totalCategorySize ? Math.round((c.size / totalCategorySize) * 100) : 0
                                            return (
                                                <div key={c.category} className="grid grid-cols-[1fr,84px] items-center gap-3">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <p className="text-xs font-semibold text-slate-700 truncate" title={c.category}>{c.category}</p>
                                                            <p className="text-[11px] text-slate-500 tabular-nums">{pct}%</p>
                                                        </div>
                                                        <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                            <div className={`${c.color} h-full`} style={{ width: `${Math.max(2, pct)}%` }} />
                                                        </div>
                                                    </div>
                                                    <p className="text-xs font-semibold text-slate-800 text-right tabular-nums" title={formatBytes(c.size)}>
                                                        {formatBytes(c.size)}
                                                    </p>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="col-span-5 border-slate-100 rounded-3xl bg-white/70 backdrop-blur shadow-none flex flex-col min-h-0">
                            <CardHeader className="px-6 pt-6 pb-4 space-y-1">
                                <CardTitle className="text-sm">Highlights</CardTitle>
                                <CardDescription className="text-xs">Readiness + quick queue</CardDescription>
                            </CardHeader>
                            <CardContent className="px-6 pb-6 pt-0 space-y-5 flex-1 min-h-0">
                                <div className="rounded-2xl border border-slate-100 bg-white/60 p-5">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-semibold text-slate-900">Deliverables readiness</p>
                                        <p className="text-sm font-semibold text-slate-900">{readiness.score}%</p>
                                    </div>
                                    <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500" style={{ width: `${readiness.score}%` }} />
                                    </div>
                                    <div className="mt-3 space-y-1.5">
                                        {readiness.checks.slice(0, 5).map((c) => (
                                            <div key={c.key} className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    {c.ok ? (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-slate-300" />
                                                    )}
                                                    <p className="text-xs text-slate-700 truncate" title={c.desc}>{c.label}</p>
                                                </div>
                                                <p className="text-[11px] text-slate-500 flex-shrink-0">{c.ok ? 'OK' : 'Missing'}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-100 bg-white/70 p-4">
                                    <p className="text-[10px] font-semibold text-slate-500 uppercase">Quick queue</p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className="h-7 px-2 text-xs font-semibold"
                                            onClick={() => onQueueDownload(anomalies.reportCandidates.map(f => f.path))}
                                            disabled={anomalies.reportCandidates.length === 0}
                                        >
                                            <ArrowDownToLine className="w-3 h-3" />
                                            Reports
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className="h-7 px-2 text-xs font-semibold"
                                            onClick={() => onQueueDownload(anomalies.tooLarge.map(f => f.path))}
                                            disabled={anomalies.tooLarge.length === 0}
                                        >
                                            <ArrowDownToLine className="w-3 h-3" />
                                            ≥1GB
                                        </Button>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-100 bg-white/70 p-4 flex-1 min-h-0 overflow-hidden">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-semibold text-slate-500 uppercase">Largest files</p>
                                        <p className="text-[10px] text-slate-500">top {largestFiles.length}</p>
                                    </div>
                                    <div className="mt-2 space-y-2 overflow-auto pr-1 max-h-[190px]">
                                        {largestFiles.map((f) => (
                                            <div key={f.path} className="flex items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-semibold text-slate-800 truncate" title={f.name}>{f.name}</p>
                                                    <p className="text-[10px] text-slate-500 truncate" title={f.path}>{formatBytes(f.size || 0)} · {f.path}</p>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    className="h-7 px-2 text-xs font-semibold flex-shrink-0"
                                                    onClick={() => onQueueDownload([f.path])}
                                                >
                                                    <ArrowDownToLine className="w-3 h-3" />
                                                    Queue
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </section>
                </div>
            </main>
        </div>
    )
}

export { DashboardMock as default }
export type { DashboardMockProps }

