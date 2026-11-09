import nodemailer from 'nodemailer';
import { Config } from '../models/Config.js';

/**
 * Resolves the active SMTP configuration from either Database (Config)
 * or environment variables as fallback.
 */
export const getActiveSmtpConfig = async () => {
  try {
    const config = await Config.findOne({ key: 'app' });
    const dbSmtp = config?.smtpConfig;

    if (dbSmtp && dbSmtp.host && dbSmtp.user) {
      return {
        host: dbSmtp.host.trim(),
        port: Number(dbSmtp.port) || 587,
        secure: Boolean(dbSmtp.secure),
        user: dbSmtp.user.trim(),
        pass: dbSmtp.pass || '',
        from: dbSmtp.from ? dbSmtp.from.trim() : `"MyDeepwork" <${dbSmtp.user.trim()}>`
      };
    }
  } catch (err) {
    console.error('Error fetching db smtpConfig:', err);
  }

  // Fallback to environment variables
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    const isSecure = process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465';
    return {
      host: process.env.SMTP_HOST.trim(),
      port: Number(process.env.SMTP_PORT) || (isSecure ? 465 : 587),
      secure: isSecure,
      user: process.env.SMTP_USER.trim(),
      pass: process.env.SMTP_PASS || '',
      from: process.env.SMTP_FROM
        ? process.env.SMTP_FROM.trim()
        : `"MyDeepwork" <${process.env.SMTP_USER.trim()}>`
    };
  }

  return null;
};

/**
 * Creates and returns a Nodemailer transporter.
 */
export const createSmtpTransporter = (smtpConfig) => {
  if (!smtpConfig || !smtpConfig.host || !smtpConfig.user) {
    throw new Error('SMTP is not configured. Please set up SMTP credentials in Admin Settings or server environment.');
  }

  const transportOpts = {
    host: smtpConfig.host,
    port: Number(smtpConfig.port) || (smtpConfig.secure ? 465 : 587),
    secure: Boolean(smtpConfig.secure),
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass
    },
    // Reasonable timeouts
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  };

  // If using port 587 with STARTTLS
  if (!transportOpts.secure && transportOpts.port === 587) {
    transportOpts.tls = {
      rejectUnauthorized: false
    };
  }

  return nodemailer.createTransport(transportOpts);
};

/**
 * Sends a password or PIN reset OTP verification email.
 */
export const sendPasswordResetOtpEmail = async ({ toEmail, userName, otpCode, minutesValid = 10, isPin = false }) => {
  const smtpConfig = await getActiveSmtpConfig();
  if (!smtpConfig) {
    throw new Error('SMTP email service is not configured. Please contact your system administrator to configure SMTP.');
  }

  const transporter = createSmtpTransporter(smtpConfig);

  const formattedOtp = String(otpCode);
  const fromAddress = smtpConfig.from || `"MyDeepwork" <${smtpConfig.user}>`;
  const credType = isPin ? '4-digit PIN' : 'password';
  const credTitle = isPin ? 'PIN' : 'Password';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${credTitle} Reset Verification Code</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #0b0f12; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f0f3f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; margin: 0 auto; background-color: #161b22; border-radius: 16px; border: 1px solid #30363d; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
    <!-- Header -->
    <tr>
      <td style="padding: 28px 32px 20px; border-bottom: 1px solid #21262d;">
        <span style="font-size: 22px; font-weight: 800; letter-spacing: -0.02em; color: #ffffff;">
          My<span style="color: #2ea043;">Deepwork</span>
        </span>
      </td>
    </tr>
    
    <!-- Body Content -->
    <tr>
      <td style="padding: 28px 32px;">
        <h1 style="margin: 0 0 14px; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.01em;">
          ${credTitle} Reset Request
        </h1>
        <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #8b949e;">
          Hello <strong style="color: #f0f3f6;">${userName || 'there'}</strong>,<br>
          We received a request to reset the ${credType} for your MyDeepwork account. Use the single-use verification code below to verify your identity:
        </p>

        <!-- OTP Box -->
        <div style="background-color: #0d1117; border: 1.5px solid #30363d; border-radius: 12px; padding: 20px 24px; text-align: center; margin: 24px 0;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #8b949e; margin-bottom: 8px;">
            One-Time Password (OTP)
          </div>
          <div style="font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #2ea043; padding-left: 10px;">
            ${formattedOtp}
          </div>
        </div>

        <p style="margin: 0 0 16px; font-size: 13.5px; line-height: 1.5; color: #8b949e;">
          ⏱️ This code is valid for <strong>${minutesValid} minutes</strong>. For your security, never share this code with anyone.
        </p>
        
        <p style="margin: 20px 0 0; font-size: 12.5px; line-height: 1.5; color: #6e7681; border-top: 1px solid #21262d; padding-top: 16px;">
          If you did not request this ${credType} reset, you can safely disregard this email. Your account remains secure.
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding: 16px 32px 24px; text-align: center; font-size: 11.5px; color: #484f58;">
        MyDeepwork · Digital Personal & Team Workspace · Secure Login
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
MyDeepwork - ${credTitle} Reset Request

Hello ${userName || 'there'},

We received a request to reset the ${credType} for your MyDeepwork account.
Your one-time verification code (OTP) is:

    ${formattedOtp}

This code will expire in ${minutesValid} minutes.
If you did not request this, you can safely ignore this email.

—
MyDeepwork Team
  `.trim();

  const info = await transporter.sendMail({
    from: fromAddress,
    to: toEmail,
    subject: `Your MyDeepwork Verification Code: ${formattedOtp}`,
    text,
    html
  });

  return info;
};

/**
 * Tests an SMTP connection and sends an optional test email.
 */
export const testSmtpConnection = async (customConfig, testRecipient) => {
  const config = customConfig && customConfig.host
    ? customConfig
    : await getActiveSmtpConfig();

  if (!config || !config.host || !config.user) {
    throw new Error('SMTP host and username are required to test.');
  }

  const transporter = createSmtpTransporter(config);
  await transporter.verify();

  if (testRecipient && testRecipient.trim()) {
    const to = testRecipient.trim();
    const fromAddress = config.from || `"MyDeepwork" <${config.user}>`;
    await transporter.sendMail({
      from: fromAddress,
      to,
      subject: 'MyDeepwork - SMTP Test Email',
      text: 'Congratulations! Your SMTP configuration is working correctly and ready to send OTP verification emails.',
      html: `
        <div style="font-family: sans-serif; padding: 24px; background: #0b0f12; color: #ffffff; border-radius: 12px; max-width: 500px;">
          <h2 style="color: #2ea043; margin-top: 0;">SMTP Test Successful</h2>
          <p style="color: #8b949e; line-height: 1.5;">Your MyDeepwork SMTP mail delivery is configured and verified successfully. OTP reset emails will be sent through this server.</p>
          <div style="font-size: 12px; color: #484f58; margin-top: 20px;">Sent at: ${new Date().toLocaleString('en-IN')}</div>
        </div>
      `
    });
  }

  return { success: true, message: 'SMTP connection verified successfully.' };
};

/**
 * Sends an email notification when an administrator accepts a PIN or password reset request.
 */
export const sendResetRequestAcceptedEmail = async ({ toEmail, userName, type = 'pin', newCred, loginUrl }) => {
  const smtpConfig = await getActiveSmtpConfig();
  if (!smtpConfig) {
    throw new Error('SMTP email service is not configured.');
  }

  const transporter = createSmtpTransporter(smtpConfig);
  const fromAddress = smtpConfig.from || `"MyDeepwork" <${smtpConfig.user}>`;
  const isPin = type === 'pin';
  const credTitle = isPin ? '4-Digit PIN' : 'Password';
  const resolvedLoginUrl = loginUrl || process.env.APP_URL || 'https://mydeepwork.in/login';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your MyDeepwork ${credTitle} Has Been Reset</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #0b0f12; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f0f3f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; margin: 0 auto; background-color: #161b22; border-radius: 16px; border: 1px solid #30363d; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
    <!-- Header -->
    <tr>
      <td style="padding: 28px 32px 20px; border-bottom: 1px solid #21262d;">
        <span style="font-size: 22px; font-weight: 800; letter-spacing: -0.02em; color: #ffffff;">
          My<span style="color: #2ea043;">Deepwork</span>
        </span>
      </td>
    </tr>
    
    <!-- Body Content -->
    <tr>
      <td style="padding: 28px 32px;">
        <h1 style="margin: 0 0 14px; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.01em;">
          Your ${credTitle} Has Been Reset
        </h1>
        <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #8b949e;">
          Hello <strong style="color: #f0f3f6;">${userName || 'there'}</strong>,<br>
          An administrator has approved your ${credTitle.toLowerCase()} reset request. Your account has been updated with your new ${isPin ? '4-digit PIN' : 'password'}:
        </p>

        <!-- Credential Box -->
        <div style="background-color: #0d1117; border: 1.5px solid #2ea043; border-radius: 12px; padding: 20px 24px; text-align: center; margin: 24px 0;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #8b949e; margin-bottom: 8px;">
            Your New ${credTitle}
          </div>
          <div style="font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: ${isPin ? '36px' : '22px'}; font-weight: 800; letter-spacing: ${isPin ? '10px' : '2px'}; color: #2ea043; padding-left: ${isPin ? '10px' : '0'};">
            ${newCred}
          </div>
        </div>

        <div style="text-align: center; margin: 28px 0 16px;">
          <a href="${resolvedLoginUrl}" style="background-color: #238636; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
            Sign In to MyDeepwork
          </a>
        </div>

        <p style="margin: 20px 0 0; font-size: 12.5px; line-height: 1.5; color: #6e7681; border-top: 1px solid #21262d; padding-top: 16px;">
          For security, keep this ${credTitle.toLowerCase()} confidential. If you did not request this reset, please contact your administrator immediately.
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding: 16px 32px 24px; text-align: center; font-size: 11.5px; color: #484f58;">
        MyDeepwork · Digital Personal & Team Workspace · Secure Login
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
MyDeepwork - Your ${credTitle} Has Been Reset

Hello ${userName || 'there'},

An administrator has approved your ${credTitle.toLowerCase()} reset request.
Your new ${credTitle} is:

    ${newCred}

You can sign in now at: ${resolvedLoginUrl}

For security, keep this credential safe. If you did not request this reset, please contact your administrator immediately.

—
MyDeepwork Team
  `.trim();

  return transporter.sendMail({
    from: fromAddress,
    to: toEmail,
    subject: `Your MyDeepwork ${credTitle} Has Been Reset`,
    text,
    html
  });
};

/**
 * Sends an email notification when an administrator declines a reset request.
 */
export const sendResetRequestDeclinedEmail = async ({ toEmail, userName, type = 'pin', adminNote }) => {
  const smtpConfig = await getActiveSmtpConfig();
  if (!smtpConfig) {
    throw new Error('SMTP email service is not configured.');
  }

  const transporter = createSmtpTransporter(smtpConfig);
  const fromAddress = smtpConfig.from || `"MyDeepwork" <${smtpConfig.user}>`;
  const credTitle = type === 'pin' ? '4-Digit PIN' : 'Password';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Update on Your MyDeepwork ${credTitle} Reset Request</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #0b0f12; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f0f3f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; margin: 0 auto; background-color: #161b22; border-radius: 16px; border: 1px solid #30363d; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
    <!-- Header -->
    <tr>
      <td style="padding: 28px 32px 20px; border-bottom: 1px solid #21262d;">
        <span style="font-size: 22px; font-weight: 800; letter-spacing: -0.02em; color: #ffffff;">
          My<span style="color: #2ea043;">Deepwork</span>
        </span>
      </td>
    </tr>
    
    <!-- Body Content -->
    <tr>
      <td style="padding: 28px 32px;">
        <h1 style="margin: 0 0 14px; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.01em;">
          Update on Your Reset Request
        </h1>
        <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #8b949e;">
          Hello <strong style="color: #f0f3f6;">${userName || 'there'}</strong>,<br>
          Your request to reset your MyDeepwork ${credTitle.toLowerCase()} was reviewed by an administrator and could not be approved at this time.
        </p>

        ${adminNote ? `
        <div style="background-color: #0d1117; border-left: 3px solid #d29922; border-radius: 6px; padding: 14px 18px; margin: 20px 0;">
          <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #d29922; margin-bottom: 4px;">
            Note from Administrator
          </div>
          <div style="font-size: 14px; color: #c9d1d9; line-height: 1.5;">
            “${adminNote}”
          </div>
        </div>
        ` : ''}

        <p style="margin: 16px 0 0; font-size: 13.5px; line-height: 1.5; color: #8b949e;">
          If you believe this is an error or still need access to your account, please contact your administrator directly.
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding: 16px 32px 24px; text-align: center; font-size: 11.5px; color: #484f58;">
        MyDeepwork · Digital Personal & Team Workspace
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
MyDeepwork - Update on Your Reset Request

Hello ${userName || 'there'},

Your request to reset your MyDeepwork ${credTitle.toLowerCase()} was reviewed by an administrator and could not be approved at this time.

${adminNote ? `Note from Administrator: "${adminNote}"\n` : ''}
If you believe this is an error, please contact your administrator directly.

—
MyDeepwork Team
  `.trim();

  return transporter.sendMail({
    from: fromAddress,
    to: toEmail,
    subject: `Update on Your MyDeepwork ${credTitle} Reset Request`,
    text,
    html
  });
};

