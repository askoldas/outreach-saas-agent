import { randomUUID } from "node:crypto";
import {
  companyIntelligenceV3Schema,
  type CompanyIntelligenceV3,
} from "@/lib/intelligence/company-profile-v3";
import {
  compileCommercialIntelligence,
  type CommercialIntelligence,
} from "@/lib/intelligence/core";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  loadLatestCommercialIntelligenceVersionNumber,
  persistCommercialIntelligence,
  type PersistedArtifact,
} from "./repository";

export type CommercialIntelligenceServiceAdapters = {
  loadPublishedProfile: (workspaceId: string) => Promise<CompanyIntelligenceV3>;
  latestVersionNumber: (input: {
    workspaceId: string;
    companyProfileVersionId: string;
  }) => Promise<number>;
  persist: (input: {
    artifact: CommercialIntelligence;
    versionNumber: number;
  }) => Promise<PersistedArtifact<CommercialIntelligence>>;
  artifactId: () => string;
  now: () => string;
};

const productionAdapters: CommercialIntelligenceServiceAdapters = {
  loadPublishedProfile: loadPublishedCompanyProfileV3,
  latestVersionNumber: loadLatestCommercialIntelligenceVersionNumber,
  persist: persistCommercialIntelligence,
  artifactId: randomUUID,
  now: () => new Date().toISOString(),
};

export async function compileAndPersistCommercialIntelligence(
  input: { workspaceId: string },
  adapters: CommercialIntelligenceServiceAdapters = productionAdapters,
) {
  const profile = await adapters.loadPublishedProfile(input.workspaceId);
  const artifact = compileCommercialIntelligence({
    artifactId: adapters.artifactId(),
    workspaceId: input.workspaceId,
    profile,
    createdAt: adapters.now(),
  });
  const latestVersion = await adapters.latestVersionNumber({
    workspaceId: input.workspaceId,
    companyProfileVersionId: profile.profileVersionId,
  });
  return adapters.persist({ artifact, versionNumber: latestVersion + 1 });
}

export async function loadPublishedCompanyProfileV3(
  workspaceId: string,
): Promise<CompanyIntelligenceV3> {
  const supabase = createServiceRoleClient();
  const { data: profile, error: profileError } = await supabase
    .from("company_profiles")
    .select("current_version_id")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (profileError) {
    throw new Error(`Could not load Company Profile container: ${profileError.message}`);
  }
  if (!profile?.current_version_id) {
    throw new Error("A published Company Profile V3 is required.");
  }
  const { data: version, error: versionError } = await supabase
    .from("company_profile_versions")
    .select("id,intelligence_version,profile_status,structured_profile")
    .eq("workspace_id", workspaceId)
    .eq("id", profile.current_version_id)
    .single();
  if (versionError) {
    throw new Error(
      `Could not load published Company Profile V3: ${versionError.message}`,
    );
  }
  if (version.intelligence_version !== "v2" || version.profile_status !== "published") {
    throw new Error("The current Company Profile is not a published native V3 version.");
  }
  const parsed = companyIntelligenceV3Schema.parse(version.structured_profile);
  if (parsed.profileVersionId !== version.id || parsed.status !== "published") {
    throw new Error(
      "Published Company Profile V3 identity does not match its version row.",
    );
  }
  if (parsed.identity.workspaceId !== workspaceId) {
    throw new Error("Published Company Profile V3 belongs to another workspace.");
  }
  return parsed;
}
