import { useState } from "react";
import styles from "../styles/App.module.css";

export function Artwork({ src, name }: { src?: string | null; name: string }) {
  const [failed, setFailed] = useState(!src);
  if (failed) {
    return (
      <span
        className={styles.artworkFallback}
        role="img"
        aria-label={`${name} artwork unavailable`}
      >
        <span aria-hidden="true">◇</span>
      </span>
    );
  }
  return (
    <img
      className={styles.artwork}
      src={src!}
      alt={`${name} artwork`}
      onError={() => setFailed(true)}
    />
  );
}
