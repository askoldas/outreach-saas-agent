import type {
  DiscoveryProviderCapabilities,
  ProviderDiscoveryEstimate,
  ProviderDiscoveryRequest,
  ProviderDiscoveryResponse,
} from "./contracts.ts";

export interface CompanyDiscoveryProvider {
  readonly id: string;
  readonly version: string;
  getCapabilities(): Promise<DiscoveryProviderCapabilities>;
  estimate(request: ProviderDiscoveryRequest): Promise<ProviderDiscoveryEstimate>;
  search(request: ProviderDiscoveryRequest): Promise<ProviderDiscoveryResponse>;
}
