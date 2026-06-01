// ============================================================
// Política de Privacidad — Página pública (sin auth)
// Requerida por Google para publicar la app OAuth.
// ============================================================

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidad — CLAUDIO",
  description: "Política de privacidad de CLAUDIO, app personal de uso privado.",
};

export default function PrivacyPage() {
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
          Política de Privacidad
        </h1>
        <p className="text-sm text-on-surface-variant mb-10">
          Última actualización: 1 de junio de 2026
        </p>

        <div className="space-y-6 text-sm text-on-surface-variant leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-on-surface mb-2">
              Qué es CLAUDIO
            </h2>
            <p>
              CLAUDIO es una aplicación personal de uso privado que centraliza
              información de sueño, fitness, nutrición, proyectos, ideas,
              finanzas y agenda de un único usuario. No es un servicio comercial
              ni está abierto al registro público.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-on-surface mb-2">
              Datos que recopilamos
            </h2>
            <p>
              Recopilamos únicamente los datos necesarios para el funcionamiento
              de la app: nombre, correo electrónico e imagen de perfil de tu
              cuenta de Google, y la información que vos mismo registrás dentro
              de la aplicación (hábitos, actividades, eventos, notas).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-on-surface mb-2">
              Uso de Google Calendar y datos de Google
            </h2>
            <p>
              Con tu autorización, la app accede a tu Google Calendar para leer
              tus eventos y crear o modificar eventos a pedido tuyo. Esta
              información se usa exclusivamente para brindarte recordatorios y
              gestionar tu agenda dentro de la app. No vendemos, compartimos ni
              transferimos tus datos de Google a terceros, y su uso se adhiere a
              la Política de Datos de Usuario de los Servicios de la API de
              Google, incluidos los requisitos de uso limitado.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-on-surface mb-2">
              Almacenamiento y seguridad
            </h2>
            <p>
              Los datos se almacenan en una base de datos privada y los tokens
              de acceso se guardan de forma segura. El acceso a la app está
              restringido a cuentas autorizadas. No usamos los datos con fines
              publicitarios.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-on-surface mb-2">
              Eliminación de datos
            </h2>
            <p>
              Podés revocar el acceso de la app a tu cuenta de Google en
              cualquier momento desde la configuración de seguridad de tu cuenta
              de Google. También podés solicitar la eliminación de tus datos
              escribiendo al correo de contacto.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-on-surface mb-2">
              Contacto
            </h2>
            <p>
              Ante cualquier consulta sobre esta política, escribí a{" "}
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
