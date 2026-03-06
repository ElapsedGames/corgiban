let lastFallbackTimestamp = 0;
let lastFallbackCounter = 0;

function makeFallbackRunId(prefix: string): string {
  const now = Date.now();
  const timestamp = now > lastFallbackTimestamp ? now : lastFallbackTimestamp;

  if (timestamp === lastFallbackTimestamp) {
    lastFallbackCounter += 1;
  } else {
    lastFallbackTimestamp = timestamp;
    lastFallbackCounter = 0;
  }

  lastFallbackTimestamp = timestamp;
  return `${prefix}-${timestamp}-${lastFallbackCounter}`;
}

export function makeRunId(prefix: string): string {
  try {
    return `${prefix}-${crypto.randomUUID()}`;
  } catch {
    return makeFallbackRunId(prefix);
  }
}
