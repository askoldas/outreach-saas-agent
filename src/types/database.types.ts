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
      campaign_strategy_versions: {
        Row: {
          campaign_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          model_config_id: string | null;
          prompt_version: string | null;
          status: string;
          strategy: Json;
          version: number;
          workspace_id: string;
        };
        Insert: {
          campaign_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          model_config_id?: string | null;
          prompt_version?: string | null;
          status?: string;
          strategy?: Json;
          version: number;
          workspace_id: string;
        };
        Update: {
          campaign_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          model_config_id?: string | null;
          prompt_version?: string | null;
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
          industry: string | null;
          metadata: Json;
          name: string;
          normalized_name: string;
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
          industry?: string | null;
          metadata?: Json;
          name: string;
          normalized_name: string;
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
          industry?: string | null;
          metadata?: Json;
          name?: string;
          normalized_name?: string;
          updated_at?: string;
          website_url?: string | null;
          workspace_id?: string;
        };
        Relationships: [
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
          id: string;
          is_primary: boolean;
          metadata: Json;
          normalized_domain: string;
          verification_status: string;
          workspace_id: string;
        };
        Insert: {
          collision_status?: string;
          company_id: string;
          created_at?: string;
          domain: string;
          id?: string;
          is_primary?: boolean;
          metadata?: Json;
          normalized_domain: string;
          verification_status?: string;
          workspace_id: string;
        };
        Update: {
          collision_status?: string;
          company_id?: string;
          created_at?: string;
          domain?: string;
          id?: string;
          is_primary?: boolean;
          metadata?: Json;
          normalized_domain?: string;
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
          id: string;
          lifecycle_status: string;
          origin_id: string | null;
          origin_type: string;
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
          id?: string;
          lifecycle_status?: string;
          origin_id?: string | null;
          origin_type: string;
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
          id?: string;
          lifecycle_status?: string;
          origin_id?: string | null;
          origin_type?: string;
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
          created_at: string;
          created_by: string | null;
          id: string;
          model_config_id: string | null;
          prompt_version: string | null;
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
