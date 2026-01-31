import React, { useState, useEffect } from 'react'
import { User, Lock as LockIcon, ArrowRight, FolderOpen, ShieldCheck, Globe, Zap } from 'lucide-react'
import { sftpApi } from '../api/sftp'
import type { SessionInfo } from '../types'
import { useSessionError } from '../hooks/useSessionError'
import unigenomeLogo from '../assets/unigenome.png'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Alert,
    Box,
    Button,
    Center,
    Flex,
    Grid,
    Group,
    PasswordInput,
    SegmentedControl,
    Stack,
    Text,
    TextInput,
    Title,
    Paper,
} from '@mantine/core'

interface FormData {
    server: string
    port: number
    username: string
    password: string
    path: string
}

interface LoginPageProps {
    onLogin: (session: SessionInfo) => void
    initialPath?: string
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, initialPath }) => {
    const [formData, setFormData] = useState<FormData>({
        server: '',
        port: 22,
        username: '',
        password: '',
        path: initialPath || '/'
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [showPassword, setShowPassword] = useState(false)

    const { parseError, getErrorDisplay } = useSessionError()

    // Modes: 'client' uses the fixed host/port, 'admin' allows custom host/port
    type Mode = 'client' | 'admin'
    const [mode, setMode] = useState<Mode>('client')

    // Fixed client host/port as requested
    const CLIENT_HOST = '120.72.93.162'
    const CLIENT_PORT = 9091

    // Keep separate storage for admin server/port so switching doesn't lose edits
    const [adminServerBackup, setAdminServerBackup] = useState<string>('')
    const [adminPortBackup, setAdminPortBackup] = useState<number>(22)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        // When client mode, force the fixed server/port regardless of input
        let server = mode === 'client' ? CLIENT_HOST : (formData.server || '').trim()
        const port = mode === 'client' ? CLIENT_PORT : (formData.port || 22)

        if (server.toLowerCase().startsWith('ftp://')) {
            server = server.replace(/ftp:\/\//i, '')
        } else if (server.toLowerCase().startsWith('sftp://')) {
            server = server.replace(/sftp:\/\//i, '')
        }

        try {
            const payload = {
                server,
                port,
                protocol: mode === 'client' ? 'ftp' : 'sftp',
                username: formData.username,
                password: formData.password,
                path: formData.path,
                isAdmin: mode === 'admin'
            }

            const response = await sftpApi.connect(payload)
            onLogin({
                sessionId: response.data.sessionId,
                server,
                username: formData.username,
                currentPath: formData.path,
                isAdmin: mode === 'admin'
            } as SessionInfo)
        } catch (err: unknown) {
            const parsed = parseError(err)
            setError(getErrorDisplay(parsed))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (initialPath) setFormData(prev => ({ ...prev, path: initialPath }))
    }, [initialPath])

    useEffect(() => {
        if (mode === 'client' && (!formData.server || formData.server === '')) {
            setFormData(prev => ({ ...prev, server: CLIENT_HOST, port: CLIENT_PORT }))
        }
    }, [mode, formData.server])

    const switchMode = (nextMode: Mode) => {
        if (nextMode === mode) return

        if (nextMode === 'client') {
            setAdminServerBackup(formData.server)
            setAdminPortBackup(formData.port || 22)
            setFormData(prev => ({ ...prev, server: CLIENT_HOST, port: CLIENT_PORT }))
            setMode('client')
        } else {
            setFormData(prev => ({ ...prev, server: adminServerBackup || '', port: adminPortBackup || 22 }))
            setMode('admin')
        }
        setError('')
    }

    return (
        <Flex mih="100dvh" w="100%" bg="slate.50" style={{ overflow: 'hidden' }}>
            {/* Left Branding Panel */}
            <Box
                visibleFrom="lg"
                w="45%"
                pos="relative"
                style={{ overflow: 'hidden', background: '#020617' }}
            >
                {/* Animated Background Elements */}
                <motion.div
                    animate={{
                        scale: [1, 1.1, 1],
                        opacity: [0.3, 0.5, 0.3],
                    }}
                    transition={{
                        duration: 8,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    style={{
                        position: 'absolute',
                        top: '-10%',
                        left: '-10%',
                        width: '60%',
                        height: '60%',
                        background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)',
                        filter: 'blur(60px)',
                    }}
                />

                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.2, 0.4, 0.2],
                    }}
                    transition={{
                        duration: 10,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 1
                    }}
                    style={{
                        position: 'absolute',
                        bottom: '5%',
                        right: '-5%',
                        width: '50%',
                        height: '50%',
                        background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)',
                        filter: 'blur(50px)',
                    }}
                />

                {/* Grid Overlay */}
                <Box
                    pos="absolute"
                    inset={0}
                    style={{
                        opacity: 0.05,
                        backgroundImage: `radial-gradient(#fff 0.5px, transparent 0.5px)`,
                        backgroundSize: '24px 24px',
                    }}
                />

                <Flex pos="relative" h="100%" direction="column" justify="space-between" p={60} c="white" style={{ zIndex: 10 }}>
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <Group gap={16}>
                            <Box
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '14px 18px',
                                    borderRadius: 20,
                                    background: 'rgba(255,255,255,1)',
                                    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                                }}
                            >
                                <img
                                    src={unigenomeLogo}
                                    alt="Unigenome"
                                    style={{ height: 36, width: 'auto', objectFit: 'contain' }}
                                />
                            </Box>
                            <Box>
                                <Text fw={900} size="xl" style={{ letterSpacing: -0.5, lineHeight: 1 }}>UNIGENOME</Text>
                                <Text size="xs" fw={700} c="blue.4" style={{ letterSpacing: 1.5, opacity: 0.8 }}>GENOMICS SFTP</Text>
                            </Box>
                        </Group>
                    </motion.div>

                    <Box maw={540}>
                        <motion.div
                            initial={{ opacity: 0, x: -30 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                        >
                            <Text
                                component="span"
                                style={{
                                    display: 'inline-block',
                                    fontWeight: 900,
                                    fontSize: 32,
                                    letterSpacing: -0.6,
                                    lineHeight: 1.1,
                                    background: 'linear-gradient(135deg, var(--mantine-color-blue-4) 0%, var(--mantine-color-indigo-4) 100%)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text',
                                    color: 'transparent',
                                }}
                            >
                                The gateway to genomic data
                            </Text>
                            Seamlessly access high-throughput sequencing results, detailed variant calling reports, and custom bioinformatic pipelines through our high-performance secure repository.
                        </motion.div>

                        <Group mt={40} gap={16}>
                            {[
                                { icon: ShieldCheck, label: 'Military Grade Encryption' },
                                { icon: Globe, label: 'Global Edge Relay' },
                                { icon: Zap, label: 'High Bandwidth Transfers' }
                            ].map((item, i) => (
                                <motion.div
                                    key={item.label}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5, delay: 0.4 + (i * 0.1) }}
                                >
                                    <Group gap={8} p="8px 16px" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 100, border: '1px solid rgba(255,255,255,0.1)' }}>
                                        <item.icon size={14} className="text-blue-400" />
                                        <Text size="xs" fw={700} c="blue.1" style={{ whiteSpace: 'nowrap' }}>{item.label}</Text>
                                    </Group>
                                </motion.div>
                            ))}
                        </Group>
                    </Box>

                    <Box>
                        <Text size="xs" fw={500} c="slate.500">
                            PRECISION GENOMICS INFRASTRUCTURE v2.4.0
                        </Text>
                    </Box>
                </Flex>
            </Box>

            {/* Right Login Panel */}
            <Flex
                flex={1}
                direction="column"
                justify="center"
                align="center"
                bg="white"
                p={{ base: 24, sm: 48, lg: 96 }}
                pos="relative"
            >
                {/* Subtle Right Side Decor */}
                <Box
                    pos="absolute"
                    top="10%"
                    right="-5%"
                    w={400}
                    h={400}
                    style={{ background: 'rgba(59,130,246,0.03)', filter: 'blur(100px)', borderRadius: 9999, pointerEvents: 'none' }}
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6 }}
                    style={{ width: '100%', maxWidth: 440 }}
                >
                    <Box hiddenFrom="lg" mb={40} style={{ textAlign: 'center' }}>
                        <Center mb={12}>
                            <Box p="10px 14px" bg="slate.900" style={{ borderRadius: 16 }}>
                                <img
                                    src={unigenomeLogo}
                                    alt="Unigenome"
                                    style={{ height: 32, width: 'auto', filter: 'brightness(0) invert(1)' }}
                                />
                            </Box>
                        </Center>
                        <Title order={3}>Genomics Portal</Title>
                    </Box>

                    <Stack gap={32}>
                        <Box>
                            <Title order={2} style={{ fontSize: 32, fontWeight: 900, marginBottom: 8, letterSpacing: -0.5 }}>
                                Start Session
                            </Title>
                            <Text size="sm" c="slate.500" fw={500}>
                                Authenticate to access your secure genomics environment.
                            </Text>
                        </Box>

                        <form onSubmit={handleLogin} noValidate>
                            <Stack gap={20}>
                                <SegmentedControl
                                    fullWidth
                                    size="md"
                                    radius="xl"
                                    value={mode}
                                    onChange={(value) => switchMode(value as Mode)}
                                    bg="slate.50"
                                    data={[
                                        { label: 'Client Node', value: 'client' },
                                        { label: 'Advanced / Admin', value: 'admin' },
                                    ]}
                                    styles={{
                                        root: { border: '1px solid var(--mantine-color-slate-100)' },
                                        indicator: { boxShadow: '0 4px 12px rgba(59,130,246,0.2)' }
                                    }}
                                />

                                <Paper withBorder p={0} radius="xl" style={{ overflow: 'hidden' }}>
                                    <Grid gutter={0}>
                                        <Grid.Col span={mode === 'client' ? 12 : 8}>
                                            <TextInput
                                                label="Host Infrastructure"
                                                variant="unstyled"
                                                px={20}
                                                py={10}
                                                required
                                                placeholder={mode === 'client' ? `ftp://${CLIENT_HOST}` : 'sftp.unigenome.in'}
                                                value={formData.server}
                                                onChange={(e) => setFormData({ ...formData, server: e.target.value })}
                                                disabled={mode === 'client'}
                                                styles={{
                                                    label: { fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--mantine-color-slate-400)', marginBottom: 2 },
                                                    input: { fontWeight: 600, fontSize: 14 }
                                                }}
                                            />
                                        </Grid.Col>
                                        {mode === 'admin' && (
                                            <Grid.Col span={4} style={{ borderLeft: '1px solid var(--mantine-color-slate-100)' }}>
                                                <TextInput
                                                    label="Port"
                                                    variant="unstyled"
                                                    px={20}
                                                    py={10}
                                                    type="number"
                                                    value={formData.port || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value
                                                        setFormData({ ...formData, port: val === '' ? 0 : parseInt(val) })
                                                    }}
                                                    styles={{
                                                        label: { fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--mantine-color-slate-400)', marginBottom: 2 },
                                                        input: { fontWeight: 600, fontSize: 14 }
                                                    }}
                                                />
                                            </Grid.Col>
                                        )}
                                    </Grid>
                                </Paper>

                                <Stack gap={12}>
                                    <TextInput
                                        size="md"
                                        radius="xl"
                                        label="Operator ID"
                                        placeholder="Enter your username"
                                        leftSection={<User size={18} className="text-slate-400" />}
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        styles={{
                                            label: { fontSize: 11, fontWeight: 700, marginBottom: 6, color: 'var(--mantine-color-slate-700)' },
                                            input: { backgroundColor: 'var(--mantine-color-slate-50)', border: '1px solid transparent', '&:focus': { borderColor: 'var(--mantine-color-blue-500)', backgroundColor: 'white' } }
                                        }}
                                    />

                                    <PasswordInput
                                        size="md"
                                        radius="xl"
                                        label="Security Key"
                                        placeholder="••••••••••••"
                                        leftSection={<LockIcon size={18} className="text-slate-400" />}
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        visible={showPassword}
                                        onVisibilityChange={setShowPassword}
                                        styles={{
                                            label: { fontSize: 11, fontWeight: 700, marginBottom: 6, color: 'var(--mantine-color-slate-700)' },
                                            input: { backgroundColor: 'var(--mantine-color-slate-50)', border: '1px solid transparent', '&:focus': { borderColor: 'var(--mantine-color-blue-500)', backgroundColor: 'white' } }
                                        }}
                                    />
                                </Stack>

                                <TextInput
                                    size="md"
                                    radius="xl"
                                    label="Root Protocol Path"
                                    placeholder="/"
                                    leftSection={<FolderOpen size={18} className="text-slate-400" />}
                                    value={formData.path}
                                    onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                                    styles={{
                                        label: { fontSize: 11, fontWeight: 700, marginBottom: 6, color: 'var(--mantine-color-slate-700)' },
                                        input: { backgroundColor: 'var(--mantine-color-slate-50)', border: '1px solid transparent', '&:focus': { borderColor: 'var(--mantine-color-blue-500)', backgroundColor: 'white' } }
                                    }}
                                />

                                <AnimatePresence>
                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                        >
                                            <Alert color="red" variant="filled" radius="xl" py={12}>
                                                <Text size="xs" fw={700}>{error}</Text>
                                            </Alert>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <Button
                                    type="submit"
                                    fullWidth
                                    size="lg"
                                    radius="xl"
                                    loading={loading}
                                    rightSection={!loading && <ArrowRight size={20} />}
                                    color="blue.6"
                                    style={{
                                        boxShadow: '0 12px 24px rgba(59,130,246,0.3)',
                                        height: 54,
                                        fontSize: 16,
                                        fontWeight: 800
                                    }}
                                >
                                    {loading ? 'Validating Protocol...' : 'Establish Secure Connection'}
                                </Button>

                                <Group justify="center">
                                    <Text size="xs" c="slate.400" fw={600} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <ShieldCheck size={14} /> SOC2 Type II Certified Access
                                    </Text>
                                </Group>
                            </Stack>
                        </form>
                    </Stack>
                </motion.div>
            </Flex>
        </Flex>
    )
}
