# Skill: Módulo de Sueño
> Sesión 3 — Registro manual, Garmin Connect API, scoring real, cron jobs, agente completo

---

## Qué se hizo en esta sesión

Implementación completa del módulo de sueño:
- UI funcional con gráficos Recharts
- Flujo de dos pasos: "me voy a dormir" → "me desperté"
- Integración con Garmin Connect API (SSO + endpoints de wellness)
- Auto-sync diario via cron job Vercel
- Notificaciones de bedtime/wake (preparadas para WhatsApp en Sesión 8)
- Agente de sueño con parsing de lenguaje natural
- Scoring real con tres bloques (registro + duración + calidad)

---

## Archivos creados/modificados

### Nuevos

| Archivo | Descripción |
|---------|-------------|
| `lib/sleep.ts` | Toda la lógica de negocio del módulo |
| `lib/garmin.ts` | Cliente Garmin Connect (SSO + API wellness) |
| `app/api/sleep/log/route.ts` | POST: registrar bed/wake time o log manual |
| `app/api/sleep/today/route.ts` | GET: sueño de hoy + log pendiente |
| `app/api/sleep/history/route.ts` | GET: historial + stats semanales |
| `app/api/sleep/sync-garmin/route.ts` | POST: sync manual con Garmin |
| `app/api/sleep/[id]/route.ts` | PATCH/DELETE: editar/eliminar registro |
| `app/api/garmin/status/route.ts` | GET: estado de la conexión Garmin |
| `app/api/cron/sleep-sync/route.ts` | GET: cron diario de sync Garmin (8 AM) |
| `app/api/cron/sleep-notifications/route.ts` | GET: cron de notificaciones (cada 30min, 8-11 PM) |
| `components/sleep/SleepQuickActions.tsx` | Botones "Me voy a dormir" / "Me desperté" |
| `components/sleep/SleepTodayCard.tsx` | Card del sueño de hoy (duración, fases, Garmin) |
| `components/sleep/SleepWeekStats.tsx` | Estadísticas de los últimos 7 días |
| `components/sleep/SleepDurationChart.tsx` | Bar chart: duración últimos 7 días (Recharts) |
| `components/sleep/SleepQualityChart.tsx` | ComposedChart: calidad Garmin + duración (14 días) |
| `components/sleep/SleepTimingChart.tsx` | Timing chart: ventanas de sueño como barras flotantes |
| `components/sleep/SleepHistoryList.tsx` | Lista de registros pasados con expandible |
| `components/sleep/GarminSyncButton.tsx` | Botón de sync + estado de conexión |
| `components/sleep/SleepModuleClient.tsx` | Wrapper client con estado y acciones |
| `vercel.json` | Configuración de cron jobs |

### Modificados

| Archivo | Cambio |
|---------|--------|
| `prisma/schema.prisma` | SleepLog: +spo2Avg, +respirationAvg, +bodyBatteryChange; UserSettings: +garminSessionKey, +garminSessionExp |
| `app/(app)/sleep/page.tsx` | Implementación completa (Server Component) |
| `agents/sleep/index.ts` | Agente completo con parsing NLP |
| `lib/scoring.ts` | Criterios de sueño reales (3 bloques), +`calcSleepScoreForDate()` exportada |
| `.env.local.example` | +GARMIN_EMAIL, +GARMIN_PASSWORD, +CRON_SECRET |

---

## Arquitectura del módulo

```
/sleep (Server Component)
  ├── carga en paralelo (Promise.all):
  │     getTodaySleep, getPendingSleepLog,
  │     getSleepHistory(14), getWeeklyStats,
  │     checkGarminStatus
  └── SleepModuleClient (Client Component)
        ├── SleepQuickActions → POST /api/sleep/log
        ├── SleepTodayCard (si hay datos)
        ├── SleepWeekStats (si stats.totalDays > 0)
        ├── GarminSyncButton → POST /api/sleep/sync-garmin
        ├── Tabs: Gráficos | Historial
        │     Gráficos:
        │       ├── SleepDurationChart (7 días, BarChart)
        │       ├── SleepQualityChart (14 días, ComposedChart)
        │       └── SleepTimingChart (7 días, barras flotantes)
        │     Historial:
        │       └── SleepHistoryList (expandible, con delete)
        └── Estado: today, pending, history, stats
```

---

## Flujo de dos pasos (Manual)

```
Usuario → "Me voy a dormir"
  ↓
POST /api/sleep/log { action: "bed" }
  → logBedTime(now)
  → date = próximo día (si son ≥ 12 PM → siguiente día; si < 12 PM → mismo día)
  → crea SleepLog con bedTime, wakeTime=null
  ↓
UI muestra: "Te fuiste a dormir a las 23:30" + botón "Me desperté"

───────── usuario duerme ─────────

Usuario → "Me desperté"
  ↓
POST /api/sleep/log { action: "wake" }
  → logWakeTime(now)
  → busca SleepLog pendiente (bedTime sin wakeTime, últimas 20h)
  → actualiza wakeTime + calcula durationMinutes
  ↓
UI muestra: card completo con duración
```

---

## Garmin Connect API

### Autenticación (SSO no oficial)

```
Paso 1: GET sso.garmin.com/sso/embed → HTML con CSRF token
Paso 2: POST sso.garmin.com/sso/signin (email + password + CSRF) → ticket
Paso 3: GET connect.garmin.com/modern/?ticket=xxx → cookies de sesión
         ↓
         cookies "GARMIN-SSO" / "SESSIONID" válidas por ~24h
```

La sesión se cachea en memoria (proceso) + UserSettings.garminSessionKey (DB).
TTL: 23 horas. Se renueva automáticamente al expirar.

### Endpoints usados

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/proxy/userprofile-service/socialProfile` | GET | displayName del usuario |
| `/proxy/wellness-service/wellness/dailySleepData/{displayName}?date=YYYY-MM-DD` | GET | Datos de sueño del día |

### Campos del response de sueño

| Campo Garmin | Campo DB | Descripción |
|-------------|----------|-------------|
| `sleepStartTimestampGMT` | `bedTime` | Inicio del sueño (ms epoch GMT) |
| `sleepEndTimestampGMT` | `wakeTime` | Fin del sueño (ms epoch GMT) |
| `sleepTimeSeconds` | `durationMinutes` | Duración total |
| `deepSleepSeconds` | `deepSleepMinutes` | Sueño profundo |
| `lightSleepSeconds` | `lightSleepMinutes` | Sueño ligero |
| `remSleepSeconds` | `remSleepMinutes` | Sueño REM |
| `awakeSleepSeconds` | `awakeMinutes` | Tiempo despierto durante la noche |
| `sleepScores.overall.value` | `garminScore` | Score de calidad 0–100 |
| `averageStressLevel` | `stressScore` | Nivel de estrés (0–100, menor = mejor) |
| `averageSpO2Value` | `spo2Avg` | SpO2 promedio (%) |
| `averageRespirationValue` | `respirationAvg` | Frecuencia respiratoria (resp/min) |
| `bodyBatteryChange` | `bodyBatteryChange` | Cambio en Body Battery |

### Variables de entorno requeridas

```env
GARMIN_EMAIL="tu-email@garmin.com"
GARMIN_PASSWORD="tu-contraseña"
CRON_SECRET="[openssl rand -base64 32]"
```

### Para obtener acceso oficial (futuro)
Solicitar en https://developer.garmin.com/health-api/overview/
Requiere: OAuth 1.0a (consumer key + secret), aprobación de Garmin
Diferencia: acceso a datos de múltiples usuarios, webhooks push

---

## Scoring de Sueño — Criterios Sesión 3

```
Total: 100 puntos — 3 bloques

Bloque Registro (30 pts):
  +30  bedTime + wakeTime (registro completo)
  +15  solo bedTime (pendiente)

Bloque Duración (40 pts):
  +40  7–9h (ideal)
  +20  6–7h ó 9–10h (aceptable)
  +0   fuera de rango

Bloque Calidad (30 pts):
  SIN Garmin — hora de acostarse:
    +30  ≤ 23:30
    +20  ≤ 00:30
    +10  ≤ 01:00
    +0   > 01:00
  CON Garmin — score de calidad:
    proporcional: round(garminScore / 100 * 30)
```

**Score null vs 0:**
- `null`: sin ningún registro → módulo excluido del promedio global
- `0`: hay registro pero no se cumplió ningún criterio (ej: dormiste 3h)

---

## Cron Jobs (Vercel)

| Schedule | Endpoint | Descripción |
|----------|----------|-------------|
| `0 8 * * *` | `/api/cron/sleep-sync` | Sync Garmin diario (8 AM) |
| `*/30 20-23 * * *` | `/api/cron/sleep-notifications` | Notificaciones de bedtime (8–11:30 PM) |

**Protección:** header `Authorization: Bearer $CRON_SECRET`

**Configurar en Vercel:**
1. Agregar `CRON_SECRET` en Environment Variables
2. El `vercel.json` ya tiene las reglas de cron definidas
3. Los crons solo corren en producción (Vercel Pro+ o Hobby con limitaciones)

---

## Agente de Sueño — Intenciones reconocidas

| Mensaje ejemplo | Intención detectada |
|-----------------|-------------------|
| "me voy a dormir" | `bed` (ahora) |
| "me dormí a las 11" | `bed` (23:00) |
| "hoy salgo tarde, te aviso" | `bed` (flexible=true) |
| "me desperté" | `wake` (ahora) |
| "me desperté a las 7" | `wake` (07:00) |
| "cuánto dormí?" | `query` (today) |
| "cuánto dormí esta semana?" | `query` (week) |
| "sync" / "sincronizar" | `sync` Garmin |

---

## Schema Prisma — cambios Sesión 3

### SleepLog (nuevo)
```prisma
spo2Avg           Float?   // SpO2 promedio (%)
respirationAvg    Float?   // Frecuencia respiratoria (resp/min)
bodyBatteryChange Int?     // Cambio en Body Battery
```

### UserSettings (nuevo)
```prisma
garminSessionKey String?   // Cookie de sesión Garmin (encriptada)
garminSessionExp DateTime? // Expiración de la sesión
```

---

## Convención de fechas

La `date` del SleepLog es el **día de despertar** (no el día de acostarse):
- Acostarse el lunes a las 11 PM → date = martes
- Acostarse el martes a la 1 AM → date = martes (ya es el día siguiente)

Regla: `bedTime.getHours() >= 12` → date es el día siguiente; de lo contrario, el mismo día.

---

## Cómo arrancar después de esta sesión

```bash
# 1. Pushear cambios del schema a Supabase
npm run db:push

# 2. Regenerar el cliente Prisma
npm run db:generate

# 3. Completar variables en .env.local
#    GARMIN_EMAIL, GARMIN_PASSWORD, CRON_SECRET

# 4. Correr
npm run dev
# → /sleep muestra UI completa
# → Botones "Me voy a dormir" / "Me desperté" funcionan
# → Sync Garmin funciona si las credenciales están configuradas

# Para probar los cron jobs manualmente:
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/sleep-sync
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/sleep-notifications
```

---

## Decisiones técnicas

| Decisión | Alternativa | Razón |
|----------|-------------|-------|
| SSO email/password para Garmin | API oficial OAuth 1.0a | La API oficial requiere partnership con Garmin (no accesible para desarrolladores individuales sin aprobación). SSO funciona para uso personal. |
| Cachear sesión Garmin en DB | Llamar SSO en cada request | La autenticación SSO tarda ~1–2s. Con cache el sync es rápido. TTL 23h. |
| date = día de despertar | date = día de acostarse | Más intuitivo: "dormí el martes" = me desperté el martes, aunque me acosté el lunes. |
| logWakeTime busca por bedTime (últimas 20h) | buscar por date | Más robusto: si el usuario duerme de 11 PM a 8 AM, la fecha de bedTime y wakeTime difieren. |
| Garmin reemplaza horario en bloque calidad | Ambos sumables | Mantiene el total en 100. Con Garmin, el score es más preciso; sin Garmin, el proxy de hora de dormir es razonable. |
| Charts del cliente, datos del servidor | Charts con SWR | Los datos de sueño no cambian frecuentemente. El Server Component carga el estado inicial; el cliente actualiza via fetch al registrar. |
| Floating bar en SleepTimingChart (stacked transparent + colored) | Custom shape Recharts | Más simple, sin necesidad de `customShape` complejo. El stack invisible posiciona la barra visible. |

---

*Sesión 3 completada — Mayo 2026*
*Próximo paso: Sesión 4 — Fitness (Garmin actividades, smart habits, reagendado)*
