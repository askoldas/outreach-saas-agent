import type { CompanyDiscoveryProvider } from "./provider.ts";

export class DiscoveryProviderRegistry {
  readonly #providers: ReadonlyMap<string, CompanyDiscoveryProvider>;

  constructor(providers: CompanyDiscoveryProvider[]) {
    const entries = new Map<string, CompanyDiscoveryProvider>();
    for (const provider of providers) {
      if (entries.has(provider.id)) {
        throw new Error(`Duplicate discovery provider: ${provider.id}.`);
      }
      entries.set(provider.id, provider);
    }
    this.#providers = entries;
  }

  get(providerId: string) {
    const provider = this.#providers.get(providerId);
    if (!provider)
      throw new Error(`Discovery provider is not registered: ${providerId}.`);
    return provider;
  }

  list() {
    return [...this.#providers.values()].sort((left, right) =>
      left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
    );
  }
}
