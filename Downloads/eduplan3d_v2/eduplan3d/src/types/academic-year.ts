// src/types/academic-year.ts
// Tipos compartidos para el sistema multi-año lectivo.

export type AcademicYearStatus = 'active' | 'archived' | 'draft'

export interface AcademicYear {
  id:              string
  institution_id:  string
  label:           string          // '2026 - 2027'
  start_date:      string | null   // ISO date
  end_date:        string | null
  is_current:      boolean
  status:          AcademicYearStatus
  created_at:      string
  updated_at:      string
}

// Payload para crear un año nuevo (solo admin)
export interface CreateAcademicYearInput {
  label:        string
  start_date?:  string | null
  end_date?:    string | null
  is_current?:  boolean            // si true, desmarca el actual como current
}

// Nombre de la cookie donde persiste el año que el usuario está viendo
export const VIEWING_YEAR_COOKIE = 'eduplan_viewing_year'
export const VIEWING_YEAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 días
