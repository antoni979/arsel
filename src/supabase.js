// src/supabase.js
import { createClient } from '@supabase/supabase-js'

// Estas líneas leen las claves que pusiste en el archivo .env.local
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Exportamos el cliente para poder usarlo en toda la aplicación
export const supabase = createClient(supabaseUrl, supabaseAnonKey)