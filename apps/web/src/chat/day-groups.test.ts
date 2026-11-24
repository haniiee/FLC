import { describe, expect, it } from "vitest";
import type { ClientChatMessage } from "./cache";
import { formatDayLabel, groupMessagesByDay } from "./day-groups";

function msg(iso: string, id: string): ClientChatMessage {
  return {
    id,
    channelId: "11111111-1111-1111-1111-111111111111",
    type: "text",
    text: "x",
    durationMs: null,
    status: "ready",
    replyToId: null,
    createdAt: iso,
    deleted: false,
    sender: {
      id: "22222222-2222-2222-2222-222222222222",
      displayName: "Ali",
      role: "student",
    },
  };
}

describe("day groups", () => {
  const now = new Date(2026, 10, 16, 15, 0, 0); // 16 Nov 2026 local

  it("labels today and yesterday", () => {
    expect(formatDayLabel(new Date(2026, 10, 16, 10).toISOString(), now)).toBe("Today");
    expect(formatDayLabel(new Date(2026, 10, 15, 10).toISOString(), now)).toBe("Yesterday");
  });

  it("uses calendar date for older days", () => {
    const label = formatDayLabel(new Date(2026, 10, 13, 10).toISOString(), now);
    expect(label).not.toBe("Today");
    expect(label).not.toBe("Yesterday");
    expect(label.length).toBeGreaterThan(3);
    expect(label).toMatch(/[0-9]/);
  });

  it("groups consecutive messages by local day", () => {
    const messages = [
      msg(new Date(2026, 10, 15, 9).toISOString(), "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
      msg(new Date(2026, 10, 15, 11).toISOString(), "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
      msg(new Date(2026, 10, 16, 8).toISOString(), "cccccccc-cccc-cccc-cccc-cccccccccccc"),
    ];
    const groups = groupMessagesByDay(messages, now);
    expect(groups).toHaveLength(2);
    expect(groups[0]!.label).toBe("Yesterday");
    expect(groups[0]!.messages).toHaveLength(2);
    expect(groups[1]!.label).toBe("Today");
    expect(groups[1]!.messages).toHaveLength(1);
  });
});
