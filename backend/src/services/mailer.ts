import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../config';

let transporterPromise: Promise<Transporter> | null = null;
let etherealCredentials: { user: string; pass: string } | null = null;

async function getTransporter(): Promise<Transporter> {
  if (transporterPromise) {
    return transporterPromise;
  }

  transporterPromise = (async () => {
    let user = config.smtp.user?.trim() || '';
    let pass = config.smtp.pass?.trim() || '';
    let host = config.smtp.host;
    let port = config.smtp.port;
    let secure = port === 465;

    if (user.endsWith('@gmail.com')) {
      host = 'smtp.gmail.com';
      port = 465;
      secure = true;
      pass = pass.replace(/\s+/g, '');
    } else if (!user || !pass) {
      if (!etherealCredentials) {
        const testAccount = await nodemailer.createTestAccount();
        etherealCredentials = {
          user: testAccount.user,
          pass: testAccount.pass,
        };
        console.log(`Created Ethereal test account: ${testAccount.user}`);
      }
      user = etherealCredentials.user;
      pass = etherealCredentials.pass;
      host = 'smtp.ethereal.email';
      port = 587;
      secure = false;
    }

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });
  })();

  return transporterPromise;
}

export async function sendEmail({
  to,
  from,
  subject,
  html,
}: {
  to: string;
  from: string;
  subject: string;
  html: string;
}): Promise<{ messageId: string; etherealUrl: string | null }> {
  const transporter = await getTransporter();
  const authUser = config.smtp.user?.trim() || etherealCredentials?.user;

  let displayName = 'ReachInbox';
  if (from && from !== 'noreply@reachinbox-scheduler.test') {
    if (from.includes('<') && from.includes('>')) {
      const match = from.match(/^"?([^"<]+)"?\s*<([^>]+)>/);
      if (match) displayName = match[1].trim();
    } else if (from.includes('@')) {
      const prefix = from.split('@')[0];
      displayName = prefix
        .split(/[._-]/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    } else {
      displayName = from.trim();
    }
  }

  const formattedFrom = authUser ? `"${displayName}" <${authUser}>` : from;

  const info = await transporter.sendMail({
    from: formattedFrom,
    replyTo: from.includes('@') ? from : authUser,
    to,
    subject,
    html,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  const etherealUrl = previewUrl ? (previewUrl as string) : null;

  return {
    messageId: info.messageId,
    etherealUrl,
  };
}
