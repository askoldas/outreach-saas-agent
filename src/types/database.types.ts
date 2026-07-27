export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      activity_events: {
        Row: {
          actor_user_id: string | null;
          created_at: string;
          description: string;
          entity_id: string | null;
          entity_type: string;
          event_type: string;
          id: string;
          label: string;
          metadata: Json;
          workspace_id: string;
        };
        Insert: {
          actor_user_id?: string | null;
          created_at?: string;
          description?: string;
          entity_id?: string | null;
          entity_type: string;
          event_type: string;
          id?: string;
          label: string;
          metadata?: Json;
          workspace_id: string;
        };
        Update: {
          actor_user_id?: string | null;
          created_at?: string;
          description?: string;
          entity_id?: string | null;
          entity_type?: string;
          event_type?: string;
          id?: string;
          label?: string;
          metadata?: Json;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_events_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_applied_changes: {
        Row: {
          applied_by: string | null;
          changes: Json;
          created_at: string;
          entity_id: string | null;
          guided_draft_id: string | null;
          id: string;
          scope: string;
          source_version: number;
          target_version: number;
          undo_metadata: Json;
          workspace_id: string;
        };
        Insert: {
          applied_by?: string | null;
          changes: Json;
          created_at?: string;
          entity_id?: string | null;
          guided_draft_id?: string | null;
          id?: string;
          scope: string;
          source_version: number;
          target_version: number;
          undo_metadata?: Json;
          workspace_id: string;
        };
        Update: {
          applied_by?: string | null;
          changes?: Json;
          created_at?: string;
          entity_id?: string | null;
          guided_draft_id?: string | null;
          id?: string;
          scope?: string;
          source_version?: number;
          target_version?: number;
          undo_metadata?: Json;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_applied_changes_guided_draft_id_fkey";
            columns: ["guided_draft_id"];
            isOneToOne: false;
            referencedRelation: "ai_guided_drafts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_applied_changes_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_conversations: {
        Row: {
          created_at: string;
          created_by: string | null;
          entity_id: string | null;
          id: string;
          scope: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          entity_id?: string | null;
          id?: string;
          scope: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          entity_id?: string | null;
          id?: string;
          scope?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_conversations_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_guided_drafts: {
        Row: {
          base_version: number;
          created_at: string;
          created_by: string | null;
          entity_id: string | null;
          id: string;
          proposal: Json;
          scope: string;
          status: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          base_version: number;
          created_at?: string;
          created_by?: string | null;
          entity_id?: string | null;
          id?: string;
          proposal?: Json;
          scope: string;
          status?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          base_version?: number;
          created_at?: string;
          created_by?: string | null;
          entity_id?: string | null;
          id?: string;
          proposal?: Json;
          scope?: string;
          status?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_guided_drafts_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_messages: {
        Row: {
          content: string;
          conversation_id: string;
          created_at: string;
          id: string;
          metadata: Json;
          role: string;
          workspace_id: string;
        };
        Insert: {
          content: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          role: string;
          workspace_id: string;
        };
        Update: {
          content?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          role?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "ai_conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_messages_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_model_configs: {
        Row: {
          cost_limit: number | null;
          created_at: string;
          currency: string;
          enabled: boolean;
          fallback_model_id: string | null;
          gateway: string;
          id: string;
          max_output_tokens: number | null;
          metadata: Json;
          model_id: string;
          provider: string;
          role: string;
          temperature: number | null;
          timeout_ms: number;
          updated_at: string;
          workspace_id: string | null;
        };
        Insert: {
          cost_limit?: number | null;
          created_at?: string;
          currency?: string;
          enabled?: boolean;
          fallback_model_id?: string | null;
          gateway?: string;
          id?: string;
          max_output_tokens?: number | null;
          metadata?: Json;
          model_id: string;
          provider: string;
          role: string;
          temperature?: number | null;
          timeout_ms?: number;
          updated_at?: string;
          workspace_id?: string | null;
        };
        Update: {
          cost_limit?: number | null;
          created_at?: string;
          currency?: string;
          enabled?: boolean;
          fallback_model_id?: string | null;
          gateway?: string;
          id?: string;
          max_output_tokens?: number | null;
          metadata?: Json;
          model_id?: string;
          provider?: string;
          role?: string;
          temperature?: number | null;
          timeout_ms?: number;
          updated_at?: string;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ai_model_configs_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_requests: {
        Row: {
          actual_cost: number;
          campaign_run_id: string | null;
          completed_at: string | null;
          created_at: string;
          currency: string;
          error_code: string | null;
          error_message: string | null;
          estimated_cost: number;
          fallback_model: string | null;
          fallback_used: boolean;
          id: string;
          input_units: number | null;
          metadata: Json;
          model_config_id: string | null;
          output_units: number | null;
          prompt_version: string;
          provider: string;
          provider_execution_id: string | null;
          request_hash: string;
          role: string;
          schema_version: string | null;
          selected_model: string;
          started_at: string | null;
          status: string;
          workspace_id: string;
        };
        Insert: {
          actual_cost?: number;
          campaign_run_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          currency?: string;
          error_code?: string | null;
          error_message?: string | null;
          estimated_cost?: number;
          fallback_model?: string | null;
          fallback_used?: boolean;
          id?: string;
          input_units?: number | null;
          metadata?: Json;
          model_config_id?: string | null;
          output_units?: number | null;
          prompt_version: string;
          provider: string;
          provider_execution_id?: string | null;
          request_hash: string;
          role: string;
          schema_version?: string | null;
          selected_model: string;
          started_at?: string | null;
          status: string;
          workspace_id: string;
        };
        Update: {
          actual_cost?: number;
          campaign_run_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          currency?: string;
          error_code?: string | null;
          error_message?: string | null;
          estimated_cost?: number;
          fallback_model?: string | null;
          fallback_used?: boolean;
          id?: string;
          input_units?: number | null;
          metadata?: Json;
          model_config_id?: string | null;
          output_units?: number | null;
          prompt_version?: string;
          provider?: string;
          provider_execution_id?: string | null;
          request_hash?: string;
          role?: string;
          schema_version?: string | null;
          selected_model?: string;
          started_at?: string | null;
          status?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_requests_campaign_run_id_fkey";
            columns: ["campaign_run_id"];
            isOneToOne: false;
            referencedRelation: "campaign_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_requests_model_config_id_fkey";
            columns: ["model_config_id"];
            isOneToOne: false;
            referencedRelation: "ai_model_configs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_requests_provider_execution_id_fkey";
            columns: ["provider_execution_id"];
            isOneToOne: false;
            referencedRelation: "provider_executions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_requests_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      budget_reservations: {
        Row: {
          campaign_run_id: string;
          created_at: string;
          currency: string;
          expires_at: string | null;
          id: string;
          idempotency_key: string;
          operation: string;
          reserved_amount: number;
          settled_amount: number | null;
          settled_at: string | null;
          status: string;
          workspace_id: string;
        };
        Insert: {
          campaign_run_id: string;
          created_at?: string;
          currency?: string;
          expires_at?: string | null;
          id?: string;
          idempotency_key: string;
          operation: string;
          reserved_amount: number;
          settled_amount?: number | null;
          settled_at?: string | null;
          status?: string;
          workspace_id: string;
        };
        Update: {
          campaign_run_id?: string;
          created_at?: string;
          currency?: string;
          expires_at?: string | null;
          id?: string;
          idempotency_key?: string;
          operation?: string;
          reserved_amount?: number;
          settled_amount?: number | null;
          settled_at?: string | null;
          status?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "budget_reservations_campaign_run_id_fkey";
            columns: ["campaign_run_id"];
            isOneToOne: false;
            referencedRelation: "campaign_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "budget_reservations_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      buyer_archetype_hypotheses: {
        Row: {
          archetype_key: string;
          claim_ids: string[];
          confidence: number;
          created_at: string;
          evidence_ids: string[];
          id: string;
          name: string;
          offering_version_id: string;
          priority: string;
          profile_draft_id: string | null;
          profile_version_id: string | null;
          relationship_type: string;
          status: string;
          structured_details_json: Json;
          workspace_id: string;
        };
        Insert: {
          archetype_key: string;
          claim_ids?: string[];
          confidence: number;
          created_at?: string;
          evidence_ids?: string[];
          id?: string;
          name: string;
          offering_version_id: string;
          priority: string;
          profile_draft_id?: string | null;
          profile_version_id?: string | null;
          relationship_type: string;
          status: string;
          structured_details_json?: Json;
          workspace_id: string;
        };
        Update: {
          archetype_key?: string;
          claim_ids?: string[];
          confidence?: number;
          created_at?: string;
          evidence_ids?: string[];
          id?: string;
          name?: string;
          offering_version_id?: string;
          priority?: string;
          profile_draft_id?: string | null;
          profile_version_id?: string | null;
          relationship_type?: string;
          status?: string;
          structured_details_json?: Json;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "buyer_archetype_hypotheses_offering_version_id_fkey";
            columns: ["offering_version_id"];
            isOneToOne: false;
            referencedRelation: "company_offering_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "buyer_archetype_hypotheses_profile_draft_id_fkey";
            columns: ["profile_draft_id"];
            isOneToOne: false;
            referencedRelation: "company_profile_drafts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "buyer_archetype_hypotheses_profile_version_id_fkey";
            columns: ["profile_version_id"];
            isOneToOne: false;
            referencedRelation: "company_profile_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "buyer_archetype_hypotheses_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_agent_checkpoints: {
        Row: {
          campaign_run_id: string;
          created_at: string;
          id: string;
          iteration: number;
          phase: string;
          state: Json;
          workspace_id: string;
        };
        Insert: {
          campaign_run_id: string;
          created_at?: string;
          id?: string;
          iteration: number;
          phase: string;
          state: Json;
          workspace_id: string;
        };
        Update: {
          campaign_run_id?: string;
          created_at?: string;
          id?: string;
          iteration?: number;
          phase?: string;
          state?: Json;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_agent_checkpoints_campaign_run_id_fkey";
            columns: ["campaign_run_id"];
            isOneToOne: false;
            referencedRelation: "campaign_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_agent_checkpoints_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_approvals: {
        Row: {
          approval_type: string;
          campaign_run_id: string;
          decided_at: string | null;
          decided_by: string | null;
          decision_notes: string | null;
          id: string;
          requested_at: string;
          requested_payload: Json;
          status: string;
          workspace_id: string;
        };
        Insert: {
          approval_type: string;
          campaign_run_id: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_notes?: string | null;
          id?: string;
          requested_at?: string;
          requested_payload?: Json;
          status?: string;
          workspace_id: string;
        };
        Update: {
          approval_type?: string;
          campaign_run_id?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_notes?: string | null;
          id?: string;
          requested_at?: string;
          requested_payload?: Json;
          status?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_approvals_campaign_run_id_fkey";
            columns: ["campaign_run_id"];
            isOneToOne: false;
            referencedRelation: "campaign_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_approvals_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_briefs: {
        Row: {
          actual_model: string;
          campaign_id: string;
          clarification_answer: Json | null;
          confidence: number;
          confirmed_brief: Json;
          created_at: string;
          created_by: string | null;
          fallback_used: boolean;
          id: string;
          profile_version_id: string;
          prompt_version: string;
          proposal: Json;
          requested_model: string;
          workspace_id: string;
        };
        Insert: {
          actual_model: string;
          campaign_id: string;
          clarification_answer?: Json | null;
          confidence: number;
          confirmed_brief: Json;
          created_at?: string;
          created_by?: string | null;
          fallback_used?: boolean;
          id?: string;
          profile_version_id: string;
          prompt_version: string;
          proposal: Json;
          requested_model: string;
          workspace_id: string;
        };
        Update: {
          actual_model?: string;
          campaign_id?: string;
          clarification_answer?: Json | null;
          confidence?: number;
          confirmed_brief?: Json;
          created_at?: string;
          created_by?: string | null;
          fallback_used?: boolean;
          id?: string;
          profile_version_id?: string;
          prompt_version?: string;
          proposal?: Json;
          requested_model?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_briefs_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: true;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_briefs_profile_version_id_fkey";
            columns: ["profile_version_id"];
            isOneToOne: false;
            referencedRelation: "company_profile_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_briefs_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_buyer_archetypes: {
        Row: {
          archetype_json: Json;
          archetype_key: string;
          campaign_strategy_draft_id: string | null;
          campaign_strategy_version_id: string | null;
          created_at: string;
          id: string;
          priority: string;
          relationship_type: string;
          user_confirmed: boolean;
          workspace_id: string;
        };
        Insert: {
          archetype_json: Json;
          archetype_key: string;
          campaign_strategy_draft_id?: string | null;
          campaign_strategy_version_id?: string | null;
          created_at?: string;
          id?: string;
          priority: string;
          relationship_type: string;
          user_confirmed?: boolean;
          workspace_id: string;
        };
        Update: {
          archetype_json?: Json;
          archetype_key?: string;
          campaign_strategy_draft_id?: string | null;
          campaign_strategy_version_id?: string | null;
          created_at?: string;
          id?: string;
          priority?: string;
          relationship_type?: string;
          user_confirmed?: boolean;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_buyer_archetypes_campaign_strategy_draft_id_fkey";
            columns: ["campaign_strategy_draft_id"];
            isOneToOne: false;
            referencedRelation: "campaign_strategy_drafts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_buyer_archetypes_campaign_strategy_version_id_fkey";
            columns: ["campaign_strategy_version_id"];
            isOneToOne: false;
            referencedRelation: "campaign_strategy_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_buyer_archetypes_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_candidate_claims: {
        Row: {
          campaign_candidate_id: string;
          campaign_strategy_version_id: string;
          claim_scope: string;
          created_at: string;
          id: string;
          intelligence_claim_id: string;
          workspace_id: string;
        };
        Insert: {
          campaign_candidate_id: string;
          campaign_strategy_version_id: string;
          claim_scope: string;
          created_at?: string;
          id?: string;
          intelligence_claim_id: string;
          workspace_id: string;
        };
        Update: {
          campaign_candidate_id?: string;
          campaign_strategy_version_id?: string;
          claim_scope?: string;
          created_at?: string;
          id?: string;
          intelligence_claim_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_candidate_claims_campaign_candidate_id_fkey";
            columns: ["campaign_candidate_id"];
            isOneToOne: false;
            referencedRelation: "campaign_candidates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_candidate_claims_campaign_strategy_version_id_fkey";
            columns: ["campaign_strategy_version_id"];
            isOneToOne: false;
            referencedRelation: "campaign_strategy_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_candidate_claims_intelligence_claim_id_fkey";
            columns: ["intelligence_claim_id"];
            isOneToOne: false;
            referencedRelation: "intelligence_claims";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_candidate_claims_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_candidate_discovery_links: {
        Row: {
          campaign_candidate_id: string;
          created_at: string;
          discovery_segment_key: string | null;
          id: string;
          normalized_candidate_id: string | null;
          provider_source_record_id: string | null;
          workspace_id: string;
        };
        Insert: {
          campaign_candidate_id: string;
          created_at?: string;
          discovery_segment_key?: string | null;
          id?: string;
          normalized_candidate_id?: string | null;
          provider_source_record_id?: string | null;
          workspace_id: string;
        };
        Update: {
          campaign_candidate_id?: string;
          created_at?: string;
          discovery_segment_key?: string | null;
          id?: string;
          normalized_candidate_id?: string | null;
          provider_source_record_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_candidate_discovery_lin_provider_source_record_id_fkey";
            columns: ["provider_source_record_id"];
            isOneToOne: false;
            referencedRelation: "provider_source_records";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_candidate_discovery_links_campaign_candidate_id_fkey";
            columns: ["campaign_candidate_id"];
            isOneToOne: false;
            referencedRelation: "campaign_candidates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_candidate_discovery_links_normalized_candidate_id_fkey";
            columns: ["normalized_candidate_id"];
            isOneToOne: false;
            referencedRelation: "normalized_provider_candidates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_candidate_discovery_links_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_candidates: {
        Row: {
          buying_organization_id: string | null;
          campaign_id: string;
          campaign_strategy_version_id: string;
          created_at: string;
          current_intelligence_version_id: string | null;
          discovered_country: string | null;
          display_organization_id: string;
          id: string;
          matched_archetype_ids_json: Json;
          organization_id: string;
          state: string;
          updated_at: string;
          user_review_status: string;
          workspace_id: string;
        };
        Insert: {
          buying_organization_id?: string | null;
          campaign_id: string;
          campaign_strategy_version_id: string;
          created_at?: string;
          current_intelligence_version_id?: string | null;
          discovered_country?: string | null;
          display_organization_id: string;
          id?: string;
          matched_archetype_ids_json?: Json;
          organization_id: string;
          state?: string;
          updated_at?: string;
          user_review_status?: string;
          workspace_id: string;
        };
        Update: {
          buying_organization_id?: string | null;
          campaign_id?: string;
          campaign_strategy_version_id?: string;
          created_at?: string;
          current_intelligence_version_id?: string | null;
          discovered_country?: string | null;
          display_organization_id?: string;
          id?: string;
          matched_archetype_ids_json?: Json;
          organization_id?: string;
          state?: string;
          updated_at?: string;
          user_review_status?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_candidates_buying_organization_id_fkey";
            columns: ["buying_organization_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_candidates_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_candidates_campaign_strategy_version_id_fkey";
            columns: ["campaign_strategy_version_id"];
            isOneToOne: false;
            referencedRelation: "campaign_strategy_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_candidates_current_intelligence_version_fk";
            columns: ["current_intelligence_version_id"];
            isOneToOne: false;
            referencedRelation: "candidate_intelligence_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_candidates_display_organization_id_fkey";
            columns: ["display_organization_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_candidates_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_candidates_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_companies: {
        Row: {
          campaign_id: string;
          campaign_run_id: string | null;
          company_id: string;
          discovery_rank: number | null;
          first_discovered_at: string;
          id: string;
          last_evaluated_at: string | null;
          metadata: Json;
          source_summary: string;
          status: string;
          user_notes: string;
          workspace_id: string;
        };
        Insert: {
          campaign_id: string;
          campaign_run_id?: string | null;
          company_id: string;
          discovery_rank?: number | null;
          first_discovered_at?: string;
          id?: string;
          last_evaluated_at?: string | null;
          metadata?: Json;
          source_summary?: string;
          status?: string;
          user_notes?: string;
          workspace_id: string;
        };
        Update: {
          campaign_id?: string;
          campaign_run_id?: string | null;
          company_id?: string;
          discovery_rank?: number | null;
          first_discovered_at?: string;
          id?: string;
          last_evaluated_at?: string | null;
          metadata?: Json;
          source_summary?: string;
          status?: string;
          user_notes?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_companies_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_companies_campaign_run_id_fkey";
            columns: ["campaign_run_id"];
            isOneToOne: false;
            referencedRelation: "campaign_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_companies_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_companies_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_contacts: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          campaign_company_id: string;
          contact_id: string | null;
          contact_method_id: string | null;
          created_at: string;
          id: string;
          recommendation_reason: string;
          role_relevance: string;
          selection_status: string;
          workspace_id: string;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          campaign_company_id: string;
          contact_id?: string | null;
          contact_method_id?: string | null;
          created_at?: string;
          id?: string;
          recommendation_reason?: string;
          role_relevance?: string;
          selection_status?: string;
          workspace_id: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          campaign_company_id?: string;
          contact_id?: string | null;
          contact_method_id?: string | null;
          created_at?: string;
          id?: string;
          recommendation_reason?: string;
          role_relevance?: string;
          selection_status?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_contacts_campaign_company_id_fkey";
            columns: ["campaign_company_id"];
            isOneToOne: false;
            referencedRelation: "campaign_companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_contacts_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_contacts_contact_method_id_fkey";
            columns: ["contact_method_id"];
            isOneToOne: false;
            referencedRelation: "contact_methods";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_contacts_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_inputs: {
        Row: {
          campaign_id: string;
          constraints_json: Json;
          created_at: string;
          created_by_user_id: string | null;
          geography_json: Json;
          id: string;
          initial_hypothesis_json: Json;
          input_hash: string;
          objective_json: Json;
          offer_variant_json: Json | null;
          offering_references_json: Json;
          requested_volume: number | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          campaign_id: string;
          constraints_json?: Json;
          created_at?: string;
          created_by_user_id?: string | null;
          geography_json: Json;
          id?: string;
          initial_hypothesis_json?: Json;
          input_hash: string;
          objective_json: Json;
          offer_variant_json?: Json | null;
          offering_references_json: Json;
          requested_volume?: number | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          campaign_id?: string;
          constraints_json?: Json;
          created_at?: string;
          created_by_user_id?: string | null;
          geography_json?: Json;
          id?: string;
          initial_hypothesis_json?: Json;
          input_hash?: string;
          objective_json?: Json;
          offer_variant_json?: Json | null;
          offering_references_json?: Json;
          requested_volume?: number | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_inputs_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_inputs_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_market_findings: {
        Row: {
          campaign_strategy_draft_id: string;
          created_at: string;
          evidence_ids: string[];
          finding_json: Json;
          finding_key: string;
          id: string;
          workspace_id: string;
        };
        Insert: {
          campaign_strategy_draft_id: string;
          created_at?: string;
          evidence_ids?: string[];
          finding_json: Json;
          finding_key: string;
          id?: string;
          workspace_id: string;
        };
        Update: {
          campaign_strategy_draft_id?: string;
          created_at?: string;
          evidence_ids?: string[];
          finding_json?: Json;
          finding_key?: string;
          id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_market_findings_campaign_strategy_draft_id_fkey";
            columns: ["campaign_strategy_draft_id"];
            isOneToOne: false;
            referencedRelation: "campaign_strategy_drafts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_market_findings_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_memories: {
        Row: {
          approval_status: string;
          campaign_id: string;
          campaign_run_id: string | null;
          category: string;
          confidence: string;
          created_at: string;
          embedding: string | null;
          evidence_ids: string[];
          expires_at: string | null;
          id: string;
          origin: string;
          retention_class: string;
          scope: string;
          statement: string;
          workspace_id: string;
        };
        Insert: {
          approval_status?: string;
          campaign_id: string;
          campaign_run_id?: string | null;
          category: string;
          confidence: string;
          created_at?: string;
          embedding?: string | null;
          evidence_ids?: string[];
          expires_at?: string | null;
          id?: string;
          origin: string;
          retention_class?: string;
          scope: string;
          statement: string;
          workspace_id: string;
        };
        Update: {
          approval_status?: string;
          campaign_id?: string;
          campaign_run_id?: string | null;
          category?: string;
          confidence?: string;
          created_at?: string;
          embedding?: string | null;
          evidence_ids?: string[];
          expires_at?: string | null;
          id?: string;
          origin?: string;
          retention_class?: string;
          scope?: string;
          statement?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_memories_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_memories_campaign_run_id_fkey";
            columns: ["campaign_run_id"];
            isOneToOne: false;
            referencedRelation: "campaign_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_memories_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_memory_snapshots: {
        Row: {
          campaign_id: string;
          campaign_strategy_version_id: string | null;
          content_hash: string;
          created_at: string;
          id: string;
          snapshot_json: Json;
          workspace_id: string;
        };
        Insert: {
          campaign_id: string;
          campaign_strategy_version_id?: string | null;
          content_hash: string;
          created_at?: string;
          id?: string;
          snapshot_json: Json;
          workspace_id: string;
        };
        Update: {
          campaign_id?: string;
          campaign_strategy_version_id?: string | null;
          content_hash?: string;
          created_at?: string;
          id?: string;
          snapshot_json?: Json;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_memory_snapshots_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_memory_snapshots_campaign_strategy_version_id_fkey";
            columns: ["campaign_strategy_version_id"];
            isOneToOne: false;
            referencedRelation: "campaign_strategy_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_memory_snapshots_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_objectives: {
        Row: {
          campaign_strategy_draft_id: string | null;
          campaign_strategy_version_id: string | null;
          created_at: string;
          id: string;
          objective_json: Json;
          workspace_id: string;
        };
        Insert: {
          campaign_strategy_draft_id?: string | null;
          campaign_strategy_version_id?: string | null;
          created_at?: string;
          id?: string;
          objective_json: Json;
          workspace_id: string;
        };
        Update: {
          campaign_strategy_draft_id?: string | null;
          campaign_strategy_version_id?: string | null;
          created_at?: string;
          id?: string;
          objective_json?: Json;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_objectives_campaign_strategy_draft_id_fkey";
            columns: ["campaign_strategy_draft_id"];
            isOneToOne: false;
            referencedRelation: "campaign_strategy_drafts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_objectives_campaign_strategy_version_id_fkey";
            columns: ["campaign_strategy_version_id"];
            isOneToOne: false;
            referencedRelation: "campaign_strategy_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_objectives_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_profile_snapshots: {
        Row: {
          campaign_id: string;
          company_profile_version_id: string;
          created_at: string;
          id: string;
          snapshot_data: Json;
          workspace_id: string;
        };
        Insert: {
          campaign_id: string;
          company_profile_version_id: string;
          created_at?: string;
          id?: string;
          snapshot_data: Json;
          workspace_id: string;
        };
        Update: {
          campaign_id?: string;
          company_profile_version_id?: string;
          created_at?: string;
          id?: string;
          snapshot_data?: Json;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_profile_snapshots_campaign_fk";
            columns: ["campaign_id"];
            isOneToOne: true;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_profile_snapshots_company_profile_version_id_fkey";
            columns: ["company_profile_version_id"];
            isOneToOne: false;
            referencedRelation: "company_profile_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_profile_snapshots_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_qualification_factor_definitions: {
        Row: {
          created_at: string;
          criticality: string;
          factor_json: Json;
          factor_key: string;
          id: string;
          purpose: string;
          qualification_rubric_id: string;
          sort_order: number;
          weight: number;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          criticality: string;
          factor_json: Json;
          factor_key: string;
          id?: string;
          purpose: string;
          qualification_rubric_id: string;
          sort_order: number;
          weight: number;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          criticality?: string;
          factor_json?: Json;
          factor_key?: string;
          id?: string;
          purpose?: string;
          qualification_rubric_id?: string;
          sort_order?: number;
          weight?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_qualification_factor_defi_qualification_rubric_id_fkey";
            columns: ["qualification_rubric_id"];
            isOneToOne: false;
            referencedRelation: "campaign_qualification_rubrics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_qualification_factor_definitions_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_qualification_rubrics: {
        Row: {
          campaign_strategy_draft_id: string | null;
          campaign_strategy_version_id: string | null;
          content_hash: string;
          created_at: string;
          id: string;
          policy_json: Json;
          scoring_version_id: string | null;
          workspace_id: string;
        };
        Insert: {
          campaign_strategy_draft_id?: string | null;
          campaign_strategy_version_id?: string | null;
          content_hash: string;
          created_at?: string;
          id?: string;
          policy_json: Json;
          scoring_version_id?: string | null;
          workspace_id: string;
        };
        Update: {
          campaign_strategy_draft_id?: string | null;
          campaign_strategy_version_id?: string | null;
          content_hash?: string;
          created_at?: string;
          id?: string;
          policy_json?: Json;
          scoring_version_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_qualification_rubric_campaign_strategy_version_id_fkey";
            columns: ["campaign_strategy_version_id"];
            isOneToOne: false;
            referencedRelation: "campaign_strategy_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_qualification_rubrics_campaign_strategy_draft_id_fkey";
            columns: ["campaign_strategy_draft_id"];
            isOneToOne: false;
            referencedRelation: "campaign_strategy_drafts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_qualification_rubrics_scoring_version_id_fkey";
            columns: ["scoring_version_id"];
            isOneToOne: false;
            referencedRelation: "scoring_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_qualification_rubrics_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_questions: {
        Row: {
          answer: Json | null;
          answered_at: string | null;
          answered_by: string | null;
          campaign_run_id: string;
          created_at: string;
          id: string;
          options: Json;
          question: string;
          question_type: string;
          status: string;
          workspace_id: string;
        };
        Insert: {
          answer?: Json | null;
          answered_at?: string | null;
          answered_by?: string | null;
          campaign_run_id: string;
          created_at?: string;
          id?: string;
          options?: Json;
          question: string;
          question_type: string;
          status?: string;
          workspace_id: string;
        };
        Update: {
          answer?: Json | null;
          answered_at?: string | null;
          answered_by?: string | null;
          campaign_run_id?: string;
          created_at?: string;
          id?: string;
          options?: Json;
          question?: string;
          question_type?: string;
          status?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_questions_campaign_run_id_fkey";
            columns: ["campaign_run_id"];
            isOneToOne: false;
            referencedRelation: "campaign_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_questions_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_rules_v2: {
        Row: {
          campaign_strategy_draft_id: string | null;
          campaign_strategy_version_id: string | null;
          created_at: string;
          id: string;
          rule_json: Json;
          rule_key: string;
          rule_type: string;
          status: string;
          strength: string;
          workspace_id: string;
        };
        Insert: {
          campaign_strategy_draft_id?: string | null;
          campaign_strategy_version_id?: string | null;
          created_at?: string;
          id?: string;
          rule_json: Json;
          rule_key: string;
          rule_type: string;
          status: string;
          strength: string;
          workspace_id: string;
        };
        Update: {
          campaign_strategy_draft_id?: string | null;
          campaign_strategy_version_id?: string | null;
          created_at?: string;
          id?: string;
          rule_json?: Json;
          rule_key?: string;
          rule_type?: string;
          status?: string;
          strength?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_rules_v2_campaign_strategy_draft_id_fkey";
            columns: ["campaign_strategy_draft_id"];
            isOneToOne: false;
            referencedRelation: "campaign_strategy_drafts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_rules_v2_campaign_strategy_version_id_fkey";
            columns: ["campaign_strategy_version_id"];
            isOneToOne: false;
            referencedRelation: "campaign_strategy_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_rules_v2_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_run_events: {
        Row: {
          campaign_run_id: string;
          created_at: string;
          details: Json;
          event_type: string;
          id: string;
          level: string;
          phase: string | null;
          summary: string;
          visible_to_user: boolean;
          workspace_id: string;
        };
        Insert: {
          campaign_run_id: string;
          created_at?: string;
          details?: Json;
          event_type: string;
          id?: string;
          level?: string;
          phase?: string | null;
          summary: string;
          visible_to_user?: boolean;
          workspace_id: string;
        };
        Update: {
          campaign_run_id?: string;
          created_at?: string;
          details?: Json;
          event_type?: string;
          id?: string;
          level?: string;
          phase?: string | null;
          summary?: string;
          visible_to_user?: boolean;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_run_events_campaign_run_id_fkey";
            columns: ["campaign_run_id"];
            isOneToOne: false;
            referencedRelation: "campaign_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_run_events_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_runs: {
        Row: {
          campaign_id: string;
          cancelled_at: string | null;
          candidates_classified: number;
          candidates_discovered: number;
          candidates_unique: number;
          companies_discovered: number;
          companies_evaluated: number;
          companies_qualified: number;
          completed_at: string | null;
          contacts_found: number;
          contract_versions: Json;
          created_at: string;
          currency: string;
          current_iteration: number;
          current_phase: string;
          dispatch_attempts: number;
          dispatch_key: string | null;
          dispatch_state: string;
          dispatch_updated_at: string;
          error_code: string | null;
          error_message: string | null;
          failed_at: string | null;
          id: string;
          last_dispatch_error: string | null;
          llm_cost: number;
          metadata: Json;
          profile_snapshot_id: string;
          progress_percentage: number;
          provider_cost: number;
          started_at: string | null;
          status: string;
          strategy_version_id: string;
          total_cost: number | null;
          trigger_run_id: string | null;
          updated_at: string;
          workflow_version: string;
          workspace_id: string;
        };
        Insert: {
          campaign_id: string;
          cancelled_at?: string | null;
          candidates_classified?: number;
          candidates_discovered?: number;
          candidates_unique?: number;
          companies_discovered?: number;
          companies_evaluated?: number;
          companies_qualified?: number;
          completed_at?: string | null;
          contacts_found?: number;
          contract_versions?: Json;
          created_at?: string;
          currency?: string;
          current_iteration?: number;
          current_phase?: string;
          dispatch_attempts?: number;
          dispatch_key?: string | null;
          dispatch_state?: string;
          dispatch_updated_at?: string;
          error_code?: string | null;
          error_message?: string | null;
          failed_at?: string | null;
          id?: string;
          last_dispatch_error?: string | null;
          llm_cost?: number;
          metadata?: Json;
          profile_snapshot_id: string;
          progress_percentage?: number;
          provider_cost?: number;
          started_at?: string | null;
          status?: string;
          strategy_version_id: string;
          total_cost?: number | null;
          trigger_run_id?: string | null;
          updated_at?: string;
          workflow_version?: string;
          workspace_id: string;
        };
        Update: {
          campaign_id?: string;
          cancelled_at?: string | null;
          candidates_classified?: number;
          candidates_discovered?: number;
          candidates_unique?: number;
          companies_discovered?: number;
          companies_evaluated?: number;
          companies_qualified?: number;
          completed_at?: string | null;
          contacts_found?: number;
          contract_versions?: Json;
          created_at?: string;
          currency?: string;
          current_iteration?: number;
          current_phase?: string;
          dispatch_attempts?: number;
          dispatch_key?: string | null;
          dispatch_state?: string;
          dispatch_updated_at?: string;
          error_code?: string | null;
          error_message?: string | null;
          failed_at?: string | null;
          id?: string;
          last_dispatch_error?: string | null;
          llm_cost?: number;
          metadata?: Json;
          profile_snapshot_id?: string;
          progress_percentage?: number;
          provider_cost?: number;
          started_at?: string | null;
          status?: string;
          strategy_version_id?: string;
          total_cost?: number | null;
          trigger_run_id?: string | null;
          updated_at?: string;
          workflow_version?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_runs_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_runs_profile_snapshot_id_fkey";
            columns: ["profile_snapshot_id"];
            isOneToOne: false;
            referencedRelation: "campaign_profile_snapshots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_runs_strategy_version_id_fkey";
            columns: ["strategy_version_id"];
            isOneToOne: false;
            referencedRelation: "campaign_strategy_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_runs_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_source_plans: {
        Row: {
          campaign_strategy_draft_id: string | null;
          campaign_strategy_version_id: string | null;
          created_at: string;
          id: string;
          source_plan_json: Json;
          workspace_id: string;
        };
        Insert: {
          campaign_strategy_draft_id?: string | null;
          campaign_strategy_version_id?: string | null;
          created_at?: string;
          id?: string;
          source_plan_json: Json;
          workspace_id: string;
        };
        Update: {
          campaign_strategy_draft_id?: string | null;
          campaign_strategy_version_id?: string | null;
          created_at?: string;
          id?: string;
          source_plan_json?: Json;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_source_plans_campaign_strategy_draft_id_fkey";
            columns: ["campaign_strategy_draft_id"];
            isOneToOne: false;
            referencedRelation: "campaign_strategy_drafts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_source_plans_campaign_strategy_version_id_fkey";
            columns: ["campaign_strategy_version_id"];
            isOneToOne: false;
            referencedRelation: "campaign_strategy_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_source_plans_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_strategy_diffs: {
        Row: {
          campaign_id: string;
          created_at: string;
          diff_json: Json;
          from_strategy_version_id: string | null;
          id: string;
          reevaluation_scope: string;
          to_strategy_version_id: string;
          workspace_id: string;
        };
        Insert: {
          campaign_id: string;
          created_at?: string;
          diff_json: Json;
          from_strategy_version_id?: string | null;
          id?: string;
          reevaluation_scope?: string;
          to_strategy_version_id: string;
          workspace_id: string;
        };
        Update: {
          campaign_id?: string;
          created_at?: string;
          diff_json?: Json;
          from_strategy_version_id?: string | null;
          id?: string;
          reevaluation_scope?: string;
          to_strategy_version_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_strategy_diffs_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_strategy_diffs_from_strategy_version_id_fkey";
            columns: ["from_strategy_version_id"];
            isOneToOne: false;
            referencedRelation: "campaign_strategy_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_strategy_diffs_to_strategy_version_id_fkey";
            columns: ["to_strategy_version_id"];
            isOneToOne: false;
            referencedRelation: "campaign_strategy_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_strategy_diffs_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_strategy_drafts: {
        Row: {
          base_strategy_version_id: string | null;
          campaign_id: string;
          campaign_input_id: string;
          compiled_context_hash: string | null;
          compiled_context_json: Json;
          compiled_draft_json: Json;
          compiler_version: string;
          content_hash: string | null;
          context_compiler_version: string;
          contract_version: string;
          created_at: string;
          created_by_run_id: string | null;
          created_by_user_id: string | null;
          id: string;
          profile_intelligence_version_id: string;
          state: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          base_strategy_version_id?: string | null;
          campaign_id: string;
          campaign_input_id: string;
          compiled_context_hash?: string | null;
          compiled_context_json?: Json;
          compiled_draft_json?: Json;
          compiler_version?: string;
          content_hash?: string | null;
          context_compiler_version?: string;
          contract_version?: string;
          created_at?: string;
          created_by_run_id?: string | null;
          created_by_user_id?: string | null;
          id?: string;
          profile_intelligence_version_id: string;
          state?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          base_strategy_version_id?: string | null;
          campaign_id?: string;
          campaign_input_id?: string;
          compiled_context_hash?: string | null;
          compiled_context_json?: Json;
          compiled_draft_json?: Json;
          compiler_version?: string;
          content_hash?: string | null;
          context_compiler_version?: string;
          contract_version?: string;
          created_at?: string;
          created_by_run_id?: string | null;
          created_by_user_id?: string | null;
          id?: string;
          profile_intelligence_version_id?: string;
          state?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_strategy_drafts_base_strategy_version_id_fkey";
            columns: ["base_strategy_version_id"];
            isOneToOne: false;
            referencedRelation: "campaign_strategy_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_strategy_drafts_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_strategy_drafts_campaign_input_id_fkey";
            columns: ["campaign_input_id"];
            isOneToOne: false;
            referencedRelation: "campaign_inputs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_strategy_drafts_profile_intelligence_version_id_fkey";
            columns: ["profile_intelligence_version_id"];
            isOneToOne: false;
            referencedRelation: "company_profile_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_strategy_drafts_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_strategy_events: {
        Row: {
          actor_type: string;
          actor_user_id: string | null;
          affected_paths: string[];
          campaign_id: string;
          campaign_strategy_draft_id: string | null;
          campaign_strategy_version_id: string | null;
          created_at: string;
          details_json: Json;
          event_type: string;
          id: string;
          workspace_id: string;
        };
        Insert: {
          actor_type: string;
          actor_user_id?: string | null;
          affected_paths?: string[];
          campaign_id: string;
          campaign_strategy_draft_id?: string | null;
          campaign_strategy_version_id?: string | null;
          created_at?: string;
          details_json?: Json;
          event_type: string;
          id?: string;
          workspace_id: string;
        };
        Update: {
          actor_type?: string;
          actor_user_id?: string | null;
          affected_paths?: string[];
          campaign_id?: string;
          campaign_strategy_draft_id?: string | null;
          campaign_strategy_version_id?: string | null;
          created_at?: string;
          details_json?: Json;
          event_type?: string;
          id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_strategy_events_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_strategy_events_campaign_strategy_draft_id_fkey";
            columns: ["campaign_strategy_draft_id"];
            isOneToOne: false;
            referencedRelation: "campaign_strategy_drafts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_strategy_events_campaign_strategy_version_id_fkey";
            columns: ["campaign_strategy_version_id"];
            isOneToOne: false;
            referencedRelation: "campaign_strategy_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_strategy_events_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_strategy_versions: {
        Row: {
          campaign_id: string;
          compiled_context_hash: string | null;
          confirmation_status: string;
          confirmed_at: string | null;
          confirmed_by: string | null;
          content_hash: string | null;
          contract_version: string;
          created_at: string;
          created_by: string | null;
          id: string;
          model_config_id: string | null;
          profile_intelligence_version_id: string | null;
          prompt_version: string | null;
          scoring_version_id: string | null;
          status: string;
          strategy: Json;
          version: number;
          workspace_id: string;
        };
        Insert: {
          campaign_id: string;
          compiled_context_hash?: string | null;
          confirmation_status?: string;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          content_hash?: string | null;
          contract_version?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          model_config_id?: string | null;
          profile_intelligence_version_id?: string | null;
          prompt_version?: string | null;
          scoring_version_id?: string | null;
          status?: string;
          strategy?: Json;
          version: number;
          workspace_id: string;
        };
        Update: {
          campaign_id?: string;
          compiled_context_hash?: string | null;
          confirmation_status?: string;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          content_hash?: string | null;
          contract_version?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          model_config_id?: string | null;
          profile_intelligence_version_id?: string | null;
          prompt_version?: string | null;
          scoring_version_id?: string | null;
          status?: string;
          strategy?: Json;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_strategy_versions_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_strategy_versions_model_config_fk";
            columns: ["model_config_id"];
            isOneToOne: false;
            referencedRelation: "ai_model_configs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_strategy_versions_profile_intelligence_version_id_fkey";
            columns: ["profile_intelligence_version_id"];
            isOneToOne: false;
            referencedRelation: "company_profile_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_strategy_versions_scoring_version_id_fkey";
            columns: ["scoring_version_id"];
            isOneToOne: false;
            referencedRelation: "scoring_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_strategy_versions_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      campaigns: {
        Row: {
          approval_settings: Json;
          budget_currency: string;
          budget_limit: number | null;
          company_characteristics: string[];
          created_at: string;
          created_by: string | null;
          current_strategy_draft_id: string | null;
          current_strategy_version_id: string | null;
          exclusions: string[];
          external_id: string;
          id: string;
          industries: string[];
          initial_target_description: string;
          intelligence_version: string;
          name: string;
          objective: string;
          outreach_enabled: boolean;
          preferred_outreach_language: string;
          profile_snapshot_id: string | null;
          relevant_use_case: string;
          selected_offering_id: string | null;
          status: string;
          target_geography: string;
          target_volume: number;
          updated_at: string;
          workflow_version: string;
          workspace_id: string;
        };
        Insert: {
          approval_settings?: Json;
          budget_currency?: string;
          budget_limit?: number | null;
          company_characteristics?: string[];
          created_at?: string;
          created_by?: string | null;
          current_strategy_draft_id?: string | null;
          current_strategy_version_id?: string | null;
          exclusions?: string[];
          external_id: string;
          id?: string;
          industries?: string[];
          initial_target_description?: string;
          intelligence_version?: string;
          name: string;
          objective: string;
          outreach_enabled?: boolean;
          preferred_outreach_language?: string;
          profile_snapshot_id?: string | null;
          relevant_use_case?: string;
          selected_offering_id?: string | null;
          status?: string;
          target_geography?: string;
          target_volume?: number;
          updated_at?: string;
          workflow_version?: string;
          workspace_id: string;
        };
        Update: {
          approval_settings?: Json;
          budget_currency?: string;
          budget_limit?: number | null;
          company_characteristics?: string[];
          created_at?: string;
          created_by?: string | null;
          current_strategy_draft_id?: string | null;
          current_strategy_version_id?: string | null;
          exclusions?: string[];
          external_id?: string;
          id?: string;
          industries?: string[];
          initial_target_description?: string;
          intelligence_version?: string;
          name?: string;
          objective?: string;
          outreach_enabled?: boolean;
          preferred_outreach_language?: string;
          profile_snapshot_id?: string | null;
          relevant_use_case?: string;
          selected_offering_id?: string | null;
          status?: string;
          target_geography?: string;
          target_volume?: number;
          updated_at?: string;
          workflow_version?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaigns_current_strategy_draft_id_fkey";
            columns: ["current_strategy_draft_id"];
            isOneToOne: false;
            referencedRelation: "campaign_strategy_drafts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaigns_current_strategy_fk";
            columns: ["current_strategy_version_id"];
            isOneToOne: false;
            referencedRelation: "campaign_strategy_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaigns_profile_snapshot_fk";
            columns: ["profile_snapshot_id"];
            isOneToOne: false;
            referencedRelation: "campaign_profile_snapshots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaigns_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      candidate_claims: {
        Row: {
          created_at: string;
          freshness_state: string;
          id: string;
          intelligence_claim_id: string;
          organization_id: string;
          reusable_status: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          freshness_state: string;
          id?: string;
          intelligence_claim_id: string;
          organization_id: string;
          reusable_status?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          freshness_state?: string;
          id?: string;
          intelligence_claim_id?: string;
          organization_id?: string;
          reusable_status?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_claims_intelligence_claim_id_fkey";
            columns: ["intelligence_claim_id"];
            isOneToOne: true;
            referencedRelation: "intelligence_claims";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "candidate_claims_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "candidate_claims_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      candidate_classifications: {
        Row: {
          actual_model: string | null;
          campaign_run_id: string;
          candidate_id: string;
          confidence: number;
          created_at: string;
          exclusion_reason: string | null;
          geography_match: boolean | null;
          id: string;
          input_hash: string;
          model_role: string | null;
          probable_category: string | null;
          prompt_version: string | null;
          reasons: string[];
          requested_model: string | null;
          should_evaluate: boolean;
          status: string;
          workspace_id: string;
        };
        Insert: {
          actual_model?: string | null;
          campaign_run_id: string;
          candidate_id: string;
          confidence: number;
          created_at?: string;
          exclusion_reason?: string | null;
          geography_match?: boolean | null;
          id?: string;
          input_hash: string;
          model_role?: string | null;
          probable_category?: string | null;
          prompt_version?: string | null;
          reasons?: string[];
          requested_model?: string | null;
          should_evaluate: boolean;
          status: string;
          workspace_id: string;
        };
        Update: {
          actual_model?: string | null;
          campaign_run_id?: string;
          candidate_id?: string;
          confidence?: number;
          created_at?: string;
          exclusion_reason?: string | null;
          geography_match?: boolean | null;
          id?: string;
          input_hash?: string;
          model_role?: string | null;
          probable_category?: string | null;
          prompt_version?: string | null;
          reasons?: string[];
          requested_model?: string | null;
          should_evaluate?: boolean;
          status?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_classifications_campaign_run_id_fkey";
            columns: ["campaign_run_id"];
            isOneToOne: false;
            referencedRelation: "campaign_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "candidate_classifications_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "discovery_candidates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "candidate_classifications_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      candidate_confidence_calculations: {
        Row: {
          candidate_evaluation_version_id: string;
          caps_json: Json;
          components_json: Json;
          created_at: string;
          id: string;
          overall_confidence: number;
          policy_version: string;
          workspace_id: string;
        };
        Insert: {
          candidate_evaluation_version_id: string;
          caps_json?: Json;
          components_json: Json;
          created_at?: string;
          id?: string;
          overall_confidence: number;
          policy_version: string;
          workspace_id: string;
        };
        Update: {
          candidate_evaluation_version_id?: string;
          caps_json?: Json;
          components_json?: Json;
          created_at?: string;
          id?: string;
          overall_confidence?: number;
          policy_version?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_confidence_calculat_candidate_evaluation_version_fkey";
            columns: ["candidate_evaluation_version_id"];
            isOneToOne: true;
            referencedRelation: "candidate_evaluation_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "candidate_confidence_calculations_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      candidate_eligibility_decisions: {
        Row: {
          candidate_evaluation_version_id: string;
          created_at: string;
          decided_by: string;
          eligibility: string;
          id: string;
          reason_code: string;
          reason_text: string;
          workspace_id: string;
        };
        Insert: {
          candidate_evaluation_version_id: string;
          created_at?: string;
          decided_by?: string;
          eligibility: string;
          id?: string;
          reason_code: string;
          reason_text: string;
          workspace_id: string;
        };
        Update: {
          candidate_evaluation_version_id?: string;
          created_at?: string;
          decided_by?: string;
          eligibility?: string;
          id?: string;
          reason_code?: string;
          reason_text?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_eligibility_decisio_candidate_evaluation_version_fkey";
            columns: ["candidate_evaluation_version_id"];
            isOneToOne: true;
            referencedRelation: "candidate_evaluation_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "candidate_eligibility_decisions_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      candidate_evaluation_events: {
        Row: {
          candidate_evaluation_version_id: string;
          created_at: string;
          event_payload_json: Json;
          event_type: string;
          id: string;
          workspace_id: string;
        };
        Insert: {
          candidate_evaluation_version_id: string;
          created_at?: string;
          event_payload_json?: Json;
          event_type: string;
          id?: string;
          workspace_id: string;
        };
        Update: {
          candidate_evaluation_version_id?: string;
          created_at?: string;
          event_payload_json?: Json;
          event_type?: string;
          id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_evaluation_events_candidate_evaluation_version_i_fkey";
            columns: ["candidate_evaluation_version_id"];
            isOneToOne: false;
            referencedRelation: "candidate_evaluation_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "candidate_evaluation_events_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      candidate_evaluation_versions: {
        Row: {
          campaign_candidate_id: string;
          campaign_strategy_version_id: string;
          candidate_intelligence_version_id: string;
          compiled_snapshot_json: Json;
          content_hash: string;
          created_at: string;
          finalized_at: string | null;
          id: string;
          qualification_rubric_id: string;
          status: string;
          version_number: number;
          workspace_id: string;
        };
        Insert: {
          campaign_candidate_id: string;
          campaign_strategy_version_id: string;
          candidate_intelligence_version_id: string;
          compiled_snapshot_json: Json;
          content_hash: string;
          created_at?: string;
          finalized_at?: string | null;
          id?: string;
          qualification_rubric_id: string;
          status?: string;
          version_number: number;
          workspace_id: string;
        };
        Update: {
          campaign_candidate_id?: string;
          campaign_strategy_version_id?: string;
          candidate_intelligence_version_id?: string;
          compiled_snapshot_json?: Json;
          content_hash?: string;
          created_at?: string;
          finalized_at?: string | null;
          id?: string;
          qualification_rubric_id?: string;
          status?: string;
          version_number?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_evaluation_versions_campaign_candidate_id_fkey";
            columns: ["campaign_candidate_id"];
            isOneToOne: false;
            referencedRelation: "campaign_candidates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "candidate_evaluation_versions_campaign_strategy_version_id_fkey";
            columns: ["campaign_strategy_version_id"];
            isOneToOne: false;
            referencedRelation: "campaign_strategy_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "candidate_evaluation_versions_candidate_intelligence_versi_fkey";
            columns: ["candidate_intelligence_version_id"];
            isOneToOne: false;
            referencedRelation: "candidate_intelligence_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "candidate_evaluation_versions_qualification_rubric_id_fkey";
            columns: ["qualification_rubric_id"];
            isOneToOne: false;
            referencedRelation: "qualification_rubrics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "candidate_evaluation_versions_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      candidate_exclusion_assessments: {
        Row: {
          candidate_evaluation_version_id: string;
          confidence: number;
          created_at: string;
          effect: string;
          evidence_ids_json: Json;
          id: string;
          reason: string;
          rule_key: string;
          state: string;
          strength: string;
          workspace_id: string;
        };
        Insert: {
          candidate_evaluation_version_id: string;
          confidence: number;
          created_at?: string;
          effect: string;
          evidence_ids_json?: Json;
          id?: string;
          reason: string;
          rule_key: string;
          state: string;
          strength: string;
          workspace_id: string;
        };
        Update: {
          candidate_evaluation_version_id?: string;
          confidence?: number;
          created_at?: string;
          effect?: string;
          evidence_ids_json?: Json;
          id?: string;
          reason?: string;
          rule_key?: string;
          state?: string;
          strength?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_exclusion_assessmen_candidate_evaluation_version_fkey";
            columns: ["candidate_evaluation_version_id"];
            isOneToOne: false;
            referencedRelation: "candidate_evaluation_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "candidate_exclusion_assessments_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      candidate_explanations: {
        Row: {
          candidate_evaluation_version_id: string;
          created_at: string;
          evidence_ids_json: Json;
          explanation_version: string;
          id: string;
          summary: string;
          workspace_id: string;
        };
        Insert: {
          candidate_evaluation_version_id: string;
          created_at?: string;
          evidence_ids_json: Json;
          explanation_version: string;
          id?: string;
          summary: string;
          workspace_id: string;
        };
        Update: {
          candidate_evaluation_version_id?: string;
          created_at?: string;
          evidence_ids_json?: Json;
          explanation_version?: string;
          id?: string;
          summary?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_explanations_candidate_evaluation_version_id_fkey";
            columns: ["candidate_evaluation_version_id"];
            isOneToOne: false;
            referencedRelation: "candidate_evaluation_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "candidate_explanations_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      candidate_factor_evaluations: {
        Row: {
          candidate_evaluation_version_id: string;
          confidence: number;
          counter_evidence_ids_json: Json;
          created_at: string;
          critical_gate_state: string | null;
          evidence_ids_json: Json;
          evidence_quality: number;
          explanation: string;
          factor_key: string;
          id: string;
          potential_value: number | null;
          signed_value: number | null;
          state: string;
          workspace_id: string;
        };
        Insert: {
          candidate_evaluation_version_id: string;
          confidence: number;
          counter_evidence_ids_json?: Json;
          created_at?: string;
          critical_gate_state?: string | null;
          evidence_ids_json?: Json;
          evidence_quality: number;
          explanation: string;
          factor_key: string;
          id?: string;
          potential_value?: number | null;
          signed_value?: number | null;
          state: string;
          workspace_id: string;
        };
        Update: {
          candidate_evaluation_version_id?: string;
          confidence?: number;
          counter_evidence_ids_json?: Json;
          created_at?: string;
          critical_gate_state?: string | null;
          evidence_ids_json?: Json;
          evidence_quality?: number;
          explanation?: string;
          factor_key?: string;
          id?: string;
          potential_value?: number | null;
          signed_value?: number | null;
          state?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_factor_evaluations_candidate_evaluation_version__fkey";
            columns: ["candidate_evaluation_version_id"];
            isOneToOne: false;
            referencedRelation: "candidate_evaluation_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "candidate_factor_evaluations_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      candidate_intelligence_versions: {
        Row: {
          claim_ids_json: Json;
          compiled_snapshot_json: Json;
          conflict_keys_json: Json;
          content_hash: string;
          created_at: string;
          evidence_ids_json: Json;
          id: string;
          organization_id: string;
          source_cutoff_at: string;
          unresolved_question_keys_json: Json;
          version_number: number;
          workspace_id: string;
        };
        Insert: {
          claim_ids_json: Json;
          compiled_snapshot_json: Json;
          conflict_keys_json?: Json;
          content_hash: string;
          created_at?: string;
          evidence_ids_json: Json;
          id?: string;
          organization_id: string;
          source_cutoff_at: string;
          unresolved_question_keys_json?: Json;
          version_number: number;
          workspace_id: string;
        };
        Update: {
          claim_ids_json?: Json;
          compiled_snapshot_json?: Json;
          conflict_keys_json?: Json;
          content_hash?: string;
          created_at?: string;
          evidence_ids_json?: Json;
          id?: string;
          organization_id?: string;
          source_cutoff_at?: string;
          unresolved_question_keys_json?: Json;
          version_number?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_intelligence_versions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "candidate_intelligence_versions_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      candidate_page_fetches: {
        Row: {
          access_status: string;
          canonical_url: string;
          content_hash: string | null;
          created_at: string;
          expires_at: string;
          freshness_window_started_at: string;
          http_status: number | null;
          id: string;
          organization_id: string;
          page_kind: string;
          raw_artifact_reference: string | null;
          retrieved_at: string;
          workspace_id: string;
        };
        Insert: {
          access_status: string;
          canonical_url: string;
          content_hash?: string | null;
          created_at?: string;
          expires_at: string;
          freshness_window_started_at: string;
          http_status?: number | null;
          id?: string;
          organization_id: string;
          page_kind: string;
          raw_artifact_reference?: string | null;
          retrieved_at: string;
          workspace_id: string;
        };
        Update: {
          access_status?: string;
          canonical_url?: string;
          content_hash?: string | null;
          created_at?: string;
          expires_at?: string;
          freshness_window_started_at?: string;
          http_status?: number | null;
          id?: string;
          organization_id?: string;
          page_kind?: string;
          raw_artifact_reference?: string | null;
          retrieved_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_page_fetches_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "candidate_page_fetches_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      candidate_rank_entries: {
        Row: {
          campaign_candidate_id: string;
          candidate_evaluation_version_id: string;
          created_at: string;
          id: string;
          lane: string;
          ordering_trace_json: Json;
          rank_overall: number;
          rank_snapshot_id: string;
          rank_within_lane: number;
          workspace_id: string;
        };
        Insert: {
          campaign_candidate_id: string;
          candidate_evaluation_version_id: string;
          created_at?: string;
          id?: string;
          lane: string;
          ordering_trace_json: Json;
          rank_overall: number;
          rank_snapshot_id: string;
          rank_within_lane: number;
          workspace_id: string;
        };
        Update: {
          campaign_candidate_id?: string;
          candidate_evaluation_version_id?: string;
          created_at?: string;
          id?: string;
          lane?: string;
          ordering_trace_json?: Json;
          rank_overall?: number;
          rank_snapshot_id?: string;
          rank_within_lane?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_rank_entries_campaign_candidate_id_fkey";
            columns: ["campaign_candidate_id"];
            isOneToOne: false;
            referencedRelation: "campaign_candidates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "candidate_rank_entries_candidate_evaluation_version_id_fkey";
            columns: ["candidate_evaluation_version_id"];
            isOneToOne: false;
            referencedRelation: "candidate_evaluation_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "candidate_rank_entries_rank_snapshot_id_fkey";
            columns: ["rank_snapshot_id"];
            isOneToOne: false;
            referencedRelation: "candidate_rank_snapshots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "candidate_rank_entries_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      candidate_rank_snapshots: {
        Row: {
          anomaly_resolution_ids_json: Json;
          campaign_id: string;
          campaign_strategy_version_id: string;
          comparative_batch_ids_json: Json;
          content_hash: string;
          created_at: string;
          id: string;
          included_evaluation_ids_json: Json;
          ordering_policy_version: string;
          version_number: number;
          workspace_id: string;
        };
        Insert: {
          anomaly_resolution_ids_json?: Json;
          campaign_id: string;
          campaign_strategy_version_id: string;
          comparative_batch_ids_json?: Json;
          content_hash: string;
          created_at?: string;
          id?: string;
          included_evaluation_ids_json: Json;
          ordering_policy_version: string;
          version_number: number;
          workspace_id: string;
        };
        Update: {
          anomaly_resolution_ids_json?: Json;
          campaign_id?: string;
          campaign_strategy_version_id?: string;
          comparative_batch_ids_json?: Json;
          content_hash?: string;
          created_at?: string;
          id?: string;
          included_evaluation_ids_json?: Json;
          ordering_policy_version?: string;
          version_number?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_rank_snapshots_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "candidate_rank_snapshots_campaign_strategy_version_id_fkey";
            columns: ["campaign_strategy_version_id"];
            isOneToOne: false;
            referencedRelation: "campaign_strategy_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "candidate_rank_snapshots_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      candidate_relationship_assessments: {
        Row: {
          candidate_evaluation_version_id: string;
          confidence: number;
          created_at: string;
          decision_basis: string;
          evidence_ids_json: Json;
          id: string;
          primary_relationship: string;
          secondary_relationships_json: Json;
          unresolved_questions_json: Json;
          workspace_id: string;
        };
        Insert: {
          candidate_evaluation_version_id: string;
          confidence: number;
          created_at?: string;
          decision_basis: string;
          evidence_ids_json?: Json;
          id?: string;
          primary_relationship: string;
          secondary_relationships_json?: Json;
          unresolved_questions_json?: Json;
          workspace_id: string;
        };
        Update: {
          candidate_evaluation_version_id?: string;
          confidence?: number;
          created_at?: string;
          decision_basis?: string;
          evidence_ids_json?: Json;
          id?: string;
          primary_relationship?: string;
          secondary_relationships_json?: Json;
          unresolved_questions_json?: Json;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_relationship_assess_candidate_evaluation_version_fkey";
            columns: ["candidate_evaluation_version_id"];
            isOneToOne: true;
            referencedRelation: "candidate_evaluation_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "candidate_relationship_assessments_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      candidate_research_plans: {
        Row: {
          campaign_candidate_id: string | null;
          campaign_strategy_version_id: string | null;
          content_hash: string;
          created_at: string;
          id: string;
          organization_id: string;
          page_budget: number;
          priority: number;
          questions_json: Json;
          research_type: string;
          source_plan_json: Json;
          status: string;
          stop_policy_json: Json;
          version_number: number;
          workspace_id: string;
        };
        Insert: {
          campaign_candidate_id?: string | null;
          campaign_strategy_version_id?: string | null;
          content_hash: string;
          created_at?: string;
          id?: string;
          organization_id: string;
          page_budget: number;
          priority: number;
          questions_json: Json;
          research_type: string;
          source_plan_json: Json;
          status?: string;
          stop_policy_json: Json;
          version_number: number;
          workspace_id: string;
        };
        Update: {
          campaign_candidate_id?: string | null;
          campaign_strategy_version_id?: string | null;
          content_hash?: string;
          created_at?: string;
          id?: string;
          organization_id?: string;
          page_budget?: number;
          priority?: number;
          questions_json?: Json;
          research_type?: string;
          source_plan_json?: Json;
          status?: string;
          stop_policy_json?: Json;
          version_number?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_research_plans_campaign_candidate_id_fkey";
            columns: ["campaign_candidate_id"];
            isOneToOne: false;
            referencedRelation: "campaign_candidates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "candidate_research_plans_campaign_strategy_version_id_fkey";
            columns: ["campaign_strategy_version_id"];
            isOneToOne: false;
            referencedRelation: "campaign_strategy_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "candidate_research_plans_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "candidate_research_plans_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      candidate_research_tasks: {
        Row: {
          completed_at: string | null;
          created_at: string;
          error_code: string | null;
          evidence_id: string | null;
          id: string;
          idempotency_key: string;
          priority: number;
          question_key: string;
          research_plan_id: string;
          result_reference_json: Json | null;
          source_url: string | null;
          started_at: string | null;
          status: string;
          task_type: string;
          workspace_id: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          error_code?: string | null;
          evidence_id?: string | null;
          id?: string;
          idempotency_key: string;
          priority: number;
          question_key: string;
          research_plan_id: string;
          result_reference_json?: Json | null;
          source_url?: string | null;
          started_at?: string | null;
          status?: string;
          task_type: string;
          workspace_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          error_code?: string | null;
          evidence_id?: string | null;
          id?: string;
          idempotency_key?: string;
          priority?: number;
          question_key?: string;
          research_plan_id?: string;
          result_reference_json?: Json | null;
          source_url?: string | null;
          started_at?: string | null;
          status?: string;
          task_type?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_research_tasks_evidence_id_fkey";
            columns: ["evidence_id"];
            isOneToOne: false;
            referencedRelation: "evidence_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "candidate_research_tasks_research_plan_id_fkey";
            columns: ["research_plan_id"];
            isOneToOne: false;
            referencedRelation: "candidate_research_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "candidate_research_tasks_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      candidate_review_lane_assignments: {
        Row: {
          candidate_evaluation_version_id: string;
          created_at: string;
          id: string;
          lane: string;
          reason: string;
          workspace_id: string;
        };
        Insert: {
          candidate_evaluation_version_id: string;
          created_at?: string;
          id?: string;
          lane: string;
          reason: string;
          workspace_id: string;
        };
        Update: {
          candidate_evaluation_version_id?: string;
          created_at?: string;
          id?: string;
          lane?: string;
          reason?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_review_lane_assignm_candidate_evaluation_version_fkey";
            columns: ["candidate_evaluation_version_id"];
            isOneToOne: true;
            referencedRelation: "candidate_evaluation_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "candidate_review_lane_assignments_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      candidate_score_calculations: {
        Row: {
          candidate_evaluation_version_id: string;
          created_at: string;
          denominator: number;
          id: string;
          policy_version: string;
          raw_weighted_mean: number | null;
          score: number | null;
          score_type: string;
          trace_json: Json;
          workspace_id: string;
        };
        Insert: {
          candidate_evaluation_version_id: string;
          created_at?: string;
          denominator: number;
          id?: string;
          policy_version: string;
          raw_weighted_mean?: number | null;
          score?: number | null;
          score_type: string;
          trace_json: Json;
          workspace_id: string;
        };
        Update: {
          candidate_evaluation_version_id?: string;
          created_at?: string;
          denominator?: number;
          id?: string;
          policy_version?: string;
          raw_weighted_mean?: number | null;
          score?: number | null;
          score_type?: string;
          trace_json?: Json;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_score_calculations_candidate_evaluation_version__fkey";
            columns: ["candidate_evaluation_version_id"];
            isOneToOne: false;
            referencedRelation: "candidate_evaluation_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "candidate_score_calculations_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      claim_conflicts: {
        Row: {
          claim_key: string;
          created_at: string;
          first_claim_id: string;
          id: string;
          resolution: string | null;
          resolved_at: string | null;
          resolved_by_user_id: string | null;
          second_claim_id: string;
          status: string;
          subject_id: string;
          subject_type: string;
          winning_claim_id: string | null;
          workspace_id: string;
        };
        Insert: {
          claim_key: string;
          created_at?: string;
          first_claim_id: string;
          id?: string;
          resolution?: string | null;
          resolved_at?: string | null;
          resolved_by_user_id?: string | null;
          second_claim_id: string;
          status?: string;
          subject_id: string;
          subject_type: string;
          winning_claim_id?: string | null;
          workspace_id: string;
        };
        Update: {
          claim_key?: string;
          created_at?: string;
          first_claim_id?: string;
          id?: string;
          resolution?: string | null;
          resolved_at?: string | null;
          resolved_by_user_id?: string | null;
          second_claim_id?: string;
          status?: string;
          subject_id?: string;
          subject_type?: string;
          winning_claim_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "claim_conflicts_first_claim_id_fkey";
            columns: ["first_claim_id"];
            isOneToOne: false;
            referencedRelation: "intelligence_claims";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claim_conflicts_second_claim_id_fkey";
            columns: ["second_claim_id"];
            isOneToOne: false;
            referencedRelation: "intelligence_claims";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claim_conflicts_winning_claim_id_fkey";
            columns: ["winning_claim_id"];
            isOneToOne: false;
            referencedRelation: "intelligence_claims";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claim_conflicts_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      claim_evidence_links: {
        Row: {
          claim_id: string;
          created_at: string;
          evidence_id: string;
          stance: string;
          weight: number | null;
          workspace_id: string;
        };
        Insert: {
          claim_id: string;
          created_at?: string;
          evidence_id: string;
          stance: string;
          weight?: number | null;
          workspace_id: string;
        };
        Update: {
          claim_id?: string;
          created_at?: string;
          evidence_id?: string;
          stance?: string;
          weight?: number | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "claim_evidence_links_claim_id_fkey";
            columns: ["claim_id"];
            isOneToOne: false;
            referencedRelation: "intelligence_claims";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claim_evidence_links_evidence_id_fkey";
            columns: ["evidence_id"];
            isOneToOne: false;
            referencedRelation: "evidence_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claim_evidence_links_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      commercial_rules: {
        Row: {
          applicability_json: Json;
          confidence: number;
          created_at: string;
          description: string;
          evidence_ids: string[];
          id: string;
          profile_draft_id: string | null;
          profile_version_id: string | null;
          rule_key: string;
          rule_type: string;
          scope: string;
          scope_id: string;
          source: string;
          status: string;
          strength: string;
          workspace_id: string;
        };
        Insert: {
          applicability_json?: Json;
          confidence: number;
          created_at?: string;
          description: string;
          evidence_ids?: string[];
          id?: string;
          profile_draft_id?: string | null;
          profile_version_id?: string | null;
          rule_key: string;
          rule_type: string;
          scope: string;
          scope_id: string;
          source: string;
          status: string;
          strength: string;
          workspace_id: string;
        };
        Update: {
          applicability_json?: Json;
          confidence?: number;
          created_at?: string;
          description?: string;
          evidence_ids?: string[];
          id?: string;
          profile_draft_id?: string | null;
          profile_version_id?: string | null;
          rule_key?: string;
          rule_type?: string;
          scope?: string;
          scope_id?: string;
          source?: string;
          status?: string;
          strength?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "commercial_rules_profile_draft_id_fkey";
            columns: ["profile_draft_id"];
            isOneToOne: false;
            referencedRelation: "company_profile_drafts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commercial_rules_profile_version_id_fkey";
            columns: ["profile_version_id"];
            isOneToOne: false;
            referencedRelation: "company_profile_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commercial_rules_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      companies: {
        Row: {
          city: string | null;
          company_type: string | null;
          country: string | null;
          created_at: string;
          description: string;
          estimated_size: string | null;
          id: string;
          identity_confidence: number;
          identity_review_state: string;
          industry: string | null;
          merged_into_company_id: string | null;
          metadata: Json;
          name: string;
          normalized_name: string;
          operating_status: string;
          organization_type: string;
          updated_at: string;
          website_url: string | null;
          workspace_id: string;
        };
        Insert: {
          city?: string | null;
          company_type?: string | null;
          country?: string | null;
          created_at?: string;
          description?: string;
          estimated_size?: string | null;
          id?: string;
          identity_confidence?: number;
          identity_review_state?: string;
          industry?: string | null;
          merged_into_company_id?: string | null;
          metadata?: Json;
          name: string;
          normalized_name: string;
          operating_status?: string;
          organization_type?: string;
          updated_at?: string;
          website_url?: string | null;
          workspace_id: string;
        };
        Update: {
          city?: string | null;
          company_type?: string | null;
          country?: string | null;
          created_at?: string;
          description?: string;
          estimated_size?: string | null;
          id?: string;
          identity_confidence?: number;
          identity_review_state?: string;
          industry?: string | null;
          merged_into_company_id?: string | null;
          metadata?: Json;
          name?: string;
          normalized_name?: string;
          operating_status?: string;
          organization_type?: string;
          updated_at?: string;
          website_url?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "companies_merged_into_company_id_fkey";
            columns: ["merged_into_company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "companies_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      company_business_models: {
        Row: {
          confidence: number;
          created_at: string;
          customer_usage_mode: string | null;
          id: string;
          primary_role: string | null;
          profile_draft_id: string | null;
          profile_version_id: string | null;
          revenue_model: string | null;
          sales_motion: string | null;
          structured_details_json: Json;
          transaction_model: string | null;
          workspace_id: string;
        };
        Insert: {
          confidence?: number;
          created_at?: string;
          customer_usage_mode?: string | null;
          id?: string;
          primary_role?: string | null;
          profile_draft_id?: string | null;
          profile_version_id?: string | null;
          revenue_model?: string | null;
          sales_motion?: string | null;
          structured_details_json?: Json;
          transaction_model?: string | null;
          workspace_id: string;
        };
        Update: {
          confidence?: number;
          created_at?: string;
          customer_usage_mode?: string | null;
          id?: string;
          primary_role?: string | null;
          profile_draft_id?: string | null;
          profile_version_id?: string | null;
          revenue_model?: string | null;
          sales_motion?: string | null;
          structured_details_json?: Json;
          transaction_model?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_business_models_profile_draft_id_fkey";
            columns: ["profile_draft_id"];
            isOneToOne: false;
            referencedRelation: "company_profile_drafts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_business_models_profile_version_id_fkey";
            columns: ["profile_version_id"];
            isOneToOne: false;
            referencedRelation: "company_profile_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_business_models_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      company_business_roles: {
        Row: {
          business_model_id: string;
          claim_id: string | null;
          confidence: number;
          created_at: string;
          evidence_ids: string[];
          explanation: string;
          id: string;
          priority: string;
          role_type: string;
          workspace_id: string;
        };
        Insert: {
          business_model_id: string;
          claim_id?: string | null;
          confidence: number;
          created_at?: string;
          evidence_ids?: string[];
          explanation?: string;
          id?: string;
          priority: string;
          role_type: string;
          workspace_id: string;
        };
        Update: {
          business_model_id?: string;
          claim_id?: string | null;
          confidence?: number;
          created_at?: string;
          evidence_ids?: string[];
          explanation?: string;
          id?: string;
          priority?: string;
          role_type?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_business_roles_business_model_id_fkey";
            columns: ["business_model_id"];
            isOneToOne: false;
            referencedRelation: "company_business_models";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_business_roles_claim_id_fkey";
            columns: ["claim_id"];
            isOneToOne: false;
            referencedRelation: "intelligence_claims";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_business_roles_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      company_domains: {
        Row: {
          collision_status: string;
          company_id: string;
          created_at: string;
          domain: string;
          domain_role: string;
          evidence_ids_json: Json;
          id: string;
          is_primary: boolean;
          metadata: Json;
          normalized_domain: string;
          redirects_to_domain_id: string | null;
          verification_status: string;
          workspace_id: string;
        };
        Insert: {
          collision_status?: string;
          company_id: string;
          created_at?: string;
          domain: string;
          domain_role?: string;
          evidence_ids_json?: Json;
          id?: string;
          is_primary?: boolean;
          metadata?: Json;
          normalized_domain: string;
          redirects_to_domain_id?: string | null;
          verification_status?: string;
          workspace_id: string;
        };
        Update: {
          collision_status?: string;
          company_id?: string;
          created_at?: string;
          domain?: string;
          domain_role?: string;
          evidence_ids_json?: Json;
          id?: string;
          is_primary?: boolean;
          metadata?: Json;
          normalized_domain?: string;
          redirects_to_domain_id?: string | null;
          verification_status?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_domains_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_domains_redirects_to_domain_id_fkey";
            columns: ["redirects_to_domain_id"];
            isOneToOne: false;
            referencedRelation: "company_domains";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_domains_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      company_offering_versions: {
        Row: {
          availability_json: Json;
          buyer_logic_json: Json;
          claim_ids: string[];
          commercial_mechanics_json: Json;
          company_offering_id: string;
          confidence: number;
          constraints_json: Json;
          created_at: string;
          evidence_ids: string[];
          id: string;
          name: string;
          offering_type: string;
          profile_draft_id: string | null;
          profile_version_id: string | null;
          relationship_options_json: Json;
          short_description: string;
          slug: string;
          status: string;
          workspace_id: string;
        };
        Insert: {
          availability_json?: Json;
          buyer_logic_json?: Json;
          claim_ids?: string[];
          commercial_mechanics_json?: Json;
          company_offering_id: string;
          confidence: number;
          constraints_json?: Json;
          created_at?: string;
          evidence_ids?: string[];
          id?: string;
          name: string;
          offering_type: string;
          profile_draft_id?: string | null;
          profile_version_id?: string | null;
          relationship_options_json?: Json;
          short_description: string;
          slug: string;
          status: string;
          workspace_id: string;
        };
        Update: {
          availability_json?: Json;
          buyer_logic_json?: Json;
          claim_ids?: string[];
          commercial_mechanics_json?: Json;
          company_offering_id?: string;
          confidence?: number;
          constraints_json?: Json;
          created_at?: string;
          evidence_ids?: string[];
          id?: string;
          name?: string;
          offering_type?: string;
          profile_draft_id?: string | null;
          profile_version_id?: string | null;
          relationship_options_json?: Json;
          short_description?: string;
          slug?: string;
          status?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_offering_versions_company_offering_id_fkey";
            columns: ["company_offering_id"];
            isOneToOne: false;
            referencedRelation: "company_offerings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_offering_versions_profile_draft_id_fkey";
            columns: ["profile_draft_id"];
            isOneToOne: false;
            referencedRelation: "company_profile_drafts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_offering_versions_profile_version_id_fkey";
            columns: ["profile_version_id"];
            isOneToOne: false;
            referencedRelation: "company_profile_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_offering_versions_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      company_offerings: {
        Row: {
          archived_at: string | null;
          company_profile_id: string;
          created_at: string;
          id: string;
          stable_key: string;
          workspace_id: string;
        };
        Insert: {
          archived_at?: string | null;
          company_profile_id: string;
          created_at?: string;
          id?: string;
          stable_key: string;
          workspace_id: string;
        };
        Update: {
          archived_at?: string | null;
          company_profile_id?: string;
          created_at?: string;
          id?: string;
          stable_key?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_offerings_company_profile_id_fkey";
            columns: ["company_profile_id"];
            isOneToOne: false;
            referencedRelation: "company_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_offerings_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      company_profile_drafts: {
        Row: {
          base_version_id: string | null;
          company_profile_id: string;
          compiled_snapshot_hash: string | null;
          compiled_snapshot_json: Json;
          contract_version: string;
          created_at: string;
          created_by_run_id: string | null;
          created_by_user_id: string | null;
          id: string;
          input_hash: string;
          source_set_hash: string | null;
          state: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          base_version_id?: string | null;
          company_profile_id: string;
          compiled_snapshot_hash?: string | null;
          compiled_snapshot_json?: Json;
          contract_version?: string;
          created_at?: string;
          created_by_run_id?: string | null;
          created_by_user_id?: string | null;
          id?: string;
          input_hash: string;
          source_set_hash?: string | null;
          state?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          base_version_id?: string | null;
          company_profile_id?: string;
          compiled_snapshot_hash?: string | null;
          compiled_snapshot_json?: Json;
          contract_version?: string;
          created_at?: string;
          created_by_run_id?: string | null;
          created_by_user_id?: string | null;
          id?: string;
          input_hash?: string;
          source_set_hash?: string | null;
          state?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_profile_drafts_base_version_id_fkey";
            columns: ["base_version_id"];
            isOneToOne: false;
            referencedRelation: "company_profile_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_profile_drafts_company_profile_id_fkey";
            columns: ["company_profile_id"];
            isOneToOne: false;
            referencedRelation: "company_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_profile_drafts_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      company_profile_versions: {
        Row: {
          analysis_execution_id: string | null;
          analysis_model_config_id: string | null;
          analysis_prompt_version: string | null;
          company_name: string;
          company_profile_id: string;
          created_at: string;
          created_by: string | null;
          extracted_facts: Json;
          id: string;
          intelligence_version: string;
          profile_status: string;
          provenance: string;
          readiness_score: number;
          review_questions: Json;
          structured_profile: Json;
          summary: string;
          version: number;
          website_url: string | null;
          workspace_id: string;
        };
        Insert: {
          analysis_execution_id?: string | null;
          analysis_model_config_id?: string | null;
          analysis_prompt_version?: string | null;
          company_name?: string;
          company_profile_id: string;
          created_at?: string;
          created_by?: string | null;
          extracted_facts?: Json;
          id?: string;
          intelligence_version?: string;
          profile_status?: string;
          provenance?: string;
          readiness_score?: number;
          review_questions?: Json;
          structured_profile?: Json;
          summary?: string;
          version: number;
          website_url?: string | null;
          workspace_id: string;
        };
        Update: {
          analysis_execution_id?: string | null;
          analysis_model_config_id?: string | null;
          analysis_prompt_version?: string | null;
          company_name?: string;
          company_profile_id?: string;
          created_at?: string;
          created_by?: string | null;
          extracted_facts?: Json;
          id?: string;
          intelligence_version?: string;
          profile_status?: string;
          provenance?: string;
          readiness_score?: number;
          review_questions?: Json;
          structured_profile?: Json;
          summary?: string;
          version?: number;
          website_url?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_profile_versions_analysis_execution_id_fkey";
            columns: ["analysis_execution_id"];
            isOneToOne: false;
            referencedRelation: "provider_executions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_profile_versions_company_profile_id_fkey";
            columns: ["company_profile_id"];
            isOneToOne: false;
            referencedRelation: "company_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_profile_versions_model_config_fk";
            columns: ["analysis_model_config_id"];
            isOneToOne: false;
            referencedRelation: "ai_model_configs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_profile_versions_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      company_profiles: {
        Row: {
          created_at: string;
          current_v3_draft_id: string | null;
          current_version_id: string | null;
          id: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          current_v3_draft_id?: string | null;
          current_version_id?: string | null;
          id?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          current_v3_draft_id?: string | null;
          current_version_id?: string | null;
          id?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_profiles_current_v3_draft_id_fkey";
            columns: ["current_v3_draft_id"];
            isOneToOne: false;
            referencedRelation: "company_profile_drafts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_profiles_current_version_fk";
            columns: ["current_version_id"];
            isOneToOne: false;
            referencedRelation: "company_profile_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_profiles_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: true;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      company_sources: {
        Row: {
          campaign_run_id: string | null;
          company_id: string | null;
          excerpt: string;
          id: string;
          metadata: Json;
          original_url: string;
          provider: string;
          provider_reference: string | null;
          query: string | null;
          raw_content: string | null;
          retrieved_at: string;
          source_type: string;
          source_url: string;
          title: string;
          workspace_id: string;
        };
        Insert: {
          campaign_run_id?: string | null;
          company_id?: string | null;
          excerpt?: string;
          id?: string;
          metadata?: Json;
          original_url: string;
          provider: string;
          provider_reference?: string | null;
          query?: string | null;
          raw_content?: string | null;
          retrieved_at?: string;
          source_type: string;
          source_url: string;
          title?: string;
          workspace_id: string;
        };
        Update: {
          campaign_run_id?: string | null;
          company_id?: string | null;
          excerpt?: string;
          id?: string;
          metadata?: Json;
          original_url?: string;
          provider?: string;
          provider_reference?: string | null;
          query?: string | null;
          raw_content?: string | null;
          retrieved_at?: string;
          source_type?: string;
          source_url?: string;
          title?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_sources_campaign_run_id_fkey";
            columns: ["campaign_run_id"];
            isOneToOne: false;
            referencedRelation: "campaign_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_sources_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_sources_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      comparative_anomalies: {
        Row: {
          anomaly_type: string;
          blocks_finalization: boolean;
          candidate_ids_json: Json;
          comparative_batch_id: string;
          created_at: string;
          explanation: string;
          factor_keys_json: Json;
          id: string;
          recommended_action: string;
          resolution_json: Json | null;
          resolved_at: string | null;
          severity: string;
          status: string;
          workspace_id: string;
        };
        Insert: {
          anomaly_type: string;
          blocks_finalization: boolean;
          candidate_ids_json: Json;
          comparative_batch_id: string;
          created_at?: string;
          explanation: string;
          factor_keys_json?: Json;
          id?: string;
          recommended_action: string;
          resolution_json?: Json | null;
          resolved_at?: string | null;
          severity: string;
          status?: string;
          workspace_id: string;
        };
        Update: {
          anomaly_type?: string;
          blocks_finalization?: boolean;
          candidate_ids_json?: Json;
          comparative_batch_id?: string;
          created_at?: string;
          explanation?: string;
          factor_keys_json?: Json;
          id?: string;
          recommended_action?: string;
          resolution_json?: Json | null;
          resolved_at?: string | null;
          severity?: string;
          status?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comparative_anomalies_comparative_batch_id_fkey";
            columns: ["comparative_batch_id"];
            isOneToOne: false;
            referencedRelation: "comparative_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comparative_anomalies_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      comparative_batch_members: {
        Row: {
          campaign_candidate_id: string;
          candidate_evaluation_version_id: string;
          comparative_batch_id: string;
          comparative_position: number | null;
          created_at: string;
          deterministic_position: number;
          id: string;
          is_anchor: boolean;
          workspace_id: string;
        };
        Insert: {
          campaign_candidate_id: string;
          candidate_evaluation_version_id: string;
          comparative_batch_id: string;
          comparative_position?: number | null;
          created_at?: string;
          deterministic_position: number;
          id?: string;
          is_anchor?: boolean;
          workspace_id: string;
        };
        Update: {
          campaign_candidate_id?: string;
          candidate_evaluation_version_id?: string;
          comparative_batch_id?: string;
          comparative_position?: number | null;
          created_at?: string;
          deterministic_position?: number;
          id?: string;
          is_anchor?: boolean;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comparative_batch_members_campaign_candidate_id_fkey";
            columns: ["campaign_candidate_id"];
            isOneToOne: false;
            referencedRelation: "campaign_candidates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comparative_batch_members_candidate_evaluation_version_id_fkey";
            columns: ["candidate_evaluation_version_id"];
            isOneToOne: false;
            referencedRelation: "candidate_evaluation_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comparative_batch_members_comparative_batch_id_fkey";
            columns: ["comparative_batch_id"];
            isOneToOne: false;
            referencedRelation: "comparative_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comparative_batch_members_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      comparative_batches: {
        Row: {
          batch_number: number;
          campaign_id: string;
          campaign_strategy_version_id: string;
          completed_at: string | null;
          created_at: string;
          id: string;
          input_hash: string;
          lane: string;
          model_call_id: string | null;
          rules_version: string;
          status: string;
          workspace_id: string;
        };
        Insert: {
          batch_number: number;
          campaign_id: string;
          campaign_strategy_version_id: string;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          input_hash: string;
          lane: string;
          model_call_id?: string | null;
          rules_version: string;
          status?: string;
          workspace_id: string;
        };
        Update: {
          batch_number?: number;
          campaign_id?: string;
          campaign_strategy_version_id?: string;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          input_hash?: string;
          lane?: string;
          model_call_id?: string | null;
          rules_version?: string;
          status?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comparative_batches_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comparative_batches_campaign_strategy_version_id_fkey";
            columns: ["campaign_strategy_version_id"];
            isOneToOne: false;
            referencedRelation: "campaign_strategy_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comparative_batches_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_enrichments: {
        Row: {
          campaign_run_id: string | null;
          company_id: string;
          completed_at: string | null;
          created_at: string;
          error_code: string | null;
          error_message: string | null;
          id: string;
          idempotency_key: string;
          provider: string;
          result_summary: Json;
          started_at: string | null;
          status: string;
          workspace_id: string;
        };
        Insert: {
          campaign_run_id?: string | null;
          company_id: string;
          completed_at?: string | null;
          created_at?: string;
          error_code?: string | null;
          error_message?: string | null;
          id?: string;
          idempotency_key: string;
          provider: string;
          result_summary?: Json;
          started_at?: string | null;
          status: string;
          workspace_id: string;
        };
        Update: {
          campaign_run_id?: string | null;
          company_id?: string;
          completed_at?: string | null;
          created_at?: string;
          error_code?: string | null;
          error_message?: string | null;
          id?: string;
          idempotency_key?: string;
          provider?: string;
          result_summary?: Json;
          started_at?: string | null;
          status?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contact_enrichments_campaign_run_id_fkey";
            columns: ["campaign_run_id"];
            isOneToOne: false;
            referencedRelation: "campaign_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_enrichments_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_enrichments_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_methods: {
        Row: {
          company_id: string;
          contact_id: string | null;
          created_at: string;
          id: string;
          is_primary: boolean;
          metadata: Json;
          method_type: string;
          normalized_value: string;
          value: string;
          verification_status: string;
          workspace_id: string;
        };
        Insert: {
          company_id: string;
          contact_id?: string | null;
          created_at?: string;
          id?: string;
          is_primary?: boolean;
          metadata?: Json;
          method_type: string;
          normalized_value: string;
          value: string;
          verification_status?: string;
          workspace_id: string;
        };
        Update: {
          company_id?: string;
          contact_id?: string | null;
          created_at?: string;
          id?: string;
          is_primary?: boolean;
          metadata?: Json;
          method_type?: string;
          normalized_value?: string;
          value?: string;
          verification_status?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contact_methods_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_methods_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_methods_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_sources: {
        Row: {
          contact_id: string | null;
          contact_method_id: string | null;
          id: string;
          metadata: Json;
          provider: string;
          query: string | null;
          retrieved_at: string;
          source_title: string;
          source_url: string;
          workspace_id: string;
        };
        Insert: {
          contact_id?: string | null;
          contact_method_id?: string | null;
          id?: string;
          metadata?: Json;
          provider: string;
          query?: string | null;
          retrieved_at?: string;
          source_title?: string;
          source_url: string;
          workspace_id: string;
        };
        Update: {
          contact_id?: string | null;
          contact_method_id?: string | null;
          id?: string;
          metadata?: Json;
          provider?: string;
          query?: string | null;
          retrieved_at?: string;
          source_title?: string;
          source_url?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contact_sources_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_sources_contact_method_id_fkey";
            columns: ["contact_method_id"];
            isOneToOne: false;
            referencedRelation: "contact_methods";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_sources_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      contacts: {
        Row: {
          company_id: string;
          contact_kind: string;
          created_at: string;
          department: string | null;
          full_name: string | null;
          id: string;
          job_title: string | null;
          metadata: Json;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          company_id: string;
          contact_kind?: string;
          created_at?: string;
          department?: string | null;
          full_name?: string | null;
          id?: string;
          job_title?: string | null;
          metadata?: Json;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          company_id?: string;
          contact_kind?: string;
          created_at?: string;
          department?: string | null;
          full_name?: string | null;
          id?: string;
          job_title?: string | null;
          metadata?: Json;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contacts_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      discovery_candidate_evidence: {
        Row: {
          campaign_run_id: string;
          candidate_id: string;
          created_at: string;
          discovery_query_id: string;
          id: string;
          retrieved_at: string;
          snippet: string;
          source_path: string;
          source_query: string;
          source_url: string;
          workspace_id: string;
        };
        Insert: {
          campaign_run_id: string;
          candidate_id: string;
          created_at?: string;
          discovery_query_id: string;
          id?: string;
          retrieved_at: string;
          snippet?: string;
          source_path: string;
          source_query: string;
          source_url: string;
          workspace_id: string;
        };
        Update: {
          campaign_run_id?: string;
          candidate_id?: string;
          created_at?: string;
          discovery_query_id?: string;
          id?: string;
          retrieved_at?: string;
          snippet?: string;
          source_path?: string;
          source_query?: string;
          source_url?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "discovery_candidate_evidence_campaign_run_id_fkey";
            columns: ["campaign_run_id"];
            isOneToOne: false;
            referencedRelation: "campaign_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_candidate_evidence_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "discovery_candidates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_candidate_evidence_discovery_query_id_fkey";
            columns: ["discovery_query_id"];
            isOneToOne: false;
            referencedRelation: "discovery_queries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_candidate_evidence_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      discovery_candidates: {
        Row: {
          campaign_id: string;
          campaign_run_id: string;
          candidate_key: string;
          company_name: string;
          country_region: string | null;
          created_at: string;
          discovery_confidence: number | null;
          discovery_iteration_id: string;
          discovery_query_id: string;
          id: string;
          normalized_domain: string | null;
          probable_category: string | null;
          retrieved_at: string;
          snippet: string;
          source_path: string;
          source_query: string;
          source_type: string;
          source_url: string;
          workspace_id: string;
        };
        Insert: {
          campaign_id: string;
          campaign_run_id: string;
          candidate_key: string;
          company_name: string;
          country_region?: string | null;
          created_at?: string;
          discovery_confidence?: number | null;
          discovery_iteration_id: string;
          discovery_query_id: string;
          id?: string;
          normalized_domain?: string | null;
          probable_category?: string | null;
          retrieved_at: string;
          snippet?: string;
          source_path: string;
          source_query: string;
          source_type: string;
          source_url: string;
          workspace_id: string;
        };
        Update: {
          campaign_id?: string;
          campaign_run_id?: string;
          candidate_key?: string;
          company_name?: string;
          country_region?: string | null;
          created_at?: string;
          discovery_confidence?: number | null;
          discovery_iteration_id?: string;
          discovery_query_id?: string;
          id?: string;
          normalized_domain?: string | null;
          probable_category?: string | null;
          retrieved_at?: string;
          snippet?: string;
          source_path?: string;
          source_query?: string;
          source_type?: string;
          source_url?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "discovery_candidates_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_candidates_campaign_run_id_fkey";
            columns: ["campaign_run_id"];
            isOneToOne: false;
            referencedRelation: "campaign_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_candidates_discovery_iteration_id_fkey";
            columns: ["discovery_iteration_id"];
            isOneToOne: false;
            referencedRelation: "discovery_iterations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_candidates_discovery_query_id_fkey";
            columns: ["discovery_query_id"];
            isOneToOne: false;
            referencedRelation: "discovery_queries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_candidates_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      discovery_coverage_snapshots_v2: {
        Row: {
          archetype_key: string;
          confidence: number;
          created_at: string;
          discovery_run_id: string;
          discovery_segment_run_id: string;
          geography_key: string;
          id: string;
          metrics_json: Json;
          reasons_json: Json;
          status: string;
          workspace_id: string;
        };
        Insert: {
          archetype_key: string;
          confidence: number;
          created_at?: string;
          discovery_run_id: string;
          discovery_segment_run_id: string;
          geography_key: string;
          id?: string;
          metrics_json: Json;
          reasons_json?: Json;
          status: string;
          workspace_id: string;
        };
        Update: {
          archetype_key?: string;
          confidence?: number;
          created_at?: string;
          discovery_run_id?: string;
          discovery_segment_run_id?: string;
          geography_key?: string;
          id?: string;
          metrics_json?: Json;
          reasons_json?: Json;
          status?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "discovery_coverage_snapshots_v2_discovery_run_id_fkey";
            columns: ["discovery_run_id"];
            isOneToOne: false;
            referencedRelation: "discovery_runs_v2";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_coverage_snapshots_v2_discovery_segment_run_id_fkey";
            columns: ["discovery_segment_run_id"];
            isOneToOne: false;
            referencedRelation: "discovery_segment_runs_v2";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_coverage_snapshots_v2_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      discovery_gap_actions_v2: {
        Row: {
          action_type: string;
          created_at: string;
          discovery_gap_id: string;
          expected_improvement: string;
          id: string;
          max_calls: number | null;
          max_estimated_cost_minor: number | null;
          reason: string;
          status: string;
          workspace_id: string;
        };
        Insert: {
          action_type: string;
          created_at?: string;
          discovery_gap_id: string;
          expected_improvement: string;
          id?: string;
          max_calls?: number | null;
          max_estimated_cost_minor?: number | null;
          reason: string;
          status?: string;
          workspace_id: string;
        };
        Update: {
          action_type?: string;
          created_at?: string;
          discovery_gap_id?: string;
          expected_improvement?: string;
          id?: string;
          max_calls?: number | null;
          max_estimated_cost_minor?: number | null;
          reason?: string;
          status?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "discovery_gap_actions_v2_discovery_gap_id_fkey";
            columns: ["discovery_gap_id"];
            isOneToOne: false;
            referencedRelation: "discovery_gaps_v2";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_gap_actions_v2_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      discovery_gaps_v2: {
        Row: {
          created_at: string;
          description: string;
          discovery_run_id: string;
          discovery_segment_id: string | null;
          gap_key: string;
          gap_type: string;
          id: string;
          resolved_at: string | null;
          severity: string;
          status: string;
          supporting_metrics_json: Json;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          description: string;
          discovery_run_id: string;
          discovery_segment_id?: string | null;
          gap_key: string;
          gap_type: string;
          id?: string;
          resolved_at?: string | null;
          severity: string;
          status: string;
          supporting_metrics_json: Json;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          discovery_run_id?: string;
          discovery_segment_id?: string | null;
          gap_key?: string;
          gap_type?: string;
          id?: string;
          resolved_at?: string | null;
          severity?: string;
          status?: string;
          supporting_metrics_json?: Json;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "discovery_gaps_v2_discovery_run_id_fkey";
            columns: ["discovery_run_id"];
            isOneToOne: false;
            referencedRelation: "discovery_runs_v2";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_gaps_v2_discovery_segment_id_fkey";
            columns: ["discovery_segment_id"];
            isOneToOne: false;
            referencedRelation: "discovery_segments_v2";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_gaps_v2_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      discovery_iterations: {
        Row: {
          campaign_id: string;
          campaign_run_id: string;
          completed_at: string | null;
          decision: string | null;
          decision_reason: string | null;
          discovery_plan_id: string;
          id: string;
          iteration_number: number;
          metrics: Json;
          objective: string;
          started_at: string;
          workspace_id: string;
        };
        Insert: {
          campaign_id: string;
          campaign_run_id: string;
          completed_at?: string | null;
          decision?: string | null;
          decision_reason?: string | null;
          discovery_plan_id: string;
          id?: string;
          iteration_number: number;
          metrics?: Json;
          objective: string;
          started_at?: string;
          workspace_id: string;
        };
        Update: {
          campaign_id?: string;
          campaign_run_id?: string;
          completed_at?: string | null;
          decision?: string | null;
          decision_reason?: string | null;
          discovery_plan_id?: string;
          id?: string;
          iteration_number?: number;
          metrics?: Json;
          objective?: string;
          started_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "discovery_iterations_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_iterations_campaign_run_id_fkey";
            columns: ["campaign_run_id"];
            isOneToOne: false;
            referencedRelation: "campaign_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_iterations_discovery_plan_id_fkey";
            columns: ["discovery_plan_id"];
            isOneToOne: false;
            referencedRelation: "discovery_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_iterations_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      discovery_paths: {
        Row: {
          discovery_plan_id: string;
          expected_company_category: string;
          expected_yield: string | null;
          external_id: string;
          id: string;
          max_results: number;
          path_type: string;
          priority: number;
          queries: string[];
          rationale: string;
          source_hints: string[];
          workspace_id: string;
        };
        Insert: {
          discovery_plan_id: string;
          expected_company_category: string;
          expected_yield?: string | null;
          external_id: string;
          id?: string;
          max_results: number;
          path_type: string;
          priority: number;
          queries?: string[];
          rationale: string;
          source_hints?: string[];
          workspace_id: string;
        };
        Update: {
          discovery_plan_id?: string;
          expected_company_category?: string;
          expected_yield?: string | null;
          external_id?: string;
          id?: string;
          max_results?: number;
          path_type?: string;
          priority?: number;
          queries?: string[];
          rationale?: string;
          source_hints?: string[];
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "discovery_paths_discovery_plan_id_fkey";
            columns: ["discovery_plan_id"];
            isOneToOne: false;
            referencedRelation: "discovery_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_paths_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      discovery_plans: {
        Row: {
          actual_model: string;
          campaign_id: string;
          campaign_run_id: string;
          created_at: string;
          fallback_used: boolean;
          id: string;
          market_analysis_id: string;
          prompt_version: string;
          requested_model: string;
          stop_conditions: Json;
          strategy_summary: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          actual_model: string;
          campaign_id: string;
          campaign_run_id: string;
          created_at?: string;
          fallback_used?: boolean;
          id?: string;
          market_analysis_id: string;
          prompt_version: string;
          requested_model: string;
          stop_conditions: Json;
          strategy_summary: string;
          version: number;
          workspace_id: string;
        };
        Update: {
          actual_model?: string;
          campaign_id?: string;
          campaign_run_id?: string;
          created_at?: string;
          fallback_used?: boolean;
          id?: string;
          market_analysis_id?: string;
          prompt_version?: string;
          requested_model?: string;
          stop_conditions?: Json;
          strategy_summary?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "discovery_plans_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_plans_campaign_run_id_fkey";
            columns: ["campaign_run_id"];
            isOneToOne: false;
            referencedRelation: "campaign_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_plans_market_analysis_id_fkey";
            columns: ["market_analysis_id"];
            isOneToOne: false;
            referencedRelation: "market_analyses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_plans_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      discovery_plans_v2: {
        Row: {
          budget_policy_json: Json;
          campaign_id: string;
          campaign_strategy_version_id: string;
          compiled_snapshot_json: Json;
          content_hash: string;
          coverage_policy_json: Json;
          created_at: string;
          id: string;
          memory_snapshot_id: string;
          status: string;
          stopping_policy_json: Json;
          version_number: number;
          workspace_id: string;
        };
        Insert: {
          budget_policy_json: Json;
          campaign_id: string;
          campaign_strategy_version_id: string;
          compiled_snapshot_json: Json;
          content_hash: string;
          coverage_policy_json: Json;
          created_at?: string;
          id?: string;
          memory_snapshot_id: string;
          status: string;
          stopping_policy_json: Json;
          version_number: number;
          workspace_id: string;
        };
        Update: {
          budget_policy_json?: Json;
          campaign_id?: string;
          campaign_strategy_version_id?: string;
          compiled_snapshot_json?: Json;
          content_hash?: string;
          coverage_policy_json?: Json;
          created_at?: string;
          id?: string;
          memory_snapshot_id?: string;
          status?: string;
          stopping_policy_json?: Json;
          version_number?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "discovery_plans_v2_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_plans_v2_campaign_strategy_version_id_fkey";
            columns: ["campaign_strategy_version_id"];
            isOneToOne: false;
            referencedRelation: "campaign_strategy_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_plans_v2_memory_snapshot_id_fkey";
            columns: ["memory_snapshot_id"];
            isOneToOne: false;
            referencedRelation: "campaign_memory_snapshots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_plans_v2_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      discovery_provider_capability_snapshots: {
        Row: {
          adapter_version: string;
          capabilities_json: Json;
          captured_at: string;
          content_hash: string;
          id: string;
          provider_key: string;
          workspace_id: string;
        };
        Insert: {
          adapter_version: string;
          capabilities_json: Json;
          captured_at?: string;
          content_hash: string;
          id?: string;
          provider_key: string;
          workspace_id: string;
        };
        Update: {
          adapter_version?: string;
          capabilities_json?: Json;
          captured_at?: string;
          content_hash?: string;
          id?: string;
          provider_key?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "discovery_provider_capability_snapshots_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      discovery_provider_executions: {
        Row: {
          adapter_version: string;
          campaign_id: string;
          capability_snapshot_id: string;
          completed_at: string | null;
          discovery_plan_key: string;
          discovery_segment_key: string;
          discovery_segment_run_id: string | null;
          errors_json: Json;
          exhausted: boolean | null;
          external_execution_key: string;
          id: string;
          next_cursor: string | null;
          provider_key: string;
          request_hash: string;
          request_json: Json;
          result_count: number;
          started_at: string;
          status: string;
          usage_json: Json;
          warnings_json: Json;
          workspace_id: string;
        };
        Insert: {
          adapter_version: string;
          campaign_id: string;
          capability_snapshot_id: string;
          completed_at?: string | null;
          discovery_plan_key: string;
          discovery_segment_key: string;
          discovery_segment_run_id?: string | null;
          errors_json?: Json;
          exhausted?: boolean | null;
          external_execution_key: string;
          id?: string;
          next_cursor?: string | null;
          provider_key: string;
          request_hash: string;
          request_json: Json;
          result_count?: number;
          started_at?: string;
          status?: string;
          usage_json?: Json;
          warnings_json?: Json;
          workspace_id: string;
        };
        Update: {
          adapter_version?: string;
          campaign_id?: string;
          capability_snapshot_id?: string;
          completed_at?: string | null;
          discovery_plan_key?: string;
          discovery_segment_key?: string;
          discovery_segment_run_id?: string | null;
          errors_json?: Json;
          exhausted?: boolean | null;
          external_execution_key?: string;
          id?: string;
          next_cursor?: string | null;
          provider_key?: string;
          request_hash?: string;
          request_json?: Json;
          result_count?: number;
          started_at?: string;
          status?: string;
          usage_json?: Json;
          warnings_json?: Json;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "discovery_provider_executions_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_provider_executions_capability_snapshot_id_fkey";
            columns: ["capability_snapshot_id"];
            isOneToOne: false;
            referencedRelation: "discovery_provider_capability_snapshots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_provider_executions_discovery_segment_run_id_fkey";
            columns: ["discovery_segment_run_id"];
            isOneToOne: false;
            referencedRelation: "discovery_segment_runs_v2";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_provider_executions_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      discovery_queries: {
        Row: {
          created_at: string;
          discovery_iteration_id: string;
          discovery_path_id: string;
          id: string;
          provider: string;
          provider_request_id: string | null;
          query: string;
          result_limit: number;
          retrieved_at: string | null;
          source_type: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          discovery_iteration_id: string;
          discovery_path_id: string;
          id?: string;
          provider: string;
          provider_request_id?: string | null;
          query: string;
          result_limit: number;
          retrieved_at?: string | null;
          source_type: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          discovery_iteration_id?: string;
          discovery_path_id?: string;
          id?: string;
          provider?: string;
          provider_request_id?: string | null;
          query?: string;
          result_limit?: number;
          retrieved_at?: string | null;
          source_type?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "discovery_queries_discovery_iteration_id_fkey";
            columns: ["discovery_iteration_id"];
            isOneToOne: false;
            referencedRelation: "discovery_iterations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_queries_discovery_path_id_fkey";
            columns: ["discovery_path_id"];
            isOneToOne: false;
            referencedRelation: "discovery_paths";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_queries_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      discovery_queries_v2: {
        Row: {
          country: string | null;
          created_at: string;
          fingerprint: string;
          id: string;
          language: string;
          normalized_query: string;
          provider_execution_id: string;
          purpose: string;
          query_key: string;
          query_text: string;
          query_type: string;
          result_count: number;
          sequence_number: number;
          status: string;
          workspace_id: string;
        };
        Insert: {
          country?: string | null;
          created_at?: string;
          fingerprint: string;
          id?: string;
          language: string;
          normalized_query: string;
          provider_execution_id: string;
          purpose: string;
          query_key: string;
          query_text: string;
          query_type: string;
          result_count?: number;
          sequence_number: number;
          status: string;
          workspace_id: string;
        };
        Update: {
          country?: string | null;
          created_at?: string;
          fingerprint?: string;
          id?: string;
          language?: string;
          normalized_query?: string;
          provider_execution_id?: string;
          purpose?: string;
          query_key?: string;
          query_text?: string;
          query_type?: string;
          result_count?: number;
          sequence_number?: number;
          status?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "discovery_queries_v2_provider_execution_id_fkey";
            columns: ["provider_execution_id"];
            isOneToOne: false;
            referencedRelation: "discovery_provider_executions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_queries_v2_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      discovery_runs_v2: {
        Row: {
          budget_limit_json: Json;
          campaign_id: string;
          completed_at: string | null;
          continuation_decision_json: Json | null;
          coverage_summary_json: Json;
          created_at: string;
          discovery_plan_id: string;
          id: string;
          paused_at: string | null;
          started_at: string;
          status: string;
          stopping_reason: string | null;
          usage_summary_json: Json;
          workspace_id: string;
        };
        Insert: {
          budget_limit_json: Json;
          campaign_id: string;
          completed_at?: string | null;
          continuation_decision_json?: Json | null;
          coverage_summary_json?: Json;
          created_at?: string;
          discovery_plan_id: string;
          id?: string;
          paused_at?: string | null;
          started_at?: string;
          status?: string;
          stopping_reason?: string | null;
          usage_summary_json?: Json;
          workspace_id: string;
        };
        Update: {
          budget_limit_json?: Json;
          campaign_id?: string;
          completed_at?: string | null;
          continuation_decision_json?: Json | null;
          coverage_summary_json?: Json;
          created_at?: string;
          discovery_plan_id?: string;
          id?: string;
          paused_at?: string | null;
          started_at?: string;
          status?: string;
          stopping_reason?: string | null;
          usage_summary_json?: Json;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "discovery_runs_v2_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_runs_v2_discovery_plan_id_fkey";
            columns: ["discovery_plan_id"];
            isOneToOne: false;
            referencedRelation: "discovery_plans_v2";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_runs_v2_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      discovery_segment_runs_v2: {
        Row: {
          completed_at: string | null;
          discovery_run_id: string;
          discovery_segment_id: string;
          gap_ids: string[];
          id: string;
          metrics_json: Json;
          normalized_candidate_count: number;
          pass_number: number;
          plausible_candidate_count: number | null;
          provider_record_count: number;
          qualified_yield_count: number | null;
          started_at: string;
          status: string;
          unique_candidate_count: number;
          workspace_id: string;
        };
        Insert: {
          completed_at?: string | null;
          discovery_run_id: string;
          discovery_segment_id: string;
          gap_ids?: string[];
          id?: string;
          metrics_json?: Json;
          normalized_candidate_count?: number;
          pass_number: number;
          plausible_candidate_count?: number | null;
          provider_record_count?: number;
          qualified_yield_count?: number | null;
          started_at?: string;
          status?: string;
          unique_candidate_count?: number;
          workspace_id: string;
        };
        Update: {
          completed_at?: string | null;
          discovery_run_id?: string;
          discovery_segment_id?: string;
          gap_ids?: string[];
          id?: string;
          metrics_json?: Json;
          normalized_candidate_count?: number;
          pass_number?: number;
          plausible_candidate_count?: number | null;
          provider_record_count?: number;
          qualified_yield_count?: number | null;
          started_at?: string;
          status?: string;
          unique_candidate_count?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "discovery_segment_runs_v2_discovery_run_id_fkey";
            columns: ["discovery_run_id"];
            isOneToOne: false;
            referencedRelation: "discovery_runs_v2";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_segment_runs_v2_discovery_segment_id_fkey";
            columns: ["discovery_segment_id"];
            isOneToOne: false;
            referencedRelation: "discovery_segments_v2";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_segment_runs_v2_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      discovery_segments_v2: {
        Row: {
          business_characteristics_json: Json;
          campaign_archetype_key: string;
          created_at: string;
          discovery_plan_id: string;
          exclusion_rules_json: Json;
          exploration_budget_class: string;
          geography_json: Json;
          id: string;
          negative_signals_json: Json;
          positive_signals_json: Json;
          priority: number;
          segment_key: string;
          status: string;
          target_candidate_count: number | null;
          workspace_id: string;
        };
        Insert: {
          business_characteristics_json: Json;
          campaign_archetype_key: string;
          created_at?: string;
          discovery_plan_id: string;
          exclusion_rules_json?: Json;
          exploration_budget_class: string;
          geography_json: Json;
          id?: string;
          negative_signals_json?: Json;
          positive_signals_json?: Json;
          priority: number;
          segment_key: string;
          status?: string;
          target_candidate_count?: number | null;
          workspace_id: string;
        };
        Update: {
          business_characteristics_json?: Json;
          campaign_archetype_key?: string;
          created_at?: string;
          discovery_plan_id?: string;
          exclusion_rules_json?: Json;
          exploration_budget_class?: string;
          geography_json?: Json;
          id?: string;
          negative_signals_json?: Json;
          positive_signals_json?: Json;
          priority?: number;
          segment_key?: string;
          status?: string;
          target_candidate_count?: number | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "discovery_segments_v2_discovery_plan_id_fkey";
            columns: ["discovery_plan_id"];
            isOneToOne: false;
            referencedRelation: "discovery_plans_v2";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_segments_v2_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      discovery_source_plans_v2: {
        Row: {
          activation_condition_json: Json;
          capability_snapshot_id: string;
          created_at: string;
          discovery_segment_id: string;
          id: string;
          priority: number;
          provider_key: string;
          provider_request_policy_json: Json;
          reasons_json: Json;
          source_role: string;
          unsupported_constraints_json: Json;
          workspace_id: string;
        };
        Insert: {
          activation_condition_json?: Json;
          capability_snapshot_id: string;
          created_at?: string;
          discovery_segment_id: string;
          id?: string;
          priority: number;
          provider_key: string;
          provider_request_policy_json?: Json;
          reasons_json?: Json;
          source_role: string;
          unsupported_constraints_json?: Json;
          workspace_id: string;
        };
        Update: {
          activation_condition_json?: Json;
          capability_snapshot_id?: string;
          created_at?: string;
          discovery_segment_id?: string;
          id?: string;
          priority?: number;
          provider_key?: string;
          provider_request_policy_json?: Json;
          reasons_json?: Json;
          source_role?: string;
          unsupported_constraints_json?: Json;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "discovery_source_plans_v2_capability_snapshot_id_fkey";
            columns: ["capability_snapshot_id"];
            isOneToOne: false;
            referencedRelation: "discovery_provider_capability_snapshots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_source_plans_v2_discovery_segment_id_fkey";
            columns: ["discovery_segment_id"];
            isOneToOne: false;
            referencedRelation: "discovery_segments_v2";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_source_plans_v2_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      discovery_usage_events_v2: {
        Row: {
          created_at: string;
          discovery_run_id: string;
          discovery_segment_run_id: string | null;
          event_type: string;
          id: string;
          metrics_json: Json;
          provider_execution_id: string | null;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          discovery_run_id: string;
          discovery_segment_run_id?: string | null;
          event_type: string;
          id?: string;
          metrics_json: Json;
          provider_execution_id?: string | null;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          discovery_run_id?: string;
          discovery_segment_run_id?: string | null;
          event_type?: string;
          id?: string;
          metrics_json?: Json;
          provider_execution_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "discovery_usage_events_v2_discovery_run_id_fkey";
            columns: ["discovery_run_id"];
            isOneToOne: false;
            referencedRelation: "discovery_runs_v2";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_usage_events_v2_discovery_segment_run_id_fkey";
            columns: ["discovery_segment_run_id"];
            isOneToOne: false;
            referencedRelation: "discovery_segment_runs_v2";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_usage_events_v2_provider_execution_id_fkey";
            columns: ["provider_execution_id"];
            isOneToOne: false;
            referencedRelation: "discovery_provider_executions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_usage_events_v2_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      document_chunks: {
        Row: {
          chunk_index: number;
          content: string;
          created_at: string;
          document_id: string;
          embedding: string | null;
          embedding_model: string | null;
          id: string;
          metadata: Json;
          page_number: number | null;
          section: string | null;
          workspace_id: string;
        };
        Insert: {
          chunk_index: number;
          content: string;
          created_at?: string;
          document_id: string;
          embedding?: string | null;
          embedding_model?: string | null;
          id?: string;
          metadata?: Json;
          page_number?: number | null;
          section?: string | null;
          workspace_id: string;
        };
        Update: {
          chunk_index?: number;
          content?: string;
          created_at?: string;
          document_id?: string;
          embedding?: string | null;
          embedding_model?: string | null;
          id?: string;
          metadata?: Json;
          page_number?: number | null;
          section?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "document_chunks_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_chunks_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          campaign_id: string | null;
          checksum: string | null;
          company_profile_id: string | null;
          created_at: string;
          created_by: string | null;
          file_name: string;
          id: string;
          media_type: string;
          metadata: Json;
          size_bytes: number;
          status: string;
          storage_bucket: string;
          storage_path: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          campaign_id?: string | null;
          checksum?: string | null;
          company_profile_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          file_name: string;
          id?: string;
          media_type: string;
          metadata?: Json;
          size_bytes: number;
          status?: string;
          storage_bucket?: string;
          storage_path: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          campaign_id?: string | null;
          checksum?: string | null;
          company_profile_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          file_name?: string;
          id?: string;
          media_type?: string;
          metadata?: Json;
          size_bytes?: number;
          status?: string;
          storage_bucket?: string;
          storage_path?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "documents_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_company_profile_id_fkey";
            columns: ["company_profile_id"];
            isOneToOne: false;
            referencedRelation: "company_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      email_verifications: {
        Row: {
          contact_method_id: string;
          id: string;
          metadata: Json;
          provider: string;
          provider_reference: string | null;
          status: string;
          verified_at: string;
          workspace_id: string;
        };
        Insert: {
          contact_method_id: string;
          id?: string;
          metadata?: Json;
          provider: string;
          provider_reference?: string | null;
          status: string;
          verified_at?: string;
          workspace_id: string;
        };
        Update: {
          contact_method_id?: string;
          id?: string;
          metadata?: Json;
          provider?: string;
          provider_reference?: string | null;
          status?: string;
          verified_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "email_verifications_contact_method_id_fkey";
            columns: ["contact_method_id"];
            isOneToOne: false;
            referencedRelation: "contact_methods";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_verifications_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      entity_match_assessments: {
        Row: {
          aggregate_confidence: number;
          candidate_organization_id: string;
          contradiction_severity: string;
          created_at: string;
          id: string;
          model_version: string | null;
          reasoning_summary: string;
          recommendation: string;
          resolution_case_id: string;
          rules_version: string;
          signals_json: Json;
          workspace_id: string;
        };
        Insert: {
          aggregate_confidence: number;
          candidate_organization_id: string;
          contradiction_severity: string;
          created_at?: string;
          id?: string;
          model_version?: string | null;
          reasoning_summary: string;
          recommendation: string;
          resolution_case_id: string;
          rules_version: string;
          signals_json: Json;
          workspace_id: string;
        };
        Update: {
          aggregate_confidence?: number;
          candidate_organization_id?: string;
          contradiction_severity?: string;
          created_at?: string;
          id?: string;
          model_version?: string | null;
          reasoning_summary?: string;
          recommendation?: string;
          resolution_case_id?: string;
          rules_version?: string;
          signals_json?: Json;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "entity_match_assessments_candidate_organization_id_fkey";
            columns: ["candidate_organization_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entity_match_assessments_resolution_case_id_fkey";
            columns: ["resolution_case_id"];
            isOneToOne: false;
            referencedRelation: "entity_resolution_cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entity_match_assessments_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      entity_resolution_cases: {
        Row: {
          campaign_id: string | null;
          id: string;
          normalized_candidate_id: string;
          opened_at: string;
          resolved_at: string | null;
          rules_version: string;
          status: string;
          workspace_id: string;
        };
        Insert: {
          campaign_id?: string | null;
          id?: string;
          normalized_candidate_id: string;
          opened_at?: string;
          resolved_at?: string | null;
          rules_version: string;
          status?: string;
          workspace_id: string;
        };
        Update: {
          campaign_id?: string | null;
          id?: string;
          normalized_candidate_id?: string;
          opened_at?: string;
          resolved_at?: string | null;
          rules_version?: string;
          status?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "entity_resolution_cases_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entity_resolution_cases_normalized_candidate_id_fkey";
            columns: ["normalized_candidate_id"];
            isOneToOne: false;
            referencedRelation: "normalized_provider_candidates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entity_resolution_cases_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      entity_resolution_decisions: {
        Row: {
          action: string;
          confidence: number;
          created_at: string;
          decided_by: string;
          evidence_ids_json: Json;
          id: string;
          model_version: string | null;
          normalized_candidate_id: string;
          reasoning_summary: string;
          related_organization_id: string | null;
          relationship_type: string | null;
          resolution_case_id: string;
          rules_version: string;
          target_organization_id: string | null;
          workspace_id: string;
        };
        Insert: {
          action: string;
          confidence: number;
          created_at?: string;
          decided_by: string;
          evidence_ids_json?: Json;
          id?: string;
          model_version?: string | null;
          normalized_candidate_id: string;
          reasoning_summary: string;
          related_organization_id?: string | null;
          relationship_type?: string | null;
          resolution_case_id: string;
          rules_version: string;
          target_organization_id?: string | null;
          workspace_id: string;
        };
        Update: {
          action?: string;
          confidence?: number;
          created_at?: string;
          decided_by?: string;
          evidence_ids_json?: Json;
          id?: string;
          model_version?: string | null;
          normalized_candidate_id?: string;
          reasoning_summary?: string;
          related_organization_id?: string | null;
          relationship_type?: string | null;
          resolution_case_id?: string;
          rules_version?: string;
          target_organization_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "entity_resolution_decisions_normalized_candidate_id_fkey";
            columns: ["normalized_candidate_id"];
            isOneToOne: false;
            referencedRelation: "normalized_provider_candidates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entity_resolution_decisions_related_organization_id_fkey";
            columns: ["related_organization_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entity_resolution_decisions_resolution_case_id_fkey";
            columns: ["resolution_case_id"];
            isOneToOne: true;
            referencedRelation: "entity_resolution_cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entity_resolution_decisions_target_organization_id_fkey";
            columns: ["target_organization_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entity_resolution_decisions_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      evidence_items: {
        Row: {
          company_source_id: string | null;
          content_hash: string;
          created_at: string;
          directness: string;
          document_chunk_id: string | null;
          evidence_type: string;
          excerpt: string | null;
          freshness_state: string;
          id: string;
          location_json: Json;
          manual_source_label: string | null;
          observed_at: string | null;
          provider_execution_id: string | null;
          retrieved_at: string;
          source_reliability: string;
          structured_value_json: Json | null;
          subject_id: string;
          subject_type: string;
          visibility: string;
          workspace_id: string;
        };
        Insert: {
          company_source_id?: string | null;
          content_hash: string;
          created_at?: string;
          directness: string;
          document_chunk_id?: string | null;
          evidence_type: string;
          excerpt?: string | null;
          freshness_state: string;
          id?: string;
          location_json?: Json;
          manual_source_label?: string | null;
          observed_at?: string | null;
          provider_execution_id?: string | null;
          retrieved_at: string;
          source_reliability: string;
          structured_value_json?: Json | null;
          subject_id: string;
          subject_type: string;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          company_source_id?: string | null;
          content_hash?: string;
          created_at?: string;
          directness?: string;
          document_chunk_id?: string | null;
          evidence_type?: string;
          excerpt?: string | null;
          freshness_state?: string;
          id?: string;
          location_json?: Json;
          manual_source_label?: string | null;
          observed_at?: string | null;
          provider_execution_id?: string | null;
          retrieved_at?: string;
          source_reliability?: string;
          structured_value_json?: Json | null;
          subject_id?: string;
          subject_type?: string;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "evidence_items_company_source_id_fkey";
            columns: ["company_source_id"];
            isOneToOne: false;
            referencedRelation: "company_sources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evidence_items_document_chunk_id_fkey";
            columns: ["document_chunk_id"];
            isOneToOne: false;
            referencedRelation: "document_chunks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evidence_items_provider_execution_id_fkey";
            columns: ["provider_execution_id"];
            isOneToOne: false;
            referencedRelation: "provider_executions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evidence_items_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      export_records: {
        Row: {
          campaign_id: string;
          campaign_run_id: string | null;
          created_at: string;
          created_by: string | null;
          export_type: string;
          file_name: string;
          id: string;
          payload: Json;
          row_count: number;
          workspace_id: string;
        };
        Insert: {
          campaign_id: string;
          campaign_run_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          export_type: string;
          file_name: string;
          id?: string;
          payload?: Json;
          row_count: number;
          workspace_id: string;
        };
        Update: {
          campaign_id?: string;
          campaign_run_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          export_type?: string;
          file_name?: string;
          id?: string;
          payload?: Json;
          row_count?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "export_records_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "export_records_campaign_run_id_fkey";
            columns: ["campaign_run_id"];
            isOneToOne: false;
            referencedRelation: "campaign_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "export_records_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      intelligence_claims: {
        Row: {
          claim_key: string;
          concise_rationale: string | null;
          confidence: number;
          created_at: string;
          epistemic_status: string;
          field_path: string;
          freshness_class: string | null;
          id: string;
          lifecycle_status: string;
          observed_at: string | null;
          origin_id: string | null;
          origin_type: string;
          source_scope: string;
          statement: string;
          subject_id: string;
          subject_type: string;
          supersedes_claim_id: string | null;
          valid_from: string | null;
          valid_to: string | null;
          value_json: Json | null;
          workspace_id: string;
        };
        Insert: {
          claim_key: string;
          concise_rationale?: string | null;
          confidence: number;
          created_at?: string;
          epistemic_status: string;
          field_path: string;
          freshness_class?: string | null;
          id?: string;
          lifecycle_status?: string;
          observed_at?: string | null;
          origin_id?: string | null;
          origin_type: string;
          source_scope?: string;
          statement: string;
          subject_id: string;
          subject_type: string;
          supersedes_claim_id?: string | null;
          valid_from?: string | null;
          valid_to?: string | null;
          value_json?: Json | null;
          workspace_id: string;
        };
        Update: {
          claim_key?: string;
          concise_rationale?: string | null;
          confidence?: number;
          created_at?: string;
          epistemic_status?: string;
          field_path?: string;
          freshness_class?: string | null;
          id?: string;
          lifecycle_status?: string;
          observed_at?: string | null;
          origin_id?: string | null;
          origin_type?: string;
          source_scope?: string;
          statement?: string;
          subject_id?: string;
          subject_type?: string;
          supersedes_claim_id?: string | null;
          valid_from?: string | null;
          valid_to?: string | null;
          value_json?: Json | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "intelligence_claims_supersedes_claim_id_fkey";
            columns: ["supersedes_claim_id"];
            isOneToOne: false;
            referencedRelation: "intelligence_claims";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "intelligence_claims_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      intelligence_conflicts: {
        Row: {
          conflict_type: string;
          created_at: string;
          id: string;
          precedence_result_json: Json;
          record_ids_json: Json;
          resolution: string | null;
          resolution_reason: string | null;
          resolved_at: string | null;
          resolved_by_user_id: string | null;
          status: string;
          subject_id: string;
          subject_type: string;
          summary: string;
          workspace_id: string;
        };
        Insert: {
          conflict_type: string;
          created_at?: string;
          id?: string;
          precedence_result_json?: Json;
          record_ids_json: Json;
          resolution?: string | null;
          resolution_reason?: string | null;
          resolved_at?: string | null;
          resolved_by_user_id?: string | null;
          status?: string;
          subject_id: string;
          subject_type: string;
          summary: string;
          workspace_id: string;
        };
        Update: {
          conflict_type?: string;
          created_at?: string;
          id?: string;
          precedence_result_json?: Json;
          record_ids_json?: Json;
          resolution?: string | null;
          resolution_reason?: string | null;
          resolved_at?: string | null;
          resolved_by_user_id?: string | null;
          status?: string;
          subject_id?: string;
          subject_type?: string;
          summary?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "intelligence_conflicts_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      intelligence_contracts: {
        Row: {
          content_hash: string;
          contract_key: string;
          created_at: string;
          id: string;
          json_schema: Json;
          status: string;
          version: string;
        };
        Insert: {
          content_hash: string;
          contract_key: string;
          created_at?: string;
          id?: string;
          json_schema?: Json;
          status?: string;
          version: string;
        };
        Update: {
          content_hash?: string;
          contract_key?: string;
          created_at?: string;
          id?: string;
          json_schema?: Json;
          status?: string;
          version?: string;
        };
        Relationships: [];
      };
      intelligence_memories: {
        Row: {
          applicability_json: Json;
          applicability_known: boolean;
          confidence: number;
          created_at: string;
          created_by_user_id: string | null;
          expires_at: string | null;
          id: string;
          last_applied_at: string | null;
          memory_type: string;
          origin_campaign_id: string | null;
          origin_candidate_id: string | null;
          origin_id: string | null;
          origin_run_id: string | null;
          origin_type: string;
          scope_id: string;
          scope_type: string;
          source: string;
          statement: string;
          status: string;
          strength: string;
          structured_value_json: Json | null;
          supersedes_memory_id: string | null;
          updated_at: string;
          user_id: string | null;
          workspace_id: string;
        };
        Insert: {
          applicability_json?: Json;
          applicability_known?: boolean;
          confidence: number;
          created_at?: string;
          created_by_user_id?: string | null;
          expires_at?: string | null;
          id?: string;
          last_applied_at?: string | null;
          memory_type: string;
          origin_campaign_id?: string | null;
          origin_candidate_id?: string | null;
          origin_id?: string | null;
          origin_run_id?: string | null;
          origin_type: string;
          scope_id: string;
          scope_type: string;
          source: string;
          statement: string;
          status?: string;
          strength: string;
          structured_value_json?: Json | null;
          supersedes_memory_id?: string | null;
          updated_at?: string;
          user_id?: string | null;
          workspace_id: string;
        };
        Update: {
          applicability_json?: Json;
          applicability_known?: boolean;
          confidence?: number;
          created_at?: string;
          created_by_user_id?: string | null;
          expires_at?: string | null;
          id?: string;
          last_applied_at?: string | null;
          memory_type?: string;
          origin_campaign_id?: string | null;
          origin_candidate_id?: string | null;
          origin_id?: string | null;
          origin_run_id?: string | null;
          origin_type?: string;
          scope_id?: string;
          scope_type?: string;
          source?: string;
          statement?: string;
          status?: string;
          strength?: string;
          structured_value_json?: Json | null;
          supersedes_memory_id?: string | null;
          updated_at?: string;
          user_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "intelligence_memories_origin_campaign_id_fkey";
            columns: ["origin_campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "intelligence_memories_origin_candidate_id_fkey";
            columns: ["origin_candidate_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "intelligence_memories_origin_run_id_fkey";
            columns: ["origin_run_id"];
            isOneToOne: false;
            referencedRelation: "campaign_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "intelligence_memories_supersedes_memory_id_fkey";
            columns: ["supersedes_memory_id"];
            isOneToOne: false;
            referencedRelation: "intelligence_memories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "intelligence_memories_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      intelligence_task_attempts: {
        Row: {
          attempt_number: number;
          completed_at: string | null;
          error_code: string | null;
          id: string;
          metrics_json: Json;
          started_at: string;
          status: string;
          task_run_id: string;
          trigger_execution_id: string | null;
          workspace_id: string;
        };
        Insert: {
          attempt_number: number;
          completed_at?: string | null;
          error_code?: string | null;
          id?: string;
          metrics_json?: Json;
          started_at?: string;
          status: string;
          task_run_id: string;
          trigger_execution_id?: string | null;
          workspace_id: string;
        };
        Update: {
          attempt_number?: number;
          completed_at?: string | null;
          error_code?: string | null;
          id?: string;
          metrics_json?: Json;
          started_at?: string;
          status?: string;
          task_run_id?: string;
          trigger_execution_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "intelligence_task_attempts_task_run_id_fkey";
            columns: ["task_run_id"];
            isOneToOne: false;
            referencedRelation: "intelligence_task_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "intelligence_task_attempts_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      intelligence_task_runs: {
        Row: {
          attempt_count: number;
          completed_at: string | null;
          created_at: string;
          error_code: string | null;
          error_details_json: Json | null;
          id: string;
          idempotency_key: string;
          input_fingerprint: string;
          input_reference_json: Json;
          output_reference_json: Json | null;
          parent_task_run_id: string | null;
          started_at: string | null;
          status: string;
          task_type: string;
          trigger_run_id: string | null;
          workflow_run_id: string;
          workspace_id: string;
        };
        Insert: {
          attempt_count?: number;
          completed_at?: string | null;
          created_at?: string;
          error_code?: string | null;
          error_details_json?: Json | null;
          id?: string;
          idempotency_key: string;
          input_fingerprint: string;
          input_reference_json: Json;
          output_reference_json?: Json | null;
          parent_task_run_id?: string | null;
          started_at?: string | null;
          status?: string;
          task_type: string;
          trigger_run_id?: string | null;
          workflow_run_id: string;
          workspace_id: string;
        };
        Update: {
          attempt_count?: number;
          completed_at?: string | null;
          created_at?: string;
          error_code?: string | null;
          error_details_json?: Json | null;
          id?: string;
          idempotency_key?: string;
          input_fingerprint?: string;
          input_reference_json?: Json;
          output_reference_json?: Json | null;
          parent_task_run_id?: string | null;
          started_at?: string | null;
          status?: string;
          task_type?: string;
          trigger_run_id?: string | null;
          workflow_run_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "intelligence_task_runs_parent_task_run_id_fkey";
            columns: ["parent_task_run_id"];
            isOneToOne: false;
            referencedRelation: "intelligence_task_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "intelligence_task_runs_workflow_run_id_fkey";
            columns: ["workflow_run_id"];
            isOneToOne: false;
            referencedRelation: "intelligence_workflow_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "intelligence_task_runs_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      intelligence_usage_events: {
        Row: {
          created_at: string;
          id: string;
          idempotency_key: string;
          occurred_at: string;
          provider_cost_amount: number | null;
          provider_cost_currency: string | null;
          provider_key: string;
          quantity: number;
          task_run_id: string | null;
          unit: string;
          usage_json: Json;
          usage_type: string;
          workflow_run_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          idempotency_key: string;
          occurred_at: string;
          provider_cost_amount?: number | null;
          provider_cost_currency?: string | null;
          provider_key: string;
          quantity: number;
          task_run_id?: string | null;
          unit: string;
          usage_json?: Json;
          usage_type: string;
          workflow_run_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          idempotency_key?: string;
          occurred_at?: string;
          provider_cost_amount?: number | null;
          provider_cost_currency?: string | null;
          provider_key?: string;
          quantity?: number;
          task_run_id?: string | null;
          unit?: string;
          usage_json?: Json;
          usage_type?: string;
          workflow_run_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "intelligence_usage_events_task_run_id_fkey";
            columns: ["task_run_id"];
            isOneToOne: false;
            referencedRelation: "intelligence_task_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "intelligence_usage_events_workflow_run_id_fkey";
            columns: ["workflow_run_id"];
            isOneToOne: false;
            referencedRelation: "intelligence_workflow_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "intelligence_usage_events_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      intelligence_workflow_runs: {
        Row: {
          campaign_run_id: string;
          cancelled_at: string | null;
          completed_at: string | null;
          created_at: string;
          error_summary_json: Json | null;
          id: string;
          input_reference_json: Json;
          output_reference_json: Json | null;
          paused_at: string | null;
          progress_summary_json: Json;
          requested_by_user_id: string | null;
          started_at: string | null;
          status: string;
          subject_id: string;
          subject_type: string;
          trigger_run_id: string | null;
          workflow_family: string;
          workflow_version_id: string;
          workspace_id: string;
        };
        Insert: {
          campaign_run_id: string;
          cancelled_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          error_summary_json?: Json | null;
          id?: string;
          input_reference_json: Json;
          output_reference_json?: Json | null;
          paused_at?: string | null;
          progress_summary_json?: Json;
          requested_by_user_id?: string | null;
          started_at?: string | null;
          status?: string;
          subject_id: string;
          subject_type?: string;
          trigger_run_id?: string | null;
          workflow_family?: string;
          workflow_version_id: string;
          workspace_id: string;
        };
        Update: {
          campaign_run_id?: string;
          cancelled_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          error_summary_json?: Json | null;
          id?: string;
          input_reference_json?: Json;
          output_reference_json?: Json | null;
          paused_at?: string | null;
          progress_summary_json?: Json;
          requested_by_user_id?: string | null;
          started_at?: string | null;
          status?: string;
          subject_id?: string;
          subject_type?: string;
          trigger_run_id?: string | null;
          workflow_family?: string;
          workflow_version_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "intelligence_workflow_runs_campaign_run_id_fkey";
            columns: ["campaign_run_id"];
            isOneToOne: true;
            referencedRelation: "campaign_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "intelligence_workflow_runs_workflow_version_id_fkey";
            columns: ["workflow_version_id"];
            isOneToOne: false;
            referencedRelation: "workflow_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "intelligence_workflow_runs_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      market_analyses: {
        Row: {
          actual_model: string;
          analysis: Json;
          campaign_id: string;
          campaign_run_id: string;
          confidence: number;
          created_at: string;
          fallback_used: boolean;
          id: string;
          prompt_version: string;
          requested_model: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          actual_model: string;
          analysis: Json;
          campaign_id: string;
          campaign_run_id: string;
          confidence: number;
          created_at?: string;
          fallback_used?: boolean;
          id?: string;
          prompt_version: string;
          requested_model: string;
          version: number;
          workspace_id: string;
        };
        Update: {
          actual_model?: string;
          analysis?: Json;
          campaign_id?: string;
          campaign_run_id?: string;
          confidence?: number;
          created_at?: string;
          fallback_used?: boolean;
          id?: string;
          prompt_version?: string;
          requested_model?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "market_analyses_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "market_analyses_campaign_run_id_fkey";
            columns: ["campaign_run_id"];
            isOneToOne: false;
            referencedRelation: "campaign_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "market_analyses_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      memory_application_events: {
        Row: {
          application_reason: string;
          applied_to_id: string;
          applied_to_type: string;
          created_at: string;
          id: string;
          memory_id: string;
          memory_snapshot_id: string | null;
          precedence_result_json: Json;
          result: string;
          workspace_id: string;
        };
        Insert: {
          application_reason: string;
          applied_to_id: string;
          applied_to_type: string;
          created_at?: string;
          id?: string;
          memory_id: string;
          memory_snapshot_id?: string | null;
          precedence_result_json?: Json;
          result: string;
          workspace_id: string;
        };
        Update: {
          application_reason?: string;
          applied_to_id?: string;
          applied_to_type?: string;
          created_at?: string;
          id?: string;
          memory_id?: string;
          memory_snapshot_id?: string | null;
          precedence_result_json?: Json;
          result?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "memory_application_events_memory_id_fkey";
            columns: ["memory_id"];
            isOneToOne: false;
            referencedRelation: "intelligence_memories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "memory_application_events_memory_snapshot_id_fkey";
            columns: ["memory_snapshot_id"];
            isOneToOne: false;
            referencedRelation: "campaign_memory_snapshots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "memory_application_events_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      memory_evidence_links: {
        Row: {
          correction_id: string | null;
          created_at: string;
          evidence_id: string | null;
          id: string;
          link_reason: string;
          memory_id: string;
          workspace_id: string;
        };
        Insert: {
          correction_id?: string | null;
          created_at?: string;
          evidence_id?: string | null;
          id?: string;
          link_reason?: string;
          memory_id: string;
          workspace_id: string;
        };
        Update: {
          correction_id?: string | null;
          created_at?: string;
          evidence_id?: string | null;
          id?: string;
          link_reason?: string;
          memory_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "memory_evidence_links_correction_fk";
            columns: ["correction_id"];
            isOneToOne: false;
            referencedRelation: "user_corrections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "memory_evidence_links_evidence_id_fkey";
            columns: ["evidence_id"];
            isOneToOne: false;
            referencedRelation: "evidence_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "memory_evidence_links_memory_id_fkey";
            columns: ["memory_id"];
            isOneToOne: false;
            referencedRelation: "intelligence_memories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "memory_evidence_links_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      memory_promotion_proposals: {
        Row: {
          confidence: number;
          created_at: string;
          current_scope_type: string;
          id: string;
          promoted_memory_id: string | null;
          proposed_applicability_json: Json;
          proposed_scope_id: string;
          proposed_scope_type: string;
          proposed_statement: string;
          reason: string;
          recurrence_count: number;
          resolved_at: string | null;
          resolved_by_user_id: string | null;
          source_memory_id: string;
          source_memory_ids: string[];
          status: string;
          supporting_campaign_ids: string[];
          supporting_evidence_ids: string[];
          workspace_id: string;
        };
        Insert: {
          confidence: number;
          created_at?: string;
          current_scope_type: string;
          id?: string;
          promoted_memory_id?: string | null;
          proposed_applicability_json?: Json;
          proposed_scope_id: string;
          proposed_scope_type: string;
          proposed_statement: string;
          reason: string;
          recurrence_count?: number;
          resolved_at?: string | null;
          resolved_by_user_id?: string | null;
          source_memory_id: string;
          source_memory_ids?: string[];
          status?: string;
          supporting_campaign_ids?: string[];
          supporting_evidence_ids?: string[];
          workspace_id: string;
        };
        Update: {
          confidence?: number;
          created_at?: string;
          current_scope_type?: string;
          id?: string;
          promoted_memory_id?: string | null;
          proposed_applicability_json?: Json;
          proposed_scope_id?: string;
          proposed_scope_type?: string;
          proposed_statement?: string;
          reason?: string;
          recurrence_count?: number;
          resolved_at?: string | null;
          resolved_by_user_id?: string | null;
          source_memory_id?: string;
          source_memory_ids?: string[];
          status?: string;
          supporting_campaign_ids?: string[];
          supporting_evidence_ids?: string[];
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "memory_promotion_proposals_promoted_memory_id_fkey";
            columns: ["promoted_memory_id"];
            isOneToOne: false;
            referencedRelation: "intelligence_memories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "memory_promotion_proposals_source_memory_id_fkey";
            columns: ["source_memory_id"];
            isOneToOne: false;
            referencedRelation: "intelligence_memories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "memory_promotion_proposals_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      normalized_provider_candidates: {
        Row: {
          campaign_id: string;
          canonical_domain_hint: string | null;
          country: string | null;
          created_at: string;
          description: string | null;
          employee_count: number | null;
          id: string;
          industries_json: Json;
          keywords_json: Json;
          locality: string | null;
          matched_archetype_key: string;
          matched_segment_key: string;
          matched_signals_json: Json;
          name: string;
          normalization_version: string;
          normalized_name: string | null;
          organization_type_hint: string | null;
          preliminary_quality_json: Json;
          provider_key: string;
          provider_source_record_id: string;
          region: string | null;
          source_url: string | null;
          website_url: string | null;
          workspace_id: string;
        };
        Insert: {
          campaign_id: string;
          canonical_domain_hint?: string | null;
          country?: string | null;
          created_at: string;
          description?: string | null;
          employee_count?: number | null;
          id?: string;
          industries_json?: Json;
          keywords_json?: Json;
          locality?: string | null;
          matched_archetype_key: string;
          matched_segment_key: string;
          matched_signals_json?: Json;
          name: string;
          normalization_version: string;
          normalized_name?: string | null;
          organization_type_hint?: string | null;
          preliminary_quality_json: Json;
          provider_key: string;
          provider_source_record_id: string;
          region?: string | null;
          source_url?: string | null;
          website_url?: string | null;
          workspace_id: string;
        };
        Update: {
          campaign_id?: string;
          canonical_domain_hint?: string | null;
          country?: string | null;
          created_at?: string;
          description?: string | null;
          employee_count?: number | null;
          id?: string;
          industries_json?: Json;
          keywords_json?: Json;
          locality?: string | null;
          matched_archetype_key?: string;
          matched_segment_key?: string;
          matched_signals_json?: Json;
          name?: string;
          normalization_version?: string;
          normalized_name?: string | null;
          organization_type_hint?: string | null;
          preliminary_quality_json?: Json;
          provider_key?: string;
          provider_source_record_id?: string;
          region?: string | null;
          source_url?: string | null;
          website_url?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "normalized_provider_candidates_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "normalized_provider_candidates_provider_source_record_id_fkey";
            columns: ["provider_source_record_id"];
            isOneToOne: false;
            referencedRelation: "provider_source_records";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "normalized_provider_candidates_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      operation_idempotency_keys: {
        Row: {
          campaign_run_id: string | null;
          completed_at: string | null;
          created_at: string;
          expires_at: string | null;
          id: string;
          idempotency_key: string;
          operation: string;
          request_hash: string;
          result_reference_id: string | null;
          result_reference_type: string | null;
          status: string;
          workspace_id: string;
        };
        Insert: {
          campaign_run_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          idempotency_key: string;
          operation: string;
          request_hash: string;
          result_reference_id?: string | null;
          result_reference_type?: string | null;
          status?: string;
          workspace_id: string;
        };
        Update: {
          campaign_run_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          idempotency_key?: string;
          operation?: string;
          request_hash?: string;
          result_reference_id?: string | null;
          result_reference_type?: string | null;
          status?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "operation_idempotency_keys_campaign_run_id_fkey";
            columns: ["campaign_run_id"];
            isOneToOne: false;
            referencedRelation: "campaign_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "operation_idempotency_keys_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_aliases: {
        Row: {
          alias: string;
          alias_type: string;
          confidence: number;
          country: string | null;
          created_at: string;
          evidence_ids_json: Json;
          id: string;
          normalized_alias: string;
          organization_id: string;
          workspace_id: string;
        };
        Insert: {
          alias: string;
          alias_type: string;
          confidence: number;
          country?: string | null;
          created_at?: string;
          evidence_ids_json?: Json;
          id?: string;
          normalized_alias: string;
          organization_id: string;
          workspace_id: string;
        };
        Update: {
          alias?: string;
          alias_type?: string;
          confidence?: number;
          country?: string | null;
          created_at?: string;
          evidence_ids_json?: Json;
          id?: string;
          normalized_alias?: string;
          organization_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_aliases_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_aliases_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_buying_hypotheses: {
        Row: {
          buying_organization_id: string;
          campaign_id: string | null;
          confidence: number;
          created_at: string;
          created_by: string;
          evidence_ids_json: Json;
          id: string;
          procurement_autonomy: string;
          procurement_scope_json: Json;
          reasoning_summary: string;
          status: string;
          target_organization_id: string;
          workspace_id: string;
        };
        Insert: {
          buying_organization_id: string;
          campaign_id?: string | null;
          confidence: number;
          created_at?: string;
          created_by: string;
          evidence_ids_json?: Json;
          id?: string;
          procurement_autonomy?: string;
          procurement_scope_json?: Json;
          reasoning_summary?: string;
          status?: string;
          target_organization_id: string;
          workspace_id: string;
        };
        Update: {
          buying_organization_id?: string;
          campaign_id?: string | null;
          confidence?: number;
          created_at?: string;
          created_by?: string;
          evidence_ids_json?: Json;
          id?: string;
          procurement_autonomy?: string;
          procurement_scope_json?: Json;
          reasoning_summary?: string;
          status?: string;
          target_organization_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_buying_hypotheses_buying_organization_id_fkey";
            columns: ["buying_organization_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_buying_hypotheses_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_buying_hypotheses_target_organization_id_fkey";
            columns: ["target_organization_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_buying_hypotheses_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_identifiers: {
        Row: {
          created_at: string;
          evidence_ids_json: Json;
          id: string;
          identifier_type: string;
          jurisdiction: string;
          normalized_value: string;
          organization_id: string;
          source_record_id: string | null;
          verification_status: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          evidence_ids_json?: Json;
          id?: string;
          identifier_type: string;
          jurisdiction?: string;
          normalized_value: string;
          organization_id: string;
          source_record_id?: string | null;
          verification_status?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          evidence_ids_json?: Json;
          id?: string;
          identifier_type?: string;
          jurisdiction?: string;
          normalized_value?: string;
          organization_id?: string;
          source_record_id?: string | null;
          verification_status?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_identifiers_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_identifiers_source_record_id_fkey";
            columns: ["source_record_id"];
            isOneToOne: false;
            referencedRelation: "provider_source_records";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_identifiers_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_locations: {
        Row: {
          address_line: string | null;
          confidence: number;
          country: string | null;
          created_at: string;
          evidence_ids_json: Json;
          id: string;
          locality: string | null;
          location_type: string;
          normalized_address: string | null;
          organization_id: string;
          phone: string | null;
          postal_code: string | null;
          region: string | null;
          workspace_id: string;
        };
        Insert: {
          address_line?: string | null;
          confidence: number;
          country?: string | null;
          created_at?: string;
          evidence_ids_json?: Json;
          id?: string;
          locality?: string | null;
          location_type: string;
          normalized_address?: string | null;
          organization_id: string;
          phone?: string | null;
          postal_code?: string | null;
          region?: string | null;
          workspace_id: string;
        };
        Update: {
          address_line?: string | null;
          confidence?: number;
          country?: string | null;
          created_at?: string;
          evidence_ids_json?: Json;
          id?: string;
          locality?: string | null;
          location_type?: string;
          normalized_address?: string | null;
          organization_id?: string;
          phone?: string | null;
          postal_code?: string | null;
          region?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_locations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_locations_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_merge_events: {
        Row: {
          actor_id: string | null;
          actor_type: string;
          created_at: string;
          id: string;
          merge_reason: string;
          pre_merge_snapshot_json: Json;
          resolution_decision_id: string | null;
          reversed_at: string | null;
          rules_version: string;
          signals_json: Json;
          source_organization_id: string;
          target_organization_id: string;
          workspace_id: string;
        };
        Insert: {
          actor_id?: string | null;
          actor_type: string;
          created_at?: string;
          id?: string;
          merge_reason: string;
          pre_merge_snapshot_json: Json;
          resolution_decision_id?: string | null;
          reversed_at?: string | null;
          rules_version: string;
          signals_json: Json;
          source_organization_id: string;
          target_organization_id: string;
          workspace_id: string;
        };
        Update: {
          actor_id?: string | null;
          actor_type?: string;
          created_at?: string;
          id?: string;
          merge_reason?: string;
          pre_merge_snapshot_json?: Json;
          resolution_decision_id?: string | null;
          reversed_at?: string | null;
          rules_version?: string;
          signals_json?: Json;
          source_organization_id?: string;
          target_organization_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_merge_events_resolution_decision_id_fkey";
            columns: ["resolution_decision_id"];
            isOneToOne: false;
            referencedRelation: "entity_resolution_decisions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_merge_events_source_organization_id_fkey";
            columns: ["source_organization_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_merge_events_target_organization_id_fkey";
            columns: ["target_organization_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_merge_events_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_relationships: {
        Row: {
          confidence: number;
          created_at: string;
          created_by: string;
          evidence_ids_json: Json;
          id: string;
          model_version: string | null;
          relationship_type: string;
          source_organization_id: string;
          status: string;
          target_organization_id: string;
          valid_from: string | null;
          valid_to: string | null;
          workspace_id: string;
        };
        Insert: {
          confidence: number;
          created_at?: string;
          created_by: string;
          evidence_ids_json?: Json;
          id?: string;
          model_version?: string | null;
          relationship_type: string;
          source_organization_id: string;
          status?: string;
          target_organization_id: string;
          valid_from?: string | null;
          valid_to?: string | null;
          workspace_id: string;
        };
        Update: {
          confidence?: number;
          created_at?: string;
          created_by?: string;
          evidence_ids_json?: Json;
          id?: string;
          model_version?: string | null;
          relationship_type?: string;
          source_organization_id?: string;
          status?: string;
          target_organization_id?: string;
          valid_from?: string | null;
          valid_to?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_relationships_source_organization_id_fkey";
            columns: ["source_organization_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_relationships_target_organization_id_fkey";
            columns: ["target_organization_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_relationships_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_source_links: {
        Row: {
          confidence: number;
          id: string;
          link_status: string;
          linked_at: string;
          normalized_candidate_id: string | null;
          organization_id: string;
          provider_source_record_id: string;
          resolution_decision_id: string | null;
          workspace_id: string;
        };
        Insert: {
          confidence: number;
          id?: string;
          link_status?: string;
          linked_at?: string;
          normalized_candidate_id?: string | null;
          organization_id: string;
          provider_source_record_id: string;
          resolution_decision_id?: string | null;
          workspace_id: string;
        };
        Update: {
          confidence?: number;
          id?: string;
          link_status?: string;
          linked_at?: string;
          normalized_candidate_id?: string | null;
          organization_id?: string;
          provider_source_record_id?: string;
          resolution_decision_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_source_links_normalized_candidate_id_fkey";
            columns: ["normalized_candidate_id"];
            isOneToOne: false;
            referencedRelation: "normalized_provider_candidates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_source_links_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_source_links_provider_source_record_id_fkey";
            columns: ["provider_source_record_id"];
            isOneToOne: false;
            referencedRelation: "provider_source_records";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_source_links_resolution_decision_id_fkey";
            columns: ["resolution_decision_id"];
            isOneToOne: false;
            referencedRelation: "entity_resolution_decisions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_source_links_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_split_events: {
        Row: {
          actor_id: string | null;
          created_at: string;
          id: string;
          merge_event_id: string;
          reassignment_plan_json: Json;
          restored_organization_id: string;
          split_reason: string;
          workspace_id: string;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          merge_event_id: string;
          reassignment_plan_json: Json;
          restored_organization_id: string;
          split_reason: string;
          workspace_id: string;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          merge_event_id?: string;
          reassignment_plan_json?: Json;
          restored_organization_id?: string;
          split_reason?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_split_events_merge_event_id_fkey";
            columns: ["merge_event_id"];
            isOneToOne: true;
            referencedRelation: "organization_merge_events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_split_events_restored_organization_id_fkey";
            columns: ["restored_organization_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_split_events_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      outreach_drafts: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          body: string;
          campaign_company_id: string;
          campaign_contact_id: string | null;
          campaign_id: string;
          campaign_run_id: string | null;
          created_at: string;
          evidence_used: string[];
          generated_at: string | null;
          id: string;
          input_hash: string;
          language: string;
          model_config_id: string | null;
          profile_snapshot_id: string;
          prompt_version: string | null;
          seller_claims: string[];
          sequence_step_id: string | null;
          status: string;
          strategy_version_id: string;
          subject: string;
          updated_at: string;
          variant: string;
          warnings: string[];
          workspace_id: string;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          body: string;
          campaign_company_id: string;
          campaign_contact_id?: string | null;
          campaign_id: string;
          campaign_run_id?: string | null;
          created_at?: string;
          evidence_used?: string[];
          generated_at?: string | null;
          id?: string;
          input_hash: string;
          language?: string;
          model_config_id?: string | null;
          profile_snapshot_id: string;
          prompt_version?: string | null;
          seller_claims?: string[];
          sequence_step_id?: string | null;
          status?: string;
          strategy_version_id: string;
          subject: string;
          updated_at?: string;
          variant: string;
          warnings?: string[];
          workspace_id: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          body?: string;
          campaign_company_id?: string;
          campaign_contact_id?: string | null;
          campaign_id?: string;
          campaign_run_id?: string | null;
          created_at?: string;
          evidence_used?: string[];
          generated_at?: string | null;
          id?: string;
          input_hash?: string;
          language?: string;
          model_config_id?: string | null;
          profile_snapshot_id?: string;
          prompt_version?: string | null;
          seller_claims?: string[];
          sequence_step_id?: string | null;
          status?: string;
          strategy_version_id?: string;
          subject?: string;
          updated_at?: string;
          variant?: string;
          warnings?: string[];
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "outreach_drafts_campaign_company_id_fkey";
            columns: ["campaign_company_id"];
            isOneToOne: false;
            referencedRelation: "campaign_companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "outreach_drafts_campaign_contact_id_fkey";
            columns: ["campaign_contact_id"];
            isOneToOne: false;
            referencedRelation: "campaign_contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "outreach_drafts_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "outreach_drafts_campaign_run_id_fkey";
            columns: ["campaign_run_id"];
            isOneToOne: false;
            referencedRelation: "campaign_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "outreach_drafts_model_config_fk";
            columns: ["model_config_id"];
            isOneToOne: false;
            referencedRelation: "ai_model_configs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "outreach_drafts_profile_snapshot_id_fkey";
            columns: ["profile_snapshot_id"];
            isOneToOne: false;
            referencedRelation: "campaign_profile_snapshots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "outreach_drafts_sequence_step_id_fkey";
            columns: ["sequence_step_id"];
            isOneToOne: false;
            referencedRelation: "sequence_steps";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "outreach_drafts_strategy_version_id_fkey";
            columns: ["strategy_version_id"];
            isOneToOne: false;
            referencedRelation: "campaign_strategy_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "outreach_drafts_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      profile_change_events: {
        Row: {
          actor_type: string;
          actor_user_id: string | null;
          affected_paths: string[];
          created_at: string;
          details_json: Json;
          event_type: string;
          id: string;
          profile_draft_id: string;
          workspace_id: string;
        };
        Insert: {
          actor_type: string;
          actor_user_id?: string | null;
          affected_paths?: string[];
          created_at?: string;
          details_json?: Json;
          event_type: string;
          id?: string;
          profile_draft_id: string;
          workspace_id: string;
        };
        Update: {
          actor_type?: string;
          actor_user_id?: string | null;
          affected_paths?: string[];
          created_at?: string;
          details_json?: Json;
          event_type?: string;
          id?: string;
          profile_draft_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_change_events_profile_draft_id_fkey";
            columns: ["profile_draft_id"];
            isOneToOne: false;
            referencedRelation: "company_profile_drafts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_change_events_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      profile_clarification_questions: {
        Row: {
          affected_paths: string[];
          answer_json: Json | null;
          answer_type: string;
          category: string;
          created_at: string;
          explanation: string;
          id: string;
          impact: string;
          options_json: Json;
          profile_draft_id: string;
          question: string;
          question_key: string;
          skip_allowed: boolean;
          status: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          affected_paths?: string[];
          answer_json?: Json | null;
          answer_type: string;
          category: string;
          created_at?: string;
          explanation: string;
          id?: string;
          impact: string;
          options_json?: Json;
          profile_draft_id: string;
          question: string;
          question_key: string;
          skip_allowed?: boolean;
          status?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          affected_paths?: string[];
          answer_json?: Json | null;
          answer_type?: string;
          category?: string;
          created_at?: string;
          explanation?: string;
          id?: string;
          impact?: string;
          options_json?: Json;
          profile_draft_id?: string;
          question?: string;
          question_key?: string;
          skip_allowed?: boolean;
          status?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_clarification_questions_profile_draft_id_fkey";
            columns: ["profile_draft_id"];
            isOneToOne: false;
            referencedRelation: "company_profile_drafts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_clarification_questions_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      profile_task_runs: {
        Row: {
          ai_request_ids: string[];
          attempt_count: number;
          completed_at: string | null;
          context_compiler_version: string;
          contract_version: string;
          created_at: string;
          error_code: string | null;
          error_message: string | null;
          id: string;
          idempotency_key: string;
          input_hash: string;
          output_hash: string | null;
          output_json: Json | null;
          profile_draft_id: string;
          prompt_version: string;
          schema_version: string;
          started_at: string | null;
          status: string;
          task_id: string;
          trigger_run_id: string | null;
          updated_at: string;
          warnings_json: Json;
          workspace_id: string;
        };
        Insert: {
          ai_request_ids?: string[];
          attempt_count?: number;
          completed_at?: string | null;
          context_compiler_version: string;
          contract_version: string;
          created_at?: string;
          error_code?: string | null;
          error_message?: string | null;
          id?: string;
          idempotency_key: string;
          input_hash: string;
          output_hash?: string | null;
          output_json?: Json | null;
          profile_draft_id: string;
          prompt_version: string;
          schema_version: string;
          started_at?: string | null;
          status?: string;
          task_id: string;
          trigger_run_id?: string | null;
          updated_at?: string;
          warnings_json?: Json;
          workspace_id: string;
        };
        Update: {
          ai_request_ids?: string[];
          attempt_count?: number;
          completed_at?: string | null;
          context_compiler_version?: string;
          contract_version?: string;
          created_at?: string;
          error_code?: string | null;
          error_message?: string | null;
          id?: string;
          idempotency_key?: string;
          input_hash?: string;
          output_hash?: string | null;
          output_json?: Json | null;
          profile_draft_id?: string;
          prompt_version?: string;
          schema_version?: string;
          started_at?: string | null;
          status?: string;
          task_id?: string;
          trigger_run_id?: string | null;
          updated_at?: string;
          warnings_json?: Json;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_task_runs_profile_draft_id_fkey";
            columns: ["profile_draft_id"];
            isOneToOne: false;
            referencedRelation: "company_profile_drafts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_task_runs_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          id: string;
          locale: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          id: string;
          locale?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          id?: string;
          locale?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      prompt_versions: {
        Row: {
          change_notes: string | null;
          content_hash: string;
          contract_id: string;
          created_at: string;
          id: string;
          prompt_key: string;
          role: string;
          status: string;
          system_template: string;
          user_template: string;
          version: string;
        };
        Insert: {
          change_notes?: string | null;
          content_hash: string;
          contract_id: string;
          created_at?: string;
          id?: string;
          prompt_key: string;
          role: string;
          status?: string;
          system_template: string;
          user_template: string;
          version: string;
        };
        Update: {
          change_notes?: string | null;
          content_hash?: string;
          contract_id?: string;
          created_at?: string;
          id?: string;
          prompt_key?: string;
          role?: string;
          status?: string;
          system_template?: string;
          user_template?: string;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "prompt_versions_contract_id_fkey";
            columns: ["contract_id"];
            isOneToOne: false;
            referencedRelation: "intelligence_contracts";
            referencedColumns: ["id"];
          },
        ];
      };
      provider_adapters: {
        Row: {
          adapter_version: string;
          configuration_schema: Json;
          created_at: string;
          id: string;
          provider_key: string;
          status: string;
        };
        Insert: {
          adapter_version: string;
          configuration_schema?: Json;
          created_at?: string;
          id?: string;
          provider_key: string;
          status?: string;
        };
        Update: {
          adapter_version?: string;
          configuration_schema?: Json;
          created_at?: string;
          id?: string;
          provider_key?: string;
          status?: string;
        };
        Relationships: [];
      };
      provider_executions: {
        Row: {
          actual_cost: number;
          agent_iteration: number | null;
          attempt: number;
          campaign_run_id: string | null;
          completed_at: string | null;
          created_at: string;
          currency: string;
          dispatch_attempts: number;
          dispatch_key: string | null;
          dispatch_state: string;
          dispatch_updated_at: string;
          error_code: string | null;
          error_message: string | null;
          estimated_cost: number;
          id: string;
          idempotency_key: string;
          input_units: number | null;
          last_dispatch_error: string | null;
          metadata: Json;
          operation: string;
          output_units: number | null;
          parent_execution_id: string | null;
          provider: string;
          provider_cost: number | null;
          provider_currency: string | null;
          provider_reference: string | null;
          request_hash: string;
          started_at: string | null;
          status: string;
          trigger_run_id: string | null;
          workspace_id: string;
        };
        Insert: {
          actual_cost?: number;
          agent_iteration?: number | null;
          attempt?: number;
          campaign_run_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          currency?: string;
          dispatch_attempts?: number;
          dispatch_key?: string | null;
          dispatch_state?: string;
          dispatch_updated_at?: string;
          error_code?: string | null;
          error_message?: string | null;
          estimated_cost?: number;
          id?: string;
          idempotency_key: string;
          input_units?: number | null;
          last_dispatch_error?: string | null;
          metadata?: Json;
          operation: string;
          output_units?: number | null;
          parent_execution_id?: string | null;
          provider: string;
          provider_cost?: number | null;
          provider_currency?: string | null;
          provider_reference?: string | null;
          request_hash: string;
          started_at?: string | null;
          status: string;
          trigger_run_id?: string | null;
          workspace_id: string;
        };
        Update: {
          actual_cost?: number;
          agent_iteration?: number | null;
          attempt?: number;
          campaign_run_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          currency?: string;
          dispatch_attempts?: number;
          dispatch_key?: string | null;
          dispatch_state?: string;
          dispatch_updated_at?: string;
          error_code?: string | null;
          error_message?: string | null;
          estimated_cost?: number;
          id?: string;
          idempotency_key?: string;
          input_units?: number | null;
          last_dispatch_error?: string | null;
          metadata?: Json;
          operation?: string;
          output_units?: number | null;
          parent_execution_id?: string | null;
          provider?: string;
          provider_cost?: number | null;
          provider_currency?: string | null;
          provider_reference?: string | null;
          request_hash?: string;
          started_at?: string | null;
          status?: string;
          trigger_run_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "provider_executions_campaign_run_id_fkey";
            columns: ["campaign_run_id"];
            isOneToOne: false;
            referencedRelation: "campaign_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "provider_executions_parent_execution_id_fkey";
            columns: ["parent_execution_id"];
            isOneToOne: false;
            referencedRelation: "provider_executions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "provider_executions_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      provider_source_records: {
        Row: {
          adapter_version: string;
          campaign_id: string;
          created_at: string;
          discovery_plan_key: string;
          discovery_segment_key: string;
          duplicate_of_source_record_id: string | null;
          id: string;
          ingestion_status: string;
          provider_execution_id: string;
          provider_key: string;
          provider_published_at: string | null;
          provider_record_id: string | null;
          provider_updated_at: string | null;
          query_or_filter_fingerprint: string;
          raw_payload_hash: string;
          raw_payload_json: Json;
          result_rank: number | null;
          retrieved_at: string;
          source_record_key: string;
          source_type: string;
          source_url: string | null;
          workspace_id: string;
        };
        Insert: {
          adapter_version: string;
          campaign_id: string;
          created_at?: string;
          discovery_plan_key: string;
          discovery_segment_key: string;
          duplicate_of_source_record_id?: string | null;
          id?: string;
          ingestion_status?: string;
          provider_execution_id: string;
          provider_key: string;
          provider_published_at?: string | null;
          provider_record_id?: string | null;
          provider_updated_at?: string | null;
          query_or_filter_fingerprint: string;
          raw_payload_hash: string;
          raw_payload_json: Json;
          result_rank?: number | null;
          retrieved_at: string;
          source_record_key: string;
          source_type: string;
          source_url?: string | null;
          workspace_id: string;
        };
        Update: {
          adapter_version?: string;
          campaign_id?: string;
          created_at?: string;
          discovery_plan_key?: string;
          discovery_segment_key?: string;
          duplicate_of_source_record_id?: string | null;
          id?: string;
          ingestion_status?: string;
          provider_execution_id?: string;
          provider_key?: string;
          provider_published_at?: string | null;
          provider_record_id?: string | null;
          provider_updated_at?: string | null;
          query_or_filter_fingerprint?: string;
          raw_payload_hash?: string;
          raw_payload_json?: Json;
          result_rank?: number | null;
          retrieved_at?: string;
          source_record_key?: string;
          source_type?: string;
          source_url?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "provider_source_records_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "provider_source_records_duplicate_of_source_record_id_fkey";
            columns: ["duplicate_of_source_record_id"];
            isOneToOne: false;
            referencedRelation: "provider_source_records";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "provider_source_records_provider_execution_id_fkey";
            columns: ["provider_execution_id"];
            isOneToOne: false;
            referencedRelation: "discovery_provider_executions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "provider_source_records_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      qualification_dimensions: {
        Row: {
          confidence: string;
          criterion: string;
          explanation: string;
          id: string;
          metadata: Json;
          qualification_result_id: string;
          score: number;
          workspace_id: string;
        };
        Insert: {
          confidence: string;
          criterion: string;
          explanation: string;
          id?: string;
          metadata?: Json;
          qualification_result_id: string;
          score: number;
          workspace_id: string;
        };
        Update: {
          confidence?: string;
          criterion?: string;
          explanation?: string;
          id?: string;
          metadata?: Json;
          qualification_result_id?: string;
          score?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "qualification_dimensions_qualification_result_id_fkey";
            columns: ["qualification_result_id"];
            isOneToOne: false;
            referencedRelation: "qualification_results";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "qualification_dimensions_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      qualification_evidence: {
        Row: {
          confidence: string;
          created_at: string;
          criterion: string;
          evidence_kind: string;
          id: string;
          metadata: Json;
          qualification_result_id: string;
          source_id: string | null;
          source_url: string | null;
          statement: string;
          workspace_id: string;
        };
        Insert: {
          confidence: string;
          created_at?: string;
          criterion: string;
          evidence_kind: string;
          id?: string;
          metadata?: Json;
          qualification_result_id: string;
          source_id?: string | null;
          source_url?: string | null;
          statement: string;
          workspace_id: string;
        };
        Update: {
          confidence?: string;
          created_at?: string;
          criterion?: string;
          evidence_kind?: string;
          id?: string;
          metadata?: Json;
          qualification_result_id?: string;
          source_id?: string | null;
          source_url?: string | null;
          statement?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "qualification_evidence_qualification_result_id_fkey";
            columns: ["qualification_result_id"];
            isOneToOne: false;
            referencedRelation: "qualification_results";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "qualification_evidence_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "company_sources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "qualification_evidence_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      qualification_results: {
        Row: {
          campaign_company_id: string;
          campaign_run_id: string | null;
          confidence: string;
          created_at: string;
          id: string;
          input_hash: string;
          missing_evidence: string[];
          model_config_id: string | null;
          negative_signals: string[];
          positive_signals: string[];
          prompt_version: string;
          recommended_roles: string[];
          relationship_hypothesis: string;
          schema_version: string;
          score: number;
          status: string;
          summary: string;
          workspace_id: string;
        };
        Insert: {
          campaign_company_id: string;
          campaign_run_id?: string | null;
          confidence: string;
          created_at?: string;
          id?: string;
          input_hash: string;
          missing_evidence?: string[];
          model_config_id?: string | null;
          negative_signals?: string[];
          positive_signals?: string[];
          prompt_version: string;
          recommended_roles?: string[];
          relationship_hypothesis?: string;
          schema_version: string;
          score: number;
          status: string;
          summary: string;
          workspace_id: string;
        };
        Update: {
          campaign_company_id?: string;
          campaign_run_id?: string | null;
          confidence?: string;
          created_at?: string;
          id?: string;
          input_hash?: string;
          missing_evidence?: string[];
          model_config_id?: string | null;
          negative_signals?: string[];
          positive_signals?: string[];
          prompt_version?: string;
          recommended_roles?: string[];
          relationship_hypothesis?: string;
          schema_version?: string;
          score?: number;
          status?: string;
          summary?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "qualification_results_campaign_company_id_fkey";
            columns: ["campaign_company_id"];
            isOneToOne: false;
            referencedRelation: "campaign_companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "qualification_results_campaign_run_id_fkey";
            columns: ["campaign_run_id"];
            isOneToOne: false;
            referencedRelation: "campaign_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "qualification_results_model_config_fk";
            columns: ["model_config_id"];
            isOneToOne: false;
            referencedRelation: "ai_model_configs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "qualification_results_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      qualification_rubrics: {
        Row: {
          campaign_strategy_version_id: string;
          content_hash: string;
          created_at: string;
          exclusion_policy_version: string;
          factor_library_version: string;
          factors_json: Json;
          id: string;
          relationship_classifier_version: string;
          scoring_policy_version: string;
          thresholds_json: Json;
          workspace_id: string;
        };
        Insert: {
          campaign_strategy_version_id: string;
          content_hash: string;
          created_at?: string;
          exclusion_policy_version: string;
          factor_library_version: string;
          factors_json: Json;
          id?: string;
          relationship_classifier_version: string;
          scoring_policy_version: string;
          thresholds_json: Json;
          workspace_id: string;
        };
        Update: {
          campaign_strategy_version_id?: string;
          content_hash?: string;
          created_at?: string;
          exclusion_policy_version?: string;
          factor_library_version?: string;
          factors_json?: Json;
          id?: string;
          relationship_classifier_version?: string;
          scoring_policy_version?: string;
          thresholds_json?: Json;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "qualification_rubrics_campaign_strategy_version_id_fkey";
            columns: ["campaign_strategy_version_id"];
            isOneToOne: false;
            referencedRelation: "campaign_strategy_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "qualification_rubrics_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      scoring_versions: {
        Row: {
          confidence_policy_json: Json;
          content_hash: string;
          created_at: string;
          formula_json: Json;
          id: string;
          lane_policy_json: Json;
          status: string;
          version: string;
        };
        Insert: {
          confidence_policy_json: Json;
          content_hash: string;
          created_at?: string;
          formula_json: Json;
          id?: string;
          lane_policy_json: Json;
          status?: string;
          version: string;
        };
        Update: {
          confidence_policy_json?: Json;
          content_hash?: string;
          created_at?: string;
          formula_json?: Json;
          id?: string;
          lane_policy_json?: Json;
          status?: string;
          version?: string;
        };
        Relationships: [];
      };
      sequence_steps: {
        Row: {
          delay_hours: number;
          id: string;
          sequence_id: string;
          step_number: number;
          step_type: string;
          template: Json;
          workspace_id: string;
        };
        Insert: {
          delay_hours?: number;
          id?: string;
          sequence_id: string;
          step_number: number;
          step_type: string;
          template?: Json;
          workspace_id: string;
        };
        Update: {
          delay_hours?: number;
          id?: string;
          sequence_id?: string;
          step_number?: number;
          step_type?: string;
          template?: Json;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sequence_steps_sequence_id_fkey";
            columns: ["sequence_id"];
            isOneToOne: false;
            referencedRelation: "sequences";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sequence_steps_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      sequences: {
        Row: {
          approval_required: boolean;
          created_at: string;
          id: string;
          name: string;
          status: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          approval_required?: boolean;
          created_at?: string;
          id?: string;
          name: string;
          status?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          approval_required?: boolean;
          created_at?: string;
          id?: string;
          name?: string;
          status?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sequences_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      usage_ledger: {
        Row: {
          amount: number;
          campaign_run_id: string | null;
          created_at: string;
          credits: number;
          currency: string;
          entry_type: string;
          id: string;
          idempotency_key: string;
          metadata: Json;
          operation: string;
          provider_execution_id: string | null;
          workspace_id: string;
        };
        Insert: {
          amount?: number;
          campaign_run_id?: string | null;
          created_at?: string;
          credits?: number;
          currency?: string;
          entry_type: string;
          id?: string;
          idempotency_key: string;
          metadata?: Json;
          operation: string;
          provider_execution_id?: string | null;
          workspace_id: string;
        };
        Update: {
          amount?: number;
          campaign_run_id?: string | null;
          created_at?: string;
          credits?: number;
          currency?: string;
          entry_type?: string;
          id?: string;
          idempotency_key?: string;
          metadata?: Json;
          operation?: string;
          provider_execution_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "usage_ledger_campaign_run_id_fkey";
            columns: ["campaign_run_id"];
            isOneToOne: false;
            referencedRelation: "campaign_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "usage_ledger_provider_execution_id_fkey";
            columns: ["provider_execution_id"];
            isOneToOne: false;
            referencedRelation: "provider_executions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "usage_ledger_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      user_corrections: {
        Row: {
          campaign_id: string;
          campaign_run_id: string | null;
          candidate_id: string | null;
          chosen_scope: string;
          corrected_value_json: Json;
          correction_statement: string;
          correction_type: string;
          created_at: string;
          created_by_user_id: string;
          id: string;
          immediate_action: string;
          invalidation_json: Json;
          previous_value_json: Json | null;
          target_id: string | null;
          target_type: string;
          workspace_id: string;
        };
        Insert: {
          campaign_id: string;
          campaign_run_id?: string | null;
          candidate_id?: string | null;
          chosen_scope?: string;
          corrected_value_json: Json;
          correction_statement: string;
          correction_type: string;
          created_at?: string;
          created_by_user_id: string;
          id?: string;
          immediate_action: string;
          invalidation_json?: Json;
          previous_value_json?: Json | null;
          target_id?: string | null;
          target_type: string;
          workspace_id: string;
        };
        Update: {
          campaign_id?: string;
          campaign_run_id?: string | null;
          candidate_id?: string | null;
          chosen_scope?: string;
          corrected_value_json?: Json;
          correction_statement?: string;
          correction_type?: string;
          created_at?: string;
          created_by_user_id?: string;
          id?: string;
          immediate_action?: string;
          invalidation_json?: Json;
          previous_value_json?: Json | null;
          target_id?: string | null;
          target_type?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_corrections_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_corrections_campaign_run_id_fkey";
            columns: ["campaign_run_id"];
            isOneToOne: false;
            referencedRelation: "campaign_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_corrections_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_corrections_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workflow_checkpoints: {
        Row: {
          checkpoint_key: string;
          checkpoint_version: number;
          created_at: string;
          id: string;
          payload_json: Json;
          workflow_run_id: string;
          workspace_id: string;
        };
        Insert: {
          checkpoint_key: string;
          checkpoint_version: number;
          created_at?: string;
          id?: string;
          payload_json: Json;
          workflow_run_id: string;
          workspace_id: string;
        };
        Update: {
          checkpoint_key?: string;
          checkpoint_version?: number;
          created_at?: string;
          id?: string;
          payload_json?: Json;
          workflow_run_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workflow_checkpoints_workflow_run_id_fkey";
            columns: ["workflow_run_id"];
            isOneToOne: false;
            referencedRelation: "intelligence_workflow_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflow_checkpoints_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workflow_commands: {
        Row: {
          command_type: string;
          created_at: string;
          id: string;
          payload_json: Json;
          processed_at: string | null;
          requested_by_user_id: string | null;
          status: string;
          subject_id: string;
          subject_type: string;
          workspace_id: string;
        };
        Insert: {
          command_type: string;
          created_at?: string;
          id?: string;
          payload_json?: Json;
          processed_at?: string | null;
          requested_by_user_id?: string | null;
          status?: string;
          subject_id: string;
          subject_type?: string;
          workspace_id: string;
        };
        Update: {
          command_type?: string;
          created_at?: string;
          id?: string;
          payload_json?: Json;
          processed_at?: string | null;
          requested_by_user_id?: string | null;
          status?: string;
          subject_id?: string;
          subject_type?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workflow_commands_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workflow_outbox: {
        Row: {
          attempt_count: number;
          available_at: string;
          command_id: string | null;
          created_at: string;
          event_type: string;
          id: string;
          payload_json: Json;
          published_at: string | null;
          status: string;
          workspace_id: string;
        };
        Insert: {
          attempt_count?: number;
          available_at?: string;
          command_id?: string | null;
          created_at?: string;
          event_type: string;
          id?: string;
          payload_json: Json;
          published_at?: string | null;
          status?: string;
          workspace_id: string;
        };
        Update: {
          attempt_count?: number;
          available_at?: string;
          command_id?: string | null;
          created_at?: string;
          event_type?: string;
          id?: string;
          payload_json?: Json;
          published_at?: string | null;
          status?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workflow_outbox_command_id_fkey";
            columns: ["command_id"];
            isOneToOne: false;
            referencedRelation: "workflow_commands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflow_outbox_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workflow_versions: {
        Row: {
          change_notes: string | null;
          created_at: string;
          id: string;
          status: string;
          version: string;
          workflow_family: string;
        };
        Insert: {
          change_notes?: string | null;
          created_at?: string;
          id?: string;
          status?: string;
          version: string;
          workflow_family: string;
        };
        Update: {
          change_notes?: string | null;
          created_at?: string;
          id?: string;
          status?: string;
          version?: string;
          workflow_family?: string;
        };
        Relationships: [];
      };
      workspace_intelligence_settings: {
        Row: {
          campaign_workflow: string;
          created_at: string;
          enabled_providers: string[];
          profile_version: string;
          result_write_mode: string;
          shadow_mode: boolean;
          updated_at: string;
          updated_by: string | null;
          workspace_id: string;
        };
        Insert: {
          campaign_workflow?: string;
          created_at?: string;
          enabled_providers?: string[];
          profile_version?: string;
          result_write_mode?: string;
          shadow_mode?: boolean;
          updated_at?: string;
          updated_by?: string | null;
          workspace_id: string;
        };
        Update: {
          campaign_workflow?: string;
          created_at?: string;
          enabled_providers?: string[];
          profile_version?: string;
          result_write_mode?: string;
          shadow_mode?: boolean;
          updated_at?: string;
          updated_by?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_intelligence_settings_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: true;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_members: {
        Row: {
          created_at: string;
          invited_by: string | null;
          role: string;
          status: string;
          updated_at: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          invited_by?: string | null;
          role: string;
          status?: string;
          updated_at?: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          invited_by?: string | null;
          role?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_memories: {
        Row: {
          approval_status: string;
          category: string;
          confidence: string;
          created_at: string;
          embedding: string | null;
          evidence_ids: string[];
          expires_at: string | null;
          id: string;
          origin: string;
          retention_class: string;
          statement: string;
          workspace_id: string;
        };
        Insert: {
          approval_status?: string;
          category: string;
          confidence: string;
          created_at?: string;
          embedding?: string | null;
          evidence_ids?: string[];
          expires_at?: string | null;
          id?: string;
          origin: string;
          retention_class?: string;
          statement: string;
          workspace_id: string;
        };
        Update: {
          approval_status?: string;
          category?: string;
          confidence?: string;
          created_at?: string;
          embedding?: string | null;
          evidence_ids?: string[];
          expires_at?: string | null;
          id?: string;
          origin?: string;
          retention_class?: string;
          statement?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_memories_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspaces: {
        Row: {
          created_at: string;
          created_by: string;
          default_locale: string;
          id: string;
          name: string;
          slug: string;
          status: string;
          updated_at: string;
          website_url: string | null;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          default_locale?: string;
          id?: string;
          name: string;
          slug: string;
          status?: string;
          updated_at?: string;
          website_url?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          default_locale?: string;
          id?: string;
          name?: string;
          slug?: string;
          status?: string;
          updated_at?: string;
          website_url?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      clear_workspace_data: {
        Args: { target_workspace_id: string };
        Returns: undefined;
      };
      clear_workspace_data_delete_all_legacy: {
        Args: { target_workspace_id: string };
        Returns: undefined;
      };
      compile_campaign_strategy_v2_draft: {
        Args: {
          target_compilation: Json;
          target_strategy_draft_id: string;
          target_workspace_id: string;
        };
        Returns: {
          base_strategy_version_id: string | null;
          campaign_id: string;
          campaign_input_id: string;
          compiled_context_hash: string | null;
          compiled_context_json: Json;
          compiled_draft_json: Json;
          compiler_version: string;
          content_hash: string | null;
          context_compiler_version: string;
          contract_version: string;
          created_at: string;
          created_by_run_id: string | null;
          created_by_user_id: string | null;
          id: string;
          profile_intelligence_version_id: string;
          state: string;
          updated_at: string;
          workspace_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "campaign_strategy_drafts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      compile_company_profile_v3_draft: {
        Args: {
          target_compilation: Json;
          target_profile_draft_id: string;
          target_workspace_id: string;
        };
        Returns: undefined;
      };
      confirm_campaign_strategy_v2: {
        Args: { target_strategy_draft_id: string; target_workspace_id: string };
        Returns: {
          campaign_id: string;
          compiled_context_hash: string | null;
          confirmation_status: string;
          confirmed_at: string | null;
          confirmed_by: string | null;
          content_hash: string | null;
          contract_version: string;
          created_at: string;
          created_by: string | null;
          id: string;
          model_config_id: string | null;
          profile_intelligence_version_id: string | null;
          prompt_version: string | null;
          scoring_version_id: string | null;
          status: string;
          strategy: Json;
          version: number;
          workspace_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "campaign_strategy_versions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_campaign_memory_snapshot: {
        Args: {
          target_campaign_id: string;
          target_content_hash: string;
          target_snapshot: Json;
          target_strategy_version_id: string;
          target_workspace_id: string;
        };
        Returns: {
          campaign_id: string;
          campaign_strategy_version_id: string | null;
          content_hash: string;
          created_at: string;
          id: string;
          snapshot_json: Json;
          workspace_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "campaign_memory_snapshots";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_campaign_strategy_v2_draft: {
        Args: {
          target_campaign_external_id: string;
          target_compiled_context: Json;
          target_compiled_context_hash: string;
          target_input: Json;
          target_input_hash: string;
          target_profile_version_id: string;
          target_workspace_id: string;
        };
        Returns: {
          base_strategy_version_id: string | null;
          campaign_id: string;
          campaign_input_id: string;
          compiled_context_hash: string | null;
          compiled_context_json: Json;
          compiled_draft_json: Json;
          compiler_version: string;
          content_hash: string | null;
          context_compiler_version: string;
          contract_version: string;
          created_at: string;
          created_by_run_id: string | null;
          created_by_user_id: string | null;
          id: string;
          profile_intelligence_version_id: string;
          state: string;
          updated_at: string;
          workspace_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "campaign_strategy_drafts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_clean_campaign: {
        Args: {
          campaign_data: Json;
          initial_strategy: Json;
          target_workspace_id: string;
        };
        Returns: {
          approval_settings: Json;
          budget_currency: string;
          budget_limit: number | null;
          company_characteristics: string[];
          created_at: string;
          created_by: string | null;
          current_strategy_draft_id: string | null;
          current_strategy_version_id: string | null;
          exclusions: string[];
          external_id: string;
          id: string;
          industries: string[];
          initial_target_description: string;
          intelligence_version: string;
          name: string;
          objective: string;
          outreach_enabled: boolean;
          preferred_outreach_language: string;
          profile_snapshot_id: string | null;
          relevant_use_case: string;
          selected_offering_id: string | null;
          status: string;
          target_geography: string;
          target_volume: number;
          updated_at: string;
          workflow_version: string;
          workspace_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "campaigns";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_clean_campaign_run: {
        Args: {
          desired_company_count: number;
          target_campaign_external_id: string;
          target_workspace_id: string;
        };
        Returns: {
          campaign_id: string;
          cancelled_at: string | null;
          candidates_classified: number;
          candidates_discovered: number;
          candidates_unique: number;
          companies_discovered: number;
          companies_evaluated: number;
          companies_qualified: number;
          completed_at: string | null;
          contacts_found: number;
          contract_versions: Json;
          created_at: string;
          currency: string;
          current_iteration: number;
          current_phase: string;
          dispatch_attempts: number;
          dispatch_key: string | null;
          dispatch_state: string;
          dispatch_updated_at: string;
          error_code: string | null;
          error_message: string | null;
          failed_at: string | null;
          id: string;
          last_dispatch_error: string | null;
          llm_cost: number;
          metadata: Json;
          profile_snapshot_id: string;
          progress_percentage: number;
          provider_cost: number;
          started_at: string | null;
          status: string;
          strategy_version_id: string;
          total_cost: number | null;
          trigger_run_id: string | null;
          updated_at: string;
          workflow_version: string;
          workspace_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "campaign_runs";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_company_profile_v3_draft: {
        Args: {
          target_base_version_id: string;
          target_created_by?: string;
          target_input_hash: string;
          target_snapshot: Json;
          target_workspace_id: string;
        };
        Returns: {
          base_version_id: string | null;
          company_profile_id: string;
          compiled_snapshot_hash: string | null;
          compiled_snapshot_json: Json;
          contract_version: string;
          created_at: string;
          created_by_run_id: string | null;
          created_by_user_id: string | null;
          id: string;
          input_hash: string;
          source_set_hash: string | null;
          state: string;
          updated_at: string;
          workspace_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "company_profile_drafts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_discovery_plan_v2: {
        Args: {
          target_campaign_id: string;
          target_content_hash: string;
          target_memory_snapshot_id: string;
          target_plan: Json;
          target_strategy_version_id: string;
          target_workspace_id: string;
        };
        Returns: {
          budget_policy_json: Json;
          campaign_id: string;
          campaign_strategy_version_id: string;
          compiled_snapshot_json: Json;
          content_hash: string;
          coverage_policy_json: Json;
          created_at: string;
          id: string;
          memory_snapshot_id: string;
          status: string;
          stopping_policy_json: Json;
          version_number: number;
          workspace_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "discovery_plans_v2";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_intelligence_claim_with_evidence: {
        Args: {
          evidence_links: Json;
          target_claim_id: string;
          target_claim_key: string;
          target_concise_rationale: string;
          target_confidence: number;
          target_epistemic_status: string;
          target_field_path: string;
          target_origin_id: string;
          target_origin_type: string;
          target_statement: string;
          target_subject_id: string;
          target_subject_type: string;
          target_supersedes_claim_id: string;
          target_value_json: Json;
          target_workspace_id: string;
        };
        Returns: string;
      };
      create_workspace: {
        Args: { workspace_name: string; workspace_website_url?: string };
        Returns: {
          created_at: string;
          created_by: string;
          default_locale: string;
          id: string;
          name: string;
          slug: string;
          status: string;
          updated_at: string;
          website_url: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "workspaces";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      current_workspace_role: {
        Args: { target_workspace_id: string };
        Returns: string;
      };
      empty_discovery_progress_counters_v2: { Args: never; Returns: Json };
      is_workspace_admin: {
        Args: { target_workspace_id: string };
        Returns: boolean;
      };
      is_workspace_member: {
        Args: { target_workspace_id: string };
        Returns: boolean;
      };
      is_workspace_owner: {
        Args: { target_workspace_id: string };
        Returns: boolean;
      };
      merge_organizations_v2: {
        Args: {
          merge_reason: string;
          rules_version: string;
          signals: Json;
          source_organization_id: string;
          target_organization_id: string;
          target_workspace_id: string;
        };
        Returns: {
          actor_id: string | null;
          actor_type: string;
          created_at: string;
          id: string;
          merge_reason: string;
          pre_merge_snapshot_json: Json;
          resolution_decision_id: string | null;
          reversed_at: string | null;
          rules_version: string;
          signals_json: Json;
          source_organization_id: string;
          target_organization_id: string;
          workspace_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "organization_merge_events";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      persist_discovery_coverage_decision_v2: {
        Args: {
          target_coverage: Json;
          target_decision: Json;
          target_gaps: Json;
          target_run_id: string;
          target_segment_run_id: string;
          target_workspace_id: string;
        };
        Returns: {
          archetype_key: string;
          confidence: number;
          created_at: string;
          discovery_run_id: string;
          discovery_segment_run_id: string;
          geography_key: string;
          id: string;
          metrics_json: Json;
          reasons_json: Json;
          status: string;
          workspace_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "discovery_coverage_snapshots_v2";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      persist_discovery_provider_response: {
        Args: {
          target_adapter_version: string;
          target_campaign_id: string;
          target_capabilities: Json;
          target_capabilities_hash: string;
          target_execution_key: string;
          target_normalization_version: string;
          target_plan_key: string;
          target_provider_key: string;
          target_request: Json;
          target_request_hash: string;
          target_response: Json;
          target_segment_key: string;
          target_workspace_id: string;
        };
        Returns: {
          adapter_version: string;
          campaign_id: string;
          capability_snapshot_id: string;
          completed_at: string | null;
          discovery_plan_key: string;
          discovery_segment_key: string;
          discovery_segment_run_id: string | null;
          errors_json: Json;
          exhausted: boolean | null;
          external_execution_key: string;
          id: string;
          next_cursor: string | null;
          provider_key: string;
          request_hash: string;
          request_json: Json;
          result_count: number;
          started_at: string;
          status: string;
          usage_json: Json;
          warnings_json: Json;
          workspace_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "discovery_provider_executions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      publish_candidate_intelligence_v2: {
        Args: {
          target_claim_ids: Json;
          target_conflict_keys: Json;
          target_content_hash: string;
          target_evidence_ids: Json;
          target_organization_id: string;
          target_snapshot: Json;
          target_source_cutoff_at: string;
          target_unresolved_keys: Json;
          target_workspace_id: string;
        };
        Returns: {
          claim_ids_json: Json;
          compiled_snapshot_json: Json;
          conflict_keys_json: Json;
          content_hash: string;
          created_at: string;
          evidence_ids_json: Json;
          id: string;
          organization_id: string;
          source_cutoff_at: string;
          unresolved_question_keys_json: Json;
          version_number: number;
          workspace_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "candidate_intelligence_versions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      publish_company_profile_v3_draft: {
        Args: { target_profile_draft_id: string; target_workspace_id: string };
        Returns: {
          analysis_execution_id: string | null;
          analysis_model_config_id: string | null;
          analysis_prompt_version: string | null;
          company_name: string;
          company_profile_id: string;
          created_at: string;
          created_by: string | null;
          extracted_facts: Json;
          id: string;
          intelligence_version: string;
          profile_status: string;
          provenance: string;
          readiness_score: number;
          review_questions: Json;
          structured_profile: Json;
          summary: string;
          version: number;
          website_url: string | null;
          workspace_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "company_profile_versions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      record_campaign_memory_correction: {
        Args: {
          target_applicability?: Json;
          target_campaign_id: string;
          target_corrected_value: Json;
          target_correction_type: string;
          target_immediate_action: string;
          target_previous_value: Json;
          target_proposed_offering_id?: string;
          target_statement: string;
          target_workspace_id: string;
        };
        Returns: {
          applicability_json: Json;
          applicability_known: boolean;
          confidence: number;
          created_at: string;
          created_by_user_id: string | null;
          expires_at: string | null;
          id: string;
          last_applied_at: string | null;
          memory_type: string;
          origin_campaign_id: string | null;
          origin_candidate_id: string | null;
          origin_id: string | null;
          origin_run_id: string | null;
          origin_type: string;
          scope_id: string;
          scope_type: string;
          source: string;
          statement: string;
          status: string;
          strength: string;
          structured_value_json: Json | null;
          supersedes_memory_id: string | null;
          updated_at: string;
          user_id: string | null;
          workspace_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "intelligence_memories";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      record_discovery_query_audit_v2: {
        Args: {
          target_provider_execution_id: string;
          target_queries: Json;
          target_segment_run_id: string;
          target_workspace_id: string;
        };
        Returns: number;
      };
      resolve_discovered_company: {
        Args: {
          company_name_value: string;
          country_value: string;
          description_value: string;
          metadata_value: Json;
          normalized_domain_value: string;
          normalized_name_value: string;
          target_workspace_id: string;
          website_url_value: string;
        };
        Returns: string;
      };
      resolve_memory_promotion_proposal: {
        Args: {
          target_decision: string;
          target_proposal_id: string;
          target_workspace_id: string;
        };
        Returns: {
          confidence: number;
          created_at: string;
          current_scope_type: string;
          id: string;
          promoted_memory_id: string | null;
          proposed_applicability_json: Json;
          proposed_scope_id: string;
          proposed_scope_type: string;
          proposed_statement: string;
          reason: string;
          recurrence_count: number;
          resolved_at: string | null;
          resolved_by_user_id: string | null;
          source_memory_id: string;
          source_memory_ids: string[];
          status: string;
          supporting_campaign_ids: string[];
          supporting_evidence_ids: string[];
          workspace_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "memory_promotion_proposals";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      save_analyzed_company_profile_version: {
        Args: {
          analysis_execution_id_value: string;
          facts_data?: Json;
          profile_data: Json;
          provenance_value?: string;
          questions_data?: Json;
          target_workspace_id: string;
        };
        Returns: {
          analysis_execution_id: string | null;
          analysis_model_config_id: string | null;
          analysis_prompt_version: string | null;
          company_name: string;
          company_profile_id: string;
          created_at: string;
          created_by: string | null;
          extracted_facts: Json;
          id: string;
          intelligence_version: string;
          profile_status: string;
          provenance: string;
          readiness_score: number;
          review_questions: Json;
          structured_profile: Json;
          summary: string;
          version: number;
          website_url: string | null;
          workspace_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "company_profile_versions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      save_clean_campaign_strategy_version: {
        Args: {
          strategy_data: Json;
          target_campaign_external_id: string;
          target_workspace_id: string;
        };
        Returns: {
          campaign_id: string;
          compiled_context_hash: string | null;
          confirmation_status: string;
          confirmed_at: string | null;
          confirmed_by: string | null;
          content_hash: string | null;
          contract_version: string;
          created_at: string;
          created_by: string | null;
          id: string;
          model_config_id: string | null;
          profile_intelligence_version_id: string | null;
          prompt_version: string | null;
          scoring_version_id: string | null;
          status: string;
          strategy: Json;
          version: number;
          workspace_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "campaign_strategy_versions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      save_clean_company_profile_version: {
        Args: {
          facts_data?: Json;
          profile_data: Json;
          provenance_value?: string;
          questions_data?: Json;
          target_workspace_id: string;
        };
        Returns: {
          analysis_execution_id: string | null;
          analysis_model_config_id: string | null;
          analysis_prompt_version: string | null;
          company_name: string;
          company_profile_id: string;
          created_at: string;
          created_by: string | null;
          extracted_facts: Json;
          id: string;
          intelligence_version: string;
          profile_status: string;
          provenance: string;
          readiness_score: number;
          review_questions: Json;
          structured_profile: Json;
          summary: string;
          version: number;
          website_url: string | null;
          workspace_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "company_profile_versions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      slugify_workspace_name: { Args: { input: string }; Returns: string };
      split_organization_merge_v2: {
        Args: {
          reassignment_plan?: Json;
          split_reason: string;
          target_merge_event_id: string;
          target_workspace_id: string;
        };
        Returns: {
          actor_id: string | null;
          created_at: string;
          id: string;
          merge_event_id: string;
          reassignment_plan_json: Json;
          restored_organization_id: string;
          split_reason: string;
          workspace_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "organization_split_events";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      start_discovery_run_v2: {
        Args: { target_plan_id: string; target_workspace_id: string };
        Returns: {
          budget_limit_json: Json;
          campaign_id: string;
          completed_at: string | null;
          continuation_decision_json: Json | null;
          coverage_summary_json: Json;
          created_at: string;
          discovery_plan_id: string;
          id: string;
          paused_at: string | null;
          started_at: string;
          status: string;
          stopping_reason: string | null;
          usage_summary_json: Json;
          workspace_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "discovery_runs_v2";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      start_discovery_segment_pass_v2: {
        Args: {
          target_gap_ids?: string[];
          target_pass_number: number;
          target_run_id: string;
          target_segment_id: string;
          target_workspace_id: string;
        };
        Returns: {
          completed_at: string | null;
          discovery_run_id: string;
          discovery_segment_id: string;
          gap_ids: string[];
          id: string;
          metrics_json: Json;
          normalized_candidate_count: number;
          pass_number: number;
          plausible_candidate_count: number | null;
          provider_record_count: number;
          qualified_yield_count: number | null;
          started_at: string;
          status: string;
          unique_candidate_count: number;
          workspace_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "discovery_segment_runs_v2";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_company_profile_v3_core: {
        Args: {
          target_canonical_domain: string;
          target_commercial_summary: string;
          target_customer_usage_mode: string;
          target_primary_role: string;
          target_profile_draft_id: string;
          target_public_name: string;
          target_revenue_model: string;
          target_transaction_model: string;
          target_workspace_id: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
