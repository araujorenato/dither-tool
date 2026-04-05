/// <reference types="vite/client" />

declare module "gifenc" {
  export function GIFEncoder(): {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: {
        palette?: [number, number, number][];
        delay?: number;
        repeat?: number;
        transparent?: boolean;
        transparentIndex?: number;
        colorDepth?: number;
        first?: boolean;
        dispose?: number;
      }
    ): void;
    finish(): void;
    bytesView(): Uint8Array;
    bytes(): Uint8Array;
  };
  export function quantize(
    rgba: Uint8Array,
    maxColors: number,
    options?: { format?: string; oneBitAlpha?: boolean }
  ): [number, number, number][];
  export function applyPalette(
    rgba: Uint8Array,
    palette: [number, number, number][],
    format?: string
  ): Uint8Array;
}
