import BulletList from "@/components/BulletList";
import ShowMore from "@/components/ShowMore";
import Linkify from "@/components/Linkify";
import styles from "./EntryDescription.module.css";

export interface EntryDescriptionProps {
  bullets: string[];
}

// Always renders something (a "No description" placeholder rather than
// omitting the section entirely when there's nothing) — clipped behind
// a Show More past 320px tall (see ShowMore) for a long one.
export default function EntryDescription({ bullets }: EntryDescriptionProps) {
  return (
    <>
      <h3 className={styles["heading"]}>Description</h3>
      {bullets.length > 0 ? (
        <ShowMore maxHeight={320}>
          <BulletList>
            {bullets.map((item, i) => (
              <li key={i}>
                <Linkify text={item} />
              </li>
            ))}
          </BulletList>
        </ShowMore>
      ) : (
        <p className={styles["empty"]}>No description</p>
      )}
    </>
  );
}
