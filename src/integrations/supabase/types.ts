export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      anexo_financeiro: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          lancamento_id: string
          nome: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          lancamento_id: string
          nome: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          lancamento_id?: string
          nome?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "anexo_financeiro_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "lancamento_financeiro"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          category: string | null
          client_name: string
          created_at: string
          extra_charge: boolean
          id: string
          notes: string | null
          phone: string
          scheduled_at: string
          service_id: string | null
          service_name: string | null
          status: Database["public"]["Enums"]["appointment_status"]
          type: Database["public"]["Enums"]["appointment_type"]
          updated_at: string
          user_id: string
          wants_to_anticipate: boolean
        }
        Insert: {
          category?: string | null
          client_name: string
          created_at?: string
          extra_charge?: boolean
          id?: string
          notes?: string | null
          phone: string
          scheduled_at: string
          service_id?: string | null
          service_name?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          type?: Database["public"]["Enums"]["appointment_type"]
          updated_at?: string
          user_id: string
          wants_to_anticipate?: boolean
        }
        Update: {
          category?: string | null
          client_name?: string
          created_at?: string
          extra_charge?: boolean
          id?: string
          notes?: string | null
          phone?: string
          scheduled_at?: string
          service_id?: string | null
          service_name?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          type?: Database["public"]["Enums"]["appointment_type"]
          updated_at?: string
          user_id?: string
          wants_to_anticipate?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      arquivos_paciente: {
        Row: {
          created_at: string
          id: string
          nome: string
          paciente_id: string
          tamanho: number | null
          tipo: string | null
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          paciente_id: string
          tamanho?: number | null
          tipo?: string | null
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          paciente_id?: string
          tamanho?: number | null
          tipo?: string | null
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arquivos_paciente_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      business_hours: {
        Row: {
          break_end: string | null
          break_start: string | null
          close_time: string
          created_at: string
          id: string
          is_open: boolean
          open_time: string
          updated_at: string
          user_id: string
          weekday: number
        }
        Insert: {
          break_end?: string | null
          break_start?: string | null
          close_time?: string
          created_at?: string
          id?: string
          is_open?: boolean
          open_time?: string
          updated_at?: string
          user_id: string
          weekday: number
        }
        Update: {
          break_end?: string | null
          break_start?: string | null
          close_time?: string
          created_at?: string
          id?: string
          is_open?: boolean
          open_time?: string
          updated_at?: string
          user_id?: string
          weekday?: number
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      chart_accounts: {
        Row: {
          code: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["account_kind"]
          name: string
          parent_id: string | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["account_kind"]
          name: string
          parent_id?: string | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["account_kind"]
          name?: string
          parent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chart_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_settings: {
        Row: {
          clinic_name: string
          closing_hour: string
          cnpj: string | null
          contact_email: string | null
          created_at: string
          evaluation_fee: number
          evaluation_free_campaign: boolean
          id: string
          late_cancellation_fee: boolean
          no_children_message: boolean
          no_pets_message: boolean
          opening_hour: string
          reminder_10min_enabled: boolean
          reminder_24h_enabled: boolean
          updated_at: string
          user_id: string
          whatsapp_number: string | null
        }
        Insert: {
          clinic_name?: string
          closing_hour?: string
          cnpj?: string | null
          contact_email?: string | null
          created_at?: string
          evaluation_fee?: number
          evaluation_free_campaign?: boolean
          id?: string
          late_cancellation_fee?: boolean
          no_children_message?: boolean
          no_pets_message?: boolean
          opening_hour?: string
          reminder_10min_enabled?: boolean
          reminder_24h_enabled?: boolean
          updated_at?: string
          user_id: string
          whatsapp_number?: string | null
        }
        Update: {
          clinic_name?: string
          closing_hour?: string
          cnpj?: string | null
          contact_email?: string | null
          created_at?: string
          evaluation_fee?: number
          evaluation_free_campaign?: boolean
          id?: string
          late_cancellation_fee?: boolean
          no_children_message?: boolean
          no_pets_message?: boolean
          opening_hour?: string
          reminder_10min_enabled?: boolean
          reminder_24h_enabled?: boolean
          updated_at?: string
          user_id?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      fichas_anamnese: {
        Row: {
          alcool: boolean | null
          alcool_frequencia: string | null
          alergia_anestesico: boolean | null
          alergias_quais: string | null
          alimentos_preferencia: string | null
          alteracoes_cardiacas: boolean | null
          alteracoes_cardiacas_quais: string | null
          alteracoes_psicologicas: boolean | null
          alteracoes_psicologicas_quais: string | null
          antecedentes_alergicos: boolean | null
          antecedentes_oncologicos: boolean | null
          antecedentes_oncologicos_qual: string | null
          anticoagulantes_quais: string | null
          anticoncepcional: boolean | null
          anticoncepcional_qual: string | null
          assinado_em: string | null
          assinado_medico_em: string | null
          assinatura_imagem: string | null
          assinatura_medico_imagem: string | null
          assinatura_tipo: string | null
          assinatura_token: string | null
          assinatura_token_expira_em: string | null
          atividade_fisica: boolean | null
          atividade_fisica_frequencia: string | null
          atividade_fisica_tipo: string | null
          autoriza_imagem: boolean | null
          autorizado: boolean | null
          bairro_paciente: string | null
          celular_paciente: string | null
          cep: string | null
          cep_paciente: string | null
          cidade_paciente: string | null
          cirurgia_plastica: boolean | null
          cirurgia_plastica_qual: string | null
          cirurgia_reparadora: boolean | null
          cirurgia_reparadora_qual: string | null
          cosmeticos_qual: string | null
          cpf_paciente: string | null
          created_at: string
          data_assinatura: string | null
          data_avaliacao: string
          data_nasc_paciente: string | null
          diabetes: boolean | null
          diabetes_tipo: string | null
          disturbio_circulatorio: boolean | null
          disturbio_circulatorio_qual: string | null
          disturbio_gastro: boolean | null
          disturbio_gastro_qual: string | null
          disturbio_hormonal: boolean | null
          disturbio_hormonal_qual: string | null
          disturbio_renal: boolean | null
          disturbio_renal_qual: string | null
          doenca_autoimune: boolean | null
          doenca_autoimune_qual: string | null
          dt_ultima_menstruacao: string | null
          dt_ultimo_checkup: string | null
          duracao_queixa: string | null
          email_paciente: string | null
          endereco_paciente: string | null
          epilepsia: boolean | null
          epilepsia_frequencia: string | null
          estado_civil_paciente: string | null
          estado_paciente: string | null
          estresse: boolean | null
          estresse_obs: string | null
          exposicao_sol: boolean | null
          filtro_solar: boolean | null
          filtro_solar_frequencia: string | null
          funcionamento_intestinal: string | null
          gestacoes: boolean | null
          gestacoes_quantas: string | null
          gestacoes_tempo: string | null
          gestante: boolean | null
          hipo_hipertensao: boolean | null
          horas_sono: string | null
          id: string
          idade: string | null
          idade_paciente: string | null
          implante_dentario: boolean | null
          ingestao_agua_copos: string | null
          marcapasso: boolean | null
          medicamentos_uso: string | null
          muito_tempo_pe_sentada: boolean | null
          nome_paciente: string | null
          outra_condicao: string | null
          paciente_id: string
          profissao_paciente: string | null
          proteses_metalicas: boolean | null
          proteses_metalicas_qual: string | null
          qualidade_sono: string | null
          quanto_tempo_pe_sentada: string | null
          queixa: string | null
          soropositivo: boolean | null
          tabagismo: boolean | null
          tabagismo_quantidade: string | null
          telefone_celular: string | null
          telefone_comercial: string | null
          telefone_residencial: string | null
          tipo_alimentacao: string | null
          trat_dermatologico: boolean | null
          trat_dermatologico_qual: string | null
          trat_estetico_anterior: boolean | null
          trat_estetico_qual: string | null
          tratamento_medico_atual: boolean | null
          updated_at: string
          usa_cosmeticos: boolean | null
          usa_lente_contato: boolean | null
          user_id: string
          uso_anticoagulantes: boolean | null
        }
        Insert: {
          alcool?: boolean | null
          alcool_frequencia?: string | null
          alergia_anestesico?: boolean | null
          alergias_quais?: string | null
          alimentos_preferencia?: string | null
          alteracoes_cardiacas?: boolean | null
          alteracoes_cardiacas_quais?: string | null
          alteracoes_psicologicas?: boolean | null
          alteracoes_psicologicas_quais?: string | null
          antecedentes_alergicos?: boolean | null
          antecedentes_oncologicos?: boolean | null
          antecedentes_oncologicos_qual?: string | null
          anticoagulantes_quais?: string | null
          anticoncepcional?: boolean | null
          anticoncepcional_qual?: string | null
          assinado_em?: string | null
          assinado_medico_em?: string | null
          assinatura_imagem?: string | null
          assinatura_medico_imagem?: string | null
          assinatura_tipo?: string | null
          assinatura_token?: string | null
          assinatura_token_expira_em?: string | null
          atividade_fisica?: boolean | null
          atividade_fisica_frequencia?: string | null
          atividade_fisica_tipo?: string | null
          autoriza_imagem?: boolean | null
          autorizado?: boolean | null
          bairro_paciente?: string | null
          celular_paciente?: string | null
          cep?: string | null
          cep_paciente?: string | null
          cidade_paciente?: string | null
          cirurgia_plastica?: boolean | null
          cirurgia_plastica_qual?: string | null
          cirurgia_reparadora?: boolean | null
          cirurgia_reparadora_qual?: string | null
          cosmeticos_qual?: string | null
          cpf_paciente?: string | null
          created_at?: string
          data_assinatura?: string | null
          data_avaliacao?: string
          data_nasc_paciente?: string | null
          diabetes?: boolean | null
          diabetes_tipo?: string | null
          disturbio_circulatorio?: boolean | null
          disturbio_circulatorio_qual?: string | null
          disturbio_gastro?: boolean | null
          disturbio_gastro_qual?: string | null
          disturbio_hormonal?: boolean | null
          disturbio_hormonal_qual?: string | null
          disturbio_renal?: boolean | null
          disturbio_renal_qual?: string | null
          doenca_autoimune?: boolean | null
          doenca_autoimune_qual?: string | null
          dt_ultima_menstruacao?: string | null
          dt_ultimo_checkup?: string | null
          duracao_queixa?: string | null
          email_paciente?: string | null
          endereco_paciente?: string | null
          epilepsia?: boolean | null
          epilepsia_frequencia?: string | null
          estado_civil_paciente?: string | null
          estado_paciente?: string | null
          estresse?: boolean | null
          estresse_obs?: string | null
          exposicao_sol?: boolean | null
          filtro_solar?: boolean | null
          filtro_solar_frequencia?: string | null
          funcionamento_intestinal?: string | null
          gestacoes?: boolean | null
          gestacoes_quantas?: string | null
          gestacoes_tempo?: string | null
          gestante?: boolean | null
          hipo_hipertensao?: boolean | null
          horas_sono?: string | null
          id?: string
          idade?: string | null
          idade_paciente?: string | null
          implante_dentario?: boolean | null
          ingestao_agua_copos?: string | null
          marcapasso?: boolean | null
          medicamentos_uso?: string | null
          muito_tempo_pe_sentada?: boolean | null
          nome_paciente?: string | null
          outra_condicao?: string | null
          paciente_id: string
          profissao_paciente?: string | null
          proteses_metalicas?: boolean | null
          proteses_metalicas_qual?: string | null
          qualidade_sono?: string | null
          quanto_tempo_pe_sentada?: string | null
          queixa?: string | null
          soropositivo?: boolean | null
          tabagismo?: boolean | null
          tabagismo_quantidade?: string | null
          telefone_celular?: string | null
          telefone_comercial?: string | null
          telefone_residencial?: string | null
          tipo_alimentacao?: string | null
          trat_dermatologico?: boolean | null
          trat_dermatologico_qual?: string | null
          trat_estetico_anterior?: boolean | null
          trat_estetico_qual?: string | null
          tratamento_medico_atual?: boolean | null
          updated_at?: string
          usa_cosmeticos?: boolean | null
          usa_lente_contato?: boolean | null
          user_id: string
          uso_anticoagulantes?: boolean | null
        }
        Update: {
          alcool?: boolean | null
          alcool_frequencia?: string | null
          alergia_anestesico?: boolean | null
          alergias_quais?: string | null
          alimentos_preferencia?: string | null
          alteracoes_cardiacas?: boolean | null
          alteracoes_cardiacas_quais?: string | null
          alteracoes_psicologicas?: boolean | null
          alteracoes_psicologicas_quais?: string | null
          antecedentes_alergicos?: boolean | null
          antecedentes_oncologicos?: boolean | null
          antecedentes_oncologicos_qual?: string | null
          anticoagulantes_quais?: string | null
          anticoncepcional?: boolean | null
          anticoncepcional_qual?: string | null
          assinado_em?: string | null
          assinado_medico_em?: string | null
          assinatura_imagem?: string | null
          assinatura_medico_imagem?: string | null
          assinatura_tipo?: string | null
          assinatura_token?: string | null
          assinatura_token_expira_em?: string | null
          atividade_fisica?: boolean | null
          atividade_fisica_frequencia?: string | null
          atividade_fisica_tipo?: string | null
          autoriza_imagem?: boolean | null
          autorizado?: boolean | null
          bairro_paciente?: string | null
          celular_paciente?: string | null
          cep?: string | null
          cep_paciente?: string | null
          cidade_paciente?: string | null
          cirurgia_plastica?: boolean | null
          cirurgia_plastica_qual?: string | null
          cirurgia_reparadora?: boolean | null
          cirurgia_reparadora_qual?: string | null
          cosmeticos_qual?: string | null
          cpf_paciente?: string | null
          created_at?: string
          data_assinatura?: string | null
          data_avaliacao?: string
          data_nasc_paciente?: string | null
          diabetes?: boolean | null
          diabetes_tipo?: string | null
          disturbio_circulatorio?: boolean | null
          disturbio_circulatorio_qual?: string | null
          disturbio_gastro?: boolean | null
          disturbio_gastro_qual?: string | null
          disturbio_hormonal?: boolean | null
          disturbio_hormonal_qual?: string | null
          disturbio_renal?: boolean | null
          disturbio_renal_qual?: string | null
          doenca_autoimune?: boolean | null
          doenca_autoimune_qual?: string | null
          dt_ultima_menstruacao?: string | null
          dt_ultimo_checkup?: string | null
          duracao_queixa?: string | null
          email_paciente?: string | null
          endereco_paciente?: string | null
          epilepsia?: boolean | null
          epilepsia_frequencia?: string | null
          estado_civil_paciente?: string | null
          estado_paciente?: string | null
          estresse?: boolean | null
          estresse_obs?: string | null
          exposicao_sol?: boolean | null
          filtro_solar?: boolean | null
          filtro_solar_frequencia?: string | null
          funcionamento_intestinal?: string | null
          gestacoes?: boolean | null
          gestacoes_quantas?: string | null
          gestacoes_tempo?: string | null
          gestante?: boolean | null
          hipo_hipertensao?: boolean | null
          horas_sono?: string | null
          id?: string
          idade?: string | null
          idade_paciente?: string | null
          implante_dentario?: boolean | null
          ingestao_agua_copos?: string | null
          marcapasso?: boolean | null
          medicamentos_uso?: string | null
          muito_tempo_pe_sentada?: boolean | null
          nome_paciente?: string | null
          outra_condicao?: string | null
          paciente_id?: string
          profissao_paciente?: string | null
          proteses_metalicas?: boolean | null
          proteses_metalicas_qual?: string | null
          qualidade_sono?: string | null
          quanto_tempo_pe_sentada?: string | null
          queixa?: string | null
          soropositivo?: boolean | null
          tabagismo?: boolean | null
          tabagismo_quantidade?: string | null
          telefone_celular?: string | null
          telefone_comercial?: string | null
          telefone_residencial?: string | null
          tipo_alimentacao?: string | null
          trat_dermatologico?: boolean | null
          trat_dermatologico_qual?: string | null
          trat_estetico_anterior?: boolean | null
          trat_estetico_qual?: string | null
          tratamento_medico_atual?: boolean | null
          updated_at?: string
          usa_cosmeticos?: boolean | null
          usa_lente_contato?: boolean | null
          user_id?: string
          uso_anticoagulantes?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "fichas_anamnese_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamento_financeiro: {
        Row: {
          appointment_id: string | null
          beneficiario: string | null
          created_at: string
          created_by: string | null
          descricao: string
          dt_pagamento: string | null
          dt_vencimento: string
          forma_pagamento: string | null
          grupo_parcela_id: string | null
          id: string
          lancamento_pai_id: string | null
          numero_documento: string | null
          numero_parcelas: number | null
          parcela_atual: number | null
          plano_contas_id: string
          recorrencia: string
          status: string
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          appointment_id?: string | null
          beneficiario?: string | null
          created_at?: string
          created_by?: string | null
          descricao: string
          dt_pagamento?: string | null
          dt_vencimento: string
          forma_pagamento?: string | null
          grupo_parcela_id?: string | null
          id?: string
          lancamento_pai_id?: string | null
          numero_documento?: string | null
          numero_parcelas?: number | null
          parcela_atual?: number | null
          plano_contas_id: string
          recorrencia?: string
          status?: string
          tipo: string
          updated_at?: string
          valor: number
        }
        Update: {
          appointment_id?: string | null
          beneficiario?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string
          dt_pagamento?: string | null
          dt_vencimento?: string
          forma_pagamento?: string | null
          grupo_parcela_id?: string | null
          id?: string
          lancamento_pai_id?: string | null
          numero_documento?: string | null
          numero_parcelas?: number | null
          parcela_atual?: number | null
          plano_contas_id?: string
          recorrencia?: string
          status?: string
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "lancamento_financeiro_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamento_financeiro_lancamento_pai_id_fkey"
            columns: ["lancamento_pai_id"]
            isOneToOne: false
            referencedRelation: "lancamento_financeiro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamento_financeiro_plano_contas_id_fkey"
            columns: ["plano_contas_id"]
            isOneToOne: false
            referencedRelation: "plano_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      pacientes: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cpf: string | null
          created_at: string
          data_nasc: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          estado_civil: string | null
          id: string
          nome: string
          profissao: string | null
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cpf?: string | null
          created_at?: string
          data_nasc?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          estado_civil?: string | null
          id?: string
          nome: string
          profissao?: string | null
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cpf?: string | null
          created_at?: string
          data_nasc?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          estado_civil?: string | null
          id?: string
          nome?: string
          profissao?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      parametros: {
        Row: {
          created_at: string
          id: string
          plano_contas_padrao_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          plano_contas_padrao_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          plano_contas_padrao_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parametros_plano_contas_padrao_id_fkey"
            columns: ["plano_contas_padrao_id"]
            isOneToOne: false
            referencedRelation: "plano_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      payables: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string
          description: string
          due_date: string
          id: string
          notes: string | null
          paid_at: string | null
          status: Database["public"]["Enums"]["finance_status"]
          supplier: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          created_at?: string
          description: string
          due_date: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["finance_status"]
          supplier?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["finance_status"]
          supplier?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payables_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_contas: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          id: string
          nome: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          nome: string
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ativo: boolean
          cargo: string | null
          created_at: string
          full_name: string | null
          id: string
          modulos: string[]
          role: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cargo?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          modulos?: string[]
          role?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cargo?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          modulos?: string[]
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      receivables: {
        Row: {
          account_id: string | null
          amount: number
          appointment_id: string | null
          client_name: string | null
          created_at: string
          description: string
          due_date: string
          id: string
          notes: string | null
          received_at: string | null
          service_id: string | null
          status: Database["public"]["Enums"]["finance_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          appointment_id?: string | null
          client_name?: string | null
          created_at?: string
          description: string
          due_date: string
          id?: string
          notes?: string | null
          received_at?: string | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["finance_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          appointment_id?: string | null
          client_name?: string | null
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          notes?: string | null
          received_at?: string | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["finance_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receivables_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          category_group: string | null
          cost: number
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_hof: boolean
          name: string
          plano_contas_id: string | null
          price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          category_group?: string | null
          cost?: number
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_hof?: boolean
          name: string
          plano_contas_id?: string | null
          price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          category_group?: string | null
          cost?: number
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_hof?: boolean
          name?: string
          plano_contas_id?: string | null
          price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_plano_contas_id_fkey"
            columns: ["plano_contas_id"]
            isOneToOne: false
            referencedRelation: "plano_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_lembrete_enviado: {
        Row: {
          enviado_em: string
          id: string
          phone: string
        }
        Insert: {
          enviado_em?: string
          id?: string
          phone: string
        }
        Update: {
          enviado_em?: string
          id?: string
          phone?: string
        }
        Relationships: []
      }
      whatsapp_sessao: {
        Row: {
          created_at: string
          etapa: string
          id: string
          lembrete_enviado: boolean | null
          phone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          etapa?: string
          id?: string
          lembrete_enviado?: boolean | null
          phone: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          etapa?: string
          id?: string
          lembrete_enviado?: boolean | null
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      buscar_sessoes_para_lembrete: {
        Args: never
        Returns: {
          etapa: string
          id: string
          phone: string
          updated_at: string
        }[]
      }
      current_user_role: { Args: never; Returns: string }
      rpc_concluir_assinatura: {
        Args: { p_assinatura_imagem: string; p_token: string }
        Returns: boolean
      }
      rpc_get_ficha_para_assinatura: {
        Args: { p_token: string }
        Returns: Json
      }
    }
    Enums: {
      account_kind: "receita" | "despesa"
      appointment_status:
        | "agendado"
        | "confirmado"
        | "concluido"
        | "cancelado"
        | "falta"
        | "pendente_pagamento"
      appointment_type: "procedimento" | "avaliacao" | "retorno" | "encaixe"
      finance_status: "pendente" | "pago" | "atrasado" | "cancelado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_kind: ["receita", "despesa"],
      appointment_status: [
        "agendado",
        "confirmado",
        "concluido",
        "cancelado",
        "falta",
        "pendente_pagamento",
      ],
      appointment_type: ["procedimento", "avaliacao", "retorno", "encaixe"],
      finance_status: ["pendente", "pago", "atrasado", "cancelado"],
    },
  },
} as const

