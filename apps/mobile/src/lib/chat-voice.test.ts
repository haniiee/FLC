import { describe, expect, it } from "vitest";
import {
  applyNew,
  applyOptimistic,
  mergeLatestPage,
  replaceOptimistic,
  type ClientChatMessage,
} from "./chat-logic";
import {
  CHAT_VOICE_MAX_MS,
  beginVoiceRetry,
  bindVoiceUploadId,
  cacheVoiceUrl,
  createOptimisticVoice,
  decideVoiceHold,
  failVoiceUpload,
  isVoiceUrlFresh,
  voiceBubblePhase,
  voicePlaybackClock,
} from "./chat-voice";

const channelId = "00000000-0000-4000-8000-000000000010";
const me = {
  id: "00000000-0000-4000-8000-000000000001",
  displayName: "Mina",
  role: "student" as const,
};
const serverId = "00000000-0000-4000-8000-0000000000aa";
const serverIdB = "00000000-0000-4000-8000-0000000000bb";

function voice(
  partial: Partial<ClientChatMessage> & Pick<ClientChatMessage, "id">,
): ClientChatMessage {
  return {
    channelId,
    type: "voice",
    text: null,
    durationMs: 3000,
    status: "ready",
    replyToId: null,
    createdAt: "2026-11-18T12:00:00.000Z",
    deleted: false,
    sender: me,
    mimeType: "audio/mp4",
    ...partial,
  };
}

describe("decideVoiceHold", () => {
  it("cancels a slide, discards a short or empty take, and sends the rest", () => {
    expect(decideVoiceHold({ cancelled: true, durationMs: 4000, hasFile: true })).toBe("cancel");
    expect(decideVoiceHold({ cancelled: false, durationMs: 999, hasFile: true })).toBe("discard");
    expect(decideVoiceHold({ cancelled: false, durationMs: 1000, hasFile: false })).toBe("discard");
    expect(decideVoiceHold({ cancelled: false, durationMs: 1000, hasFile: true })).toBe("send");
    expect(
      decideVoiceHold({ cancelled: false, durationMs: CHAT_VOICE_MAX_MS, hasFile: true }),
    ).toBe("send");
  });
});

describe("voiceBubblePhase", () => {
  it("keeps upload failure, processing, and a failed transcode apart", () => {
    expect(voiceBubblePhase({ deleted: true, status: "ready" })).toBe("deleted");
    expect(voiceBubblePhase({ deleted: false, status: "pending", sendFailed: true })).toBe(
      "upload-failed",
    );
    expect(
      voiceBubblePhase({ deleted: false, status: "pending", sending: true, tempId: "temp-1" }),
    ).toBe("sending");
    expect(voiceBubblePhase({ deleted: false, status: "processing" })).toBe("processing");
    expect(voiceBubblePhase({ deleted: false, status: "failed" })).toBe("process-failed");
    expect(voiceBubblePhase({ deleted: false, status: "ready" })).toBe("ready");
  });
});

describe("voice upload state", () => {
  const optimistic = createOptimisticVoice({
    clientId: "temp-a",
    channelId,
    durationMs: 3200,
    mimeType: "audio/mp4",
    localUri: "file:///rec.m4a",
    sender: me,
    now: new Date("2026-11-18T12:00:00.000Z"),
  });

  it("binds the real id and collapses message:new onto that one row", () => {
    const other = createOptimisticVoice({
      clientId: "temp-b",
      channelId,
      durationMs: 2000,
      mimeType: "audio/mp4",
      localUri: "file:///other.m4a",
      sender: me,
    });
    const bound = bindVoiceUploadId(
      applyOptimistic(applyOptimistic(undefined, optimistic), other),
      "temp-a",
      serverId,
    );
    const ready = voice({ id: serverId, durationMs: 3200, status: "ready" });
    const afterNew = applyNew(bound, ready);
    expect(afterNew.pages[0]?.messages.map((row) => row.id)).toEqual([serverId, "temp-b"]);
    expect(afterNew.pages[0]?.messages[0]?.tempId).toBeUndefined();
    expect(afterNew.pages[0]?.messages[0]?.durationMs).toBe(3200);
  });

  it("does not let a late processing response overwrite a ready socket update", () => {
    const bound = bindVoiceUploadId(applyOptimistic(undefined, optimistic), "temp-a", serverId);
    const ready = applyNew(bound, voice({ id: serverId, status: "ready", durationMs: null }));
    const processing = voice({ id: serverId, status: "processing", durationMs: null });
    const afterRest = replaceOptimistic(ready, "temp-a", processing);
    expect(afterRest.pages[0]?.messages).toHaveLength(1);
    expect(afterRest.pages[0]?.messages[0]?.status).toBe("ready");
    expect(afterRest.pages[0]?.messages[0]?.durationMs).toBe(3200);
  });

  it("keeps the local file when the upload fails and clears it on retry", () => {
    const bound = bindVoiceUploadId(applyOptimistic(undefined, optimistic), "temp-a", serverId);
    const failed = failVoiceUpload(bound, "temp-a");
    expect(failed.orphanMessageId).toBe(serverId);
    const row = failed.data?.pages[0]?.messages[0];
    expect(row?.id).toBe("temp-a");
    expect(row?.sendFailed).toBe(true);
    expect(row?.localUri).toBe("file:///rec.m4a");
    expect(voiceBubblePhase(row!)).toBe("upload-failed");

    const retrying = beginVoiceRetry(failed.data, "temp-a");
    expect(retrying?.pages[0]?.messages[0]?.sending).toBe(true);
    expect(retrying?.pages[0]?.messages[0]?.sendFailed).toBe(false);
    expect(retrying?.pages[0]?.messages[0]?.localUri).toBe("file:///rec.m4a");
  });

  it("keeps Sending and the local file when a refetch returns the pending server row", () => {
    const bound = bindVoiceUploadId(applyOptimistic(undefined, optimistic), "temp-a", serverId);
    const fetched = [
      voice({ id: serverId, status: "pending", durationMs: null, createdAt: optimistic.createdAt }),
    ];
    const merged = mergeLatestPage(fetched, bound);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.sending).toBe(true);
    expect(merged[0]?.localUri).toBe("file:///rec.m4a");
    expect(merged[0]?.durationMs).toBe(3200);
    expect(voiceBubblePhase(merged[0]!)).toBe("sending");
  });

  it("leaves a second in-flight voice alone", () => {
    const second = createOptimisticVoice({
      clientId: "temp-b",
      channelId,
      durationMs: 1500,
      mimeType: "audio/mp4",
      localUri: "file:///b.m4a",
      sender: me,
    });
    const boundA = bindVoiceUploadId(applyOptimistic(undefined, optimistic), "temp-a", serverId);
    const boundB = bindVoiceUploadId(applyOptimistic(boundA, second), "temp-b", serverIdB);
    const afterA = applyNew(
      boundB,
      voice({ id: serverId, status: "processing", durationMs: null }),
    );
    const ids = afterA.pages[0]?.messages.map((row) => row.id);
    expect(ids).toEqual([serverId, serverIdB]);
    expect(afterA.pages[0]?.messages[1]?.localUri).toBe("file:///b.m4a");
  });
});

describe("voicePlaybackClock", () => {
  it("steps the label from the player position in seconds, and the bar uses that same position", () => {
    const playing = voicePlaybackClock({
      active: true,
      currentTimeSec: 1.2,
      durationMs: 3000,
    });
    expect(playing.label).toBe("0:01 / 0:03");
    expect(playing.ratio).toBeCloseTo(1.2 / 3);

    const paused = voicePlaybackClock({
      active: true,
      currentTimeSec: 2,
      durationMs: 3000,
    });
    expect(paused.label).toBe("0:02 / 0:03");
    expect(paused.ratio).toBeCloseTo(2 / 3);
  });

  it("returns to the start when the voice is inactive, and seeks update the same clock", () => {
    expect(voicePlaybackClock({ active: false, currentTimeSec: 2.4, durationMs: 3000 }).label).toBe(
      "0:00 / 0:03",
    );
    expect(voicePlaybackClock({ active: true, currentTimeSec: 0, durationMs: 3000 }).label).toBe(
      "0:00 / 0:03",
    );

    const sought = voicePlaybackClock({
      active: true,
      currentTimeSec: 2.5,
      durationSec: 3,
    });
    expect(sought.label).toBe("0:02 / 0:03");
    expect(sought.ratio).toBeCloseTo(2.5 / 3);
    expect(sought.currentMs).toBeLessThan(3_000);
  });
});

describe("playback url cache", () => {
  it("treats a url as fresh until shortly before it expires", () => {
    const now = 1_000_000;
    const entry = cacheVoiceUrl("https://cdn.example/voice.m4a", 900, now);
    expect(isVoiceUrlFresh(entry, now + 884_000)).toBe(true);
    expect(isVoiceUrlFresh(entry, now + 885_000)).toBe(false);
    expect(isVoiceUrlFresh(undefined, now)).toBe(false);
  });
});
