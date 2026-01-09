# UNIGENOME Logo Replacement Guide

## Current State

The application currently displays a DNA helix icon logo. You've provided the official UNIGENOME branding logo which includes:
- Orange DNA helix icon (left)
- Navy "UNIGENOME" text with orange accent letters
- "Leading Genomics Innovations" tagline

## Steps to Replace with Official Logo

### Step 1: Prepare Your Logo Image
1. Get your official UNIGENOME logo PNG file
2. Ensure the image has a **white/transparent background** (not navy)
3. Recommended size: 1920x600 pixels or larger (for Retina displays)
4. File should be named: `unigenome-logo.png`

### Step 2: Replace the Logo File
```bash
# Replace the file in the public folder
cp /path/to/your/unigenome-logo.png sftp-portal/public/unigenome-logo.png
```

### Step 3: Verify the Logo
The logo is now used in:
- **Login Page** (`src/app/page.tsx`): Full horizontal logo displayed in the navy hero section
- **Sidebar** (`src/components/Sidebar.tsx`): Scaled version in the navigation sidebar

### Step 4: Build and Test
```bash
cd sftp-portal
npm run build
npm run dev  # or npm start for production
```

## Logo Component Configuration

### Login Page (Hero Section)
```tsx
<Image
  src="/unigenome-logo.png"
  alt="UNIGENOME - Leading Genomics Innovations"
  width={320}
  height={100}
  priority
  className="object-contain h-auto w-full"
/>
```

**Display Settings:**
- Width: Responsive, max-width 320px
- Height: Auto, maintaining aspect ratio
- Priority: Loaded immediately (above-fold)
- Sizing: 320x100 ideal dimensions

### Sidebar Navigation
```tsx
<Image
  src="/unigenome-logo.png"
  alt="UNIGENOME - Leading Genomics Innovations"
  width={200}
  height={60}
  priority
  className="object-contain h-auto w-full max-w-[180px]"
/>
```

**Display Settings:**
- Width: Responsive, max-width 180px
- Height: Auto, maintaining aspect ratio
- Priority: Loaded immediately
- Sizing: 200x60 base dimensions

## Requirements for Your Logo

### Image Specifications
✓ **Format**: PNG (recommended) or WebP
✓ **Background**: White or transparent (not colored)
✓ **Aspect Ratio**: ~3:1 (width:height) for horizontal layout
✓ **Resolution**: 1920x600px or higher (for 2x displays)
✓ **File Size**: Optimized to <150 KB

### Design Requirements
✓ Include complete branding: icon + text + tagline
✓ Navy blue primary color for text
✓ Orange accent for emphasis
✓ Clear, professional appearance
✓ Legible at both large and small sizes

## Responsive Behavior

The logo automatically scales based on screen size:

### Login Page
- **Mobile**: ~90% of available width, centered
- **Tablet**: ~90% of available width
- **Desktop**: Full logo displayed prominently

### Sidebar
- **All sizes**: Scales to fit within 180px width
- **Maintains aspect ratio**: Height adjusts automatically

## Testing Checklist

After replacing the logo, verify:

- [ ] Logo displays on login page (centered in navy section)
- [ ] Logo displays in sidebar (top of navigation)
- [ ] Logo is sharp on high-DPI displays
- [ ] Logo maintains aspect ratio at all sizes
- [ ] No layout shift when logo loads
- [ ] Alt text is meaningful for screen readers
- [ ] Logo appears immediately (cached after first load)

## Image Optimization

Next.js automatically optimizes your image:
- **Format conversion**: Serves WebP to modern browsers
- **Responsive sizes**: Creates multiple scaled versions
- **Lazy loading**: Loads when needed (except `priority` images)
- **Caching**: Browser caches for fast subsequent loads

## Troubleshooting

### Logo Not Displaying
1. Verify file path: `public/unigenome-logo.png`
2. Check file size: Should be less than 200 KB
3. Verify PNG format: Use `file` command to check
4. Check Next.js build output for errors

### Logo Appears Blurry
1. Ensure source image is high resolution (1920px+ width)
2. Verify aspect ratio is correct (~3:1)
3. Clear `.next` folder and rebuild

### Logo Has Colored Background
1. Edit image to have transparent or white background
2. Use PNG with transparency if possible
3. Ensure no compression artifacts

## Performance Impact

✅ **Load Time**: Negligible (same as original)
✅ **Bundle Size**: ~100-150 KB (well optimized)
✅ **Rendering**: No impact (static image)
✅ **SEO**: Improved with descriptive alt text

## Color System Integration

Your logo uses:
- **Primary Navy**: hsl(224 64% 33%) - Matches button colors
- **Secondary Orange**: hsl(24 94% 53%) - Matches accent elements
- **White/Transparent**: Background for contrast

These colors are already defined in your design system and will look cohesive across the entire application.

## File Locations

```
sftp-portal/
├── public/
│   └── unigenome-logo.png       ← Replace this file
├── src/
│   ├── app/
│   │   └── page.tsx              ← Uses logo (login page)
│   └── components/
│       └── Sidebar.tsx           ← Uses logo (sidebar)
└── README.md
```

## Next Steps

1. ✅ Prepare your official UNIGENOME logo PNG
2. ✅ Replace `public/unigenome-logo.png` with your file
3. ✅ Run `npm run build` to verify
4. ✅ Test in browser at different screen sizes
5. ✅ Deploy to production

## Support

If you need further adjustments:
- **Logo sizing**: Modify `width` and `height` props in Image components
- **Logo positioning**: Adjust wrapper `className` values
- **Logo styling**: Update padding/margin in containing divs
- **Format support**: Any common image format works (PNG, JPG, WebP, SVG)

---

**Implementation Status**: ✅ Ready for logo replacement
**Framework**: Next.js 16 (App Router)
**Image Component**: Built-in Next.js `Image` component
**Optimization**: Automatic (AVIF, WebP conversion)
