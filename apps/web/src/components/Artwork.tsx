import { useState } from "react";
import styles from "../styles/App.module.css";

export function Artwork({
  src,
  name,
  kind = "artwork",
  link,
}: {
  src?: string | null;
  name: string;
  kind?: "artwork" | "avatar";
  link?: { href: string; label: string };
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
  const image = (
    <img
      className={kind === "avatar" ? styles.avatar : styles.artwork}
      src={src!}
      alt={`${name} ${kind}`}
      loading="lazy"
      decoding="async"
      onError={() => setFailedSrc(src)}
    />
  );
  return link ? (
    <a
      className={styles.artworkLink}
      href={link.href}
      target="_blank"
      rel="noreferrer"
      aria-label={link.label}
    >
      {image}
    </a>
  ) : (
    image
  );
}
