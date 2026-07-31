-- CitaFácil — Esquema de base de datos para Supabase
-- Ejecutar en Supabase: Dashboard > SQL Editor > New query > pegar todo > Run

create extension if not exists "uuid-ossp";

-- 1. Consultorios (el "tenant" principal, cada doctor/clínica chica es uno)
create table consultorios (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid references auth.users(id) not null,
  slug text unique not null,              -- ej: 'dr-perez' -> citafacil.app/dr-perez
  nombre text not null,
  especialidad text,
  logo_url text,                          -- imagen de perfil/logo del consultorio
  imagen_portada text,                    -- foto de portada (hero de la página de reserva)
  imagen_fondo text,                      -- textura/imagen de fondo sutil de la página
  color_acento text default '#0F6E56',
  telefono_whatsapp text not null,        -- número del consultorio para recordatorios
  comision_porcentaje numeric default 12, -- % que cobras tú
  culqi_public_key text,                  -- llave pública de Culqi del PROPIO consultorio
  culqi_secret_key text,                  -- llave secreta de Culqi del PROPIO consultorio (solo la usa el servidor)
  descripcion text,                       -- presentación del doctor/consultorio para el paciente
  created_at timestamptz default now()
);

-- 2. Servicios que ofrece cada consultorio
create table servicios (
  id uuid primary key default uuid_generate_v4(),
  consultorio_id uuid references consultorios(id) on delete cascade not null,
  nombre text not null,
  duracion_min int not null default 30,
  precio numeric not null,
  activo boolean default true,
  imagenes text[] not null default '{}', -- fotos referenciales del tratamiento
  created_at timestamptz default now()
);

-- 3. Disponibilidad semanal simple (día + rango horario)
create table disponibilidad (
  id uuid primary key default uuid_generate_v4(),
  consultorio_id uuid references consultorios(id) on delete cascade not null,
  dia_semana int not null check (dia_semana between 0 and 6), -- 0=domingo
  hora_inicio time not null,
  hora_fin time not null
);

-- 4. Pacientes (ligero, sin historia clínica)
create table pacientes (
  id uuid primary key default uuid_generate_v4(),
  consultorio_id uuid references consultorios(id) on delete cascade not null,
  nombre text not null,
  telefono text not null,
  created_at timestamptz default now()
);

-- 5. Citas
create table citas (
  id uuid primary key default uuid_generate_v4(),
  consultorio_id uuid references consultorios(id) on delete cascade not null,
  servicio_id uuid references servicios(id) not null,
  paciente_id uuid references pacientes(id) not null,
  fecha date not null,
  hora time not null,
  estado text not null default 'pendiente_pago'
    check (estado in ('pendiente_pago','confirmada','cancelada','completada')),
  recordatorio_enviado boolean default false,
  monto numeric not null,
  created_at timestamptz default now()
);

-- 6. Pagos (registro de cada cobro vía Culqi)
create table pagos (
  id uuid primary key default uuid_generate_v4(),
  cita_id uuid references citas(id) on delete cascade not null,
  consultorio_id uuid references consultorios(id) not null,
  monto numeric not null,
  comision_monto numeric not null,
  culqi_charge_id text,
  estado text not null default 'pendiente' check (estado in ('pendiente','pagado','fallido')),
  created_at timestamptz default now()
);

-- 7. Notas cortas por cita (Opción 1)
create table notas (
  id uuid primary key default uuid_generate_v4(),
  cita_id uuid references citas(id) on delete cascade not null,
  paciente_id uuid references pacientes(id) not null,
  texto text not null,
  created_at timestamptz default now()
);

-- 8. Archivos adjuntos por paciente (Opción 3)
create table adjuntos (
  id uuid primary key default uuid_generate_v4(),
  paciente_id uuid references pacientes(id) on delete cascade not null,
  nombre_archivo text not null,
  url text not null,
  created_at timestamptz default now()
);

-- 9. Administradores (tú y quien más gestione la plataforma)
create table administradores (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid references auth.users(id) not null unique,
  nombre text not null,
  pin_hash text,                          -- hash del PIN, nunca se guarda en texto plano
  pin_salt text,
  pin_configurado boolean not null default false,
  created_at timestamptz default now()
);

-- 10. Liquidaciones: cuando un consultorio te transfiere tu comisión
create table liquidaciones (
  id uuid primary key default uuid_generate_v4(),
  consultorio_id uuid references consultorios(id) not null,
  periodo_inicio date not null,
  periodo_fin date not null,
  monto_generado numeric not null,       -- total cobrado por el consultorio en el periodo
  comision_monto numeric not null,       -- lo que te corresponde a ti
  estado text not null default 'pendiente' check (estado in ('pendiente','pagada')),
  fecha_pago timestamptz,
  registrado_por uuid references administradores(id),
  created_at timestamptz default now()
);

-- ============ STORAGE: archivos adjuntos de pacientes ============
-- Bucket privado — nadie accede a un archivo sin pasar por una URL firmada
-- generada por tu propio consultorio autenticado.

insert into storage.buckets (id, name, public)
values ('adjuntos', 'adjuntos', false)
on conflict (id) do nothing;

-- Los archivos se guardan con la ruta: {consultorio_id}/{paciente_id}/{nombre_archivo}
-- Esto permite validar el acceso solo revisando el primer segmento de la ruta.

create policy "consultorio sube sus adjuntos" on storage.objects
  for insert with check (
    bucket_id = 'adjuntos'
    and (storage.foldername(name))[1] in (
      select id::text from consultorios where auth_user_id = auth.uid()
    )
  );

create policy "consultorio ve sus adjuntos" on storage.objects
  for select using (
    bucket_id = 'adjuntos'
    and (storage.foldername(name))[1] in (
      select id::text from consultorios where auth_user_id = auth.uid()
    )
  );

create policy "consultorio elimina sus adjuntos" on storage.objects
  for delete using (
    bucket_id = 'adjuntos'
    and (storage.foldername(name))[1] in (
      select id::text from consultorios where auth_user_id = auth.uid()
    )
  );

-- ============ VISTA PÚBLICA DEL CONSULTORIO ============
-- La página de reserva (pacientes sin sesión) necesita leer nombre, color,
-- logo, etc. de un consultorio por su slug. NUNCA le damos acceso público
-- directo a la tabla `consultorios` porque ahí vive culqi_secret_key.
-- Esta vista expone solo las columnas seguras.

create or replace view consultorios_publicos as
select
  id,
  slug,
  nombre,
  especialidad,
  logo_url,
  color_acento,
  telefono_whatsapp,
  culqi_public_key,
  imagen_portada,
  imagen_fondo,
  descripcion
from consultorios;

grant select on consultorios_publicos to anon, authenticated;

-- ============ STORAGE: imágenes de marca del consultorio ============
-- Bucket público (a diferencia de `adjuntos`) porque estas imágenes son
-- justamente para mostrarse en la página pública de reservas.

insert into storage.buckets (id, name, public)
values ('marca', 'marca', true)
on conflict (id) do nothing;

create policy "consultorio sube su marca" on storage.objects
  for insert with check (
    bucket_id = 'marca'
    and (storage.foldername(name))[1] in (
      select id::text from consultorios where auth_user_id = auth.uid()
    )
  );

create policy "consultorio actualiza su marca" on storage.objects
  for update using (
    bucket_id = 'marca'
    and (storage.foldername(name))[1] in (
      select id::text from consultorios where auth_user_id = auth.uid()
    )
  );

create policy "consultorio elimina su marca" on storage.objects
  for delete using (
    bucket_id = 'marca'
    and (storage.foldername(name))[1] in (
      select id::text from consultorios where auth_user_id = auth.uid()
    )
  );

create policy "cualquiera ve imagenes de marca" on storage.objects
  for select using (bucket_id = 'marca');

-- ============ FUNCIÓN: horarios disponibles reales ============
-- Cruza la disponibilidad semanal del consultorio con las citas ya ocupadas
-- ese día, y devuelve solo los horarios realmente libres para ese servicio.
-- security definer: se ejecuta con permisos elevados para poder leer citas
-- de forma controlada sin exponer la tabla completa a pacientes anónimos.

create or replace function horarios_disponibles(
  p_consultorio_id uuid,
  p_servicio_id uuid,
  p_fecha date
)
returns table(hora time)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duracion int;
  v_dow int;
  v_ahora_lima timestamp;
begin
  select duracion_min into v_duracion from servicios where id = p_servicio_id;
  if v_duracion is null then
    return;
  end if;

  v_dow := extract(dow from p_fecha);
  v_ahora_lima := now() at time zone 'America/Lima';

  return query
  with bloques as (
    select hora_inicio, hora_fin
    from disponibilidad
    where consultorio_id = p_consultorio_id and dia_semana = v_dow
  ),
  candidatos as (
    select (b.hora_inicio + (n * v_duracion || ' minutes')::interval)::time as hora
    from bloques b,
    lateral generate_series(
      0,
      greatest(floor(extract(epoch from (b.hora_fin - b.hora_inicio)) / 60 / v_duracion)::int - 1, -1)
    ) as n
  ),
  ocupados as (
    select c.hora as inicio, (c.hora + (s.duracion_min || ' minutes')::interval)::time as fin
    from citas c
    join servicios s on s.id = c.servicio_id
    where c.consultorio_id = p_consultorio_id
      and c.fecha = p_fecha
      and c.estado in ('confirmada', 'pendiente_pago')
  )
  select cand.hora
  from candidatos cand
  where not exists (
    select 1 from ocupados o
    where cand.hora < o.fin
      and (cand.hora + (v_duracion || ' minutes')::interval)::time > o.inicio
  )
  and (p_fecha > v_ahora_lima::date or cand.hora > v_ahora_lima::time)
  order by cand.hora;
end;
$$;

-- Cualquier persona (paciente sin cuenta) puede consultar horarios libres
grant execute on function horarios_disponibles(uuid, uuid, date) to anon, authenticated;

-- ============ SEGURIDAD (RLS) ============
-- Cada consultorio solo ve y edita sus propios datos.

alter table consultorios enable row level security;
alter table servicios enable row level security;
alter table disponibilidad enable row level security;
alter table pacientes enable row level security;
alter table citas enable row level security;
alter table pagos enable row level security;
alter table notas enable row level security;
alter table adjuntos enable row level security;

-- El doctor/secretaria autenticado solo ve su propio consultorio
create policy "ver mi consultorio" on consultorios
  for select using (auth_user_id = auth.uid());
create policy "editar mi consultorio" on consultorios
  for update using (auth_user_id = auth.uid());
-- Un usuario recién registrado puede crear SU PROPIO consultorio (y solo el suyo)
create policy "crear mi consultorio" on consultorios
  for insert with check (auth_user_id = auth.uid());

-- Lectura pública de servicios y disponibilidad activos (para la página de reserva)
create policy "servicios publicos" on servicios for select using (activo = true);
create policy "disponibilidad publica" on disponibilidad for select using (true);

-- El consultorio autenticado administra sus propios servicios/citas/etc.
create policy "gestionar mis servicios" on servicios for all
  using (consultorio_id in (select id from consultorios where auth_user_id = auth.uid()));
create policy "gestionar mi disponibilidad" on disponibilidad for all
  using (consultorio_id in (select id from consultorios where auth_user_id = auth.uid()));
create policy "gestionar mis pacientes" on pacientes for all
  using (consultorio_id in (select id from consultorios where auth_user_id = auth.uid()));
create policy "gestionar mis citas" on citas for all
  using (consultorio_id in (select id from consultorios where auth_user_id = auth.uid()));
create policy "ver mis pagos" on pagos for select
  using (consultorio_id in (select id from consultorios where auth_user_id = auth.uid()));
create policy "gestionar mis notas" on notas for all
  using (cita_id in (select id from citas where consultorio_id in
    (select id from consultorios where auth_user_id = auth.uid())));
create policy "gestionar mis adjuntos" on adjuntos for all
  using (paciente_id in (select id from pacientes where consultorio_id in
    (select id from consultorios where auth_user_id = auth.uid())));

alter table administradores enable row level security;
alter table liquidaciones enable row level security;

-- Un usuario puede saber si él mismo es administrador (para mostrar/ocultar el menú)
create policy "verse a si mismo como admin" on administradores
  for select using (auth_user_id = auth.uid());

-- Los administradores ven TODOS los consultorios, citas y pagos (no solo el suyo)
create policy "admin ve todos los consultorios" on consultorios for select
  using (exists (select 1 from administradores where auth_user_id = auth.uid()));
create policy "admin ve todas las citas" on citas for select
  using (exists (select 1 from administradores where auth_user_id = auth.uid()));
create policy "admin ve todos los pagos" on pagos for select
  using (exists (select 1 from administradores where auth_user_id = auth.uid()));
create policy "admin ve todos los servicios" on servicios for select
  using (exists (select 1 from administradores where auth_user_id = auth.uid()));
create policy "admin gestiona liquidaciones" on liquidaciones for all
  using (exists (select 1 from administradores where auth_user_id = auth.uid()));

-- Nota: la CREACIÓN de citas/pacientes desde la página pública de reserva
-- se hace a través de una función serverless (api/reservar.js) usando la
-- service_role key, no directo desde el navegador. Así evitamos abrir
-- políticas de "insert" públicas inseguras.
