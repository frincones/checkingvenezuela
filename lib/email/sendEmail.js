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
*/
async function sendEmail(recipientEmails = [], subject = "", body) {
  const client = getMailjet();
  if (!client) {
    console.warn("Email not sent - Mailjet not configured");
    return;
  }
  try {
    await client.post("send", { version: "v3.1" }).request({
      Messages: [
        {
          From: {
            Email: process.env.MAIL_SENDER_EMAIL,
            Name: "Checking Venezuela",
          },
          To: recipientEmails,
          Subject: subject,
          HTMLPart: body,
        },
      ],
    });
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export default sendEmail;
