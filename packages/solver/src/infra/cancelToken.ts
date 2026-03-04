export class CancelToken {
  private cancelled = false;
  private reason?: string;

  cancel(reason?: string): void {
    this.cancelled = true;
    this.reason = reason;
  }

  isCancelled(): boolean {
    return this.cancelled;
  }

  getReason(): string | undefined {
    return this.reason;
  }
}

export function createCancelToken(): CancelToken {
  return new CancelToken();
}
