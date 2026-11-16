import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@app/shared-types";
import {
  applyDelete,
  applyNew,
  applyOptimistic,
  applyUpdate,
  canDeleteMessage,
  getNextPageParam,
  markOptimisticFailed,
  replaceOptimistic,
  type ChatInfiniteData,
  type ClientChatMessage,
} from "./cache";

function msg(partial: Partial<ClientChatMessage> & Pick<ChatMessage, "id">): ClientChatMessage {
  return {
    channelId: "11111111-1111-1111-1111-111111111111",
    type: "text",
    text: "hello",
    durationMs: null,
    status: "ready",
    replyToId: null,
    createdAt: new Date("2026-11-16T12:00:00.000Z").toISOString(),
    deleted: false,
    sender: {
      id: "22222222-2222-2222-2222-222222222222",
      displayName: "Ali",
      role: "student",
    },
    ...partial,
  };
}

describe("chat cache", () => {
  it("dedupes applyNew by id", () => {
    const a = msg({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", text: "one" });
    let data = applyNew(undefined, a);
    data = applyNew(data, { ...a, text: "one-again" });
    expect(data.pages[0]!.messages).toHaveLength(1);
    expect(data.pages[0]!.messages[0]!.text).toBe("one-again");
  });

  it("replaces tempId when response arrives after optimistic", () => {
    const tempId = "temp-1";
    const optimistic = msg({
      id: tempId,
      tempId,
      text: "pending",
      sender: {
        id: "33333333-3333-3333-3333-333333333333",
        displayName: "Me",
        role: "teacher",
      },
    });
    let data = applyOptimistic(undefined, optimistic);
    const real = msg({
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      text: "pending",
      sender: optimistic.sender,
    });
    data = replaceOptimistic(data, tempId, real);
    const flat = data.pages[0]!.messages;
    expect(flat).toHaveLength(1);
    expect(flat[0]!.id).toBe(real.id);
    expect(flat[0]!.tempId).toBeUndefined();
  });

  it("drops temp when event arrives before HTTP response", () => {
    const tempId = "temp-2";
    const optimistic = msg({
      id: tempId,
      tempId,
      text: "race",
      sender: {
        id: "33333333-3333-3333-3333-333333333333",
        displayName: "Me",
        role: "teacher",
      },
    });
    let data = applyOptimistic(undefined, optimistic);
    const real = msg({
      id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      text: "race",
      sender: optimistic.sender,
    });
    data = applyNew(data, real);
    data = replaceOptimistic(data, tempId, real);
    const flat = data.pages[0]!.messages;
    expect(flat).toHaveLength(1);
    expect(flat[0]!.id).toBe(real.id);
  });

  it("applyUpdate patches existing and applyDelete soft-deletes", () => {
    const voice = msg({
      id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
      type: "voice",
      text: null,
      status: "processing",
      mimeType: "audio/webm",
    });
    let data: ChatInfiniteData = applyNew(undefined, voice);
    data = applyUpdate(data, {
      ...voice,
      status: "ready",
      mimeType: "audio/mp4",
      durationMs: 2000,
    });
    expect(data.pages[0]!.messages[0]!.status).toBe("ready");
    expect(data.pages[0]!.messages[0]!.durationMs).toBe(2000);

    data = applyDelete(data, { id: voice.id, channelId: voice.channelId })!;
    expect(data.pages[0]!.messages[0]!.deleted).toBe(true);
    expect(data.pages[0]!.messages[0]!.text).toBeNull();
  });

  it("marks optimistic failed", () => {
    const tempId = "temp-fail";
    const optimistic = msg({ id: tempId, tempId, text: "x" });
    let data = applyOptimistic(undefined, optimistic);
    data = markOptimisticFailed(data, tempId)!;
    expect(data.pages[0]!.messages[0]!.sendFailed).toBe(true);
  });

  it("getNextPageParam stops when page shorter than limit", () => {
    expect(
      getNextPageParam({ messages: [msg({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" })] }, 50),
    ).toBeUndefined();
    const many = Array.from({ length: 50 }, (_, i) =>
      msg({
        id: `00000000-0000-4000-8000-${i.toString(16).padStart(12, "0")}`,
        text: String(i),
      }),
    );
    expect(getNextPageParam({ messages: many }, 50)).toBe(many[49]!.id);
  });
});

describe("canDeleteMessage", () => {
  it("allows own message always", () => {
    expect(
      canDeleteMessage({
        myUserId: "u1",
        myRole: "student",
        channelKind: "students",
        senderId: "u1",
      }),
    ).toBe(true);
  });

  it("allows teacher/assistant on all for others", () => {
    expect(
      canDeleteMessage({
        myUserId: "t1",
        myRole: "teacher",
        channelKind: "all",
        senderId: "s1",
      }),
    ).toBe(true);
    expect(
      canDeleteMessage({
        myUserId: "a1",
        myRole: "assistant",
        channelKind: "all",
        senderId: "s1",
      }),
    ).toBe(true);
  });

  it("denies student deleting others", () => {
    expect(
      canDeleteMessage({
        myUserId: "s1",
        myRole: "student",
        channelKind: "all",
        senderId: "s2",
      }),
    ).toBe(false);
  });
});
