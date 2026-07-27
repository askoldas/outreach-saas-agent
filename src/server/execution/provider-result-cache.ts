import { createServiceRoleClient } from "@/lib/supabase/service";

type CachedProviderResult<T> = {
  inputHash: string;
  result: T;
  storedAt: string;
};

export async function loadProviderResult<T>(
  providerExecutionId: string,
  inputHash: string,
  cacheKey = "primary",
): Promise<T | null> {
  const { data, error } = await createServiceRoleClient()
    .from("provider_executions")
    .select("metadata")
    .eq("id", providerExecutionId)
    .maybeSingle();
  if (error) throw new Error(`Could not load cached provider result: ${error.message}`);
  const cached = asRecord(asRecord(asRecord(data?.metadata).providerResults)[cacheKey]);
  if (cached.inputHash !== inputHash || !("result" in cached)) return null;
  return cached.result as T;
}

export async function storeProviderResult<T>(
  providerExecutionId: string,
  inputHash: string,
  result: T,
  cacheKey = "primary",
) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("provider_executions")
    .select("metadata,status")
    .eq("id", providerExecutionId)
    .maybeSingle();
  if (error || !data)
    throw new Error(
      `Could not prepare provider result cache: ${error?.message ?? "execution missing"}`,
    );
  if (data.status === "completed") return;
  const metadata = asRecord(data.metadata);
  const providerResults = asRecord(metadata.providerResults);
  const cached: CachedProviderResult<T> = {
    inputHash,
    result: toJsonValue(result) as T,
    storedAt: new Date().toISOString(),
  };
  const { error: updateError } = await supabase
    .from("provider_executions")
    .update({
      metadata: {
        ...metadata,
        providerResults: { ...providerResults, [cacheKey]: cached },
      },
    })
    .eq("id", providerExecutionId)
    .in("status", ["pending", "running"]);
  if (updateError)
    throw new Error(`Could not cache provider result: ${updateError.message}`);
}

function toJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
