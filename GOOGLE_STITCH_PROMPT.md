# Google Stitch Prompt: Minimalistic SFTP Portal Frontend

## Project Overview
Create a minimalistic, modern SFTP portal frontend using Google Stitch that provides secure file management capabilities with a clean, intuitive interface. The design should prioritize simplicity, functionality, and user experience while maintaining professional aesthetics.

## Core Requirements

### 1. **Minimalistic Design Philosophy**
- **Clean Interface**: Remove unnecessary visual clutter, focus on essential functionality
- **Monochromatic Base**: Use primarily grayscale colors with subtle blue accents
- **Generous White Space**: Ensure breathing room between elements
- **Flat Design**: Avoid excessive shadows, gradients, and decorative elements
- **Typography-First**: Use clear, readable fonts with proper hierarchy

### 2. **Google Stitch Integration**
- **Authentication**: Implement secure login/logout with session management
- **API Integration**: Connect to SFTP backend services via Google Stitch
- **Real-time Updates**: Live file operations status and progress
- **Error Handling**: Graceful error states with user-friendly messages
- **Performance**: Optimized loading and smooth interactions

### 3. **Core Features**
- **File Browser**: Navigate directories with breadcrumb navigation
- **File Operations**: Upload, download, delete, rename files/folders
- **Search**: Quick file/folder search with highlighting
- **Bulk Actions**: Select multiple items for batch operations
- **Preview**: Quick preview for common file types
- **Transfer Queue**: Visual progress for file transfers

## Design Specifications

### Color Palette (Minimalistic)
```css
/* Primary Colors */
--primary: #2563eb        /* Blue for actions/accents */
--primary-light: #dbeafe  /* Light blue for hover states */
--background: #ffffff     /* Pure white background */
--surface: #f8fafc       /* Light gray for cards */
--border: #e2e8f0        /* Subtle borders */

/* Text Colors */
--text-primary: #1e293b   /* Dark text */
--text-secondary: #64748b /* Muted text */
--text-tertiary: #94a3b8  /* Light text */

/* Status Colors */
--success: #10b981       /* Green for success */
--warning: #f59e0b       /* Orange for warnings */
--error: #ef4444         /* Red for errors */
```

### Typography System
```css
/* Font Stack */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

/* Type Scale */
--text-xs: 0.75rem    /* 12px - Labels, captions */
--text-sm: 0.875rem   /* 14px - Body text */
--text-base: 1rem     /* 16px - Default */
--text-lg: 1.125rem   /* 18px - Small headings */
--text-xl: 1.25rem    /* 20px - Headings */
--text-2xl: 1.5rem    /* 24px - Page titles */

/* Font Weights */
--font-normal: 400
--font-medium: 500
--font-semibold: 600
--font-bold: 700
```

### Spacing System
```css
/* 4px Base Unit */
--space-1: 0.25rem  /* 4px */
--space-2: 0.5rem   /* 8px */
--space-3: 0.75rem  /* 12px */
--space-4: 1rem     /* 16px */
--space-5: 1.25rem  /* 20px */
--space-6: 1.5rem   /* 24px */
--space-8: 2rem     /* 32px */
--space-12: 3rem    /* 48px */
--space-16: 4rem    /* 64px */
```

### Component Design Guidelines

#### Buttons
```css
/* Primary Button */
.btn-primary {
  background: var(--primary);
  color: white;
  padding: var(--space-3) var(--space-4);
  border-radius: 6px;
  font-weight: 500;
  border: none;
  transition: all 0.2s ease;
}

.btn-primary:hover {
  background: #1d4ed8;
  transform: translateY(-1px);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: var(--text-primary);
  padding: var(--space-3) var(--space-4);
  border-radius: 6px;
  border: 1px solid var(--border);
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  background: var(--surface);
  border-color: var(--primary);
}
```

#### Cards
```css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: var(--space-6);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.card:hover {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}
```

#### Input Fields
```css
.input {
  background: white;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-sm);
  transition: all 0.2s ease;
}

.input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}
```

## Layout Structure

### 1. **Authentication Page**
- Centered login form
- Clean input fields with floating labels
- Single primary action button
- Minimal branding

### 2. **Main Dashboard**
```
┌─────────────────────────────────────────┐
│ Header (Logo, User, Logout)            │
├─────────────────────────────────────────┤
│ Breadcrumb Navigation                  │
├─────────────────────────────────────────┤
│ Toolbar (Search, Upload, Actions)      │
├─────────────────────────────────────────┐
│                                       │
│ File Browser Grid/List                 │
│                                       │
├─────────────────────────────────────────┤
│ Status Bar (Storage, Connection)       │
└─────────────────────────────────────────┘
```

### 3. **File Browser**
- **Grid View**: Icon-based with file names
- **List View**: Detailed information in columns
- **Sort Options**: Name, Size, Modified date
- **View Toggle**: Switch between grid/list

## Interaction Patterns

### 1. **Navigation**
- **Keyboard Shortcuts**: 
  - `Ctrl+N`: New folder
  - `Ctrl+U`: Upload files
  - `Delete`: Delete selected
  - `F2`: Rename selected
- **Context Menu**: Right-click for actions
- **Drag & Drop**: File upload via drag

### 2. **Selection**
- **Single Click**: Select file/folder
- **Double Click**: Open/enter folder
- **Ctrl+Click**: Multi-select
- **Shift+Click**: Range select

### 3. **Feedback**
- **Loading States**: Skeleton screens during fetch
- **Progress Bars**: Visual transfer progress
- **Toast Notifications**: Success/error messages
- **Modal Dialogs**: Confirmations and forms

## Google Stitch Implementation

### 1. **Backend Integration**
```javascript
// Google Stitch Functions
const stitchClient = Stitch.initializeDefaultAppClient('your-app-id');

// Authentication
async function login(email, password) {
  const credential = new UserPasswordCredential(email, password);
  return await stitchClient.auth.loginWithCredential(credential);
}

// File Operations
async function listFiles(path) {
  return await stitchClient.callFunction('listFiles', [path]);
}

async function uploadFile(file, path) {
  return await stitchClient.callFunction('uploadFile', [file, path]);
}
```

### 2. **Real-time Updates**
```javascript
// Watch for file changes
const filesStream = stitchClient
  .callFunction('watchFiles', [currentPath])
  .watch()
  .next(docs => {
    updateFileList(docs);
  });
```

### 3. **Error Handling**
```javascript
try {
  const files = await listFiles(currentPath);
  setFiles(files);
} catch (error) {
  showToast(error.message, 'error');
  // Fallback to cached data if available
}
```

## Performance Considerations

### 1. **Optimization Strategies**
- **Virtual Scrolling**: For large file lists
- **Lazy Loading**: Load thumbnails on demand
- **Debounced Search**: Reduce API calls
- **Caching**: Store file metadata locally
- **Compression**: Minimize payload sizes

### 2. **Mobile Responsiveness**
- **Touch-Friendly**: 44px minimum touch targets
- **Adaptive Layout**: Stack components on small screens
- **Gesture Support**: Swipe for actions
- **Progressive Enhancement**: Core functionality first

## Accessibility Standards

### 1. **WCAG 2.1 AA Compliance**
- **Keyboard Navigation**: Full keyboard access
- **Screen Reader**: Proper ARIA labels
- **Color Contrast**: 4.5:1 minimum ratio
- **Focus Indicators**: Visible focus states
- **Reduced Motion**: Respect user preferences

### 2. **Semantic HTML**
```html
<nav aria-label="File navigation">
  <ol aria-label="Breadcrumb">
    <li><a href="/">Home</a></li>
    <li><a href="/documents">Documents</a></li>
  </ol>
</nav>

<main role="main">
  <table aria-label="File list">
    <thead>
      <tr>
        <th scope="col">Name</th>
        <th scope="col">Size</th>
        <th scope="col">Modified</th>
      </tr>
    </thead>
    <tbody>
      <!-- File rows -->
    </tbody>
  </table>
</main>
```

## Testing Strategy

### 1. **Unit Tests**
- Component rendering
- User interactions
- API integration
- Error scenarios

### 2. **Integration Tests**
- End-to-end workflows
- Cross-browser compatibility
- Performance benchmarks
- Accessibility validation

### 3. **User Testing**
- Usability studies
- A/B testing for critical flows
- Performance monitoring
- Error rate tracking

## Deployment & Monitoring

### 1. **Build Process**
- **Code Splitting**: Load chunks on demand
- **Tree Shaking**: Remove unused code
- **Asset Optimization**: Compress images, fonts
- **Bundle Analysis**: Monitor bundle size

### 2. **Monitoring**
- **Error Tracking**: Sentry or similar
- **Performance Metrics**: Core Web Vitals
- **User Analytics**: Usage patterns
- **Health Checks**: API availability

## Success Metrics

### 1. **User Experience**
- **Load Time**: < 2 seconds initial load
- **Interaction Latency**: < 100ms response
- **Error Rate**: < 1% failed operations
- **User Satisfaction**: > 4.5/5 rating

### 2. **Technical Performance**
- **Bundle Size**: < 500KB gzipped
- **Memory Usage**: < 50MB peak
- **Network Efficiency**: < 1MB per session
- **Accessibility Score**: 100% Lighthouse

This prompt provides a comprehensive foundation for building a minimalistic SFTP portal frontend using Google Stitch, focusing on clean design, optimal performance, and exceptional user experience.
