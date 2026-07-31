# CitaFácil

App de agenda, recordatorios por WhatsApp (manual) y pago de citas para consultorios independientes.

## 1. Instalar dependencias

```bash
npm install
```

## 2. Crear el proyecto en Supabase

1. Ve a https://supabase.com y crea un proyecto nuevo (plan gratuito alcanza para empezar).
2. En el panel, entra a **SQL Editor** → **New query**, pega todo el contenido de
   `supabase/schema.sql` y dale **Run**. Esto crea todas las tablas y la seguridad (RLS).
3. En **Project Settings → API** copia:
   - `Project URL` → va en `VITE_SUPABASE_URL` y `SUPABASE_URL`
   - `anon public key` → va en `VITE_SUPABASE_ANON_KEY`
   - `service_role key` → va en `SUPABASE_SERVICE_ROLE_KEY` (¡nunca la subas al frontend!)
4. En **Authentication → Providers → Email**, deja habilitado Email/Password y **desactiva
   "Confirm email"** — esto es importante para que el asistente de registro (`/registro`) pueda
   crear el consultorio en el mismo flujo, sin esperar confirmación por correo (ver detalle
   en la sección "Registro de nuevos consultorios" más abajo).
5. Date de alta como administrador (ver sección "Cómo darte de alta como administrador").
   Los consultorios ya no se crean a mano: cada doctor se registra solo desde `/registro`.

## 3. Pasarela de pago (Culqi)

Ya no hace falta que tú crees una cuenta Culqi global: **cada consultorio conecta la suya
propia** desde su panel (`/panel/configuracion`), como se explica más abajo en "Cómo configura
cada consultorio su cuenta de cobro". No hay ninguna llave de Culqi que configurar en tus
variables de entorno.

## 4. Variables de entorno locales

Copia `.env.example` a `.env` y completa los valores:

```bash
cp .env.example .env
```

## 5. Correr en local

```bash
npm run dev
```

- Página pública de un consultorio: `http://localhost:5173/dr-perez`
- Registro de un nuevo consultorio: `http://localhost:5173/registro`
- Login del consultorio: `http://localhost:5173/login`
- Panel: `http://localhost:5173/panel`
- Panel de administrador: `http://localhost:5173/admin`

## 6. Publicar en Vercel

1. Sube este proyecto a un repositorio de GitHub.
2. En https://vercel.com → **Add New Project** → importa el repositorio.
3. En **Environment Variables**, agrega las 5 variables de `.env.example` (los valores reales).
4. Deploy. Vercel detecta automáticamente que `/api/reservar.js` es una función serverless.
5. Cuando tengas dominio propio, lo conectas desde **Project Settings → Domains**.

## Cómo funciona el cobro con comisión (modelo de pago directo)

- Cada consultorio tiene **su propia cuenta Culqi**, con su propio RUC y cuenta bancaria de destino.
- El paciente paga con tarjeta y el dinero llega **directo a la cuenta del doctor** — tu empresa
  nunca lo toca. Esto evita que tengas que retener impuestos por él (ese tema solo aplicaría si
  tú fueras quien le paga directamente).
- El cobro sigue pasando por tu función `/api/reservar`, pero usando la llave secreta del propio
  consultorio (columna `culqi_secret_key`, cargada solo para ese doctor). La respuesta que Culqi
  devuelve (`charge.id`, éxito/error) es la prueba de que el pago ocurrió de verdad — no depende
  de que el doctor te lo reporte.
- Cada pago validado queda guardado en la tabla `pagos`, con tu comisión ya calculada.
- Cada semana, entras al **panel de administrador** (`/admin`) y ves cuánto generó cada
  consultorio y cuánto te corresponde de comisión — con datos que vienen directo de Culqi, no
  de lo que el doctor diga.
- El doctor te transfiere esa comisión por Yape/transferencia (fuera de la app), y tú lo marcas
  como "pagado" en el panel para llevar el registro.

### Cómo darte de alta como administrador

1. Crea tu propio usuario en **Authentication → Users** (igual que con los doctores).
2. En **Table Editor → administradores**, inserta una fila con tu `auth_user_id` y tu nombre.
3. Entra a `/admin` con tu correo y contraseña.

### Cómo configura cada consultorio su cuenta de cobro

Ya no necesitas cargar las llaves de Culqi a mano en Supabase. El propio doctor lo hace desde
su panel: al entrar a `/panel`, si todavía no conectó su cuenta de cobro, verá un aviso que lo
lleva a `/panel/configuracion`, donde pega su llave pública y secreta de Culqi. La app valida
que las llaves tengan el formato correcto (`pk_...` / `sk_...`) y muestra si está en modo prueba
o modo real antes de guardar.

## Registro de nuevos consultorios (self-service)

Cualquier doctor puede entrar a `/registro` y completar un asistente de 3 pasos:

1. Crea su cuenta (correo y contraseña)
2. Completa los datos de su consultorio — nombre, especialidad, WhatsApp, color, y elige la
   dirección de su página pública (`citafacil.app/su-slug`), con verificación de disponibilidad
   en tiempo real
3. Agrega su primer servicio (nombre, duración, precio)

Al terminar, lo mandamos a su panel, donde verá el aviso para conectar su cuenta de Culqi
(`/panel/configuracion`) antes de poder recibir pagos. Ya no tienes que crear nada a mano en
Supabase para incorporar un consultorio nuevo — solo compartes el link `/registro`.

**Por qué hay que desactivar "Confirm email" en Supabase:** el asistente crea la cuenta y,
en el mismo paso, usa la sesión recién creada para insertar el consultorio (las políticas de
seguridad exigen que `auth_user_id = auth.uid()`, y sin sesión activa eso falla). Si el correo
requiere confirmación primero, no hay sesión inmediata y el registro se corta a la mitad. Para
v1 es más simple mantenerlo desactivado; se puede agregar verificación por correo más adelante
sin romper el flujo, ajustando el paso 1 del asistente.

**Nota de seguridad:** las llaves de Culqi de cada consultorio se guardan como texto plano en
la base de datos, protegidas solo por RLS (nadie puede leerlas salvo tu función serverless con
`service_role`). Para producción con muchos consultorios, conviene cifrarlas antes de
guardarlas — es un ajuste pendiente en el roadmap.

## Disponibilidad real de horarios

Cada doctor define su horario semanal desde `/panel/disponibilidad` — marca los días que
atiende y el rango de horas (con un atajo para copiar el horario del lunes al resto de días
activos). Si todavía no lo configura, el panel se lo recuerda con un aviso, igual que con la
cuenta de cobro.

La página pública de reservas ya no muestra horarios de ejemplo: llama a la función SQL
`horarios_disponibles(consultorio_id, servicio_id, fecha)` (definida en `schema.sql`), que:

1. Toma el horario semanal configurado para ese día de la semana
2. Genera los espacios posibles según la duración del servicio elegido
3. Descarta los que se cruzan con citas ya confirmadas o pendientes de pago ese día
4. Descarta horarios que ya pasaron, si la fecha elegida es hoy

Corre como una función de base de datos (no en el frontend) para que el cálculo sea consistente
sin importar desde dónde se consulte, y para no exponer la tabla completa de citas a pacientes
anónimos — ellos solo reciben la lista final de horas libres.

## Archivos adjuntos de pacientes

Desde el panel de notas de cada cita (el ícono 📄 en la agenda del día), el doctor puede subir
recetas, resultados o fotos por paciente — PDF o imágenes, hasta 10MB.

- Los archivos se guardan en un bucket **privado** de Supabase Storage llamado `adjuntos`
  (se crea automáticamente al correr `schema.sql`, junto con sus políticas de seguridad).
- La ruta de cada archivo es `{consultorio_id}/{paciente_id}/archivo`, y las políticas de
  Storage solo dejan subir/ver/eliminar archivos dentro de la carpeta del propio consultorio.
- Para verlos, la app genera una **URL firmada** válida por 10 minutos (`urlFirmadaAdjunto`) —
  nunca se expone un link público y permanente al archivo.

**Nota:** si ya corriste `schema.sql` antes de este cambio, vuelve a **SQL Editor** y corre de
nuevo el archivo completo — el bucket usa `on conflict do nothing` así que no se duplica, y las
políticas de Storage son nuevas.

## Gestión de servicios

Desde `/panel/servicios`, el doctor agrega, edita y activa/desactiva sus servicios sin tocar
Supabase. Desactivar un servicio (en vez de borrarlo) lo oculta de la página pública de
reservas pero conserva su historial — importante porque las citas ya agendadas siguen
referenciando ese servicio. Si el doctor se queda sin servicios activos, el panel se lo avisa,
igual que con el horario y la cuenta de cobro.

## Apariencia de la página de reservas

Desde `/panel/apariencia`, el doctor sube 3 imágenes (arrastrando o eligiendo el archivo):

- **Foto de perfil** — su logo o foto, se muestra como avatar sobre la portada
- **Foto de portada** — la imagen principal en la parte superior de su página pública
- **Imagen de fondo** — una textura o foto sutil detrás de todo el contenido (opcional; si no
  la sube, se usa un patrón geométrico discreto en el color de acento del consultorio)

También puede cambiar su color de acento desde la misma pantalla, con vista previa en vivo de
cómo se ve todo junto antes de publicarlo.

Desde la misma pantalla (`/panel/apariencia`), el doctor también escribe una **descripción**
(hasta 400 caracteres) que se muestra en su página de reservas, debajo de su nombre — es el
espacio para que el paciente sepa quién es, su experiencia o su enfoque antes de agendar.

## Fotos referenciales por tratamiento

Desde `/panel/servicios`, cada servicio tiene su propia galería (hasta 6 fotos) — útil para que
el paciente vea, por ejemplo, cómo se ve un tratamiento de blanqueamiento o el consultorio
mismo antes de agendar. Las fotos se suben directo desde la tarjeta del servicio, sin necesidad
de entrar a modo edición.

En la página pública, la primera foto aparece como miniatura junto al servicio en la lista, y
la galería completa se muestra al elegir el horario — justo antes de que el paciente decida,
que es cuando más ayuda a generar confianza.

Las imágenes se guardan en un bucket **público** de Supabase Storage llamado `marca` (distinto
del bucket privado `adjuntos` de archivos de pacientes) — público porque su propósito es
mostrarse en la página de reservas, no proteger información sensible. Aun así, solo el propio
consultorio puede subir o reemplazar sus imágenes; cualquiera puede verlas.

## PIN de acceso al panel de administrador

Además de requerir login (correo/contraseña) y estar en la tabla `administradores`, entrar a
`/admin` pide un **PIN de 4 a 6 dígitos** como segunda capa de seguridad — útil sobre todo si
alguien más usa tu computadora con tu sesión abierta.

- La primera vez que entras, te pide **configurarlo**
- Las siguientes veces, te lo pide **una vez por sesión de navegador** (se recuerda mientras no
  cierres esa pestaña/navegador, usando `sessionStorage` — no `localStorage`, para que no quede
  guardado permanentemente en el dispositivo)
- El PIN se guarda **hasheado** (`scrypt`, con sal aleatoria) en la base de datos — ni siquiera
  tú puedes verlo de nuevo en Supabase, solo se puede verificar o reemplazar
- La verificación ocurre en el servidor (`/api/pin-verificar`), nunca en el navegador — así que
  no hay forma de "leer" el PIN correcto inspeccionando el código de la página

**Importante — esto NO reemplaza la seguridad real:** la protección de fondo sigue siendo que
las políticas de base de datos (RLS) bloquean el acceso a los datos si no eres administrador,
sin importar el PIN. El PIN es una fricción adicional para tu propio dispositivo, no la razón
por la que otros consultorios no pueden ver tus datos.

## ⚠️ Importante: probar las funciones /api en local

`npm run dev` (Vite) **no ejecuta las funciones serverless** de la carpeta `/api` — ni
`api/reservar.js`, ni `api/pin-configurar.js`, ni `api/pin-verificar.js`. Si las pruebas así,
verás errores 404 al llamar a esos endpoints (por ejemplo, al intentar pagar una cita, o al
configurar el PIN de administrador).

Para probarlas en local, necesitas la CLI de Vercel:

```bash
npm install -g vercel
vercel login
vercel link          # conecta esta carpeta a tu proyecto de Vercel
vercel env pull       # baja tus variables de entorno reales desde Vercel
vercel dev            # levanta todo (frontend + funciones /api) en un solo servidor
```

`vercel dev` reemplaza a `npm run dev` para pruebas completas — usa el mismo puerto por
defecto (`localhost:3000`, puede variar). Si solo estás revisando pantallas que no dependen de
`/api` (como `/panel/servicios` o `/panel/disponibilidad`), `npm run dev` sigue sirviendo para
ir más rápido; pero para probar pagos o el PIN de administrador, usa `vercel dev`.

## Qué falta para producción (roadmap corto)

- [ ] Permitir más de un bloque de horario por día (ej. mañana y tarde separados) — hoy la
      pantalla de disponibilidad solo admite un rango continuo por día
- [ ] Cifrar `culqi_secret_key` antes de guardarla (hoy es texto plano protegido solo por RLS)
- [ ] Webhook de Culqi para confirmar pagos de forma más robusta (no solo la respuesta directa)
- [ ] Historial de liquidaciones pasadas visible en `/admin` (hoy solo se ve el saldo pendiente)
- [ ] Verificación por correo antes de activar la cuenta (hoy está desactivada para v1)
