import "../privacy-policy/privacy-policy.css";

export const metadata = {
  title: "Política de Devolución y Reembolso | Venezuela Voyages",
  description:
    "Conoce nuestra política de devolución y reembolso. Información sobre cancelaciones, cambios y reembolsos en Venezuela Voyages.",
};

export default function ReturnPolicyPage() {
  return (
    <div
      id="privacy-policy-container"
      className="mx-auto w-[90%] lg:mb-[80px] mb-[40px] mt-5"
    >
      <h1>Política de Devolución y Reembolso</h1>
      <p>
        <strong>Venezuela Voyages</strong>
      </p>

      <p>
        Venezuela Voyages actúa únicamente como intermediario en la organización
        de viajes. Su función es coordinar los servicios de transporte,
        alojamiento y actividades turísticas ofrecidos por terceros, como líneas
        aéreas, hoteles y agencias de turismo. Venezuela Voyages no tiene
        control sobre estas empresas y, por lo tanto, no se responsabiliza por
        daños, demoras u otros inconvenientes derivados de los servicios de
        terceros. La agencia organiza los servicios en nombre de sus clientes y
        se reserva el derecho de aceptar o rechazar reservas y de modificar o
        cancelar servicios según las circunstancias.
      </p>

      <h2>Precios y Tarifas</h2>
      <p>
        Los precios están expresados en dólares y pueden cambiar sin previo
        aviso hasta que se confirme el pago. Incluyen alojamiento en habitación
        y los servicios especificados, pero no cubren extras como alimentos no
        especificados, propinas, exceso de equipaje, trámites migratorios u
        otros conceptos no detallados en el programa.
      </p>

      <h2>Itinerario</h2>
      <p>
        Aunque los itinerarios se planifican cuidadosamente, pueden ser
        modificados debido a factores operacionales como condiciones climáticas
        u horarios de transporte. Los cambios se realizan para asegurar el mejor
        desarrollo del viaje y pueden no ser notificados con antelación.
      </p>

      <h2>Reservaciones y Pagos</h2>
      <p>
        Las reservas se confirman al recibir el pago total. Los pagos deben
        completarse 60 días antes de la llegada. Cualquier cambio o adición de
        servicios durante el viaje se paga directamente por el pasajero.
      </p>

      <h2>Métodos de Pago</h2>
      <p>
        Los pagos se pueden realizar mediante depósito, transferencia bancaria o
        directamente en el sitio web de Venezuela Voyages.
      </p>

      <h2>Documentación</h2>
      <p>
        Los pasajeros deben tener su pasaporte y visas vigentes. Se requiere
        información personal como nombre completo, número de pasaporte,
        nacionalidad, edad y sexo, así como cualquier condición médica o
        preferencia alimentaria.
      </p>

      <h2>Política de Reembolsos y Devoluciones</h2>

      <h3>Anticipo y Servicios No Utilizados</h3>
      <p>
        El anticipo pagado no es reembolsable bajo ninguna circunstancia. Los
        servicios no utilizados por los pasajeros tampoco son reembolsables.
      </p>

      <h3>No Presentación y Cancelaciones</h3>
      <p>
        No se concede reembolso en caso de no presentación del pasajero o
        cancelación durante el viaje. Tampoco se reembolsarán partes de
        servicios turísticos no utilizadas.
      </p>

      <h3>Cambios y Modificaciones</h3>
      <p>
        Los cambios de nombre, fecha, hora, itinerario o cancelaciones pueden
        incurrir en cargos adicionales, sujetos a las condiciones del servicio.
        En casos extremos, como enfermedad o fallecimiento, las cancelaciones y
        reembolsos estarán sujetos a las condiciones de la tarifa o servicio
        comprado y a las políticas del proveedor.
      </p>

      <h3>Servicios Aéreos y Otros Servicios</h3>
      <p>
        Las cancelaciones de servicios turísticos que incluyan transporte aéreo,
        en bus o tren ya emitidos no son reembolsables. En su lugar, se puede
        ofrecer un boleto abierto con vigencia de un año desde la fecha de
        emisión. Ciertos servicios pueden ser interrumpidos o cancelados por
        condiciones climáticas, disturbios u otras razones fuera del control de
        Venezuela Voyages o los proveedores de servicios. En estos casos, no se
        otorgará reembolso.
      </p>

      <h3>Restricciones de Viaje</h3>
      <p>
        En caso de cancelación debido a restricciones de viaje al país de
        destino, el boleto emitido quedará abierto con vigencia de un año a
        partir de la fecha de emisión. Este boleto es intransferible e
        intercambiable. Si la cancelación ocurre después de la fecha de vigencia
        de la tarifa, el depósito no será reembolsable y estará sujeto a las
        políticas de cancelación de la aerolínea o proveedor correspondiente.
      </p>

      <h2>Contacto</h2>
      <p>
        Para cualquier consulta sobre esta política, contáctanos en:{" "}
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
