# Integration Guide - Performance Optimizations

## Overview
This guide shows how to integrate the new optimized components into your existing Dashboard.tsx.

## Step 1: Import New Components and Hooks

Update the imports in `Dashboard.tsx`:

```typescript
// Add these new imports
import { DashboardHeader } from './DashboardHeader'
import { DashboardSidebar } from './DashboardSidebar'
import { FileCard } from './FileCard'
import { FileGridSkeleton } from './FileGridSkeleton'
import { useDebounce, useFileGrid } from '../hooks'

// Keep existing imports
import { AppShell, Drawer, ... } from '@mantine/core'
// ... rest of existing imports
```

## Step 2: Update Header Rendering

**Find this section in Dashboard.tsx:**
```typescript
<AppShell.Header>
  <Group h="100%" px={{ base: 12, sm: 16 }} justify="space-between" wrap="nowrap" gap="xs">
    {/* ... header content ... */}
  </Group>
</AppShell.Header>
```

**Replace with:**
```typescript
<DashboardHeader
  view={view}
  session={session}
  search={search}
  onSearchChange={setSearch}
  onTabChange={(tab) => {
    if (tab === 'dashboard') goToDashboard()
    else if (tab === 'projects') goToProjects()
    else if (tab === 'files') goToFiles()
    else if (tab === 'transfer') goToTransferQueue()
    else if (tab === 'settings') goToSettings()
    else if (tab === 'audit') goToAudit()
  }}
  onLogout={onLogout}
  tasksCount={tasks.filter(t => t.status === 'downloading').length}
  isAdmin={session.isAdmin}
/>
```

## Step 3: Update Sidebar Rendering

**Find this section:**
```typescript
<AppShell.Navbar p="lg" style={{ borderRight: '1px solid var(--mantine-color-slate-100)' }}>
  <Stack gap="xs">
    {/* ... sidebar content ... */}
  </Stack>
</AppShell.Navbar>
```

**Replace with:**
```typescript
<AppShell.Navbar p="lg" style={{ borderRight: '1px solid var(--mantine-color-slate-100)' }}>
  <DashboardSidebar
    view={view}
    isAdmin={session.isAdmin}
    opened={navOpened}
    onClose={() => setNavOpened(false)}
    onNavigate={(navView) => {
      if (navView === 'dashboard') goToDashboard()
      else if (navView === 'overview') goToProjects()
      else if (navView === 'files') goToFiles()
      else if (navView === 'downloads') goToTransferQueue()
      else if (navView === 'settings') goToSettings()
      else if (navView === 'audit') goToAudit()
    }}
  />
</AppShell.Navbar>
```

## Step 4: Update File Grid Rendering

**Find this section (in the files view):**
```typescript
{loading ? (
  <FileGridSkeleton />
) : (
  <motion.div
    variants={{...}}
    className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6 pb-20"
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
)}
```

**Confirm it's using the new FileCard component** (should be automatic after import)

## Step 5: Optimize Search with useDebounce

**Find this line:**
```typescript
const debouncedSearch = useDebouncedValue(search, 200)
```

**Replace with:**
```typescript
const debouncedSearch = useDebounce(search, 200)
```

## Step 6: Add Animation CSS

Update your main CSS file (`index.css` or `App.css`):

```css
@import './styles/animations.css';
```

## Step 7: Optional - Use useFileGrid Hook

For even better organization, you can use the `useFileGrid` hook:

```typescript
// Inside your component
const { filteredFiles, stats } = useFileGrid({ 
  files, 
  search: debouncedSearch 
})

// Then use filteredFiles instead of manual filtering
```

## Step 8: Verify the Integration

After making changes, test:

1. **Tab Navigation**
   - Switch between Dashboard, Projects, Files, etc.
   - Should feel snappier (100-150ms instead of 500-800ms)

2. **File Grid**
   - Scroll file list
   - Should be smooth 55-60 FPS

3. **Search**
   - Type in search box
   - Should filter without lag

4. **Animations**
   - File cards should slide up smoothly
   - No stuttering when multiple items animate

## Performance Verification

Use Chrome DevTools to verify improvements:

### Method 1: Performance Timeline
1. Open DevTools → Performance
2. Click Record
3. Perform action (e.g., type in search)
4. Click Stop
5. Look at FPS graph - should show 55-60 FPS

### Method 2: React DevTools Profiler
1. Open React DevTools → Profiler
2. Click Record
3. Perform action
4. Stop recording
5. Verify DashboardHeader only renders once per view change
6. Verify FileCard only renders when its file changes

## Troubleshooting

### Components not rendering?
- Check file paths in imports
- Verify TypeScript types match
- Check console for error messages

### Still slow?
- Make sure you're using `useDebounce` (not the old `useDebouncedValue`)
- Verify CSS animations are imported
- Check that FileCard is memoized

### Memory issues?
- Use Chrome Memory profiler
- Look for detached DOM nodes
- Check refs are properly cleaned up

## File Changes Summary

| File | Change | Type |
|------|--------|------|
| `Dashboard.tsx` | Import new components | Update |
| `index.css` | Import animations.css | Update |
| `DashboardHeader.tsx` | New file | Create |
| `DashboardSidebar.tsx` | New file | Create |
| `FileCard.tsx` | New file | Create |
| `FileGridSkeleton.tsx` | New file | Create |
| `useDebounce.ts` | New file | Create |
| `useFileGrid.ts` | New file | Create |
| `useOptimizedCallback.ts` | New file | Create |
| `useVirtualizedList.ts` | New file | Create |
| `animations.css` | New file | Create |
| `vite.config.ts` | Build optimization | Update |

## Rollback Plan

If you need to revert:

1. **Remove imports** of new components
2. **Restore original Dashboard structure** from git
3. **Delete new files** (or keep for reference)
4. **Remove animations.css** import

Most files are additive, so removal is safe.

## Next Steps

After integration:
1. Run performance tests
2. Monitor with DevTools
3. Gather metrics for before/after
4. Consider implementing virtual scrolling for large lists
5. Add monitoring with Sentry/LogRocket

## Support

For detailed information on each optimization, refer to:
- `PERFORMANCE_OPTIMIZATION_GUIDE.md` - Technical details
- `OPTIMIZATION_SUMMARY.md` - High-level overview
- Individual component files - JSDoc comments
