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

export function enqueueProcessAudio(fileId: string, run: (id: string) => Promise<void>): void {
  if (enqueued.has(fileId)) {
    return;
  }
  enqueued.add(fileId);
  audioQueue.add(async () => {
    try {
      await run(fileId);
    } finally {
      enqueued.delete(fileId);
    }
  });
}
