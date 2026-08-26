import {
  createConfiguredDiscoveryProviderRegistry,
  discoveryProviderCapabilitiesSchema,
} from "@/lib/discovery-v2";
import { hashCanonical } from "@/lib/intelligence/campaign-strategy-v2";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { Json } from "@/types/database.types";
import { loadEnabledDiscoveryProviderIds } from "@/server/discovery-v2/stage-context";

export async function freezeEnabledDiscoveryProviderCapabilities(workspaceId: string) {
  const registry = createConfiguredDiscoveryProviderRegistry();
  const registered = new Set(registry.list().map(({ id }) => id));
  const providerIds = (await loadEnabledDiscoveryProviderIds(workspaceId)).filter((id) =>
    registered.has(id),
  );
  if (!providerIds.length)
    throw new Error("Market Analysis requires an implemented discovery provider.");

  return Promise.all(
    providerIds.map(async (providerId) => {
      const provider = registry.get(providerId);
      const capabilities = discoveryProviderCapabilitiesSchema.parse(
        await provider.getCapabilities(),
      );
      if (
        capabilities.providerId !== provider.id ||
        capabilities.providerVersion !== provider.version
      ) {
        throw new Error(
          `Discovery provider capability identity mismatch: ${providerId}.`,
        );
      }
      const contentHash = hashCanonical(capabilities);
      const supabase = createServiceRoleClient();
      const { error: insertError } = await supabase
        .from("discovery_provider_capability_snapshots")
        .upsert(
          {
            workspace_id: workspaceId,
            provider_key: provider.id,
            adapter_version: provider.version,
            capabilities_json: capabilities as unknown as Json,
            content_hash: contentHash,
          },
          {
            onConflict: "workspace_id,provider_key,adapter_version,content_hash",
            ignoreDuplicates: true,
          },
        );
      if (insertError)
        throw new Error(`Could not freeze provider capabilities: ${insertError.message}`);
      const { data, error } = await supabase
        .from("discovery_provider_capability_snapshots")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("provider_key", provider.id)
        .eq("adapter_version", provider.version)
        .eq("content_hash", contentHash)
        .single();
      if (error)
        throw new Error(`Could not load frozen provider capabilities: ${error.message}`);
      return data.id;
    }),
  );
}
