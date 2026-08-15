import "./privacy-policy.css";

export const metadata = {
  title: "Privacy Policy | Venezuela Voyages",
  description:
    "Venezuela Voyages privacy policy. Learn how we collect, use and protect your personal information.",
};

export default function PrivacyPolicyPage() {
  return (
    <div
      id="privacy-policy-container"
      className="mx-auto w-[90%] lg:mb-[80px] mb-[40px] mt-5"
    >
      <h1>Privacy Policy</h1>
      <p>
        <strong>Venezuela Voyages</strong>
      </p>

      <p>
        At Venezuela Voyages, protecting your personal information is
        fundamental. This policy describes how we collect, use and protect the
        data you provide when using our website{" "}
        <a href="https://www.venezuelavoyages.com">
          www.venezuelavoyages.com
        </a>
        .
      </p>

      <h2>1. Information We Collect</h2>

      <h3>1.1 Information You Provide</h3>
      <ol>
        <li>
          <b>Account information:</b> Full name, email address, phone number.
        </li>
        <li>
          <b>Profile data:</b> Profile picture and cover photo.
        </li>
        <li>
          <b>Search and booking data:</b> Flight, hotel and travel package
          queries, booking details.
        </li>
        <li>
          <b>Subscription:</b> Email address provided to receive updates and
          promotions.
        </li>
        <li>
          <b>Documentation:</b> Full name, passport number, nationality, age,
          gender and any medical condition or dietary preference required for
          the booking.
        </li>
      </ol>

      <h3>1.2 Information Collected Automatically</h3>
      <ol>
        <li>
          <b>Cookies:</b> We use cookies to track the user&apos;s time zone and
          personalise flight times. Temporary cookies are also used for email
          verification and password reset.
        </li>
        <li>
          <b>Analytics data:</b> Visitor behaviour data is collected through
          analytics services to improve the user experience.
        </li>
      </ol>

      <h3>1.3 Third-Party Services</h3>
      <ol>
        <li>
          <b>Resend:</b> Used to send transactional emails and communications.
        </li>
        <li>
          <b>Supabase:</b> Storage of user data, bookings and images.
        </li>
        <li>
          <b>Stripe:</b> Secure payment processing.
        </li>
        <li>
          <b>Vercel:</b> Platform hosting and analytics.
        </li>
      </ol>

      <h2>2. How We Use Your Information</h2>
      <ol>
        <li>
          To provide and improve our flight, hotel and travel package booking
          services.
        </li>
        <li>
          To send updates, verifications, quotes and relevant communications.
        </li>
        <li>
          To personalise search results according to your preferences and
          location.
        </li>
        <li>To coordinate services with authorized travel providers.</li>
      </ol>

      <h2>3. Sharing of Information</h2>
      <p>
        <b>We may share your data with:</b>
      </p>
      <ol>
        <li>
          <b>Service providers:</b> Airlines, hotels, tour operators and
          transport providers required to fulfil your booking.
        </li>
        <li>
          <b>Technology services:</b> Resend, Supabase, Stripe and analytics
          services used to operate our platform.
        </li>
        <li>
          <b>Legal authorities:</b> As required by applicable Venezuelan law.
        </li>
      </ol>

      <h2>4. Cookies and Tracking</h2>
      <p>
        We use cookies to track the user&apos;s time zone, display local times
        and manage email verification and password reset processes. You can
        control cookies through your browser settings.
      </p>
      <p>
        We also use third-party analytics tools to understand how our site is
        used and to improve the experience:
      </p>
      <ol>
        <li>
          <b>Google Analytics 4:</b> records visits, page views and aggregated
          navigation events. Data is processed by Google. You can review{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google&apos;s privacy policy
          </a>
          .
        </li>
        <li>
          <b>Microsoft Clarity:</b> records anonymous interactions (cursor
          movement, clicks and scrolls) to generate heatmaps and aggregated
          recordings that help us detect usability problems. Data is processed
          by Microsoft. You can review{" "}
          <a
            href="https://privacy.microsoft.com/en-us/privacystatement"
            target="_blank"
            rel="noopener noreferrer"
          >
            Microsoft&apos;s privacy policy
          </a>
          . We configure Clarity to automatically mask form field text, so that
          sensitive data such as emails, passwords or payment information is
          never recorded.
        </li>
        <li>
          <b>Vercel Analytics:</b> measures site performance metrics (Core Web
          Vitals) without collecting personal information.
        </li>
      </ol>
      <p>
        You can disable these tools using tracker-blocking extensions in your
        browser or through its &ldquo;Do Not Track&rdquo; setting.
      </p>

      <h2>5. Data Security</h2>
      <p>
        We take reasonable measures to protect your personal information. We use
        advanced encryption technologies, including SSL for data in transit and
        AES-256 for data at rest. For more information, see our{" "}
        <a href="/security-policy">Security Policies</a>.
      </p>

      <h2>6. Your Rights</h2>
      <ol>
        <li>Access, correct or delete your personal data.</li>
        <li>Withdraw consent for email communications.</li>
        <li>
          Request information about how your personal data is processed.
        </li>
      </ol>
      <p>
        For requests, contact us at:{" "}
        <strong>
          <a href="mailto:info@venezuelavoyages.com">
            info@venezuelavoyages.com
          </a>
        </strong>
      </p>

      <h2>7. Updates to This Policy</h2>
      <p>
        We reserve the right to update this Privacy Policy. Any change will be
        published on this page with an updated effective date.
      </p>

      <h2>8. Contact</h2>
      <p>
        For privacy-related enquiries, contact us at:{" "}
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
    </div>
  );
}
