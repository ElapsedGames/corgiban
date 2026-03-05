export type WorkerTask<TWorker, TResult> = {
  runId: string;
  run: (worker: TWorker) => Promise<TResult>;
};

type QueueEntry<TWorker, TResult> = {
  task: WorkerTask<TWorker, TResult>;
  resolve: (value: TResult) => void;
  reject: (error: unknown) => void;
};

type WorkerSlot<TWorker, TResult> = {
  worker: TWorker;
  busy: boolean;
  active: QueueEntry<TWorker, TResult> | null;
};

export function resolveBenchmarkWorkerPoolSize(hardwareConcurrency?: number): number {
  const rawConcurrency = hardwareConcurrency || 4;
  const clampedConcurrency = Math.max(1, Math.floor(rawConcurrency));
  return Math.max(1, Math.min(4, clampedConcurrency - 1));
}

export class WorkerPool<TWorker, TResult> {
  private readonly workers: WorkerSlot<TWorker, TResult>[];
  private readonly queue: QueueEntry<TWorker, TResult>[] = [];
  private readonly disposeWorker?: (worker: TWorker) => void;
  private disposed = false;

  // Callers must clamp size to their concurrency budget; WorkerPool does not enforce a max.
  constructor(
    createWorker: () => TWorker,
    size: number,
    disposeWorker?: (worker: TWorker) => void,
  ) {
    if (size <= 0) {
      throw new Error('WorkerPool size must be > 0.');
    }
    this.workers = Array.from({ length: size }, () => ({
      worker: createWorker(),
      busy: false,
      active: null,
    }));
    this.disposeWorker = disposeWorker;
  }

  enqueue(task: WorkerTask<TWorker, TResult>): Promise<TResult> {
    if (this.disposed) {
      return Promise.reject(new Error('WorkerPool has been disposed.'));
    }
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.schedule();
    });
  }

  // Removes a queued task only; does not interrupt a task already running.
  cancel(runId: string): boolean {
    const index = this.queue.findIndex((entry) => entry.task.runId === runId);
    if (index === -1) {
      return false;
    }
    const [entry] = this.queue.splice(index, 1);
    entry.reject(new Error(`WorkerPool cancelled run ${runId}.`));
    return true;
  }

  // Rejects queued and in-flight tasks; does not wait for running tasks to settle.
  dispose(reason = 'WorkerPool disposed.'): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const slot of this.workers) {
      if (slot.active) {
        slot.active.reject(new Error(reason));
        slot.active = null;
      }
      slot.busy = false;
    }
    while (this.queue.length > 0) {
      const entry = this.queue.shift();
      if (!entry) {
        continue;
      }
      entry.reject(new Error(reason));
    }
    if (this.disposeWorker) {
      for (const slot of this.workers) {
        this.disposeWorker(slot.worker);
      }
    }
  }

  private schedule(): void {
    if (this.disposed) {
      return;
    }
    for (const slot of this.workers) {
      if (slot.busy) {
        continue;
      }
      const entry = this.queue.shift();
      if (!entry) {
        return;
      }

      slot.busy = true;
      slot.active = entry;
      Promise.resolve()
        .then(() => entry.task.run(slot.worker))
        .then((value) => entry.resolve(value))
        .catch((error) => entry.reject(error))
        .finally(() => {
          slot.busy = false;
          slot.active = null;
          this.schedule();
        });
    }
  }
}
