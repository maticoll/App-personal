# Pendientes y Deuda Técnica
> Cambios a hacer en el futuro — cosas que se simplificaron por limitaciones o que quedaron para después

---

## Cron Jobs — Limitación Hobby Plan de Vercel

**Problema:** El plan Hobby de Vercel solo permite cron jobs que corran una vez por día. El cron de notificaciones de sueño originalmente estaba diseñado para correr cada 30 minutos entre las 8 PM y las 11 PM.

**Lo que teníamos (diseño original):**
```json
{
  "path": "/api/cron/sleep-notifications",
  "schedule": "*/30 20-23 * * *"
}
```
Esto corría a las 20:00, 20:30, 21:00, 21:30, 22:00, 22:30, 23:00 y 23:30 — para detectar el momento exacto en que el usuario todavía no registró bedtime y mandarle el recordatorio de WhatsApp en tiempo real.

**Lo que tenemos ahora (workaround):**
```json
{
  "path": "/api/cron/sleep-notifications",
  "schedule": "0 22 * * *"
}
```
Corre una sola vez a las 10 PM. Si no registró bedtime, manda el recordatorio. Funciona pero pierde la granularidad de 30 minutos.

**Soluciones posibles a futuro:**
- Upgradear a Vercel Pro (desbloquea todos los cron jobs)
- Usar un servicio externo de scheduling (ej: cron-job.org, GitHub Actions, Railway) que llame al endpoint cada 30 min
- Implementar lógica push desde la app: que el propio WhatsApp bot maneje el recordatorio basándose en la hora de respuesta del usuario

---

*Última actualización: Mayo 2026*
