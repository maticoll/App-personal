// ============================================================
// Condiciones del Servicio — Página pública (sin auth)
// Requerida por Google para publicar la app OAuth.
// ============================================================

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Condiciones del Servicio — CLAUDIO",
  description: "Condiciones del servicio de CLAUDIO, app personal de uso privado.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="w-full max-w-2xl mx-auto">
        <Link
          href="/"
          className="text-sm text-accent hover:underline mb-8 inline-block"
        >
          ← Volver
        </Link>

        <h1 className="text-3xl font-bold text-on-surface mb-2">
          Condiciones del Servicio
        </h1>
        <p className="text-sm text-on-surface-variant mb-10">
          Última actualización: 1 de junio de 2026
        </p>

        <div className="space-y-6 text-sm text-on-surface-variant leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-on-surface mb-2">
              1. Aceptación
            </h2>
            <p>
              CLAUDIO es una aplicación personal de uso privado. Al utilizarla,
              aceptás estas condiciones. La app está destinada únicamente al uso
              de su titular y de las cuentas expresamente autorizadas.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-on-surface mb-2">
              2. Uso del servicio
            </h2>
            <p>
              La app se ofrece &quot;tal cual&quot;, para organizar información
              personal y gestionar la agenda del usuario. No debe usarse con
              fines ilícitos ni para almacenar información de terceros sin su
              consentimiento.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-on-surface mb-2">
              3. Integraciones de terceros
            </h2>
            <p>
              La app puede conectarse a servicios externos (como Google
              Calendar) con tu autorización. El uso de esos servicios se rige
              además por sus propias condiciones y políticas. Podés revocar el
              acceso en cualquier momento.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-on-surface mb-2">
              4. Disponibilidad
            </h2>
            <p>
              Al tratarse de un proyecto personal, no se garantiza
              disponibilidad continua ni ausencia de errores. El servicio puede
              modificarse o discontinuarse sin previo aviso.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-on-surface mb-2">
              5. Limitación de responsabilidad
            </h2>
            <p>
              La app se provee sin garantías de ningún tipo. El titular no se
              responsabiliza por pérdidas de datos ni por decisiones tomadas en
              base a la información mostrada.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-on-surface mb-2">
              6. Contacto
            </h2>
            <p>
              Ante cualquier consulta, escribí a{" "}
              <a
                href="mailto:maticoll.dale@gmail.com"
                className="text-accent hover:underline"
              >
                maticoll.dale@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
