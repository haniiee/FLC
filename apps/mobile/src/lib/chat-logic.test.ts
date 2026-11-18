import { describe, expect, it } from "vitest";
import type { ClientChatMessage, ChatInfiniteData } from "./chat-logic";
import {
  applyDelete,
  applyNew,
  applyOptimistic,
  buildChatRows,
  canDeleteMessage,
  channelLabel,
  channelPath,
  createOptimisticText,
  lastMessagePreview,
  markOptimisticFailed,
  mergeLatestPage,
  nextMessageCursor,
  pageHasMore,
  replaceOptimistic,
  sortChannels,
  voicePlaceholder,
  formatRelativeTime,
} from "./chat-logic";

const channelId = "00000000-0000-4000-8000-000000000010";
const me = {
  id: "00000000-0000-4000-8000-000000000001",
  displayName: "Mina",
  role: "student" as const,
};
const other = {
  id: "00000000-0000-4000-8000-000000000002",
  displayName: "Reza",
  role: "teacher" as const,
};

function message(
  partial: Partial<ClientChatMessage> & Pick<ClientChatMessage, "id">,
): ClientChatMessage {
  return {
    channelId,
    type: "text",
    text: "Hello",
    durationMs: null,
    status: "ready",
    replyToId: null,
    createdAt: "2026-11-18T12:00:00.000Z",
    deleted: false,
    sender: other,
    ...partial,
  };
}

function cache(messages: ClientChatMessage[], hasMore = false): ChatInfiniteData {
  return { pages: [{ messages, hasMore }], pageParams: [undefined] };
}

describe("channel list helpers", () => {
  it("labels channels in English and keeps every server channel", () => {
    expect(channelLabel("all")).toBe("Class chat");
    expect(channelLabel("students")).toBe("Students only");
    const sorted = sortChannels([
      { id: "s", kind: "students" as const },
      { id: "a", kind: "all" as const },
    ]);
    expect(sorted.map((channel) => channel.id)).toEqual(["a", "s"]);
  });

  it("builds a channel route without dropping the group name", () => {
    const path = channelPath({
      channelId,
      groupId: "00000000-0000-4000-8000-000000000020",
      kind: "students",
      groupName: "Algebra 1",
    });
    expect(path.startsWith(`/chats/${channelId}?`)).toBe(true);
    expect(path).toContain("kind=students");
    expect(path).toContain("groupName=Algebra+1");
  });
});

describe("previews and time", () => {
  const now = Date.parse("2026-06-15T12:00:00.000Z");

  it("formats voice, deleted, and relative time", () => {
    expect(voicePlaceholder(12_000)).toBe("Voice message · 0:12");
    expect(voicePlaceholder(null)).toBe("Voice message");
    expect(lastMessagePreview({ type: "voice", text: null, deleted: false })).toBe(
      "🎤 Voice message",
    );
    expect(lastMessagePreview({ type: "text", text: "Hi", deleted: true })).toBe("Message deleted");
    expect(formatRelativeTime(new Date(now - 59_000).toISOString(), now)).toBe("now");
    expect(formatRelativeTime(new Date(now - 60_000).toISOString(), now)).toBe("1m");
    expect(formatRelativeTime(new Date(now - 2 * 3_600_000).toISOString(), now)).toBe("2h");
    expect(formatRelativeTime(new Date(now - 2 * 86_400_000).toISOString(), now)).toBe("2d");
  });
});

describe("canDeleteMessage", () => {
  it("allows own messages and staff messages, and hides it for other students", () => {
    expect(canDeleteMessage({ myUserId: me.id, myRole: "student", senderId: me.id })).toBe(true);
    expect(canDeleteMessage({ myUserId: me.id, myRole: "student", senderId: other.id })).toBe(
      false,
    );
    expect(canDeleteMessage({ myUserId: me.id, myRole: "teacher", senderId: other.id })).toBe(true);
    expect(canDeleteMessage({ myUserId: me.id, myRole: "assistant", senderId: other.id })).toBe(
      true,
    );
    expect(canDeleteMessage({ myUserId: "", myRole: "teacher", senderId: other.id })).toBe(false);
  });
});

describe("pagination cursor", () => {
  it("uses the oldest real message id and stops on a short page", () => {
    expect(pageHasMore(30)).toBe(true);
    expect(pageHasMore(29)).toBe(false);
    expect(
      nextMessageCursor({
        hasMore: true,
        messages: [message({ id: "temp-1" }), message({ id: "newer" }), message({ id: "oldest" })],
      }),
    ).toBe("oldest");
    expect(
      nextMessageCursor({ hasMore: false, messages: [message({ id: "only" })] }),
    ).toBeUndefined();
    expect(
      nextMessageCursor({ hasMore: true, messages: [message({ id: "temp-only" })] }),
    ).toBeUndefined();
  });
});

describe("merge and dedupe", () => {
  it("does not insert the same server id twice", () => {
    const first = message({ id: "m1", text: "Hi" });
    const once = applyNew(cache([]), first);
    const twice = applyNew(once, first);
    expect(twice.pages[0]?.messages).toHaveLength(1);
  });

  it("replaces one optimistic row when the server event arrives, and keeps a second pending send", () => {
    const tempA = createOptimisticText({
      clientId: "temp-a",
      channelId,
      text: "Hi",
      sender: me,
      now: new Date("2026-11-18T12:00:01.000Z"),
    });
    const tempB = createOptimisticText({
      clientId: "temp-b",
      channelId,
      text: "Hi",
      sender: me,
      now: new Date("2026-11-18T12:00:02.000Z"),
    });
    const withBoth = applyOptimistic(applyOptimistic(cache([]), tempA), tempB);
    const serverA = message({
      id: "server-a",
      text: "Hi",
      sender: me,
      createdAt: "2026-11-18T12:00:01.500Z",
    });
    const afterEvent = applyNew(withBoth, serverA);
    const ids = afterEvent.pages[0]?.messages.map((row) => row.id);
    expect(ids).toEqual(["server-a", "temp-b"]);

    const afterRest = replaceOptimistic(afterEvent, "temp-a", serverA);
    expect(afterRest.pages[0]?.messages.map((row) => row.id)).toEqual(["server-a", "temp-b"]);
    expect(applyNew(afterRest, serverA).pages[0]?.messages.map((row) => row.id)).toEqual([
      "server-a",
      "temp-b",
    ]);
  });

  it("drops the temp row when REST lands after the socket event", () => {
    const temp = createOptimisticText({
      clientId: "temp-a",
      channelId,
      text: "Hi",
      sender: me,
    });
    const server = message({ id: "server-a", text: "Hi", sender: me });
    const afterEvent = applyNew(applyOptimistic(cache([]), temp), server);
    const afterRest = replaceOptimistic(afterEvent, "temp-a", server);
    expect(afterRest.pages[0]?.messages.map((row) => row.id)).toEqual(["server-a"]);
  });

  it("marks a failed send and keeps a newer socket message across refetch", () => {
    const temp = createOptimisticText({
      clientId: "temp-a",
      channelId,
      text: "Hi",
      sender: me,
      now: new Date("2026-11-18T12:00:03.000Z"),
    });
    const failed = markOptimisticFailed(applyOptimistic(cache([]), temp), "temp-a");
    expect(failed?.pages[0]?.messages[0]?.sendFailed).toBe(true);

    const live = message({
      id: "live",
      text: "New",
      createdAt: "2026-11-18T12:00:04.000Z",
    });
    const fetched = [message({ id: "old", text: "Old", createdAt: "2026-11-18T11:00:00.000Z" })];
    const merged = mergeLatestPage(fetched, applyNew(cache(fetched), live));
    expect(merged.map((row) => row.id)).toEqual(["live", "old"]);

    const delivered = message({ id: "server-a", text: "Hi", sender: me });
    const optimistic = applyOptimistic(undefined, temp);
    expect(mergeLatestPage([delivered], optimistic).map((row) => row.id)).toEqual(["server-a"]);
  });

  it("patches a deleted message", () => {
    const updated = applyDelete(cache([message({ id: "m1", text: "Hi" })]), { id: "m1" });
    expect(updated?.pages[0]?.messages[0]).toMatchObject({ deleted: true, text: null });
  });
});

describe("buildChatRows", () => {
  it("groups a sender, inserts day labels, and keeps newest at index 0", () => {
    const now = new Date(2026, 10, 18, 15, 0, 0);
    const alice = { ...other, id: "alice", displayName: "Alice", role: "student" as const };
    const rows = buildChatRows(
      [
        message({
          id: "new",
          sender: alice,
          createdAt: new Date(2026, 10, 18, 10, 0, 0).toISOString(),
        }),
        message({
          id: "mid",
          sender: me,
          text: "Second",
          createdAt: new Date(2026, 10, 17, 10, 1, 0).toISOString(),
        }),
        message({
          id: "old",
          sender: me,
          text: "First",
          createdAt: new Date(2026, 10, 17, 10, 0, 0).toISOString(),
        }),
      ],
      { myUserId: me.id, now },
    );

    expect(rows.map((row) => (row.type === "day" ? row.label : row.message.id))).toEqual([
      "new",
      "Today",
      "mid",
      "old",
      "Yesterday",
    ]);
    const messages = rows.filter((row) => row.type === "message");
    expect(messages[0]).toMatchObject({ showSender: true, grouped: false, showTime: true });
    expect(messages[1]).toMatchObject({ showSender: false, grouped: true, showTime: true });
    expect(messages[2]).toMatchObject({ showSender: false, grouped: false, showTime: false });
  });

  it("shows the time on the newest message of a run, and always on a failed send", () => {
    const start = new Date(2026, 10, 18, 10, 0, 0);
    const at = (id: string, minutes: number, extra?: Partial<ClientChatMessage>) =>
      message({
        id,
        sender: me,
        createdAt: new Date(start.getTime() + minutes * 60_000).toISOString(),
        ...extra,
      });
    const rows = buildChatRows(
      [at("gap", 10), at("failed", 4, { sendFailed: true }), at("mid", 3), at("old", 0)],
      { myUserId: me.id, now: new Date(2026, 10, 18, 15, 0, 0) },
    );
    const messages = rows.filter((row) => row.type === "message");
    expect(messages.map((row) => [row.message.id, row.showTime, row.grouped])).toEqual([
      ["gap", true, false],
      ["failed", true, true],
      ["mid", false, true],
      ["old", false, false],
    ]);
  });

  it("starts a new group at a 5 minute gap and keeps one just under it", () => {
    const start = new Date(2026, 10, 18, 10, 0, 0);
    const at = (id: string, ms: number) =>
      message({
        id,
        sender: me,
        createdAt: new Date(start.getTime() + ms).toISOString(),
      });
    const split = buildChatRows([at("later", 5 * 60_000), at("first", 0)], {
      myUserId: me.id,
      now: new Date(2026, 10, 18, 15, 0, 0),
    }).filter((row) => row.type === "message");
    expect(split.map((row) => [row.message.id, row.grouped, row.showTime])).toEqual([
      ["later", false, true],
      ["first", false, true],
    ]);

    const joined = buildChatRows([at("later", 5 * 60_000 - 1), at("first", 0)], {
      myUserId: me.id,
      now: new Date(2026, 10, 18, 15, 0, 0),
    }).filter((row) => row.type === "message");
    expect(joined.map((row) => [row.message.id, row.grouped, row.showTime])).toEqual([
      ["later", true, true],
      ["first", false, false],
    ]);
  });
});
