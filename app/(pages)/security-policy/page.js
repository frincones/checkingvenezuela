import "../privacy-policy/privacy-policy.css";

export const metadata = {
  title: "Políticas de Seguridad | Venezuela Voyages",
  description:
    "Conoce las políticas de seguridad de Venezuela Voyages. Protección de datos personales, cifrado SSL, cumplimiento PCI-DSS y más.",
};

export default function SecurityPolicyPage() {
  return (
    <div
      id="privacy-policy-container"
      className="mx-auto w-[90%] lg:mb-[80px] mb-[40px] mt-5"
    >
      <h1>Políticas de Seguridad</h1>
      <p>
        En <strong>Venezuela Voyages</strong>, la seguridad de tus datos
        personales es una de nuestras principales prioridades. Implementamos
        medidas avanzadas y seguimos las mejores prácticas de la industria para
        garantizar que tu información esté protegida y que tu experiencia de
        usuario sea segura.
      </p>

      <h2>Seguridad del Sitio Web</h2>

      <h3>Protección de Información Personal</h3>
      <p>
        Tomamos todas las medidas y precauciones razonables para proteger tu
        información personal. Utilizamos tecnologías de cifrado avanzadas para
        proteger la información que compartes con nosotros. Toda la información
        de tu tarjeta de crédito es cifrada mediante la tecnología de capa de
        puertos seguros (SSL), lo que garantiza que los datos transmitidos estén
        protegidos contra accesos no autorizados. Además, almacenamos la
        información con cifrado AES-256, un estándar de alta seguridad que
        asegura tus datos en reposo.
      </p>

      <h3>Cumplimiento de PCI-DSS</h3>
      <p>
        Nos adherimos a todos los requisitos del Estándar de Seguridad de Datos
        para la Industria de Tarjetas de Pago (PCI-DSS). Esto asegura que
        manejamos la información de tu tarjeta de crédito de acuerdo con los
        estándares de seguridad más rigurosos y actualizados.
      </p>

      <h2>Seguridad en Pagos</h2>

      <h3>Métodos de Pago</h3>
      <p>
        Los métodos de pago utilizados por Venezuela Voyages son gestionados por
        servicios de terceros. Estos servicios de terceros cumplen con todos los
        estándares de seguridad y cifrado necesarios para mantener tu
        información segura durante las transacciones.
      </p>

      <h3>Uso de la Información</h3>
      <p>
        Los proveedores de pagos solo utilizarán la información necesaria para
        completar el proceso de pago. No emplean la información para otros
        fines. Recomendamos que revises las Políticas de Privacidad de estos
        proveedores para entender cómo manejan y protegen la información que les
        proporcionas.
      </p>

      <h2>Recomendaciones de Seguridad</h2>

      <h3>Medidas Adicionales</h3>
      <p>
        Además de nuestras prácticas de seguridad, te recomendamos adoptar
        medidas adicionales para proteger tus datos, como utilizar contraseñas
        seguras y evitar compartir información confidencial.
      </p>

      <h3>Contacto y Asistencia</h3>
      <p>
        Si tienes alguna pregunta sobre nuestras políticas de seguridad o
        necesitas asistencia, no dudes en ponerte en contacto con nosotros a
        través de nuestro correo electrónico de contacto:{" "}
        <strong>
          <a href="mailto:info@venezuelavoyages.com">
            info@venezuelavoyages.com
          </a>
        </strong>
        . Estamos aquí para ayudarte y resolver cualquier inquietud que puedas
        tener.
      </p>

      <h2>Actualizaciones</h2>
      <p>
        Nos reservamos el derecho de actualizar nuestras políticas de seguridad
        en cualquier momento. Cualquier cambio será publicado en esta página, y
        te notificaremos adecuadamente sobre los cambios importantes.
      </p>
    </div>
  );
}
