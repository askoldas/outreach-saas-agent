import { errorForTrigger } from "./errors.ts";

export async function executeProviderAttempt<T>(
  execute: () => Promise<T>,
  lifecycle: {
    onAttemptFailure: (error: unknown) => Promise<void>;
    onCompleted: () => Promise<void>;
    onStarted: () => Promise<void>;
  },
) {
  await lifecycle.onStarted();
  try {
    const result = await execute();
    await lifecycle.onCompleted();
    return result;
  } catch (error) {
    await lifecycle.onAttemptFailure(error);
    throw errorForTrigger(error);
  }
}
