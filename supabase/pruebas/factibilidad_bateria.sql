-- Batería del motor de factibilidad (paso 1). Se corre con el conector de Supabase: arma un mapa inventado,
-- evalúa los puntos y termina en "raise exception" con el resultado, así no deja nada guardado.
-- Resultado del 09/10/2026: los 12 puntos dan lo esperado ("ok": true en todos).
create or replace function pg_temp.bateria() returns void language plpgsql as $$
declare v_m bigint; r jsonb := '[]'::jsonb; p record;
  cuad text := 'insert into public.zonas_red (mapa_id, mdt, nombre, estado, operativa, exclusividad, aliado, capacidad, ciudad, lngs, lats, min_lng, max_lng, min_lat, max_lat) values ($1,$2,$2,$3,$4,$5,$6,100,''Prueba'', array[$7,$8,$8,$7], array[$9,$9,$10,$10], $7,$8,$9,$10)';
begin
  insert into public.mapas_red (fecha_mapa, archivo, estado) values ('2026-10-01', 'prueba.kmz', 'vigente') returning id into v_m;
  execute cuad using v_m, 'A-LIB', 'liberado', true, 'liberada', null::text, -71.010::float8, -71.000::float8, 10.000::float8, 10.010::float8;
  execute cuad using v_m, 'B-EXC', 'exclusiva', true, 'aliado', 'Aliado Uno', -71.010::float8, -71.000::float8, 10.020::float8, 10.030::float8;
  execute cuad using v_m, 'C-PE', 'liberado', true, 'planta_externa', null::text, -71.010::float8, -71.000::float8, 10.040::float8, 10.050::float8;
  execute cuad using v_m, 'D-DIS', 'diseno', false, 'liberada', null::text, -70.997::float8, -70.990::float8, 10.000::float8, 10.010::float8;
  for p in select * from (values
    ('1 dentro liberada', 10.005, -71.005, 'pyme', 'hay_red'),
    ('2 dentro exclusiva', 10.025, -71.005, 'pyme', 'hay_red'),
    ('3 dentro planta externa', 10.045, -71.005, 'pyme', 'hay_red'),
    ('4 pyme a 240 m', 10.005, -71.012189, 'pyme', 'excepcion'),
    ('5 pyme a 1 km', 10.005, -71.019122, 'pyme', 'espera'),
    ('6 dedicado a 1,5 km', 10.005, -71.023682, 'dedicado', 'excepcion'),
    ('7 diseno a 300 m pyme', 10.005, -70.99726, 'pyme', 'excepcion'),
    ('7b diseno a 300 m dedicado', 10.005, -70.99726, 'dedicado', 'excepcion'),
    ('7c diseno a 1 km pyme', 10.005, -70.991, 'pyme', 'espera'),
    ('8 pyme a mas de 2 km', 10.005, -71.04, 'pyme', 'sin_red'),
    ('8b dedicado a 2,1 km', 10.005, -71.029155, 'dedicado', 'sin_red'),
    ('9 pyme a 2,1 km', 10.005, -71.029155, 'pyme', 'sin_red')
  ) t(nombre, lat, lng, tipo, espera) loop
    r := r || jsonb_build_array((select jsonb_build_object('p', p.nombre, 'ok', x->>'resultado' = p.espera, 'res', x->>'resultado', 'mdt', x->>'mdt', 'd', x->'distancia_m')
           from (select privado.fact_evaluar(p.lat::float8, p.lng::float8, p.tipo, v_m) x) q));
  end loop;
  raise exception 'RESULTADO %', r;
end $$;
select pg_temp.bateria();
