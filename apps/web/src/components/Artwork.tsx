import { useState } from "react";
import styles from "../styles/App.module.css";

export function Artwork({
  src,
  name,
  kind = "artwork",
}: {
  src?: string | null;
  name: string;
  kind?: "artwork" | "avatar";
}) {
  const [failedSrc, setFailedSrc] = useState<string>();
  const className =
    kind === "avatar" ? styles.avatarFallback : styles.artworkFallback;
  if (!src || failedSrc === src) {
    return (
      <span
        className={className}
        role="img"
        aria-label={`${name} ${kind} unavailable`}
      >
        <span aria-hidden="true">◇</span>
      </span>
    );
  }
  return (
    <img
      className={kind === "avatar" ? styles.avatar : styles.artwork}
      src={src!}
      alt={`${name} ${kind}`}
      loading="lazy"
      decoding="async"
      onError={() => setFailedSrc(src)}
    />
  );
}
