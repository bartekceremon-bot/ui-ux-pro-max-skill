/**
 * The wordmark's glyph: three sawn boards seen at the same isometric angle the rest of the site
 * draws in, so the logo, the mobile art and the 3D scene all read as one drawing system.
 * Drawn bottom board first, so the stack paints back to front without a z-buffer.
 */
const BOARDS = [
  { y: 18, inset: 0, top: '#b8834a' },
  { y: 12.6, inset: 1.6, top: '#cf9d61' },
  { y: 7.2, inset: 3.2, top: '#e5c191' },
];

export function LogoMark(): JSX.Element {
  return (
    <svg viewBox="0 0 40 30" width="34" height="26" aria-hidden="true" focusable="false">
      {BOARDS.map(({ y, inset, top }) => {
        const left = 2 + inset;
        const right = 38 - inset;
        return (
          <g key={y}>
            <path d={`M${left} ${y} L20 ${y - 5.4} L${right} ${y} L20 ${y + 5.4} Z`} fill={top} />
            <path d={`M${left} ${y} L20 ${y + 5.4} L20 ${y + 7.8} L${left} ${y + 2.4} Z`} fill="#8a6234" />
            <path d={`M${right} ${y} L20 ${y + 5.4} L20 ${y + 7.8} L${right} ${y + 2.4} Z`} fill="#6b4a26" />
          </g>
        );
      })}
    </svg>
  );
}
