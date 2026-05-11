// ============================================================
// Utilidad de autenticación para cron jobs
// Acepta Authorization: Bearer $CRON_SECRET (Vercel Cron)
// o x-cron-secret: $CRON_SECRET (cron-job.org)
// ============================================================

export function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const cronHeader = request.headers.get("x-cron-secret");
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return authHeader === `Bearer ${secret}` || cronHeader === secret;
}
