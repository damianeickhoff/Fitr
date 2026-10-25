import { cx } from "./ui";

export function Wordmark({ className }: { className?: string }) {
  return <span className={cx("text-[20px] font-extrabold tracking-[0.12em] uppercase", className)}>FITR</span>;
}
