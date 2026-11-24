import { describe, expect, it } from "vitest";
import { createSerialQueue } from "./serial-queue";

describe("createSerialQueue", () => {
  it("runs tasks in enqueue order even when later tasks finish faster", async () => {
    const enqueue = createSerialQueue();
    const order: number[] = [];

    const first = enqueue(async () => {
      await new Promise((r) => setTimeout(r, 30));
      order.push(1);
      return 1;
    });
    const second = enqueue(async () => {
      order.push(2);
      return 2;
    });

    await expect(Promise.all([first, second])).resolves.toEqual([1, 2]);
    expect(order).toEqual([1, 2]);
  });

  it("continues after a failed task", async () => {
    const enqueue = createSerialQueue();
    const order: string[] = [];

    const failed = enqueue(async () => {
      order.push("a");
      throw new Error("boom");
    });
    const next = enqueue(async () => {
      order.push("b");
      return "ok";
    });

    await expect(failed).rejects.toThrow("boom");
    await expect(next).resolves.toBe("ok");
    expect(order).toEqual(["a", "b"]);
  });

  it("does not start the next task until the previous settles", async () => {
    const enqueue = createSerialQueue();
    let active = 0;
    let maxActive = 0;

    const run = () =>
      enqueue(async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 10));
        active -= 1;
      });

    await Promise.all([run(), run(), run()]);
    expect(maxActive).toBe(1);
  });
});
