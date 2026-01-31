import React from 'react'
import { Box, Stack, Text, Button, Center } from '@mantine/core'
import { motion } from 'framer-motion'
import { Database, Search, FolderOpen } from 'lucide-react'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
  type?: 'search' | 'empty' | 'error'
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  type = 'empty'
}) => {
  const defaultIcons = {
    search: <Search size={48} />,
    empty: <Database size={48} />,
    error: <FolderOpen size={48} />
  }

  const iconColor = {
    search: 'text-slate-300',
    empty: 'text-slate-300',
    error: 'text-red-300'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{ width: '100%' }}
    >
      <Center style={{ minHeight: '400px' }}>
        <Stack
          gap={24}
          align="center"
          style={{
            textAlign: 'center',
            maxWidth: '480px',
            padding: '48px 24px'
          }}
        >
          {/* Animated Icon */}
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
            style={{
              willChange: 'transform'
            }}
          >
            <Box
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '120px',
                height: '120px',
                borderRadius: '24px',
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(14, 165, 233, 0.1) 100%)',
                border: '2px solid rgba(59, 130, 246, 0.2)',
                color: 'rgba(59, 130, 246, 0.8)',
                backdropFilter: 'blur(10px)',
              }}
            >
              {icon || defaultIcons[type]}
            </Box>
          </motion.div>

          {/* Content */}
          <Stack gap={8}>
            <Text
              size="24px"
              fw={900}
              style={{
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.5px'
              }}
            >
              {title}
            </Text>
            <Text size="14px" c="slate.500" lh={1.6}>
              {description}
            </Text>
          </Stack>

          {/* Action Button */}
          {action && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.3 }}
              style={{ width: '100%' }}
            >
              <Button
                onClick={action.onClick}
                size="md"
                radius="12px"
                fullWidth
                styles={{
                  root: {
                    background: 'linear-gradient(135deg, #3b82f6 0%, #0ea5e9 100%)',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '14px',
                    height: '48px',
                    boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 25px rgba(59, 130, 246, 0.4)'
                    }
                  }
                }}
              >
                {action.label}
              </Button>
            </motion.div>
          )}
        </Stack>
      </Center>
    </motion.div>
  )
}
