export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      campagnes: {
        Row: {
          brief_ia: string | null
          corps: string | null
          date_creation: string
          date_maj: string
          id: string
          lead_ids: Json
          mode: string
          nom: string
          planification: string
          profil_ciblage_id: string | null
          statut: string
          sujet: string | null
        }
        Insert: {
          brief_ia?: string | null
          corps?: string | null
          date_creation?: string
          date_maj?: string
          id?: string
          lead_ids?: Json
          mode?: string
          nom: string
          planification?: string
          profil_ciblage_id?: string | null
          statut?: string
          sujet?: string | null
        }
        Update: {
          brief_ia?: string | null
          corps?: string | null
          date_creation?: string
          date_maj?: string
          id?: string
          lead_ids?: Json
          mode?: string
          nom?: string
          planification?: string
          profil_ciblage_id?: string | null
          statut?: string
          sujet?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campagnes_profil_ciblage_id_fkey"
            columns: ["profil_ciblage_id"]
            isOneToOne: false
            referencedRelation: "profils_ciblage"
            referencedColumns: ["id"]
          },
        ]
      }
      emails_envoyes: {
        Row: {
          campagne_id: string | null
          contenu: string | null
          date_envoi: string
          destinataire: string | null
          id: string
          lead_id: string | null
          statut_envoi: string | null
          sujet: string | null
        }
        Insert: {
          campagne_id?: string | null
          contenu?: string | null
          date_envoi?: string
          destinataire?: string | null
          id?: string
          lead_id?: string | null
          statut_envoi?: string | null
          sujet?: string | null
        }
        Update: {
          campagne_id?: string | null
          contenu?: string | null
          date_envoi?: string
          destinataire?: string | null
          id?: string
          lead_id?: string | null
          statut_envoi?: string | null
          sujet?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emails_envoyes_campagne_id_fkey"
            columns: ["campagne_id"]
            isOneToOne: false
            referencedRelation: "campagnes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_envoyes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      equipe: {
        Row: {
          date_ajout: string
          email: string
          id: string
          nom: string
          role: string
        }
        Insert: {
          date_ajout?: string
          email: string
          id?: string
          nom: string
          role?: string
        }
        Update: {
          date_ajout?: string
          email?: string
          id?: string
          nom?: string
          role?: string
        }
        Relationships: []
      }
      file_envoi: {
        Row: {
          campagne_id: string | null
          contenu_genere: string | null
          date_creation: string
          date_prevue: string
          id: string
          lead_id: string | null
          statut: string
          sujet_genere: string | null
        }
        Insert: {
          campagne_id?: string | null
          contenu_genere?: string | null
          date_creation?: string
          date_prevue?: string
          id?: string
          lead_id?: string | null
          statut?: string
          sujet_genere?: string | null
        }
        Update: {
          campagne_id?: string | null
          contenu_genere?: string | null
          date_creation?: string
          date_prevue?: string
          id?: string
          lead_id?: string | null
          statut?: string
          sujet_genere?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "file_envoi_campagne_id_fkey"
            columns: ["campagne_id"]
            isOneToOne: false
            referencedRelation: "campagnes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_envoi_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          activite: string | null
          adresse: string | null
          campagne_id: string | null
          code_postal: string | null
          commune: string | null
          contact: string | null
          date_maj: string
          derniere_activite: string
          effectif: string | null
          email: string | null
          email_source: string | null
          enrichissement_en_cours: boolean
          facebook_url: string | null
          fiches_annuaires: Json
          forme_juridique: string | null
          id: string
          instagram_url: string | null
          linkedin_url: string | null
          nb_avis_google: string | null
          nom: string | null
          note_google: string | null
          notes: string | null
          qualifie_par: string | null
          rdv_date: string | null
          rdv_heure: string | null
          siren: string | null
          site_web: string | null
          source: string
          statut: string
          tags: Json
          telephone: string | null
          tiktok_url: string | null
        }
        Insert: {
          activite?: string | null
          adresse?: string | null
          campagne_id?: string | null
          code_postal?: string | null
          commune?: string | null
          contact?: string | null
          date_maj?: string
          derniere_activite?: string
          effectif?: string | null
          email?: string | null
          email_source?: string | null
          enrichissement_en_cours?: boolean
          facebook_url?: string | null
          fiches_annuaires?: Json
          forme_juridique?: string | null
          id: string
          instagram_url?: string | null
          linkedin_url?: string | null
          nb_avis_google?: string | null
          nom?: string | null
          note_google?: string | null
          notes?: string | null
          qualifie_par?: string | null
          rdv_date?: string | null
          rdv_heure?: string | null
          siren?: string | null
          site_web?: string | null
          source?: string
          statut?: string
          tags?: Json
          telephone?: string | null
          tiktok_url?: string | null
        }
        Update: {
          activite?: string | null
          adresse?: string | null
          campagne_id?: string | null
          code_postal?: string | null
          commune?: string | null
          contact?: string | null
          date_maj?: string
          derniere_activite?: string
          effectif?: string | null
          email?: string | null
          email_source?: string | null
          enrichissement_en_cours?: boolean
          facebook_url?: string | null
          fiches_annuaires?: Json
          forme_juridique?: string | null
          id?: string
          instagram_url?: string | null
          linkedin_url?: string | null
          nb_avis_google?: string | null
          nom?: string | null
          note_google?: string | null
          notes?: string | null
          qualifie_par?: string | null
          rdv_date?: string | null
          rdv_heure?: string | null
          siren?: string | null
          site_web?: string | null
          source?: string
          statut?: string
          tags?: Json
          telephone?: string | null
          tiktok_url?: string | null
        }
        Relationships: []
      }
      parametres: {
        Row: {
          classification_auto: boolean
          contexte_ia: string | null
          date_maj: string
          email_reception: string | null
          exclusions: Json
          expediteur_email: string | null
          expediteur_nom: string | null
          fuseau_horaire: string
          id: string
          logo_url: string | null
          nom_agence: string
          notif_recap_quotidien: boolean
          notif_reponse_interessee: boolean
          radar_departement: string | null
        }
        Insert: {
          classification_auto?: boolean
          contexte_ia?: string | null
          date_maj?: string
          email_reception?: string | null
          exclusions?: Json
          expediteur_email?: string | null
          expediteur_nom?: string | null
          fuseau_horaire?: string
          id?: string
          logo_url?: string | null
          nom_agence?: string
          notif_recap_quotidien?: boolean
          notif_reponse_interessee?: boolean
          radar_departement?: string | null
        }
        Update: {
          classification_auto?: boolean
          contexte_ia?: string | null
          date_maj?: string
          email_reception?: string | null
          exclusions?: Json
          expediteur_email?: string | null
          expediteur_nom?: string | null
          fuseau_horaire?: string
          id?: string
          logo_url?: string | null
          nom_agence?: string
          notif_recap_quotidien?: boolean
          notif_reponse_interessee?: boolean
          radar_departement?: string | null
        }
        Relationships: []
      }
      profils_ciblage: {
        Row: {
          autre_secteur: string | null
          date_creation: string
          departement: string | null
          effectif_max: string | null
          effectif_min: string | null
          id: string
          jours: number
          nom: string
          secteurs: Json
          source: string
        }
        Insert: {
          autre_secteur?: string | null
          date_creation?: string
          departement?: string | null
          effectif_max?: string | null
          effectif_min?: string | null
          id?: string
          jours?: number
          nom: string
          secteurs?: Json
          source?: string
        }
        Update: {
          autre_secteur?: string | null
          date_creation?: string
          departement?: string | null
          effectif_max?: string | null
          effectif_min?: string | null
          id?: string
          jours?: number
          nom?: string
          secteurs?: Json
          source?: string
        }
        Relationships: []
      }
      reponses_emails: {
        Row: {
          campagne_id: string | null
          classification: string
          contenu: string | null
          date_reception: string
          email_expediteur: string | null
          id: string
          lead_id: string | null
          lu: boolean
          sujet: string | null
        }
        Insert: {
          campagne_id?: string | null
          classification?: string
          contenu?: string | null
          date_reception?: string
          email_expediteur?: string | null
          id?: string
          lead_id?: string | null
          lu?: boolean
          sujet?: string | null
        }
        Update: {
          campagne_id?: string | null
          classification?: string
          contenu?: string | null
          date_reception?: string
          email_expediteur?: string | null
          id?: string
          lead_id?: string | null
          lu?: boolean
          sujet?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reponses_emails_campagne_id_fkey"
            columns: ["campagne_id"]
            isOneToOne: false
            referencedRelation: "campagnes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reponses_emails_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      reponses_formulaire: {
        Row: {
          classification: string | null
          date_reponse: string
          id: string
          lead_id: string | null
          nom_entreprise: string | null
          reponses: Json | null
        }
        Insert: {
          classification?: string | null
          date_reponse?: string
          id?: string
          lead_id?: string | null
          nom_entreprise?: string | null
          reponses?: Json | null
        }
        Update: {
          classification?: string | null
          date_reponse?: string
          id?: string
          lead_id?: string | null
          nom_entreprise?: string | null
          reponses?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "reponses_formulaire_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
