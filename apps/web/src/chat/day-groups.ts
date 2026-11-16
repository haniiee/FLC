import type { ClientChatMessage } from "./cache";

const dayFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function dayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDayLabel(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const today = startOfLocalDay(now);
  const target = startOfLocalDay(date);
  const diffDays = Math.round((today - target) / 86_400_000);
  if (diffDays === 0) return "امروز";
  if (diffDays === 1) return "دیروز";
  return dayFormatter.format(date);
}

export function formatMessageTime(iso: string): string {
  return new Intl.DateTimeFormat("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export type DayGroup = {
  key: string;
  label: string;
  messages: ClientChatMessage[];
};

/** messagesForDisplay order (oldest → newest). */
export function groupMessagesByDay(messages: ClientChatMessage[], now = new Date()): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const message of messages) {
    const key = dayKey(message.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.messages.push(message);
    } else {
      groups.push({
        key,
        label: formatDayLabel(message.createdAt, now),
        messages: [message],
      });
    }
  }
  return groups;
}
