import styles from "./Linkify.module.css";

export interface LinkifyProps {
  text: string;
}

// http(s) or a bare "www." host — either way, split out into its own
// piece so it can be rendered as a real <a> instead of the rest of the
// line's plain text.
const URL_SPLIT_RE = /(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+)/gi;
const URL_TEST_RE = /^(https?:\/\/|www\.)/i;

// A sentence's own trailing punctuation right after a URL ("...menu at
// https://example.com." or "(see https://example.com)") shouldn't get
// swallowed into the link — peeled off one character at a time and
// rendered as plain text right after it instead. A trailing ")" is
// kept as part of the URL when it actually balances an earlier "("
// within it (e.g. a Wikipedia link ending "...Foo_(bar)") rather than
// always being treated as prose closing a parenthetical.
function splitTrailingPunctuation(url: string): { url: string; trailing: string } {
  let trailing = "";
  while (url.length > 0) {
    const last = url[url.length - 1];
    if (last === ")") {
      const opens = (url.match(/\(/g) || []).length;
      const closes = (url.match(/\)/g) || []).length;
      if (closes <= opens) break;
    } else if (!/[).,;:!?\]]/.test(last)) {
      break;
    }
    trailing = last + trailing;
    url = url.slice(0, -1);
  }
  return { url, trailing };
}

// Splits a line of plain text on any URL it contains and renders each
// as a real link — a description/note pasted with "menu at
// https://..." or "book at www.example.com" otherwise sits there as
// inert text, unlike every other link on the site.
export default function Linkify({ text }: LinkifyProps) {
  const parts = text.split(URL_SPLIT_RE);
  return (
    <>
      {parts.map((part, i) => {
        if (!URL_TEST_RE.test(part)) return part;
        const { url, trailing } = splitTrailingPunctuation(part);
        const href = url.startsWith("www.") ? `https://${url}` : url;
        return (
          <span key={i}>
            <a href={href} target="_blank" rel="noopener noreferrer" className={styles["link"]}>
              {url}
            </a>
            {trailing}
          </span>
        );
      })}
    </>
  );
}
