import "./terms-of-service.css";

export const metadata = {
  title: "Terms & Conditions | Venezuela Voyages",
  description:
    "Terms and conditions of use for Venezuela Voyages. Information about bookings, payments, liability and applicable law.",
};

export default function TermsOfServicePage() {
  return (
    <div
      id="terms-of-service-container"
      className="mx-auto w-[90%] lg:mb-[80px] mb-[40px] mt-5"
    >
      <h1>Terms &amp; Conditions</h1>
      <p>
        <strong>Venezuela Voyages</strong>
      </p>

      <h2>1. Introduction</h2>
      <p>
        Welcome to Venezuela Voyages. By accessing and using our website, you
        accept these Terms and Conditions. If you do not agree with any
        provision, we recommend that you do not use our site.
      </p>

      <h2>2. Definitions</h2>
      <ol>
        <li>
          <b>Venezuela Voyages:</b> Travel agency with registered offices in
          Caracas, Miranda State, Venezuela.
        </li>
        <li>
          <b>User:</b> Any person who accesses and uses our website.
        </li>
        <li>
          <b>Services:</b> Includes searching for, booking and purchasing travel
          packages, flight tickets, accommodation and other travel-related
          services.
        </li>
      </ol>

      <h2>3. Use of the Website</h2>
      <p>
        Our website:{" "}
        <a href="https://www.venezuelavoyages.com">
          www.venezuelavoyages.com
        </a>{" "}
        is provided for commercial use related to travel planning and booking.
      </p>

      <h2>4. Registration and User Account</h2>
      <p>
        To access certain services you may need to register and create an
        account. You are responsible for keeping your account information
        confidential and for all activity that occurs under your account. Notify
        us immediately if you suspect any unauthorized use.
      </p>

      <h2>5. Bookings and Payments</h2>

      <h3>5.1 Booking Services</h3>
      <p>
        Bookings are confirmed upon receipt of payment. Prices are quoted in US
        dollars and may change without prior notice until payment is confirmed.
        Prices include accommodation and the services specified in the
        itinerary, but do not cover extras such as meals (not specified),
        gratuities, excess baggage, immigration procedures or any other item not
        detailed in the programme.
      </p>

      <h3>5.2 Payments</h3>
      <p>
        Payments can be made by credit card, deposit, bank transfer or other
        methods accepted on our site. Payments must be completed 60 days before
        arrival. Any change or addition of services during the trip must be paid
        directly by the traveller.
      </p>

      <h3>5.3 Documentation</h3>
      <p>
        Travellers must hold a valid passport and visas. Accurate personal
        information must be provided, such as full name, passport number,
        nationality, age and any medical condition or dietary preference.
      </p>

      <h2>6. Cancellation and Refund Policy</h2>
      <p>
        Cancellation and refund policies are detailed in our{" "}
        <a href="/return-policy">Return &amp; Refund Policy</a>.
      </p>

      <h2>7. Liability</h2>
      <p>
        Venezuela Voyages acts as an intermediary in organizing travel,
        coordinating transport, accommodation and activity services offered by
        third parties. We are not liable for damages, delays or other
        inconveniences arising from third-party services. Our liability is
        limited to the correct handling of bookings and to providing services in
        accordance with the descriptions given on the site.
      </p>

      <h2>8. Changes to the Service</h2>
      <p>
        We may modify, suspend or discontinue any part of our website or
        services at any time without prior notice. We may also amend these Terms
        and Conditions, and any change will take effect immediately upon
        publication on our website.
      </p>

      <h2>9. Links to Other Sites</h2>
      <p>
        Our site may contain links to third-party websites. We have no control
        over the content or practices of these sites and accept no
        responsibility for them. Access to these sites is at your own risk.
      </p>

      <h2>10. Applicable Law and Jurisdiction</h2>
      <p>
        These Terms and Conditions shall be governed by and construed in
        accordance with the laws of the Bolivarian Republic of Venezuela. Any
        dispute relating to these Terms and Conditions shall be subject to the
        exclusive jurisdiction of the courts of the Bolivarian Republic of
        Venezuela.
      </p>

      <h2>11. Contact</h2>
      <p>
        For any question or comment about these Terms and Conditions, please
        contact us at:
      </p>
      <p>
        Email:{" "}
        <strong>
          <a href="mailto:info@venezuelavoyages.com">
            info@venezuelavoyages.com
          </a>
        </strong>
      </p>
      <p>
        Phone:{" "}
        <strong>
          <a href="tel:+584264034052">+58 426 4034052</a>
        </strong>
      </p>
      <p>
        Thank you for trusting Venezuela Voyages. We are committed to protecting
        your personal information and to providing you with a safe and reliable
        service.
      </p>
    </div>
  );
}
