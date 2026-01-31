import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Download, Eye, Folder, File, Activity, HardDrive, Shield } from 'lucide-react'
import { Checkbox, ActionIcon, Text, Badge } from '@mantine/core'
import { Button as MButton } from '@mantine/core'
import type { SFTPFile } from '../types'

interface FileCardProps {
  file: SFTPFile
  onClick: () => void
  onDownload: () => void
  formatBytes: (bytes: number) => string
  selected: boolean
  onSelect: () => void
}

const getFileIcon = (fileName: string, isDirectory: boolean) => {
  const size = 'w-6 h-6'
  if (isDirectory) return <Folder className={`${size} fill-current text-blue-600`} aria-hidden="true" />
  const ext = fileName.toLowerCase().split('.').pop()
  if (['fastq', 'fq', 'gz'].includes(ext || '')) return <Activity className={`${size} text-emerald-600`} aria-hidden="true" />
  if (['bam', 'sam', 'bai'].includes(ext || '')) return <HardDrive className={`${size} text-blue-600`} aria-hidden="true" />
  if (['vcf', 'bcf', 'bed'].includes(ext || '')) return <Shield className={`${size} text-purple-600`} aria-hidden="true" />
  if (['pdf', 'doc', 'docx', 'txt'].includes(ext || '')) return <File className={`${size} text-orange-600`} aria-hidden="true" />
  return <File className={`${size} text-slate-400`} aria-hidden="true" />
}

const FileCardComponent: React.FC<FileCardProps> = ({ file, onClick, onDownload, formatBytes, selected, onSelect }) => {
  const ext = useMemo(() => !file.isDirectory ? (file.name.split('.').pop() || '').toUpperCase() : 'DIR', [file])

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect()
  }

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDownload()
  }

  const handlePreviewClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onClick()
  }

  return (
    <motion.div
      layout
      variants={{
        hidden: { opacity: 0, y: 12, scale: 0.96 },
        show: { opacity: 1, y: 0, scale: 1 }
      }}
      whileHover={{
        y: -6,
        transition: { duration: 0.2, ease: "easeOut" }
      }}
      whileTap={{ scale: 0.98 }}
      className={`
        group relative flex flex-col h-full min-h-[200px]
        bg-gradient-to-br from-white via-white to-slate-50/80
        border transition-all duration-300 backdrop-blur-xl
        rounded-2xl overflow-hidden cursor-pointer
        ${selected
          ? 'ring-2 ring-blue-500 border-blue-400 shadow-2xl shadow-blue-500/20'
          : 'border-slate-200/60 hover:border-blue-300/80 hover:shadow-2xl hover:shadow-blue-400/15'
        }
      `}
      onClick={onClick}
    >
      {/* Animated background gradient */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/40 via-transparent to-purple-50/40" />
      </div>

      {/* Header / Selection Area */}
      <div className="relative p-5 flex-1 flex flex-col z-10">
        <div className="flex items-start justify-between mb-5">
          <div className={`
            p-3 rounded-2xl shadow-lg transition-all duration-300 group-hover:scale-125 group-hover:shadow-xl
            ${file.isDirectory
              ? 'bg-gradient-to-br from-amber-100 to-orange-100 text-amber-700'
              : 'bg-gradient-to-br from-blue-100 to-cyan-100 text-blue-700'
            }
          `}>
            {getFileIcon(file.name, file.isDirectory)}
          </div>

          <motion.div
            initial={false}
            animate={{ scale: selected ? 1.1 : 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          >
            <Checkbox
              size="sm"
              checked={!!selected}
              onChange={(e) => {
                e.stopPropagation()
                onSelect()
              }}
              onClick={handleCheckboxClick}
              className={`transition-all duration-200 ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
              styles={{
                input: { 
                  cursor: 'pointer',
                  borderRadius: '6px',
                  transition: 'all 0.2s ease'
                }
              }}
            />
          </motion.div>
        </div>

        {/* File Info */}
        <div className="space-y-2.5 flex-1">
          <Text
            className="text-sm font-bold text-slate-900 leading-tight line-clamp-2 group-hover:text-blue-700 transition-colors duration-200"
            title={file.name}
          >
            {file.name}
          </Text>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="light"
              color={file.isDirectory ? "orange" : "blue"}
              className="text-xs font-bold uppercase tracking-wide px-2.5 py-0.5"
            >
              {ext}
            </Badge>
            <span className="text-[11px] font-semibold text-slate-500 group-hover:text-slate-700 transition-colors">
              {file.isDirectory ? 'Folder' : formatBytes(file.size || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="relative h-px bg-gradient-to-r from-transparent via-slate-200/50 to-transparent" />

      {/* Footer Actions */}
      <div className="relative px-4 py-3.5 bg-gradient-to-t from-slate-50/80 to-slate-50/40 group-hover:from-slate-50/100 group-hover:to-slate-50/60 transition-all duration-300 backdrop-blur-sm flex items-center gap-2 z-10">
        <motion.div
          className="flex-1"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.02 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
          <MButton
            fullWidth
            size="compact-xs"
            radius="md"
            color="blue"
            variant="gradient"
            onClick={handleDownloadClick}
            leftSection={<Download size={14} />}
            className="opacity-0 group-hover:opacity-100 transition-all duration-300 font-semibold"
            styles={{
              root: {
                background: 'linear-gradient(135deg, #3b82f6 0%, #0ea5e9 100%)',
                boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)',
                '&:hover': {
                  boxShadow: '0 8px 20px rgba(59, 130, 246, 0.4)'
                }
              }
            }}
          >
            Download
          </MButton>
        </motion.div>

        {!file.isDirectory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <ActionIcon
              variant="light"
              color="blue"
              size="sm"
              radius="md"
              className="opacity-0 group-hover:opacity-100 transition-opacity group-hover:scale-110"
              onClick={handlePreviewClick}
              styles={{
                root: {
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  color: '#3b82f6',
                  '&:hover': {
                    backgroundColor: 'rgba(59, 130, 246, 0.2)'
                  }
                }
              }}
            >
              <Eye size={16} />
            </ActionIcon>
          </motion.div>
        )}
      </div>

      {/* Selection Overlay Gradient */}
      {selected && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        />
      )}
    </motion.div>
  )
}

// Memoize with proper prop comparison
export const FileCard = React.memo(FileCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.file.path === nextProps.file.path &&
    prevProps.selected === nextProps.selected &&
    prevProps.onClick === nextProps.onClick &&
    prevProps.onDownload === nextProps.onDownload &&
    prevProps.onSelect === nextProps.onSelect &&
    prevProps.formatBytes === nextProps.formatBytes
  )
})

FileCard.displayName = 'FileCard'
