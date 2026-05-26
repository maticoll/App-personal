---
name: Claudio Super-App
colors:
  surface: '#10131d'
  surface-dim: '#10131d'
  surface-bright: '#363944'
  surface-container-lowest: '#0b0e17'
  surface-container-low: '#181b25'
  surface-container: '#1c1f29'
  surface-container-high: '#272a34'
  surface-container-highest: '#31343f'
  on-surface: '#e0e2f0'
  on-surface-variant: '#c7c4d7'
  inverse-surface: '#e0e2f0'
  inverse-on-surface: '#2d303b'
  outline: '#908fa0'
  outline-variant: '#464554'
  surface-tint: '#c0c1ff'
  primary: '#c0c1ff'
  on-primary: '#1000a9'
  primary-container: '#8083ff'
  on-primary-container: '#0d0096'
  inverse-primary: '#494bd6'
  secondary: '#d0bcff'
  on-secondary: '#3c0091'
  secondary-container: '#571bc1'
  on-secondary-container: '#c4abff'
  tertiary: '#ffb783'
  on-tertiary: '#4f2500'
  tertiary-container: '#d97721'
  on-tertiary-container: '#452000'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#d0bcff'
  on-secondary-fixed: '#23005c'
  on-secondary-fixed-variant: '#5516be'
  tertiary-fixed: '#ffdcc5'
  tertiary-fixed-dim: '#ffb783'
  on-tertiary-fixed: '#301400'
  on-tertiary-fixed-variant: '#703700'
  background: '#10131d'
  on-background: '#e0e2f0'
  surface-variant: '#31343f'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  mono-md:
    fontFamily: Geist Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.6'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style
The design system for this personal super-app dashboard is built on the philosophy of **"Augmented Intent."** It serves as a sophisticated, high-performance cockpit for one's life, blending professional-grade utility with a calm, focused aesthetic.

The style is **Modern Minimalist with Glassmorphic accents.** It utilizes deep obsidian surfaces to reduce eye strain, paired with vibrant, neon-adjacent accents that signify high-energy data points. The interface feels expansive and breathable, using translucency to establish a sense of depth and "intelligent layering" without cluttering the user's cognitive load. It evokes a feeling of being in control, organized, and technologically empowered.

## Colors
The palette is rooted in a "Deep Space" foundation. 
- **Core Surfaces:** The background uses a near-black obsidian (#0D0F14), while primary surfaces use a slightly lifted charcoal (#1A1D27).
- **Functional Accents:** Indigo serves as the primary action color. Success and Danger states use high-vibrancy Emerald and Red respectively to ensure glanceability.
- **Module Semantic Colors:** Each life-vertical is assigned a unique hue. These should be used for iconography, progress rings, and subtle glows to allow the user to mentally categorize data instantly.

## Typography
The system uses **Geist** for its clinical precision and developer-centric clarity. 
- **Headlines:** Use tight letter-spacing and bold weights to create a strong information hierarchy.
- **Body:** Standardized at 16px for optimal legibility against dark backgrounds.
- **Mono:** A secondary monospace variant is used specifically for the NLP Command-line textareas and data timestamps to reinforce the "super-app" technical utility.
- **Mobile scaling:** Headline-lg should scale down to 24px on mobile devices to maintain layout integrity.

## Layout & Spacing
The system follows a **4px baseline grid** with a fluid 12-column system for desktop and a single-column stack for mobile.
- **Card Grid:** Modules utilize a bento-box style layout. Small modules occupy 1x1 or 2x1 units; large analytical modules occupy 2x2 or full-width spans.
- **Safe Areas:** All content must respect a 16px outer margin on mobile.
- **Rhythm:** Use "XL" spacing (40px) between major functional sections (e.g., between the Score Ring and the Module Grid) to maintain a sense of premium "breathing room."

## Elevation & Depth
Depth is created through **Stacking and Refraction** rather than traditional heavy shadows.
- **Level 0 (Background):** #0D0F14.
- **Level 1 (Cards):** #1A1D27 with a 1px border at 10% opacity white. Background blur of 12px applied to card surfaces.
- **Level 2 (Modals/Popovers):** Surface color with a subtle outer glow matching the primary accent color (Indigo) at 5% opacity.
- **Shadows:** Use extremely soft, large-radius shadows (0 20px 40px rgba(0,0,0,0.4)) to lift cards off the background.

## Shapes
The design system uses a **Rounded** language to soften the technical nature of the app.
- **Modules/Cards:** 1rem (16px) corner radius.
- **Pills/Buttons:** Fully rounded (pill-shaped) for interactive elements.
- **Selection States:** Use a 0.5rem radius for internal nested elements like segmented control items.

## Components

### Bottom Navigation Bar (iPhone Style)
A floating "Dock" component. Positioned 16px from the bottom edge. It features a high-blur glassmorphic background, 1px top-border, and haptic-responsive icons. The active state is indicated by a subtle glow underneath the icon.

### Animated SVG Score Ring
Used for health and project completion metrics. Central stroke uses the module's semantic color. The background track is a semi-transparent version of the same color. Animation should be a "draw-in" ease-out-expo over 1.2s.

### NLP Textareas (Command-line)
Minimalist input field with a `>` prompt prefix. Uses Geist Mono font. Background is a slightly darker shade than the surface color. Focused state shows a pulsing vertical cursor in Primary Indigo.

### Module Cards
Grid-based bento units. Each card includes a `label-sm` category at the top-left and an icon at the top-right. The background-blur is essential here to allow the background color to bleed through slightly.

### Garmin Sync / Pill Selectors
Standardized "Pill" shapes. Segmented controls use a sliding white/indigo indicator that moves behind the text. Sync buttons feature a rotating icon animation during the active "fetching" state.

### Kanban & Collapsible Sections
- **Kanban:** Columns are transparent with dashed borders. Cards inside follow the standard Module Card style.
- **Collapsible:** Uses a chevron-right that rotates 90deg. Header text remains `label-md` bold to distinguish from content.