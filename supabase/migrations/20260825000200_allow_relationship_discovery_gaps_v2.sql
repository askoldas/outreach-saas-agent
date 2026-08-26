-- Relationship coverage is a first-class Discovery dimension in the V2 runtime.
-- Keep the persisted gap vocabulary aligned with the application contract.

alter table public.discovery_gaps_v2
  drop constraint if exists discovery_gaps_v2_gap_type_check;

alter table public.discovery_gaps_v2
  add constraint discovery_gaps_v2_gap_type_check check (gap_type in (
    'geography_undercovered',
    'archetype_undercovered',
    'relationship_undercovered',
    'language_not_attempted',
    'source_diversity_low',
    'unique_yield_low',
    'plausible_yield_low',
    'known_anchor_missing',
    'candidate_mix_unbalanced',
    'provider_failure',
    'strategy_ambiguity',
    'other'
  ));
