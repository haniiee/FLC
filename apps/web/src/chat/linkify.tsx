import type { ReactNode } from "react";

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/gi;

export function linkifyText(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(URL_RE);
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const href = match[0]!;
    parts.push(
      <a
        key={`${match.index}-${href}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2"
        onClick={(event) => event.stopPropagation()}
      >
        {href}
      </a>,
    );
    lastIndex = match.index + href.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length ? parts : [text];
}
