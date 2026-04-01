# EduPlan 3D

Plataforma SaaS para docentes de secundaria y bachillerato — genera planificaciones curriculares con IA y escenas 3D didácticas interactivas.

**Stack:** Next.js 14 (App Router) · Supabase (auth + postgres) · Anthropic Claude · Three.js · Tailwind CSS

---

## Estructura del proyecto

```
eduplan3d/
├── middleware.ts                        # Protección de rutas (Supabase SSR)
├── next.config.js
├── tailwind.config.ts
├── .env.local.example                   # Variables de entorno necesarias
│
├── supabase/
│   └── migrations/
│       └── 0001_initial.sql            # Tablas + RLS policies
│
└── src/
    ├── app/
    │   ├── layout.tsx                   # Root layout (fuentes, Toaster)
    │   ├── globals.css                  # Design tokens + utilidades
    │   ├── page.tsx                     # Redirect → /dashboard o /landing
    │   │
    │   ├── landing/
    │   │   └── page.tsx                 # Landing page pública
    │   │
    │   ├── auth/
    │   │   ├── layout.tsx               # Auth layout (centrado + glows)
    │   │   ├── callback/route.ts        # OAuth + email confirmation
    │   │   ├── login/page.tsx
    │   │   ├── register/page.tsx
    │   │   └── forgot-password/page.tsx
    │   │
    │   ├── dashboard/
    │   │   ├── layout.tsx               # Dashboard layout (Sidebar + Topbar)
    │   │   ├── page.tsx                 # Home: stats, recientes, acciones rápidas
    │   │   ├── planificador/page.tsx    # Generador de planificaciones
    │   │   ├── escenas/page.tsx         # Escenas 3D interactivas
    │   │   ├── historial/
    │   │   │   ├── page.tsx             # Lista con búsqueda y filtros
    │   │   │   └── [id]/page.tsx        # Detalle de planificación
    │   │   └── configuracion/page.tsx   # Perfil, plan, seguridad
    │   │
    │   └── api/
    │       └── planificaciones/
    │           ├── route.ts             # POST: genera + guarda planificación
    │           ├── [id]/route.ts        # DELETE: elimina planificación
    │           └── explain/route.ts     # POST: explicación didáctica 3D
    │
    ├── components/
    │   ├── ui/
    │   │   ├── Logo.tsx
    │   │   ├── FeatureCard.tsx
    │   │   └── PlanCard.tsx
    │   ├── layout/
    │   │   ├── Sidebar.tsx              # Navegación lateral con estado activo
    │   │   ├── Topbar.tsx               # Barra superior + menú de usuario
    │   │   └── ConfiguracionClient.tsx  # Tabs: perfil, plan, seguridad
    │   ├── auth/
    │   │   ├── LoginForm.tsx
    │   │   ├── RegisterForm.tsx
    │   │   └── ForgotPasswordForm.tsx
    │   ├── planner/
    │   │   ├── PlannerClient.tsx        # Formulario + panel de resultado
    │   │   ├── HistorialClient.tsx      # Grid con búsqueda y filtros
    │   │   └── DeletePlanButton.tsx
    │   └── scenes/
    │       └── ScenesClient.tsx         # Three.js: 6 escenas 3D + IA explain
    │
    ├── lib/
    │   ├── supabase/
    │   │   ├── client.ts                # Browser client (Client Components)
    │   │   └── server.ts                # Server client (Server Components, Actions)
    │   └── actions/
    │       └── auth.ts                  # Server Actions: signIn, signUp, signOut...
    │
    └── types/
        └── supabase.ts                  # Database types + domain types
```

---

## Setup en 5 pasos

### 1. Instalar dependencias
```bash
cd eduplan3d
npm install
```

### 2. Configurar variables de entorno
```bash
cp .env.local.example .env.local
# Edita .env.local con tus credenciales reales
```

### 3. Crear proyecto en Supabase
1. Ve a [supabase.com](https://supabase.com) → New project
2. Copia `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` desde **Settings → API**
3. Copia `SUPABASE_SERVICE_ROLE_KEY` desde la misma página (nunca expongas esta al cliente)

### 4. Ejecutar la migración SQL
1. Ve a **Supabase Dashboard → SQL Editor**
2. Pega el contenido de `supabase/migrations/0001_initial.sql`
3. Ejecuta — crea las tablas `profiles` y `planificaciones` con RLS

### 5. Obtener API key de Anthropic
1. Ve a [console.anthropic.com](https://console.anthropic.com)
2. Crea una API key y ponla en `ANTHROPIC_API_KEY`

### Levantar el servidor
```bash
npm run dev
# Abre http://localhost:3000
```

---

## URLs del proyecto

| Ruta | Descripción |
|------|-------------|
| `/` | Redirect automático según sesión |
| `/landing` | Landing page pública |
| `/auth/login` | Login |
| `/auth/register` | Registro |
| `/auth/forgot-password` | Recuperar contraseña |
| `/auth/callback` | Callback de email/OAuth |
| `/dashboard` | Home con stats y recientes |
| `/dashboard/planificador` | Generador de planificaciones IA |
| `/dashboard/escenas` | Escenas 3D interactivas |
| `/dashboard/historial` | Lista de planificaciones guardadas |
| `/dashboard/historial/[id]` | Detalle de una planificación |
| `/dashboard/configuracion` | Perfil, plan y seguridad |
| `/api/planificaciones` | POST: generar planificación |
| `/api/planificaciones/[id]` | DELETE: eliminar planificación |
| `/api/planificaciones/explain` | POST: explicación didáctica IA |

---

## Comandos útiles

```bash
npm run dev          # Servidor de desarrollo
npm run build        # Build de producción
npm run lint         # Linting
npm run db:types     # Regenerar tipos desde Supabase CLI
```

---

## Deploy en Vercel

```bash
npx vercel
# Agrega las variables de entorno en el dashboard de Vercel
```

El middleware de Supabase SSR funciona nativamente en Vercel Edge Runtime.
