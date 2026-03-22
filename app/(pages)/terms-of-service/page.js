import "./terms-of-service.css";

export const metadata = {
  title: "Términos y Condiciones | Venezuela Voyages",
  description:
    "Términos y condiciones de uso de Venezuela Voyages. Información sobre reservas, pagos, responsabilidades y legislación aplicable.",
};

export default function TermsOfServicePage() {
  return (
    <div
      id="terms-of-service-container"
      className="mx-auto w-[90%] lg:mb-[80px] mb-[40px] mt-5"
    >
      <h1>Términos y Condiciones</h1>
      <p>
        <strong>Venezuela Voyages</strong>
      </p>

      <h2>1. Introducción</h2>
      <p>
        Bienvenido a Venezuela Voyages. Al acceder y utilizar nuestro sitio web,
        aceptas estos Términos y Condiciones. Si no estás de acuerdo con alguna
        disposición, te recomendamos que no utilices nuestro sitio.
      </p>

      <h2>2. Definiciones</h2>
      <ol>
        <li>
          <b>Venezuela Voyages:</b> Agencia de viajes con domicilio en Caracas,
          Edo. Miranda, Venezuela.
        </li>
        <li>
          <b>Usuario:</b> Persona que accede y utiliza nuestro sitio web.
        </li>
        <li>
          <b>Servicios:</b> Incluye la búsqueda, reserva y compra de paquetes
          turísticos, boletos de avión, alojamiento y otros servicios
          relacionados con viajes.
        </li>
      </ol>

      <h2>3. Uso del Sitio Web</h2>
      <p>
        Nuestro sitio web:{" "}
        <a href="https://www.venezuelavoyages.com">
          www.venezuelavoyages.com
        </a>{" "}
        se proporciona para uso comercial relacionado con la planificación y
        reserva de viajes.
      </p>

      <h2>4. Registro y Cuenta de Usuario</h2>
      <p>
        Para acceder a ciertos servicios, es posible que debas registrarte y
        crear una cuenta. Eres responsable de mantener la confidencialidad de tu
        información de cuenta y de todas las actividades que ocurran bajo tu
        cuenta. Notifícanos de inmediato si sospechas de cualquier uso no
        autorizado.
      </p>

      <h2>5. Reservas y Pagos</h2>

      <h3>5.1 Reserva de Servicios</h3>
      <p>
        Las reservas se confirman al recibir el pago. Los precios están
        expresados en dólares y pueden cambiar sin previo aviso hasta que se
        confirme el pago. Los precios incluyen alojamiento y los servicios
        especificados en el itinerario, pero no cubren extras como alimentos (no
        especificados), propinas, exceso de equipaje, trámites migratorios u
        otros conceptos no detallados en el programa.
      </p>

      <h3>5.2 Pagos</h3>
      <p>
        Los pagos pueden realizarse mediante tarjeta de crédito, depósito,
        transferencia bancaria u otros métodos aceptados en nuestro sitio. Los
        pagos deben completarse 60 días antes de la llegada. Cualquier cambio o
        adición de servicios durante el viaje debe ser pagado directamente por
        el pasajero.
      </p>

      <h3>5.3 Documentación</h3>
      <p>
        Los pasajeros deben tener pasaporte y visas vigentes. Se requiere
        proporcionar información personal precisa, como nombre completo, número
        de pasaporte, nacionalidad, edad y cualquier condición médica o
        preferencia alimentaria.
      </p>

      <h2>6. Política de Cancelación y Reembolsos</h2>
      <p>
        Las políticas de cancelación y reembolsos están detalladas en nuestra{" "}
        <a href="/return-policy">Política de Devolución y Reembolso</a>.
      </p>

      <h2>7. Responsabilidad</h2>
      <p>
        Venezuela Voyages actúa como intermediario en la organización de viajes,
        coordinando servicios de transporte, alojamiento y actividades ofrecidos
        por terceros. No somos responsables por daños, demoras u otros
        inconvenientes derivados de los servicios de terceros. Nuestra
        responsabilidad se limita a la correcta gestión de las reservas y a la
        prestación de servicios conforme a las descripciones proporcionadas en
        el sitio.
      </p>

      <h2>8. Modificaciones del Servicio</h2>
      <p>
        Podemos modificar, suspender o interrumpir cualquier parte de nuestro
        sitio web o servicios en cualquier momento sin previo aviso. También
        podemos modificar estos Términos y Condiciones, y cualquier cambio será
        efectivo inmediatamente después de su publicación en nuestro sitio web.
      </p>

      <h2>9. Enlaces a Otros Sitios</h2>
      <p>
        Nuestro sitio puede contener enlaces a sitios web de terceros. No
        tenemos control sobre el contenido o las prácticas de estos sitios y no
        asumimos ninguna responsabilidad por ellos. El acceso a estos sitios se
        realiza bajo tu propio riesgo.
      </p>

      <h2>10. Legislación Aplicable y Jurisdicción</h2>
      <p>
        Estos Términos y Condiciones se regirán e interpretarán de acuerdo con
        las leyes de La República Bolivariana de Venezuela. Cualquier disputa
        relacionada con estos Términos y Condiciones estará sujeta a la
        jurisdicción exclusiva de los tribunales de La República Bolivariana de
        Venezuela.
      </p>

      <h2>11. Contacto</h2>
      <p>
        Para cualquier pregunta o comentario sobre estos Términos y Condiciones,
        por favor contáctanos en:
      </p>
      <p>
        Correo electrónico:{" "}
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
      <p>
        Gracias por confiar en Venezuela Voyages. Nos comprometemos a proteger
        tu información personal y a proporcionarte un servicio seguro y
        confiable.
      </p>
    </div>
  );
}
