-- Lote urgente 20/10, parte 6: contrato presencial (migración faltantes_contrato_presencial).
-- Con contrato presencial no se piden el correo del representante legal, el correo de la empresa ni el número de contacto.
-- Los documentos legales se siguen pidiendo. Esto mueve los faltantes, "Pedir lo que falta" y el paso a Documentos en revisión
-- (privado.recalcular usa estos faltantes).
CREATE OR REPLACE FUNCTION privado.faltantes(p bigint)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
declare c public.clientes; r jsonb := '[]'::jsonb; q record; rp public.representantes;
begin
  select * into c from public.clientes where id = p;
  if not found then return r; end if;
  for q in
    select rq.r_casilla, rq.r_numero, rq.r_texto, d.estado, d.motivo
    from privado.requeridos(p) rq
    left join public.documentos d on d.cliente_id = p and d.casilla = rq.r_casilla and d.numero = rq.r_numero
  loop
    if q.estado is null then
      r := r || jsonb_build_array(jsonb_build_object('k', q.r_casilla, 'n', q.r_numero, 't', q.r_texto, 'e', 'falta'));
    elsif q.estado = 'devuelto' then
      r := r || jsonb_build_array(jsonb_build_object('k', q.r_casilla, 'n', q.r_numero, 't', q.r_texto, 'e', 'devuelto', 'm', q.motivo));
    end if;
  end loop;
  -- Contrato presencial: el cliente firma en físico; no se piden correos ni teléfono
  if c.es_natural or c.contrato_presencial then return r; end if;
  select * into rp from public.representantes where cliente_id = p and orden = 1;
  if coalesce(btrim(rp.correo), '') = '' then
    r := r || jsonb_build_array(jsonb_build_object('k', 'correo', 'n', 1, 't', 'correo', 'e', 'falta', 'dato', true));
  end if;
  if coalesce(btrim(rp.telefono), '') = '' then
    r := r || jsonb_build_array(jsonb_build_object('k', 'telefono', 'n', 1, 't', 'número de contacto', 'e', 'falta', 'dato', true));
  end if;
  if coalesce(btrim(c.correo_empresa), '') = '' then
    r := r || jsonb_build_array(jsonb_build_object('k', 'correo_empresa', 'n', 0, 't', 'correo de la empresa', 'e', 'falta', 'dato', true));
  end if;
  return r;
end $function$;
