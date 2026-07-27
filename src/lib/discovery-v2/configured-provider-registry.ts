import { DiscoveryProviderRegistry } from "./provider-registry.ts";
import { WebSearchProvider } from "./providers/web-search-provider.ts";

export function createConfiguredDiscoveryProviderRegistry() {
  return new DiscoveryProviderRegistry([new WebSearchProvider()]);
}
