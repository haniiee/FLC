import type { FileKind } from "./content";

export function sessionDisplayName(input: { number: number; title: string | null }): string {
  return input.title ?? `Session ${input.number}`;
}

export function topicDisplayName(input: { number: number; title: string | null }): string {
  return input.title ?? `Topic ${input.number}`;
}

export function fileDisplayName(input: {
  number: number;
  title: string | null;
  kind: FileKind;
}): string {
  if (input.title) {
    return input.title;
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
