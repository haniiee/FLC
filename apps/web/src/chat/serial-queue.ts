/**
 * Run async tasks one after another. Failures do not block later tasks.
 * Used so chat voice uploads keep send order (createUploadUrl → createdAt).
 */
export function createSerialQueue() {
  let chain: Promise<void> = Promise.resolve();

  return function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = chain.then(task, task);
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}
