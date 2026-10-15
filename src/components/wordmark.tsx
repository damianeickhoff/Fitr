import { cx } from "./ui";

export function Wordmark({ className }: { className?: string }) {
  return <span className={cx("font-display text-[17px] font-bold tracking-[0.32em]", className)}>FITR</span>;
}
