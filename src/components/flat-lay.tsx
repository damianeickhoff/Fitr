import { imageUrl } from "@/lib/storage-url";
import { cx, pill } from "./ui";

export type FlatLayPiece = {
  id: string;
  name: string;
  category: string;
  /** The transparent cut-out when there is one, else the framed listing. */
  imagePath: string;
  cutout: boolean;
  suggested?: boolean;
};

type Slot = { left: number; top: number; width: number; rotate: number };

/**
 * Where each kind of piece lies on the table, as percentages of a 4:5 frame:
 * tops and jackets across the top, trousers down the middle, shoes and bags
 * at the corners. A second piece of a kind takes its second slot; anything
 * beyond that goes to the spare corners.
 */
const SLOTS: Record<string, Slot[]> = {
  outerwear: [{ left: 50, top: 3, width: 46, rotate: 4 }, { left: 4, top: 3, width: 42, rotate: -4 }],
  top: [{ left: 4, top: 3, width: 42, rotate: -4 }, { left: 52, top: 6, width: 40, rotate: 4 }],
  dress: [{ left: 6, top: 3, width: 40, rotate: -2 }, { left: 52, top: 3, width: 40, rotate: 3 }],
  bottom: [{ left: 34, top: 40, width: 30, rotate: 0 }, { left: 6, top: 46, width: 28, rotate: -3 }],
  shoes: [{ left: 66, top: 63, width: 27, rotate: 0 }, { left: 8, top: 72, width: 28, rotate: 0 }],
  bag: [{ left: 4, top: 52, width: 28, rotate: -5 }, { left: 68, top: 42, width: 26, rotate: 5 }],
  accessory: [{ left: 6, top: 78, width: 28, rotate: -8 }, { left: 66, top: 86, width: 24, rotate: 6 }],
};
const SPARE: Slot[] = [
  { left: 70, top: 30, width: 24, rotate: 6 },
  { left: 4, top: 30, width: 24, rotate: -6 },
  { left: 40, top: 78, width: 22, rotate: 0 },
];

function layout(pieces: FlatLayPiece[]) {
  // The outfit's own pieces claim slots first, so a suggestion never pushes them aside.
  const order = [...pieces].sort((a, b) => Number(Boolean(a.suggested)) - Number(Boolean(b.suggested)));
  const used = new Map<string, number>();
  let spare = 0;
  return order.map((piece) => {
    const options = SLOTS[piece.category] ?? [];
    const n = used.get(piece.category) ?? 0;
    used.set(piece.category, n + 1);
    const slot = options[n] ?? SPARE[spare++ % SPARE.length];
    return { piece, slot };
  });
}

export function FlatLay({
  pieces,
  className,
  showLabels,
  suggestedLabel = "+ Suggested",
}: {
  pieces: FlatLayPiece[];
  className?: string;
  showLabels?: boolean;
  suggestedLabel?: string;
}) {
  return (
    <div className={cx("relative aspect-[4/5] overflow-hidden rounded-[20px] bg-[#efe8db]", className)}>
      {layout(pieces).map(({ piece, slot }, n) => (
        <div
          key={piece.id}
          className="absolute"
          style={{ left: `${slot.left}%`, top: `${slot.top}%`, width: `${slot.width}%`, zIndex: piece.suggested ? 20 : 10 + n }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- private cut-out image */}
          <img
            src={imageUrl(piece.imagePath)}
            alt={piece.name}
            className={cx(
              "block w-full object-contain transition",
              piece.cutout ? "drop-shadow-[0_10px_12px_rgba(35,31,26,0.18)]" : "rounded-md",
              piece.suggested && "opacity-45",
            )}
            style={{ transform: `rotate(${slot.rotate}deg)` }}
          />
          {showLabels && piece.suggested && <span className={cx("mt-1", pill("green"))}>{suggestedLabel}</span>}
        </div>
      ))}
    </div>
  );
}

/** Maps an item row to a flat-lay piece. */
export function toPiece(
  item: { id: string; name: string; category: string; imagePath: string; cutoutPath: string | null },
  suggested = false,
): FlatLayPiece {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    imagePath: item.cutoutPath ?? item.imagePath,
    cutout: Boolean(item.cutoutPath),
    suggested,
  };
}
