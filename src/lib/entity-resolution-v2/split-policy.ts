export type OrganizationMergeSnapshot = {
  mergeEventId: string;
  sourceOrganizationId: string;
  targetOrganizationId: string;
  reassignedSourceLinkIds: string[];
};

export type OrganizationSplitPlan = {
  mergeEventId: string;
  restoreOrganizationId: string;
  detachFromOrganizationId: string;
  restoreSourceLinkIds: string[];
};

export function buildSplitPlan(
  snapshot: OrganizationMergeSnapshot,
): OrganizationSplitPlan {
  return {
    mergeEventId: snapshot.mergeEventId,
    restoreOrganizationId: snapshot.sourceOrganizationId,
    detachFromOrganizationId: snapshot.targetOrganizationId,
    restoreSourceLinkIds: [...snapshot.reassignedSourceLinkIds],
  };
}
