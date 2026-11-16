type Job = () => Promise<void>;

class SimpleQueue {
  private readonly concurrency: number;
  private readonly pending: Job[] = [];
  private active = 0;

  constructor(concurrency: number) {
    this.concurrency = concurrency;
  }

  add(job: Job): void {
    this.pending.push(job);
    this.pump();
  }

  get size(): number {
    return this.pending.length + this.active;
  }

  private pump(): void {
    while (this.active < this.concurrency && this.pending.length > 0) {
      const job = this.pending.shift()!;
      this.active += 1;
      void job()
        .catch((error) => {
          console.error("[media-queue] job failed", error);
        })
        .finally(() => {
          this.active -= 1;
          this.pump();
        });
    }
  }
}

const audioQueue = new SimpleQueue(2);
const enqueued = new Set<string>();

export type AudioJobTarget = {
  table: "files" | "chat_messages";
  id: string;
};

export function audioJobKey(target: AudioJobTarget): string {
  return `${target.table}:${target.id}`;
}

export function enqueueProcessAudio(
  target: AudioJobTarget | string,
  run: (target: AudioJobTarget) => Promise<void>,
): void {
  const normalized: AudioJobTarget =
    typeof target === "string" ? { table: "files", id: target } : target;
  const key = audioJobKey(normalized);
  if (enqueued.has(key)) {
    return;
  }
  enqueued.add(key);
  audioQueue.add(async () => {
    try {
      await run(normalized);
    } finally {
      enqueued.delete(key);
    }
  });
}
