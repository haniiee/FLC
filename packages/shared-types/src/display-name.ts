import type { FileKind } from "./content";

export function sessionDisplayName(input: { number: number; title: string | null }): string {
  return input.title ?? `Session ${input.number}`;
}

export function topicDisplayName(input: { number: number; title: string | null }): string {
  return input.title ?? `Topic ${input.number}`;
}

export function fileDisplayName(input: {
  number: number | null;
  title: string | null;
  kind: FileKind;
}): string | null {
  if (input.title) {
    return input.title;
  }
  if (input.number == null) {
    return null;
  }
  switch (input.kind) {
    case "audio":
      return `Voice ${input.number}`;
    case "pdf":
      return `PDF ${input.number}`;
    case "image":
      return `Image ${input.number}`;
    case "video":
      return `Video ${input.number}`;
    case "text":
      return `Text ${input.number}`;
  }
}
