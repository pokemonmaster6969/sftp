import React from 'react'
import { Stack, Button as MButton, Text } from '@mantine/core'
import { Activity, Folder, File, Download, Settings, ClipboardList } from 'lucide-react'
import { motion } from 'framer-motion'

interface DashboardSidebarProps {
  view: 'overview' | 'dashboard' | 'files' | 'downloads' | 'audit' | 'report' | 'settings' | 'mock'
  isAdmin: boolean
  opened: boolean
  onClose: () => void
  onNavigate: (view: string) => void
}

const navItems = [
  { id: 'dashboard', label: 'Operational Intel', icon: Activity },
  { id: 'overview', label: 'Project Explorer', icon: Folder },
  { id: 'files', label: 'Core Repository', icon: File },
  { id: 'downloads', label: 'Transfer Center', icon: Download },
  { id: 'settings', label: 'Config Space', icon: Settings },
]

export const DashboardSidebar: React.FC<DashboardSidebarProps> = React.memo(({
  view,
  isAdmin,
  opened,
  onClose,
  onNavigate
}) => {
  const handleNavigate = (navView: string) => {
    onNavigate(navView)
    onClose()
  }

  return (
    <Stack gap="2px" p="lg" style={{ minHeight: '100%' }}>
      <div style={{ marginBottom: '16px' }}>
        <Text 
          size="10px" 
          fw={900} 
          c="slate.500" 
          tt="uppercase" 
          lts={2}
          style={{ 
            background: 'linear-gradient(90deg, #475569 0%, #64748b 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '1px'
          }}
        >
          Infrastructure Gateway
        </Text>
      </div>
      {navItems.map((item, idx) => (
        <MButton
          key={item.id}
          variant={view === item.id ? 'filled' : 'subtle'}
          color="blue"
          radius="12px"
          justify="flex-start"
          leftSection={<item.icon size={20} />}
          onClick={() => handleNavigate(item.id)}
          styles={{
            root: {
              padding: '12px 16px',
              height: '48px',
              fontWeight: 600,
              fontSize: '14px',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              overflow: 'hidden'
            },
            inner: {
              gap: '12px'
            },
            section: {
              transition: 'all 0.3s ease'
            }
          }}
          className={`
            group relative
            ${view === item.id 
              ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/30' 
              : 'bg-slate-50/50 text-slate-700 hover:bg-slate-100/80'
            }
            before:absolute before:inset-0 before:opacity-0 before:bg-gradient-to-r before:from-blue-500/20 before:to-cyan-500/20 before:transition-opacity before:duration-300 before:group-hover:opacity-100
          `}
        >
          <span style={{ position: 'relative', zIndex: 1 }}>
            {item.label}
          </span>
          {view === item.id && (
            <motion.div
              layoutId="activeNav"
              className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-600 -z-10 rounded-xl"
              transition={{ type: 'spring', stiffness: 380, damping: 40 }}
            />
          )}
        </MButton>
      ))}
      {isAdmin && (
        <div style={{ marginTop: 'auto' }}>
          <MButton
            variant={view === 'audit' ? 'filled' : 'subtle'}
            color="orange"
            radius="12px"
            justify="flex-start"
            leftSection={<ClipboardList size={20} />}
            onClick={() => handleNavigate('audit')}
            styles={{
              root: {
                padding: '12px 16px',
                height: '48px',
                fontWeight: 600,
                fontSize: '14px',
                transition: 'all 0.3s ease'
              }
            }}
            className={view === 'audit' 
              ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-lg shadow-orange-500/30' 
              : 'bg-orange-50/50 text-orange-700 hover:bg-orange-100/80'
            }
          >
            Audit Ledger
          </MButton>
        </div>
      )}
    </Stack>
  )
}, (prevProps, nextProps) => {
  return (
    prevProps.view === nextProps.view &&
    prevProps.isAdmin === nextProps.isAdmin &&
    prevProps.opened === nextProps.opened
  )
})

DashboardSidebar.displayName = 'DashboardSidebar'
