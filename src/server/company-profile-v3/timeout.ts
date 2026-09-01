export function companyProfileRequestTimeoutMs(
  environment: Record<string, string | undefined> = process.env,
) {
  const configured = environment.OPENROUTER_PROFILE_REQUEST_TIMEOUT_MS?.trim();
  if (!configured) return 240_000;
  const timeout = Number(configured);
  if (!Number.isFinite(timeout) || timeout < 30_000 || timeout > 600_000) {
    throw new Error(
      "OPENROUTER_PROFILE_REQUEST_TIMEOUT_MS must be between 30000 and 600000.",
    );
  }
  return Math.floor(timeout);
}
