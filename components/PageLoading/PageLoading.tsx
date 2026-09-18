import classNames from "classnames";
import Spinner from "@/components/Spinner";
import styles from "./PageLoading.module.css";

export interface PageLoadingProps {
  /** Spinner diameter in pixels. */
  size?: number;
  className?: string;
}

// Full-width centered page loading state — same Spinner the rest of
// the site uses, wrapped so each page doesn't re-declare the min-height
// flex centering (SectionPage, Itinerary, …).
export default function PageLoading({ size = 48, className }: PageLoadingProps) {
  return (
    <div className={classNames(styles["root"], className)}>
      <Spinner size={size} />
    </div>
  );
}
