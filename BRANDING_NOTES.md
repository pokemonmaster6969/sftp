# UNIGENOME Branding Implementation

## Overview
Professional branding integration for the SFTP Portal with custom DNA helix logo and cohesive visual identity.

## Branding Elements

### Logo Component (`src/components/UnigenomeLogo.tsx`)
- **SVG-based DNA helix icon** in brand orange (#F97316)
- **Responsive sizing**: `sm` (24px), `md` (32px), `lg` (48px)
- **Flexible variants**:
  - `full`: Logo with text (default)
  - `icon-only`: Just the DNA helix
  - `text-only`: Just the UNIGENOME text
- **Optional tagline**: "Leading Genomics Innovations"
- **Branded text**: "UNIGENOME" with orange "G" accent

### Design Features
- **DNA Helix**: Orange curved strands with base pair connectors
- **Typography**: Navy primary text with orange secondary accent
- **Responsive**: Scales smoothly across all device sizes
- **Accessible**: Proper SVG structure with semantic HTML

## Implementation

### Files Modified
1. **`src/components/UnigenomeLogo.tsx`** (NEW)
   - Reusable branding component
   - Fully customizable sizing and variants
   - SVG-based for crisp rendering at any size

2. **`src/components/Sidebar.tsx`**
   - Integrated `UnigenomeLogo` component (md size)
   - Cleaner header with professional branding
   - Removed redundant text styling

3. **`src/app/page.tsx`**
   - Integrated `UnigenomeLogo` component (lg size with tagline)
   - Professional brand presence on login page
   - Consistent visual hierarchy

## Color System
- **Primary Navy**: hsl(224 64% 33%) - UNIGENOME text
- **Secondary Orange**: hsl(24 94% 53%) - Accent "G" and DNA helix
- **Contrast**: Meets WCAG AA accessibility standards

## Logo Specifications

### DNA Helix Element
- **Strokes**: Curved double helix with base pair connections
- **Circles**: 5 base pairs per strand for visual accuracy
- **Color**: Vibrant orange (#F97316)
- **Weight**: 2.5px strokes for crisp rendering

### Typography
- **Font**: Inter (system font stack fallback)
- **Format**: "UNI**G**ENOME" with orange G accent
- **Tagline**: "Leading Genomics Innovations" (optional)
- **Weight**: Bold (700) for logo text

## Usage Examples

```tsx
// Full logo with tagline (login page)
<UnigenomeLogo size="lg" variant="full" showTagline={true} />

// Logo in sidebar
<UnigenomeLogo size="md" variant="full" showTagline={false} />

// Icon only (for favicons, etc.)
<UnigenomeLogo size="sm" variant="icon-only" />

// Text only
<UnigenomeLogo size="md" variant="text-only" />
```

## Responsive Behavior
- **Mobile**: Logo adapts to smaller screens with md sizing
- **Tablet**: Standard md sizing
- **Desktop**: Full lg sizing with tagline in hero sections
- **Icon-only**: Can be used in tight spaces (headers, tabs)

## Accessibility
- ✅ Proper SVG markup
- ✅ Text contrast meets WCAG AA
- ✅ Semantic HTML structure
- ✅ Works with screen readers (text fallbacks)
- ✅ No decorative-only elements

## Future Enhancements
- [ ] Add SVG animation (DNA helix rotation on hover)
- [ ] Create branded favicon variant
- [ ] Implement dark mode logo variant
- [ ] Add logo guidelines document
- [ ] Export as SVG asset file for external use

## Brand Voice
The UNIGENOME logo represents:
- **Innovation**: DNA helix symbolizes genetic research
- **Professionalism**: Navy blue conveys trust and expertise
- **Energy**: Vibrant orange represents growth and dynamism
- **Precision**: Clean, modern design reflects scientific accuracy
