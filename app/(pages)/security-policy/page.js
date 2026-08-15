import "../privacy-policy/privacy-policy.css";

export const metadata = {
  title: "Security Policies | Venezuela Voyages",
  description:
    "Learn about Venezuela Voyages' security policies. Personal data protection, SSL encryption, PCI-DSS compliance and more.",
};

export default function SecurityPolicyPage() {
  return (
    <div
      id="privacy-policy-container"
      className="mx-auto w-[90%] lg:mb-[80px] mb-[40px] mt-5"
    >
      <h1>Security Policies</h1>
      <p>
        At <strong>Venezuela Voyages</strong>, the security of your personal
        data is one of our highest priorities. We implement advanced measures
        and follow industry best practices to ensure your information is
        protected and your experience as a user is safe.
      </p>

      <h2>Website Security</h2>

      <h3>Protection of Personal Information</h3>
      <p>
        We take every reasonable measure and precaution to protect your personal
        information. We use advanced encryption technologies to protect the
        information you share with us. All credit card information is encrypted
        using Secure Sockets Layer (SSL) technology, which ensures that
        transmitted data is protected against unauthorized access. In addition,
        we store information using AES-256 encryption, a high-security standard
        that keeps your data safe at rest.
      </p>

      <h3>PCI-DSS Compliance</h3>
      <p>
        We adhere to all requirements of the Payment Card Industry Data Security
        Standard (PCI-DSS). This ensures that we handle your credit card
        information in accordance with the most rigorous and up-to-date security
        standards.
      </p>

      <h2>Payment Security</h2>

      <h3>Payment Methods</h3>
      <p>
        The payment methods used by Venezuela Voyages are managed by third-party
        services. These third-party services comply with all the security and
        encryption standards required to keep your information safe during
        transactions.
      </p>

      <h3>Use of Information</h3>
      <p>
        Payment providers will only use the information necessary to complete
        the payment process. They do not use the information for any other
        purpose. We recommend reviewing the Privacy Policies of these providers
        to understand how they handle and protect the information you give them.
      </p>

      <h2>Security Recommendations</h2>

      <h3>Additional Measures</h3>
      <p>
        In addition to our security practices, we recommend adopting further
        measures to protect your data, such as using strong passwords and
        avoiding sharing confidential information.
      </p>

      <h3>Contact and Support</h3>
      <p>
        If you have any questions about our security policies or need
        assistance, please do not hesitate to contact us at our email address:{" "}
        <strong>
          <a href="mailto:info@venezuelavoyages.com">
            info@venezuelavoyages.com
          </a>
        </strong>
        . We are here to help and to resolve any concerns you may have.
      </p>

      <h2>Updates</h2>
      <p>
        We reserve the right to update our security policies at any time. Any
        change will be published on this page, and we will notify you
        appropriately about significant changes.
      </p>
    </div>
  );
}
