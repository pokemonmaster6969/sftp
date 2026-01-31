# Design Tokens - Modern Visual System

## Color Tokens

### Primary Gradients
```css
--gradient-primary: linear-gradient(135deg, #3b82f6 0%, #0ea5e9 100%)
--gradient-primary-light: linear-gradient(135deg, #60a5fa 0%, #38bdf8 100%)
--gradient-primary-dark: linear-gradient(135deg, #1e40af 0%, #0369a1 100%)
```

### Secondary Gradients
```css
--gradient-secondary: linear-gradient(135deg, #ef4444 0%, #f97316 100%)
--gradient-success: linear-gradient(135deg, #10b981 0%, #14b8a6 100%)
--gradient-warning: linear-gradient(135deg, #f59e0b 0%, #eab308 100%)
--gradient-danger: linear-gradient(135deg, #ef4444 0%, #dc2626 100%)
```

### Background Gradients
```css
--gradient-dark: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)
--gradient-light: linear-gradient(to bottom, rgba(255,255,255,0.95), rgba(255,255,255,0.9), rgba(248,250,252,0.8))
--gradient-subtle: linear-gradient(135deg, rgba(59,130,246,0.05) 0%, transparent 100%)
```

### Semantic Colors
```css
/* Blue */
--color-blue-50: #f0f9ff
--color-blue-100: #e0f2fe
--color-blue-500: #3b82f6
--color-blue-600: #2563eb
--color-blue-700: #1d4ed8

/* Slate */
--color-slate-50: #f8fafc
--color-slate-100: #f1f5f9
--color-slate-400: #cbd5e1
--color-slate-500: #64748b
--color-slate-900: #0f172a

/* Orange */
--color-orange-50: #fff7ed
--color-orange-600: #ea580c
--color-orange-700: #c2410c
```

---

## Shadow Elevation System

### Subtle Shadow
```css
--shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.04)
```

### Medium Shadow
```css
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08)
```

### Large Shadow
```css
--shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.12)
```

### Glow Effects
```css
--shadow-glow-blue: 0 4px 15px rgba(59, 130, 246, 0.3)
--shadow-glow-orange: 0 4px 15px rgba(239, 68, 68, 0.3)
--shadow-glow-success: 0 4px 15px rgba(16, 185, 129, 0.3)
```

---

## Border Radius System

```css
--radius-sm: 8px
--radius-md: 12px
--radius-lg: 16px
--radius-xl: 20px
--radius-2xl: 24px
--radius-full: 9999px
```

---

## Spacing System

```css
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px
--space-5: 20px
--space-6: 24px
--space-8: 32px
--space-12: 48px
```

---

## Typography Tokens

### Font Weights
```css
--font-normal: 400
--font-medium: 500
--font-semibold: 600
--font-bold: 700
--font-black: 900
```

### Font Sizes
```css
--text-xs: 12px
--text-sm: 14px
--text-base: 16px
--text-lg: 18px
--text-xl: 20px
--text-2xl: 24px
```

### Line Heights
```css
--leading-tight: 1.25
--leading-normal: 1.5
--leading-relaxed: 1.625
--leading-loose: 2
```

### Letter Spacing
```css
--tracking-tight: -0.02em
--tracking-normal: 0
--tracking-wide: 0.05em
--tracking-wider: 0.1em
--tracking-widest: 0.15em
```

---

## Animation Tokens

### Duration
```css
--duration-fast: 150ms
--duration-normal: 300ms
--duration-slow: 500ms
--duration-slower: 1000ms
```

### Easing Functions
```css
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1)
--ease-in: cubic-bezier(0.4, 0, 1, 1)
--ease-out: cubic-bezier(0, 0, 0.2, 1)
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)
```

---

## Glassmorphism Tokens

### Light Glass
```css
--glass-light: rgba(255, 255, 255, 0.7)
--glass-light-blur: blur(10px)
--glass-light-border: 1px solid rgba(255, 255, 255, 0.18)
```

### Dark Glass
```css
--glass-dark: rgba(15, 23, 42, 0.7)
--glass-dark-blur: blur(10px)
--glass-dark-border: 1px solid rgba(255, 255, 255, 0.1)
```

---

## Component-Specific Tokens

### Button Tokens
```css
/* Primary Button */
--btn-primary-bg: linear-gradient(135deg, #3b82f6 0%, #0ea5e9 100%)
--btn-primary-shadow: 0 4px 15px rgba(59, 130, 246, 0.3)
--btn-primary-height: 44px
--btn-primary-padding: 10px 16px
--btn-primary-radius: 12px

/* Secondary Button */
--btn-secondary-bg: rgba(59, 130, 246, 0.05)
--btn-secondary-border: 1px solid rgba(59, 130, 246, 0.2)
--btn-secondary-height: 40px
```

### Input Tokens
```css
--input-bg: rgba(59, 130, 246, 0.05)
--input-border: 1px solid rgba(59, 130, 246, 0.15)
--input-focus-border: 1px solid rgba(59, 130, 246, 0.4)
--input-focus-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1)
--input-height: 44px
--input-padding: 10px 16px
--input-radius: 12px
```

### Card Tokens
```css
--card-bg: linear-gradient(to bottom right, #ffffff, rgba(248, 250, 252, 0.8))
--card-border: 1px solid rgba(148, 163, 184, 0.24)
--card-shadow: 0 4px 12px rgba(0, 0, 0, 0.08)
--card-radius: 16px
--card-padding: 20px
```

---

## Responsive Breakpoints

```css
--breakpoint-xs: 0
--breakpoint-sm: 640px
--breakpoint-md: 768px
--breakpoint-lg: 1024px
--breakpoint-xl: 1280px
--breakpoint-2xl: 1536px
```

---

## Usage in Components

### CSS Variables Example:
```css
.btn-primary {
  background: var(--gradient-primary);
  box-shadow: var(--shadow-glow-blue);
  padding: var(--btn-primary-padding);
  border-radius: var(--radius-md);
  height: var(--btn-primary-height);
}
```

### Tailwind/Mantine Example:
```typescript
<Button
  styles={{
    root: {
      background: 'linear-gradient(135deg, #3b82f6 0%, #0ea5e9 100%)',
      boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)',
      height: '44px',
      borderRadius: '12px'
    }
  }}
/>
```

---

## Color Contrast Requirements

All text colors meet WCAG AA standards:
- Regular text: 4.5:1 contrast ratio
- Large text: 3:1 contrast ratio
- UI components: 3:1 contrast ratio

---

## Animation Performance

All animations:
- Use GPU-accelerated properties (transform, opacity)
- Avoid layout-triggering properties (width, height, left, top)
- Use `will-change` hints for animated elements
- Maintain 60 FPS at all times

---

## References

- Colors follow Tailwind CSS color system
- Shadows follow Apple design system elevation model
- Animations follow Material Design motion principles
- Spacing follows 4px base unit system

---

## Implementation Notes

1. **Color Management**
   - Use CSS variables for consistency
   - Update color system in one place
   - Easy dark mode implementation

2. **Shadow Elevation**
   - 3-level system (subtle, medium, large)
   - Add glow effects for interactive elements
   - Increase shadow on hover for depth

3. **Animation**
   - Keep durations 150-500ms for UI
   - Use spring easing for natural feel
   - Stagger animations to prevent jank

4. **Accessibility**
   - All gradients have adequate contrast
   - Reduced motion support required
   - Focus states must be visible
