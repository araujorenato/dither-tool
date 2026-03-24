# Dither Studio

A minimal, client-side web tool for applying dithering effects to images with real-time preview.

## Features

- **Upload** images via drag-and-drop or file picker (PNG, JPG, WEBP)
- **Adjust** contrast, highlights, shadows, gamma, and grain
- **Apply** Floyd-Steinberg, Bayer, or Stucki dithering algorithms
- **Preview** changes in real-time on canvas
- **Export** the result as PNG
- **100% client-side** — no data leaves your browser

## Stack

- React 19 + TypeScript
- Vite 6
- Tailwind CSS 4
- shadcn/ui components
- Canvas API for image processing
- Lucide React for icons

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Toggle original / edited |
| `1` `2` `3` | Select algorithm (Floyd-Steinberg, Bayer, Stucki) |
| `R` | Reset all parameters |
| `Ctrl+S` / `⌘S` | Export PNG |

## Project Structure

```
src/
├── components/
│   ├── ui/              # shadcn/ui components (Button, Slider, Input, Card, Tooltip)
│   ├── algorithm-card.tsx
│   ├── canvas-size.tsx
│   ├── export-success.tsx
│   ├── header.tsx
│   ├── preview-canvas.tsx
│   ├── sidebar.tsx
│   ├── slider-control.tsx
│   └── upload-screen.tsx
├── hooks/
│   └── use-dither-worker.ts
├── lib/
│   ├── image-processing.ts   # Core algorithms (adjustments + dithering)
│   ├── types.ts               # Shared types and constants
│   └── utils.ts               # cn() utility
├── workers/
│   └── dither.worker.ts       # Web Worker for offloading processing
├── App.tsx                    # Main application
├── main.tsx                   # Entry point
└── index.css                  # Global styles + Tailwind theme
```

## License

MIT
