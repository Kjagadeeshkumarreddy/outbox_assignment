import nodemailer from 'nodemailer';

async function test() {
  try {
    console.log('Creating Ethereal account...');
    const acc = await nodemailer.createTestAccount();
    console.log('Account created:', acc.user);
    const trans = nodemailer.createTransport({
      host: acc.smtp.host,
      port: acc.smtp.port,
      secure: acc.smtp.secure,
      auth: {
        user: acc.user,
        pass: acc.pass,
      },
    });

    const info = await trans.sendMail({
      from: acc.user,
      to: 'recipient@example.com',
      subject: 'Test ReachInbox Email',
      html: '<b>Hello from ReachInbox Scheduler</b>',
    });

    console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
  } catch (err: any) {
    console.error('Test error:', err);
  }
}

test();
