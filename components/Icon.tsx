import type { CSSProperties } from "react";
const paths = {
  arrow: "M5 12h14m-6-6 6 6-6 6",
  northeast: "M6 18 18 6M6 6h12v12",
  check: "m5 12 4 4L19 6",
  plus: "M12 5v14M5 12h14",
  close: "m6 6 12 12M6 18 18 6",
  box: "m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 5 9-5M12 12v9m-4.5-16 9 4.5",
  shield: "m12 3 8 3v6c0 4-5 8-8 10-3-2-8-6-8-10V6l8-3Zm-4 9 3 3 5-6",
  wave: "M3 10v4m4-7v10m5-14v18m5-14v10m4-7v4",
  mic: "M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5Zm-3 6v1a6 6 0 0 0 12 0v-1m-6 7v4m-4 0h8",
  attach: "m8 13 7-7a3 3 0 0 1 4 4L9 20a5 5 0 0 1-7-7L13 2",
  image: "M3 3h18v18H3V3Zm0 13 6-6 5 5 3-3 4 4M15 7h.01",
  play: "m9 5 11 7-11 7V5Z",
  stop: "M6 6h12v12H6V6Z",
  chevron: "m9 5 7 7-7 7",
  down: "m6 9 6 6 6-6",
  refresh: "M20 7a8 8 0 1 0 0 10m0-10h-5m5 0V2",
  clock: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 4v5l3 2",
  code: "m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18",
  truck:
    "M3 6h11v11H3V6Zm11 4h4l3 4v3h-7m-6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z",
  wallet: "M3 6h17v14H3V6Zm0 0 14-3v3m3 5h-6v5h6m-3-2.5h.01",
  search: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 6 6",
  filter: "M4 6h16M7 12h10m-7 6h4",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  undo: "M8 4 3 9l5 5M3 9h10a7 7 0 0 1 0 14",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  menu: "M4 7h16M4 12h16M4 17h16",
  grid: "M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z",
  document: "M5 3h10l4 4v14H5V3Zm10 0v5h4M8 12h8m-8 4h6",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 7v7m0-10h.01",
  external: "M14 3h7v7m0-7L11 13M9 5H3v16h16v-6",
  sparkle: "m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z",
  dots: "M5 12h.01M12 12h.01M19 12h.01",
} as const;
export type IconName = keyof typeof paths;
export function Icon({
  name,
  size = 20,
  className = "",
  style,
}: {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={style}
    >
      <path d={paths[name]} />
    </svg>
  );
}
