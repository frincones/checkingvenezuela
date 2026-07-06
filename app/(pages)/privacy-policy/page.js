import "./privacy-policy.css";

export const metadata = {
  title: "Política de Privacidad | Venezuela Voyages",
  description:
    "Política de privacidad de Venezuela Voyages. Conoce cómo recopilamos, usamos y protegemos tu información personal.",
};

export default function PrivacyPolicyPage() {
  return (
    <div
      id="privacy-policy-container"
      className="mx-auto w-[90%] lg:mb-[80px] mb-[40px] mt-5"
    >
      <h1>Política de Privacidad</h1>
      <p>
        <strong>Venezuela Voyages</strong>
      </p>

      <p>
        En Venezuela Voyages, la protección de tu información personal es
        fundamental. Esta política describe cómo recopilamos, utilizamos y
        protegemos los datos que nos proporcionas al usar nuestro sitio web{" "}
        <a href="https://www.venezuelavoyages.com">
          www.venezuelavoyages.com
        </a>
        .
      </p>

      <h2>1. Información que Recopilamos</h2>

      <h3>1.1 Información que Proporcionas</h3>
      <ol>
        <li>
          <b>Información de Cuenta:</b> Nombre completo, correo electrónico,
          número de teléfono.
        </li>
        <li>
          <b>Datos de Perfil:</b> Foto de perfil y foto de portada.
        </li>
        <li>
          <b>Datos de Búsqueda y Reservas:</b> Consultas de vuelos, hoteles y
          paquetes turísticos, detalles de reservas.
        </li>
        <li>
          <b>Suscripción:</b> Correo electrónico proporcionado para recibir
          actualizaciones y promociones.
        </li>
        <li>
          <b>Documentación:</b> Nombre completo, número de pasaporte,
          nacionalidad, edad, sexo y cualquier condición médica o preferencia
          alimentaria necesaria para la reserva.
        </li>
      </ol>

      <h3>1.2 Información Recopilada Automáticamente</h3>
      <ol>
        <li>
          <b>Cookies:</b> Utilizamos cookies para rastrear la zona horaria del
          usuario y personalizar horarios de vuelos. También se usan cookies
          temporales para verificación de email y restablecimiento de
          contraseña.
        </li>
        <li>
          <b>Datos de Analítica:</b> Se recopilan datos de comportamiento de
          visitantes mediante servicios de analítica para mejorar la experiencia
          del usuario.
        </li>
      </ol>

      <h3>1.3 Servicios de Terceros</h3>
      <ol>
        <li>
          <b>Resend:</b> Utilizado para el envío de correos electrónicos
          transaccionales y comunicaciones.
        </li>
        <li>
          <b>Supabase:</b> Almacenamiento de datos de usuario, reservas e
          imágenes.
        </li>
        <li>
          <b>Stripe:</b> Procesamiento seguro de pagos.
        </li>
        <li>
          <b>Vercel:</b> Hosting y analítica de la plataforma.
        </li>
      </ol>

      <h2>2. Cómo Utilizamos tu Información</h2>
      <ol>
        <li>
          Proporcionar y mejorar nuestros servicios de reserva de vuelos,
          hoteles y paquetes turísticos.
        </li>
        <li>
          Enviar actualizaciones, verificaciones, cotizaciones y comunicaciones
          relevantes.
        </li>
        <li>
          Personalizar resultados de búsqueda según tus preferencias y
          ubicación.
        </li>
        <li>Coordinar servicios con proveedores turísticos autorizados.</li>
      </ol>

      <h2>3. Compartición de Información</h2>
      <p>
        <b>Podemos compartir tus datos con:</b>
      </p>
      <ol>
        <li>
          <b>Proveedores de Servicios:</b> Aerolíneas, hoteles, operadores
          turísticos y proveedores de transporte necesarios para cumplir con tu
          reserva.
        </li>
        <li>
          <b>Servicios Tecnológicos:</b> Resend, Supabase, Stripe y servicios de
          analítica para operar nuestra plataforma.
        </li>
        <li>
          <b>Autoridades Legales:</b> Según lo requiera la ley venezolana
          aplicable.
        </li>
      </ol>

      <h2>4. Cookies y Seguimiento</h2>
      <p>
        Utilizamos cookies para rastrear la zona horaria del usuario, mostrar
        horarios locales y gestionar procesos de verificación de correo
        electrónico y restablecimiento de contraseña. Puedes controlar las
        cookies a través de la configuración de tu navegador.
      </p>
      <p>
        Además, utilizamos herramientas de análisis de terceros para entender
        cómo se usa nuestro sitio y mejorar la experiencia:
      </p>
      <ol>
        <li>
          <b>Google Analytics 4:</b> registra visitas, páginas vistas y eventos
          agregados de navegación. Los datos se procesan por Google. Puedes
          consultar la{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            política de privacidad de Google
          </a>
          .
        </li>
        <li>
          <b>Microsoft Clarity:</b> registra interacciones anónimas
          (movimientos del cursor, clicks y scrolls) para generar mapas de
          calor y grabaciones agregadas que nos ayudan a detectar problemas de
          usabilidad. Los datos se procesan por Microsoft. Puedes consultar la{" "}
          <a
            href="https://privacy.microsoft.com/es-es/privacystatement"
            target="_blank"
            rel="noopener noreferrer"
          >
            política de privacidad de Microsoft
          </a>
          . Configuramos Clarity para enmascarar automáticamente el texto de
          los campos de formulario, de modo que datos sensibles como emails,
          contraseñas o información de pago no queden registrados.
        </li>
        <li>
          <b>Vercel Analytics:</b> mide métricas de rendimiento (Core Web
          Vitals) del sitio, sin recopilar información personal.
        </li>
      </ol>
      <p>
        Puedes deshabilitar estas herramientas mediante extensiones de bloqueo
        de rastreadores en tu navegador o mediante la configuración de
        &ldquo;Do Not Track&rdquo; del mismo.
      </p>

      <h2>5. Seguridad de Datos</h2>
      <p>
        Tomamos medidas razonables para proteger tu información personal.
        Utilizamos tecnologías de cifrado avanzadas, incluyendo SSL para datos
        en tránsito y AES-256 para datos en reposo. Para más información,
        consulta nuestras{" "}
        <a href="/security-policy">Políticas de Seguridad</a>.
      </p>

      <h2>6. Derechos del Usuario</h2>
      <ol>
        <li>Acceder, corregir o eliminar tus datos personales.</li>
        <li>Retirar el consentimiento para comunicaciones por correo.</li>
        <li>
          Solicitar información sobre cómo se procesan tus datos personales.
        </li>
      </ol>
      <p>
        Para solicitudes, contáctanos en:{" "}
        <strong>
          <a href="mailto:info@venezuelavoyages.com">
            info@venezuelavoyages.com
          </a>
        </strong>
      </p>

      <h2>7. Actualizaciones de esta Política</h2>
      <p>
        Nos reservamos el derecho de actualizar esta Política de Privacidad.
        Cualquier cambio será publicado en esta página con la fecha de vigencia
        actualizada.
      </p>

      <h2>8. Contacto</h2>
      <p>
        Para consultas relacionadas con privacidad, contáctanos en:{" "}
        <strong>
          <a href="mailto:info@venezuelavoyages.com">
            info@venezuelavoyages.com
          </a>
        </strong>
      </p>
      <p>
        Teléfono:{" "}
        <strong>
          <a href="tel:+584264034052">+58 426 4034052</a>
        </strong>
      </p>
    </div>
  );
}
