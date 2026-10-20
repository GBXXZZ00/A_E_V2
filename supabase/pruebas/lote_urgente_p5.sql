-- Lote urgente 20/10, parte 5: representantes agregados (migración requeridos_representantes_extra).
-- Un representante agregado (más allá de los que pide el régimen de firma) solo se pide si tiene algún dato
-- (nombre, correo o teléfono) o algún archivo (cédula o RIF personal). Vacío no cuenta y se puede quitar en la pantalla.
-- Decisión propia: solo para clientes sin Legal aprobado (no se reabren expedientes ya aprobados).
CREATE OR REPLACE FUNCTION privado.requeridos(p bigint)
 RETURNS TABLE(r_casilla text, r_numero integer, r_texto text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
declare c public.clientes; n int; i int; suf text;
begin
  select * into c from public.clientes where id = p;
  if not found then return; end if;
  n := case when not c.es_natural and c.regimen_firma = 'conjunta' then 2 else 1 end;
  for i in 1..n loop
    suf := case when n > 1 then ' del representante ' || i else '' end;
    r_casilla := 'cedula'; r_numero := i; r_texto := 'cédula' || suf; return next;
    r_casilla := 'rif_personal'; r_numero := i; r_texto := 'RIF personal' || suf; return next;
  end loop;
  -- Representantes agregados con algún dato o archivo
  if not c.es_natural and c.legal_ok_en is null then
    for i in (n + 1)..4 loop
      if exists (select 1 from public.representantes r where r.cliente_id = p and r.orden = i
                   and (coalesce(btrim(r.nombre), '') <> '' or coalesce(btrim(r.correo), '') <> '' or coalesce(btrim(r.telefono), '') <> ''))
         or exists (select 1 from public.documentos d join public.documento_archivos da on da.documento_id = d.id and da.vigente
                    where d.cliente_id = p and d.casilla in ('cedula', 'rif_personal') and d.numero = i) then
        r_casilla := 'cedula'; r_numero := i; r_texto := 'cédula del representante ' || i; return next;
        r_casilla := 'rif_personal'; r_numero := i; r_texto := 'RIF personal del representante ' || i; return next;
      end if;
    end loop;
  end if;
  if not c.es_natural then
    r_casilla := 'rif_empresa'; r_numero := 0; r_texto := 'RIF de la empresa'; return next;
    r_casilla := 'acta_constitutiva'; r_numero := 0; r_texto := 'acta constitutiva'; return next;
    if c.es_isp then r_casilla := 'conatel'; r_numero := 0; r_texto := 'permiso de Conatel'; return next; end if;
  end if;
end $function$;
