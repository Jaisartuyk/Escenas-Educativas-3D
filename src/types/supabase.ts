// src/types/supabase.ts
// Generado con: npm run db:types
// Por ahora tipado manual — reemplazar con el generado de Supabase CLI

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type UserRole = 'admin' | 'full' | 'horarios_only'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          plan: 'free' | 'pro' | 'institucion'
          institution: string | null
          role: UserRole
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      planificaciones: {
        Row: {
          id: string
          user_id: string
          title: string
          type: 'clase' | 'unidad' | 'rubrica' | 'adaptacion' | 'diagnostica'
          subject: string
          grade: string
          topic: string
          duration: string
          methodologies: string[]
          content: string
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['planificaciones']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['planificaciones']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      plan_type: 'free' | 'pro' | 'institucion'
      planificacion_type: 'clase' | 'unidad' | 'rubrica' | 'adaptacion' | 'diagnostica'
      user_role: UserRole
    }
  }
}

// ─── Domain types ────────────────────────────────────────

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Planificacion = Database['public']['Tables']['planificaciones']['Row']

export type PlanType = 'clase' | 'unidad' | 'rubrica' | 'adaptacion' | 'diagnostica'

export interface PlanificacionFormData {
  subject: string
  grade: string
  topic: string
  duration: string
  type: PlanType
  methodologies: string[]
  extra?: string
}

export interface SceneInfo {
  id: string
  name: string
  emoji: string
  description: string
}
