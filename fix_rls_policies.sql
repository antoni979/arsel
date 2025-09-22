-- Fix RLS policies for versiones_plano table
-- Enable RLS if not already
ALTER TABLE public.versiones_plano ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow authenticated users to select versiones_plano" ON public.versiones_plano;
DROP POLICY IF EXISTS "Allow authenticated users to insert versiones_plano" ON public.versiones_plano;
DROP POLICY IF EXISTS "Allow authenticated users to update versiones_plano" ON public.versiones_plano;
DROP POLICY IF EXISTS "Allow authenticated users to delete versiones_plano" ON public.versiones_plano;

-- Create policies for authenticated users
CREATE POLICY "Allow authenticated users to select versiones_plano" ON public.versiones_plano
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert versiones_plano" ON public.versiones_plano
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update versiones_plano" ON public.versiones_plano
FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete versiones_plano" ON public.versiones_plano
FOR DELETE USING (auth.role() = 'authenticated');

-- Also for centros table
ALTER TABLE public.centros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to select centros" ON public.centros;
DROP POLICY IF EXISTS "Allow authenticated users to insert centros" ON public.centros;
DROP POLICY IF EXISTS "Allow authenticated users to update centros" ON public.centros;
DROP POLICY IF EXISTS "Allow authenticated users to delete centros" ON public.centros;

CREATE POLICY "Allow authenticated users to select centros" ON public.centros
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert centros" ON public.centros
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update centros" ON public.centros
FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete centros" ON public.centros
FOR DELETE USING (auth.role() = 'authenticated');

-- For salas
ALTER TABLE public.salas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to select salas" ON public.salas;
DROP POLICY IF EXISTS "Allow authenticated users to insert salas" ON public.salas;
DROP POLICY IF EXISTS "Allow authenticated users to update salas" ON public.salas;
DROP POLICY IF EXISTS "Allow authenticated users to delete salas" ON public.salas;

CREATE POLICY "Allow authenticated users to select salas" ON public.salas
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert salas" ON public.salas
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update salas" ON public.salas
FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete salas" ON public.salas
FOR DELETE USING (auth.role() = 'authenticated');

-- For puntos_maestros
ALTER TABLE public.puntos_maestros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to select puntos_maestros" ON public.puntos_maestros;
DROP POLICY IF EXISTS "Allow authenticated users to insert puntos_maestros" ON public.puntos_maestros;
DROP POLICY IF EXISTS "Allow authenticated users to update puntos_maestros" ON public.puntos_maestros;
DROP POLICY IF EXISTS "Allow authenticated users to delete puntos_maestros" ON public.puntos_maestros;

CREATE POLICY "Allow authenticated users to select puntos_maestros" ON public.puntos_maestros
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert puntos_maestros" ON public.puntos_maestros
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update puntos_maestros" ON public.puntos_maestros
FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete puntos_maestros" ON public.puntos_maestros
FOR DELETE USING (auth.role() = 'authenticated');

-- For inspecciones
ALTER TABLE public.inspecciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to select inspecciones" ON public.inspecciones;
DROP POLICY IF EXISTS "Allow authenticated users to insert inspecciones" ON public.inspecciones;
DROP POLICY IF EXISTS "Allow authenticated users to update inspecciones" ON public.inspecciones;
DROP POLICY IF EXISTS "Allow authenticated users to delete inspecciones" ON public.inspecciones;

CREATE POLICY "Allow authenticated users to select inspecciones" ON public.inspecciones
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert inspecciones" ON public.inspecciones
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update inspecciones" ON public.inspecciones
FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete inspecciones" ON public.inspecciones
FOR DELETE USING (auth.role() = 'authenticated');

-- For other tables as needed, but focus on versiones_plano for now