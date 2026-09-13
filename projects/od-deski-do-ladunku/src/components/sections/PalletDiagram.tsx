type Props = {
  /** Relative widths of the deck boards, top view, front to back. */
  boards: number[];
  /** Dashed outline = a layout agreed per order rather than a catalogue item. */
  dashed?: boolean;
  /** Draw loose parts instead of an assembled deck. */
  loose?: boolean;
};

const W = 74;
const H = 50;
const PAD = 3;

/**
 * A drawn top view of the deck, generated from the board list rather than an image file: each
 * product card gets a diagram that actually differs, at a few hundred bytes and no HTTP request.
 */
export function PalletDiagram({ boards, dashed, loose }: Props): JSX.Element {
  const inner = H - PAD * 2;
  const total = boards.reduce((sum, value) => sum + value, 0);
  const gap = boards.length > 1 ? Math.min(3, (inner * 0.22) / (boards.length - 1)) : 0;
  const usable = inner - gap * (boards.length - 1);

  let cursor = PAD;
  const rects = boards.map((value, index) => {
    const height = (value / total) * usable;
    const y = cursor;
    cursor += height + gap;
    return <rect key={index} x={loose ? PAD + index * 2 : PAD} y={y} width={W - PAD * 2 - (loose ? index * 4 : 0)} height={height} rx="0.6" />;
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-hidden="true" focusable="false">
      <rect
        x="0.6"
        y="0.6"
        width={W - 1.2}
        height={H - 1.2}
        fill="none"
        stroke="currentColor"
        strokeOpacity={dashed ? 0.5 : 0.25}
        strokeDasharray={dashed ? '3 2.5' : undefined}
      />
      <g fill="currentColor" fillOpacity="0.62">{rects}</g>
      {!loose && (
        <g fill="currentColor" fillOpacity="0.9">
          {[PAD + 2, W / 2 - 2.5, W - PAD - 7].map((x) => (
            <rect key={x} x={x} y={H / 2 - 2.5} width="5" height="5" rx="0.6" />
          ))}
        </g>
      )}
    </svg>
  );
}
