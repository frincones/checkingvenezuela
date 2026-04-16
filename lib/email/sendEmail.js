import Mailjet from "node-mailjet";

let mailjet = null;

function getMailjet() {
  if (!process.env.MAIL_API_TOKEN || !process.env.MAIL_SECRET_TOKEN) {
    console.warn("Mailjet credentials not configured - email features disabled");
    return null;
  }
  if (!mailjet) {
    mailjet = new Mailjet({
      apiKey: process.env.MAIL_API_TOKEN,
      apiSecret: process.env.MAIL_SECRET_TOKEN,
    });
  }
  return mailjet;
}

/**
 * @param {Array} recipientEmails array of objects
 * @example
  recipientEmails: [{
    Email: "email@mail.com",
    Name: "name" //optional
}]
 * @param {String} subject
 * @param {String} body
 * @param {Array} [attachments] optional array of Mailjet attachment objects
 * @example
  attachments: [{
    ContentType: "application/pdf",
    Filename: "voucher.pdf",
    Base64Content: "<base64-encoded bytes>"
  }]
*/
async function sendEmail(recipientEmails = [], subject = "", body, attachments = []) {
  const client = getMailjet();
  if (!client) {
    console.warn("Email not sent - Mailjet not configured");
    return;
  }
  try {
    const message = {
      From: {
        Email: process.env.MAIL_SENDER_EMAIL,
        Name: "Venezuela Voyages",
      },
      To: recipientEmails,
      Subject: subject,
      HTMLPart: body,
    };

    if (attachments.length > 0) {
      message.Attachments = attachments;
    }

    await client.post("send", { version: "v3.1" }).request({
      Messages: [message],
    });
  } catch (error) {
    console.error("Mailjet sendEmail error:", error);
    const msg = error?.message || error?.statusCode?.toString() || "";
    if (/size|too large|payload|limit|413/i.test(msg)) {
      throw new Error(
        "El correo excede el límite de tamaño de Mailjet (15 MB). Reduce el tamaño de los adjuntos."
      );
    }
    throw error;
  }
}

export default sendEmail;
