# Configuración de Cron Jobs

## Contexto

La app está en Vercel plan **Hobby**. Limitación: cada cron en `vercel.json` puede correr **una sola vez por día**.

Los crons que necesitan correr más de una vez por día se configuran externamente en **[cron-job.org](https://cron-job.org)** (gratuito), que hace un HTTP GET a la API route según el schedule configurado.

---

## Crons en vercel.json (automáticos)

Estos corren solos — no requieren configuración extra:

| Job | Schedule | Qué hace |
|-----|----------|----------|
| `/api/cron/sleep-sync` | `0 8 * * *` (8:00 hs) | Sincroniza sueño de Garmin de los últimos 2 días |
| `/api/cron/sleep-notifications` | `0 22 * * *` (22:00 hs) | Recordatorio de hora de dormir y despertar no registrado |
| `/api/cron/fitness-sync` | `0 6 * * *` (6:00 hs) | Sincroniza actividades de Garmin de los últimos 2 días |
| `/api/cron/fitness-habits` | `10 7 * * *` (7:10 hs) | Detecta desvíos de smart habits (día de gym sin workout) |

---

## Crons en cron-job.org (configuración manual requerida)

Estos no están en `vercel.json` porque necesitan correr más de una vez por día:

| Job | URL | Schedule | Header requerido | Qué hace |
|-----|-----|----------|-----------------|----------|
| Water Reminder — mediodía | `https://[TU-APP].vercel.app/api/cron/water-reminder` | `0 12 * * *` | `x-cron-secret: [TU_CRON_SECRET]` | Recordatorio de hidratación al mediodía |
| Water Reminder — tarde | `https://[TU-APP].vercel.app/api/cron/water-reminder` | `0 17 * * *` | `x-cron-secret: [TU_CRON_SECRET]` | Recordatorio de hidratación a las 17 hs |

> **Reemplazá** `[TU-APP]` con el dominio real de tu app en Vercel (ej: `app-personal-maticoll.vercel.app`) y `[TU_CRON_SECRET]` con el valor de tu variable `CRON_SECRET`.

---

## Cómo crear un job en cron-job.org

1. Registrarse en [cron-job.org](https://cron-job.org) (gratis, no requiere tarjeta)
2. Ir a **Cronjobs → Create cronjob**
3. Completar:
   - **Title:** nombre descriptivo (ej: "Water Reminder — mediodía")
   - **URL:** la URL completa del endpoint (`https://[TU-APP].vercel.app/api/cron/water-reminder`)
   - **Schedule:** elegir "Custom" y pegar el schedule en formato cron (ej: `0 12 * * *`)
   - **Request method:** GET
4. Ir a la sección **Headers** → Add header:
   - **Header name:** `x-cron-secret`
   - **Header value:** el valor de tu `CRON_SECRET` (el mismo que está en Vercel → Project Settings → Environment Variables)
5. **Save** y activar el job

---

## Autenticación de los endpoints

Todos los endpoints `/api/cron/*` aceptan dos formas de autenticación:

- **Vercel Cron** (automático): envía `Authorization: Bearer $CRON_SECRET`
- **cron-job.org** (manual): configurar header `x-cron-secret: $CRON_SECRET`

Si `CRON_SECRET` no está configurado en las variables de entorno, todos los endpoints devuelven **401**.

---

## Respuesta estándar

Todos los endpoints devuelven:

```json
// Éxito
{ "ok": true, "message": "descripción de lo que se ejecutó" }

// Error interno
{ "ok": false, "error": "descripción del error" }

// No autorizado
{ "ok": false, "error": "No autorizado" }  // HTTP 401
```
