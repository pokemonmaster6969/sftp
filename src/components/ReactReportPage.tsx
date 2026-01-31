import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Download, FolderOpen, RefreshCw, BarChart, FileText, Activity, Zap, User, Shield, AlertCircle } from 'lucide-react'
import { Chart, registerables, type Chart as ChartType } from 'chart.js'
import zoomPlugin from 'chartjs-plugin-zoom'

import { sftpApi } from '../api/sftp'
import type { SFTPFile } from '../types'
import type { ProjectInfo } from './OverviewPage'
import { loadReportData } from '../report/loadReportData'
import type { ComparisonData, DgeSummaryRow, ProcessedData, ProjectMetadata, ProjectStats, TranscriptStat } from '../report/types'
import { detectComparisonId, detectFileType } from '../report/fileDetection'
import { Badge, Button, Group, Stack, Text, Title, Paper, ActionIcon, ScrollArea, Select, SimpleGrid, ThemeIcon, Table } from '@mantine/core'

Chart.register(...registerables, zoomPlugin)

type Section = 'overview' | 'data' | 'mapping' | 'transcripts' | 'dge' | 'enrichment' | 'deliverables'

function normalizePathJoin(base: string, next: string) {
    const b = base.endsWith('/') ? base.slice(0, -1) : base
    const n = next.startsWith('/') ? next.slice(1) : next
    return `${b}/${n}`
}

function renderDgeSummaryTable(rows: DgeSummaryRow[]) {
    if (!rows || rows.length === 0) return null
    return (
        <div className="overflow-x-auto rounded-xl border border-slate-100">
            <Table className="min-w-full text-sm">
                <Table.Thead className="bg-slate-50/50">
                    <Table.Tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <Table.Th className="py-3 px-4">Comparison</Table.Th>
                        <Table.Th className="py-3 px-4">Description</Table.Th>
                        <Table.Th className="py-3 px-4 text-right">Total</Table.Th>
                        <Table.Th className="py-3 px-4 text-right text-emerald-600">Sig Up</Table.Th>
                        <Table.Th className="py-3 px-4 text-right text-red-600">Sig Down</Table.Th>
                        <Table.Th className="py-3 px-4 text-right font-black">Sig Total</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody className="divide-y divide-slate-100 bg-white">
                    {rows.map((r, idx) => (
                        <Table.Tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <Table.Td className="py-3 px-4 text-slate-900 font-bold">{r.comp}</Table.Td>
                            <Table.Td className="py-3 px-4 text-slate-500 font-medium">{r.desc}</Table.Td>
                            <Table.Td className="py-3 px-4 text-right text-slate-700 font-mono">{r.total}</Table.Td>
                            <Table.Td className="py-3 px-4 text-right text-emerald-600 font-black">{r.sigUp}</Table.Td>
                            <Table.Td className="py-3 px-4 text-right text-red-600 font-black">{r.sigDown}</Table.Td>
                            <Table.Td className="py-3 px-4 text-right font-black text-blue-600 bg-blue-50/30">{r.sig}</Table.Td>
                        </Table.Tr>
                    ))}
                </Table.Tbody>
            </Table>
        </div>
    )
}

function renderTranscriptStatsTable(rows: TranscriptStat[]) {
    if (!rows || rows.length === 0) return null
    return (
        <div className="overflow-x-auto rounded-xl border border-slate-100">
            <Table className="min-w-full text-sm">
                <Table.Thead className="bg-slate-50/50">
                    <Table.Tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <Table.Th className="py-3 px-4">File</Table.Th>
                        <Table.Th className="py-3 px-4 text-right">Transcripts</Table.Th>
                        <Table.Th className="py-3 px-4 text-right">Total Length</Table.Th>
                        <Table.Th className="py-3 px-4 text-right">Mean</Table.Th>
                        <Table.Th className="py-3 px-4 text-right font-black">Max</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody className="divide-y divide-slate-100 bg-white">
                    {rows.map((r, idx) => (
                        <Table.Tr key={idx} className="hover:bg-slate-50 transition-colors font-mono">
                            <Table.Td className="py-3 px-4 text-slate-800 font-bold font-sans">{r.name}</Table.Td>
                            <Table.Td className="py-3 px-4 text-right text-slate-600">{Number(r.count || 0).toLocaleString()}</Table.Td>
                            <Table.Td className="py-3 px-4 text-right text-slate-600">{Number(r.totalLen || 0).toLocaleString()}</Table.Td>
                            <Table.Td className="py-3 px-4 text-right text-slate-600">{Number.isFinite(r.meanLen) ? Number(r.meanLen).toLocaleString(undefined, { maximumFractionDigits: 1 }) : ''}</Table.Td>
                            <Table.Td className="py-3 px-4 text-right text-blue-600 font-black">{Number(r.maxLen || 0).toLocaleString()}</Table.Td>
                        </Table.Tr>
                    ))}
                </Table.Tbody>
            </Table>
        </div>
    )
}

function pickDefaultComparisonId(comparisons: Record<string, ComparisonData>) {
    const ids = Object.keys(comparisons).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    return ids[0] || null
}

function buildMappingSeries(mappingStats: string[][]) {
    if (mappingStats.length < 2) return null
    const headers = mappingStats[0].map(h => String(h || '').toLowerCase())
    const sampleIdx = 0
    const uniqueIdx = headers.findIndex(h => h.includes('unique') && h.includes('%'))
    const mappedIdx = headers.findIndex(h => (h.includes('mapped') || h.includes('total')) && h.includes('%'))
    if (uniqueIdx < 0 || mappedIdx < 0) return null

    const samples = mappingStats.slice(1).map(r => String(r[sampleIdx] || ''))
    const uniqueVals = mappingStats.slice(1).map(r => parseFloat(String(r[uniqueIdx] || '0')))
    const mappedVals = mappingStats.slice(1).map(r => parseFloat(String(r[mappedIdx] || '0')))

    return { samples, uniqueVals, mappedVals }
}

function buildOverviewDge(dge: DgeSummaryRow[]) {
    if (!dge || dge.length === 0) return null
    return {
        labels: dge.map(r => r.comp),
        sigUp: dge.map(r => r.sigUp),
        sigDown: dge.map(r => r.sigDown),
    }
}

function renderMatrixTable(matrix: string[][]) {
    if (!matrix || matrix.length === 0) return null
    const headers = matrix[0] || []
    const rows = matrix.slice(1)

    return (
        <div className="overflow-x-auto rounded-xl border border-slate-100">
            <Table className="min-w-full text-sm">
                <Table.Thead className="bg-slate-50/50">
                    <Table.Tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                        {headers.map((h, idx) => (
                            <Table.Th key={idx} className="py-3 px-4">{String(h ?? '')}</Table.Th>
                        ))}
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody className="divide-y divide-slate-50 bg-white">
                    {rows.map((row, rIdx) => (
                        <Table.Tr key={rIdx} className="hover:bg-slate-50 transition-colors whitespace-nowrap font-mono text-[13px]">
                            {row.map((c, cIdx) => (
                                <Table.Td key={cIdx} className="py-2.5 px-4 text-slate-600">{String(c ?? '')}</Table.Td>
                            ))}
                        </Table.Tr>
                    ))}
                </Table.Tbody>
            </Table>
        </div>
    )
}

function renderEnrichmentTable(rows: Array<{ term: string; count: number; pAdjust: number }>) {
    if (!rows || rows.length === 0) return null
    return (
        <div className="overflow-x-auto rounded-xl border border-slate-100">
            <Table className="min-w-full text-sm">
                <Table.Thead className="bg-slate-50/50">
                    <Table.Tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <Table.Th className="py-3 px-4">Enrichment Term</Table.Th>
                        <Table.Th className="py-3 px-4 text-right">Count</Table.Th>
                        <Table.Th className="py-3 px-4 text-right font-black">Adj. P-Value</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody className="divide-y divide-slate-50 bg-white">
                    {rows.slice(0, 30).map((r, idx) => (
                        <Table.Tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <Table.Td className="py-3 px-4 text-slate-800 font-medium">{r.term}</Table.Td>
                            <Table.Td className="py-3 px-4 text-right text-slate-600 font-mono">{r.count}</Table.Td>
                            <Table.Td className="py-3 px-4 text-right text-blue-600 font-black font-mono">{Number.isFinite(r.pAdjust) ? r.pAdjust.toExponential(2) : ''}</Table.Td>
                        </Table.Tr>
                    ))}
                </Table.Tbody>
            </Table>
        </div>
    )
}

function useChart(canvasRef: React.RefObject<HTMLCanvasElement | null>, build: (ctx: CanvasRenderingContext2D) => ChartType | null, deps: any[]) {
    const chartRef = useRef<ChartType | null>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        if (chartRef.current) {
            chartRef.current.destroy()
            chartRef.current = null
        }

        const ch = build(ctx)
        if (ch) chartRef.current = ch

        return () => {
            if (chartRef.current) {
                chartRef.current.destroy()
                chartRef.current = null
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps)
}

interface ReactReportPageProps {
    sessionId: string
    project: ProjectInfo
    onBack: () => void
    onOpenFiles: (projectPath: string) => void
}

export const ReactReportPage: React.FC<ReactReportPageProps> = ({ sessionId, project, onBack, onOpenFiles }) => {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [files, setFiles] = useState<SFTPFile[]>([])

    const [reportLoading, setReportLoading] = useState(false)
    const [reportError, setReportError] = useState<string | null>(null)
    const [meta, setMeta] = useState<ProjectMetadata | null>(null)
    const [stats, setStats] = useState<ProjectStats | null>(null)
    const [processed, setProcessed] = useState<ProcessedData | null>(null)

    const [section, setSection] = useState<Section>('overview')
    const [selectedComparisonId, setSelectedComparisonId] = useState<string | null>(null)

    const scrollToSection = useCallback((id: Section) => {
        const el = document.getElementById(`report-${id}`)
        if (el) {
            const container = document.getElementById('report-container')
            if (container) {
                container.scrollTo({ top: el.offsetTop - 120, behavior: 'smooth' })
            } else {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
        }
    }, [])

    const detectionSummary = useMemo(() => {
        const out: Record<string, { count: number; examples: string[] }> = {}
        for (const f of files) {
            if (f.isDirectory) continue
            const t = detectFileType(f.path)
            const key = String(t)
            if (!out[key]) out[key] = { count: 0, examples: [] }
            out[key].count += 1
            if (out[key].examples.length < 3) out[key].examples.push(f.path)
        }

        const compIds = new Map<string, number>()
        for (const f of files) {
            if (f.isDirectory) continue
            const id = detectComparisonId(f.path)
            if (id) compIds.set(id, (compIds.get(id) || 0) + 1)
        }

        const compTop = [...compIds.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

        return { byType: out, compTop }
    }, [files])

    const mappingCanvasRef = useRef<HTMLCanvasElement | null>(null)
    const dgeOverviewCanvasRef = useRef<HTMLCanvasElement | null>(null)
    const volcanoCanvasRef = useRef<HTMLCanvasElement | null>(null)
    const maCanvasRef = useRef<HTMLCanvasElement | null>(null)

    const title = project.metadata?.projectId || project.name
    const readmeDownloadPath = project.readmePath || normalizePathJoin(project.path, 'Readme.txt')

    const loadFiles = useCallback(async () => {
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
            setError((typeof e.message === 'string' ? e.message : null) || 'Failed to load deliverables')
            setFiles([])
        } finally {
            setLoading(false)
        }
    }, [project.path, sessionId])

    const loadParsed = useCallback(async (allFiles: SFTPFile[]) => {
        setReportLoading(true)
        setReportError(null)
        try {
            const out = await loadReportData({
                sessionId,
                projectPath: project.path,
                readmeText: project.readmeText,
                readmeMetadata: project.metadata,
                files: allFiles,
            })
            setMeta(out.metadata)
            setStats(out.stats)
            setProcessed(out.processed)
            setSelectedComparisonId(prev => prev || pickDefaultComparisonId(out.processed.comparisons))
        } catch (err) {
            const e = (typeof err === 'object' && err !== null ? (err as Record<string, any>) : {})
            setReportError((typeof e.message === 'string' ? e.message : null) || 'Failed to parse report data')
        } finally {
            setReportLoading(false)
        }
    }, [project.metadata, project.path, project.readmeText, sessionId])

    useEffect(() => {
        void loadFiles()
    }, [loadFiles])

    useEffect(() => {
        if (files.length === 0) return
        void loadParsed(files)
    }, [files, loadParsed])

    const comparisonIds = useMemo(() => {
        if (!processed) return []
        return Object.keys(processed.comparisons).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    }, [processed])

    const selectedComp = useMemo(() => {
        if (!processed || !selectedComparisonId) return null
        return processed.comparisons[selectedComparisonId] || null
    }, [processed, selectedComparisonId])

    const mappingSeries = useMemo(() => (processed ? buildMappingSeries(processed.mappingStatsTable) : null), [processed])
    const dgeOverview = useMemo(() => (processed ? buildOverviewDge(processed.dgeSummaryTable) : null), [processed])

    useChart(
        mappingCanvasRef,
        (ctx) => {
            if (!mappingSeries) return null
            return new Chart(ctx, {
                type: 'line',
                data: {
                    labels: mappingSeries.samples,
                    datasets: [
                        { label: 'Unique Mapped %', data: mappingSeries.uniqueVals, borderColor: '#2563EB', backgroundColor: 'rgba(37,99,235,0.05)', tension: 0.4, fill: true, pointRadius: 4, pointBackgroundColor: '#FFFFFF', pointBorderWidth: 2 },
                        { label: 'Total Mapped %', data: mappingSeries.mappedVals, borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.05)', tension: 0.4, fill: true, pointRadius: 4, pointBackgroundColor: '#FFFFFF', pointBorderWidth: 2 },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { usePointStyle: true, font: { weight: 'bold' } } },
                        zoom: { zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' }, pan: { enabled: true, mode: 'x' } },
                    },
                    scales: {
                        y: { min: 0, max: 100, border: { dash: [4, 4] }, grid: { color: 'rgba(0,0,0,0.03)' } },
                        x: { grid: { display: false } }
                    },
                },
            })
        },
        [mappingSeries]
    )

    useChart(
        dgeOverviewCanvasRef,
        (ctx) => {
            if (!dgeOverview) return null
            return new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: dgeOverview.labels,
                    datasets: [
                        { label: 'Significant Up', data: dgeOverview.sigUp, backgroundColor: '#10B981', borderRadius: 4, barThickness: 24 },
                        { label: 'Significant Down', data: dgeOverview.sigDown, backgroundColor: '#EF4444', borderRadius: 4, barThickness: 24 },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, font: { weight: 'bold' } } } },
                    scales: {
                        x: { stacked: true, grid: { display: false } },
                        y: { beginAtZero: true, stacked: true, border: { dash: [4, 4] }, grid: { color: 'rgba(0,0,0,0.03)' } }
                    }
                },
            })
        },
        [dgeOverview]
    )

    useChart(
        volcanoCanvasRef,
        (ctx) => {
            if (!selectedComp || selectedComp.volcanoPoints.length === 0) return null
            const sig = selectedComp.volcanoPoints.filter(p => p.sig)
            const ns = selectedComp.volcanoPoints.filter(p => !p.sig)
            return new Chart(ctx, {
                type: 'scatter',
                data: {
                    datasets: [
                        { label: 'Significant (FDR < 0.05)', data: sig as any, backgroundColor: 'rgba(239, 68, 68, 0.7)', pointRadius: 3 },
                        { label: 'Non-Significant', data: ns as any, backgroundColor: 'rgba(148, 163, 184, 0.4)', pointRadius: 2 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { usePointStyle: true, font: { weight: 'bold' } } },
                        zoom: { zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy' }, pan: { enabled: true, mode: 'xy' } }
                    },
                    scales: {
                        x: { title: { display: true, text: 'Log2 Fold Change', font: { weight: 'bold' } }, grid: { color: 'rgba(0,0,0,0.03)' } },
                        y: { title: { display: true, text: '-Log10 FDR', font: { weight: 'bold' } }, grid: { color: 'rgba(0,0,0,0.03)' } }
                    },
                },
            })
        },
        [selectedComp?.id]
    )

    useChart(
        maCanvasRef,
        (ctx) => {
            if (!selectedComp || selectedComp.maPoints.length === 0) return null
            const sig = selectedComp.maPoints.filter(p => p.sig)
            const ns = selectedComp.maPoints.filter(p => !p.sig)
            return new Chart(ctx, {
                type: 'scatter',
                data: {
                    datasets: [
                        { label: 'Significant (FDR < 0.05)', data: sig as any, backgroundColor: 'rgba(239, 68, 68, 0.7)', pointRadius: 3 },
                        { label: 'Non-Significant', data: ns as any, backgroundColor: 'rgba(148, 163, 184, 0.4)', pointRadius: 2 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { usePointStyle: true, font: { weight: 'bold' } } },
                        zoom: { zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy' }, pan: { enabled: true, mode: 'xy' } }
                    },
                    scales: {
                        x: { title: { display: true, text: 'Log Average CPM', font: { weight: 'bold' } }, grid: { color: 'rgba(0,0,0,0.03)' } },
                        y: { title: { display: true, text: 'Log2 Fold Change', font: { weight: 'bold' } }, grid: { color: 'rgba(0,0,0,0.03)' } }
                    },
                },
            })
        },
        [selectedComp?.id]
    )

    return (
        <div className="flex-1 flex flex-col bg-slate-50/50 font-sans">
            {/* Report Header */}
            <header className="h-28 flex items-center justify-between px-6 sm:px-10 bg-white sticky top-0 z-40 border-b border-slate-100 shadow-sm">
                <div className="flex items-center gap-5 min-w-0">
                    <ActionIcon
                        variant="subtle"
                        color="slate"
                        radius="xl"
                        size="lg"
                        onClick={onBack}
                        className="hover:bg-slate-50"
                    >
                        <ArrowLeft size={22} className="text-slate-600" />
                    </ActionIcon>
                    <div className="min-w-0">
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight truncate">Multi-omics Synthesis</h2>
                            <Badge variant="filled" color="indigo" radius="sm">v1.2 Stable</Badge>
                        </div>
                        <Group gap={8} mt={4}>
                            <Text size="sm" c="blue.6" fw={800} tt="uppercase" lts={1}>Analytical Environment</Text>
                            <span className="text-sm text-slate-300 font-light">•</span>
                            <Text size="sm" c="slate.400" fw={600} truncate>{title}</Text>
                        </Group>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="white"
                        radius="xl"
                        size="md"
                        leftSection={<FolderOpen size={18} />}
                        onClick={() => onOpenFiles(project.path)}
                        className="shadow-sm border-slate-200 font-bold"
                    >
                        Project Assets
                    </Button>
                    <Button
                        variant="filled"
                        color="blue"
                        radius="xl"
                        size="md"
                        leftSection={loading || reportLoading ? <RefreshCw size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                        onClick={() => void loadFiles()}
                        className="font-bold shadow-lg shadow-blue-500/20"
                    >
                        Recalibrate
                    </Button>
                </div>
            </header>

            <div id="report-container" className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="max-w-[1440px] mx-auto p-6 sm:p-10 space-y-12">
                    {/* Navigation Pills */}
                    <div className="flex flex-wrap gap-2 sticky top-4 z-30 p-2 bg-white/70 backdrop-blur-xl rounded-2xl border border-white shadow-xl shadow-slate-200/50 w-fit mx-auto">
                        {(
                            [
                                ['overview', 'Operational Specs'],
                                ['transcripts', 'Assembly'],
                                ['data', 'Data Quality'],
                                ['mapping', 'Alignment'],
                                ['dge', 'DGE Profiling'],
                                ['enrichment', 'Ontology'],
                                ['deliverables', 'Archive'],
                            ] as Array<[Section, string]>
                        ).map(([id, label]) => (
                            <Button
                                key={id}
                                variant={section === id ? 'filled' : 'subtle'}
                                color={section === id ? 'blue' : 'slate'}
                                radius="xl"
                                size="xs"
                                onClick={() => {
                                    setSection(id)
                                    scrollToSection(id)
                                }}
                                className="font-bold px-4"
                            >
                                {label}
                            </Button>
                        ))}
                    </div>

                    {(error || reportError) && (
                        <div className="p-6 bg-red-50 rounded-2xl border border-red-100 flex items-start gap-4">
                            <ThemeIcon color="red" variant="light" size="lg" radius="md"><AlertCircle size={20} /></ThemeIcon>
                            <div>
                                <Text fw={800} c="red.9">Initialization Fault</Text>
                                <Text size="sm" c="red.8" mt={2}>{error || reportError}</Text>
                            </div>
                        </div>
                    )}

                    {/* Overview Cards */}
                    <section id="report-overview">
                        <Title order={4} mb={24} tt="uppercase" lts={2} c="slate.400" className="text-[11px] font-black">Project Metadata & KPIs</Title>
                        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing={24}>
                            {[
                                { label: 'Project ID', value: meta?.projectID || '--', icon: Zap, color: 'blue' },
                                { label: 'Library Strategy', value: meta?.serviceType || '--', icon: Activity, color: 'emerald' },
                                { label: 'Total Cohort', value: stats?.totalSamples ?? '--', icon: User, color: 'purple' },
                                { label: 'Assay Platform', value: meta?.platform || '--', icon: BarChart, color: 'indigo' },
                                { label: 'Successive Mapping', value: stats?.mappingRate || '--', icon: Zap, color: 'amber' },
                                { label: 'Isoform Discovery', value: stats?.novelIsoforms ?? '--', icon: Activity, color: 'sky' },
                                { label: 'Transcriptome Scale', value: stats?.mergedTranscripts ?? '--', icon: FileText, color: 'cyan' },
                                { label: 'Reference Genome', value: meta?.genomeBuild || '--', icon: Shield, color: 'slate' }
                            ].map((s, i) => (
                                <Paper key={i} withBorder radius="20px" p={24} className="bg-white hover:border-blue-200 transition-colors">
                                    <Text size="xs" fw={900} tt="uppercase" lts={1} c="slate.400" mb={8}>{s.label}</Text>
                                    <Text size="md" fw={900} className="text-slate-900 truncate">{s.value}</Text>
                                </Paper>
                            ))}
                        </SimpleGrid>
                    </section>

                    {/* Assembly Assembly */}
                    <section id="report-transcripts">
                        <Paper withBorder radius="24px" p={32} className="bg-white shadow-sm overflow-hidden relative">
                            <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                                <FileText size={160} />
                            </div>
                            <div className="relative z-10">
                                <Title order={3} mb={8} className="tracking-tight text-slate-900">Transcript Assembly Metrics</Title>
                                <Text size="sm" c="slate.500" mb={32} maw={600}>Performance metrics for the referenced transcriptome reconstruction and isoform detection pipeline.</Text>
                                {renderTranscriptStatsTable(processed?.transcriptStats || []) || (
                                    <div className="py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 text-center">
                                        <Text size="sm" fw={700} c="slate.400">Biological metrics not detected in this run.</Text>
                                    </div>
                                )}
                            </div>
                        </Paper>
                    </section>

                    {/* Data QC */}
                    <section id="report-data">
                        <Paper withBorder radius="24px" p={32} className="bg-white shadow-sm">
                            <Title order={3} mb={8} className="tracking-tight text-slate-900">Raw Data Quality Control</Title>
                            <Text size="sm" c="slate.500" mb={32}>Aggregated read counts and sequence-level quality score distributions.</Text>
                            {renderMatrixTable(processed?.dataStatsTable || []) || (
                                <div className="py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 text-center">
                                    <Text size="sm" fw={700} c="slate.400">QC metrics table missing or truncated.</Text>
                                </div>
                            )}
                        </Paper>
                    </section>

                    {/* Mapping Alignment */}
                    <section id="report-mapping">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                            <div className="lg:col-span-12">
                                <Paper withBorder radius="24px" p={32} className="bg-white shadow-sm">
                                    <Title order={3} mb={8} className="tracking-tight text-slate-900">Genomic Alignment Efficiency</Title>
                                    <Text size="sm" c="slate.500" mb={32}>Successful read mapping percentages across target chromosome coordinates.</Text>

                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                                        <div className="space-y-6">
                                            <div className="h-96 relative border border-slate-50 rounded-2xl p-4">
                                                {mappingSeries ? <canvas ref={mappingCanvasRef} /> : <div className="h-full flex items-center justify-center text-slate-300">Chart data unavailable.</div>}
                                            </div>
                                        </div>
                                        <div className="max-h-[500px]">
                                            <ScrollArea h={400}>
                                                {renderMatrixTable(processed?.mappingStatsTable || [])}
                                            </ScrollArea>
                                        </div>
                                    </div>
                                </Paper>
                            </div>
                        </div>
                    </section>

                    {/* DGE Profiling */}
                    <section id="report-dge" className="space-y-8">
                        <Paper withBorder radius="24px" p={32} className="bg-white shadow-sm">
                            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                                <div>
                                    <Title order={3} mb={8} className="tracking-tight text-slate-900">Differential Gene Expression</Title>
                                    <Text size="sm" c="slate.500">Comparison diagnostics and identification of transcriptionally active biological features.</Text>
                                </div>
                                <Select
                                    label="Target Comparison Group"
                                    placeholder="Select contrast"
                                    data={comparisonIds.map(id => ({ value: id, label: id }))}
                                    value={selectedComparisonId}
                                    onChange={setSelectedComparisonId}
                                    radius="xl"
                                    size="sm"
                                    w={300}
                                    styles={{ label: { fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--mantine-color-slate-400)', marginBottom: 6 } }}
                                />
                            </div>

                            <div className="space-y-12">
                                <div className="h-80 relative border border-slate-50 rounded-2xl p-4">
                                    {dgeOverview ? <canvas ref={dgeOverviewCanvasRef} /> : <div className="h-full flex items-center justify-center text-slate-300">Overview metrics unavailable.</div>}
                                </div>

                                <div className="pt-8 border-t border-slate-50">
                                    <Title order={5} mb={20} tt="uppercase" lts={1.5} c="slate.400" className="text-[10px] font-black">Comparison Heatmaps & Volcanos</Title>
                                    {!selectedComp ? (
                                        <div className="py-20 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 text-center">
                                            <Text size="sm" fw={700} c="slate.400">Contrast diagnostics not found.</Text>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                                            <Paper bg="slate.50/30" p={24} radius="24px" withBorder>
                                                <Group justify="space-between" mb={20}>
                                                    <Text size="xs" fw={900} tt="uppercase" lts={1} c="slate.500">MA Variation Plot</Text>
                                                    <Badge color="red" variant="light" size="xs">FDR 0.05</Badge>
                                                </Group>
                                                <div className="h-96">
                                                    <canvas ref={maCanvasRef} />
                                                </div>
                                            </Paper>
                                            <Paper bg="slate.50/30" p={24} radius="24px" withBorder>
                                                <Group justify="space-between" mb={20}>
                                                    <Text size="xs" fw={900} tt="uppercase" lts={1} c="slate.500">Volcano Log-Fold Distribution</Text>
                                                    <Badge color="blue" variant="light" size="xs">Log2FC 1.5</Badge>
                                                </Group>
                                                <div className="h-96">
                                                    <canvas ref={volcanoCanvasRef} />
                                                </div>
                                            </Paper>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-8 border-t border-slate-50">
                                    <Title order={5} mb={20} tt="uppercase" lts={1.5} c="slate.400" className="text-[10px] font-black">Significance Ledger</Title>
                                    {renderDgeSummaryTable(processed?.dgeSummaryTable || [])}
                                </div>
                            </div>
                        </Paper>
                    </section>

                    {/* Ontology & Enrichment */}
                    <section id="report-enrichment">
                        <Paper withBorder radius="24px" p={32} className="bg-white shadow-sm">
                            <Title order={3} mb={8} className="tracking-tight text-slate-900">Functional Ontology Enrichment</Title>
                            <Text size="sm" c="slate.500" mb={32}>Gene Ontology (GO) and KEGG pathway enrichment for differentially expressed genes.</Text>

                            {!selectedComp ? (
                                <div className="py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 text-center">
                                    <Text size="sm" fw={700} c="slate.400">Pathfinder module data missing.</Text>
                                </div>
                            ) : (
                                <div className="space-y-12">
                                    <Stack gap={12}>
                                        <Title order={5} tt="uppercase" lts={1.5} c="slate.400" className="text-[10px] font-black">GO Terms (All Significant)</Title>
                                        {renderEnrichmentTable(selectedComp.goTerms)}
                                    </Stack>

                                    <SimpleGrid cols={{ base: 1, xl: 2 }} spacing={40}>
                                        <Stack gap={12}>
                                            <Title order={5} tt="uppercase" lts={1.5} c="emerald.7" className="text-[10px] font-black bg-emerald-50 px-2 py-1 rounded w-fit">GO Enrichment (Up-regulated)</Title>
                                            {renderEnrichmentTable(selectedComp.goTermsUp) || <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-400 italic">No significant GO terms identified.</div>}
                                        </Stack>
                                        <Stack gap={12}>
                                            <Title order={5} tt="uppercase" lts={1.5} c="red.7" className="text-[10px] font-black bg-red-50 px-2 py-1 rounded w-fit">GO Enrichment (Down-regulated)</Title>
                                            {renderEnrichmentTable(selectedComp.goTermsDown) || <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-400 italic">No significant GO terms identified.</div>}
                                        </Stack>
                                    </SimpleGrid>

                                    <Stack gap={12} className="pt-8 border-t border-slate-50">
                                        <Title order={5} tt="uppercase" lts={1.5} c="slate.400" className="text-[10px] font-black">KEGG Metabolic Pathways</Title>
                                        {renderEnrichmentTable(selectedComp.keggPathways)}
                                    </Stack>
                                </div>
                            )}
                        </Paper>
                    </section>

                    {/* Archive Archive */}
                    <section id="report-deliverables">
                        <Paper withBorder radius="24px" p={32} className="bg-slate-900 border-none shadow-2xl text-white overflow-hidden relative">
                            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none text-blue-500">
                                <Shield size={200} />
                            </div>
                            <div className="relative z-10">
                                <Title order={3} mb={8} className="tracking-tight text-white font-black">Analytical Archive & Deliverables</Title>
                                <Text size="sm" c="slate.400" mb={32}>Final documented hierarchy and asset recovery points.</Text>

                                <div className="space-y-8">
                                    <div>
                                        <Text size="xs" fw={900} tt="uppercase" lts={1.5} c="slate.500" mb={12}>Project Trace Tree</Text>
                                        <pre className="text-xs bg-slate-800/50 text-blue-300 border border-slate-700/50 rounded-2xl p-6 overflow-auto font-mono leading-relaxed">
                                            {processed?.deliverablesTree || 'Analysis Manifest\n.'}
                                        </pre>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Paper bg="white/5" p={20} radius="xl" withBorder style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-blue-500/20 rounded-2xl"><FileText className="text-blue-400" size={24} /></div>
                                                <div>
                                                    <Text size="sm" fw={800}>Analysis Specification</Text>
                                                    <Text size="xs" c="slate.500" font-family="mono" className="mt-1">Readme.txt</Text>
                                                </div>
                                                <ActionIcon component="a" href={sftpApi.getDownloadUrl(sessionId, readmeDownloadPath)} variant="light" color="blue" radius="xl" size="lg" className="ml-auto">
                                                    <Download size={18} />
                                                </ActionIcon>
                                            </div>
                                        </Paper>

                                        {files
                                            .filter(f => !f.isDirectory)
                                            .filter(f => {
                                                const t = detectFileType(f.path)
                                                return t === 'stats' || t === 'mapping' || t === 'dge_summary' || String(t).startsWith('comparison_')
                                            })
                                            .slice(0, 7)
                                            .map((f) => (
                                                <Paper key={f.path} bg="white/5" p={20} radius="xl" withBorder style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                                                    <div className="flex items-center gap-4">
                                                        <div className="p-3 bg-slate-800 rounded-2xl"><Activity className="text-slate-400" size={24} /></div>
                                                        <div className="min-w-0">
                                                            <Text size="sm" fw={800} truncate>{f.name}</Text>
                                                            <Text size="xs" c="slate.500" tt="uppercase" lts={1} className="mt-1">{String(detectFileType(f.path)).replace('_', ' ')}</Text>
                                                        </div>
                                                        <ActionIcon component="a" href={sftpApi.getDownloadUrl(sessionId, f.path)} variant="subtle" color="slate" radius="xl" size="lg" className="ml-auto">
                                                            <Download size={18} />
                                                        </ActionIcon>
                                                    </div>
                                                </Paper>
                                            ))}
                                    </div>
                                    <Button variant="outline" color="slate" radius="xl" fullWidth size="md" onClick={() => onOpenFiles(project.path)} className="border-slate-800 text-slate-400 hover:bg-slate-800 font-bold">Inspect Deep-Storage Assets</Button>
                                </div>
                            </div>
                        </Paper>
                    </section>

                    {/* Report Telemetry */}
                    <details className="group">
                        <summary className="text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600 transition-colors list-none flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-slate-400 group-open:bg-blue-500"></span>
                            Neural System Diagnostics
                        </summary>
                        <div className="pt-6 space-y-4">
                            <Title order={6} tt="uppercase" lts={1} c="slate.400" size="10px" className="font-black">Fingerprint Inference</Title>
                            <SimpleGrid cols={{ base: 1, md: 2 }} spacing={12}>
                                {Object.entries(detectionSummary.byType).map(([k, v]) => (
                                    <div key={k} className="p-4 bg-white border border-slate-100 rounded-xl">
                                        <div className="flex justify-between items-center mb-2">
                                            <Text size="xs" fw={900} tt="uppercase" c="blue.6">{k}</Text>
                                            <Badge size="xs" variant="light">{v.count} instances</Badge>
                                        </div>
                                        <div className="space-y-1">
                                            {v.examples.map((e, idx) => (
                                                <div key={idx} className="font-mono text-[10px] text-slate-400 truncate">{e}</div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </SimpleGrid>
                        </div>
                    </details>
                </div>
            </div>
        </div>
    )
}

export default ReactReportPage
