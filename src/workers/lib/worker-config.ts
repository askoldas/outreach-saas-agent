export function getWorkerConfig() {
  return {
    pollIntervalMs: getPositiveInteger("WORKER_POLL_INTERVAL_MS", 3000),
    workerId:
      process.env.WORKER_ID ??
      `worker-${process.pid}-${Math.random().toString(36).slice(2, 8)}`,
  };
}

function getPositiveInteger(name: string, fallback: number) {
  const value = Number(process.env[name]);

  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}
