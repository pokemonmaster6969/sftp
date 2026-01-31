import React, { useMemo } from 'react'
import { Tabs, Group, Box, Text, ActionIcon, TextInput, Badge } from '@mantine/core'
import { Activity, Folder, File, Download, Settings, ClipboardList, LogOut, Search } from 'lucide-react'

interface DashboardHeaderProps {
  view: 'overview' | 'dashboard' | 'files' | 'downloads' | 'audit' | 'report' | 'settings' | 'mock'
  session: { username: string; server: string }
  search: string
  onSearchChange: (value: string) => void
  onTabChange: (tab: string) => void
  onLogout: () => void
  tasksCount?: number
  isAdmin?: boolean
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = React.memo(({
  view,
  session,
  search,
  onSearchChange,
  onTabChange,
  onLogout,
  tasksCount = 0,
  isAdmin = false
}) => {
  const tabValue = useMemo(() => view === 'report' ? 'projects' : view, [view])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.currentTarget.value)
  }

  return (
    <Box 
      component="header" 
      className="border-b border-slate-200/40 bg-gradient-to-b from-white/95 via-white/90 to-slate-50/80 backdrop-blur-xl sticky top-0 z-40 shadow-lg shadow-slate-900/5"
      style={{ borderImage: 'linear-gradient(90deg, transparent, rgba(226,232,240,0.5), transparent) 1' }}
    >
      <Group h="100%" px={{ base: 12, sm: 16 }} justify="space-between" wrap="nowrap" gap="xs">
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
          <Box className="hidden xs:flex" style={{
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px 16px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #eff6ff 0%, #e0f2fe 100%)',
            boxShadow: '0 4px 15px rgba(59, 130, 246, 0.15), inset 0 1px 0 rgba(255,255,255,0.8)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            backdropFilter: 'blur(10px)',
          }}>
            <Activity size={24} className="text-blue-600" aria-hidden="true" style={{ filter: 'drop-shadow(0 2px 4px rgba(59, 130, 246, 0.2))' }} />
          </Box>
          <Box style={{ minWidth: 0 }}>
            <Text size="sm" fw={900} c="slate.900" style={{ letterSpacing: -0.3, background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              GENOMICS SFTP
            </Text>
            <Text size="10px" fw={700} c="slate.500" tt="uppercase" lts={1.2} className="hidden sm:block" style={{ letterSpacing: '0.5px' }}>
              {session.username} <span className="text-slate-400">/</span> {session.server}
            </Text>
          </Box>
        </Group>

        <Tabs
          value={tabValue}
          onChange={(val) => val && onTabChange(val)}
          variant="default"
          visibleFrom="sm"
          styles={{
            root: { gap: 0 },
            list: { 
              borderBottomColor: 'transparent',
              gap: '4px',
              padding: '4px 8px',
              backgroundColor: 'rgba(59, 130, 246, 0.05)',
              borderRadius: '12px',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(59, 130, 246, 0.1)'
            },
            tab: {
              borderRadius: '8px',
              color: 'var(--mantine-color-slate-600)',
              fontWeight: 600,
              fontSize: '13px',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&[data-active]': {
                background: 'linear-gradient(135deg, #3b82f6 0%, #0ea5e9 100%)',
                color: 'white',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
              },
              '&:hover:not([data-active])': {
                backgroundColor: 'rgba(59, 130, 246, 0.08)'
              }
            }
          }}
        >
          <Tabs.List>
            <Tabs.Tab value="dashboard">Dashboard</Tabs.Tab>
            <Tabs.Tab value="projects">Projects</Tabs.Tab>
            <Tabs.Tab value="files">Files</Tabs.Tab>
            <Tabs.Tab value="transfer" style={{ position: 'relative' }}>
              Transfer
              {tasksCount > 0 && (
                <Badge size="xs" ml="xs" variant="filled" color="blue" style={{
                  background: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)'
                }}>
                  {tasksCount}
                </Badge>
              )}
            </Tabs.Tab>
            <Tabs.Tab value="settings">Settings</Tabs.Tab>
            {isAdmin && <Tabs.Tab value="audit">Audit</Tabs.Tab>}
          </Tabs.List>
        </Tabs>

        <Group gap="xs" wrap="nowrap">
          <Group gap="sm" wrap="nowrap" visibleFrom="lg" mr="xs">
            <TextInput
              placeholder="Search files..."
              leftSection={<Search size={16} className="text-slate-400" />}
              size="sm"
              radius="12px"
              value={search}
              onChange={handleSearchChange}
              w={240}
              styles={{
                input: { 
                  backgroundColor: 'rgba(59, 130, 246, 0.05)',
                  border: '1px solid rgba(59, 130, 246, 0.15)',
                  backdropFilter: 'blur(10px)',
                  transition: 'all 0.3s ease',
                  fontWeight: 500,
                  '&:focus': {
                    backgroundColor: 'rgba(59, 130, 246, 0.08)',
                    borderColor: 'rgba(59, 130, 246, 0.4)',
                    boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)'
                  },
                  '&::placeholder': {
                    color: 'var(--mantine-color-slate-400)'
                  }
                }
              }}
            />
          </Group>

          <ActionIcon
            onClick={onLogout}
            variant="light"
            size="md"
            radius="10px"
            title="Logout"
            styles={{
              root: {
                backgroundColor: 'rgba(100, 116, 139, 0.08)',
                color: 'var(--mantine-color-slate-700)',
                border: '1px solid rgba(100, 116, 139, 0.15)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  color: 'rgba(239, 68, 68, 0.8)',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  transform: 'scale(1.05)'
                }
              }
            }}
          >
            <LogOut size={18} aria-hidden="true" />
          </ActionIcon>
        </Group>
      </Group>
    </Box>
  )
}, (prevProps, nextProps) => {
  return (
    prevProps.view === nextProps.view &&
    prevProps.search === nextProps.search &&
    prevProps.session.username === nextProps.session.username &&
    prevProps.session.server === nextProps.session.server &&
    prevProps.tasksCount === nextProps.tasksCount &&
    prevProps.isAdmin === nextProps.isAdmin
  )
})

DashboardHeader.displayName = 'DashboardHeader'
