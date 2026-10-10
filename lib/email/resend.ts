import { Resend } from 'resend';

let cachedResend: Resend | null = null;
let lastApiKey: string | null = null;

export function getResendClient(): Resend | null {
  const currentKey = process.env.RESEND_API_KEY;
  if (!currentKey) {
    return null;
  }
  if (!cachedResend || lastApiKey !== currentKey) {
    cachedResend = new Resend(currentKey);
    lastApiKey = currentKey;
  }
  return cachedResend;
}

export const DEFAULT_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || 'Hunger Food Delivery <onboarding@resend.dev>';

export const DEFAULT_ADMIN_EMAIL =
  process.env.ADMIN_NOTIFICATION_EMAIL || 'admin@akrhunger.com';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
  details?: any;
}

/**
 * Universal safe email sender utilizing Resend API.
 * Dynamically resolves Resend client on every invocation.
 * Never throws uncaught exceptions, always returns a clean status object.
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const fromEmail = options.from || process.env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL;
  const { to, subject, html, text, from = fromEmail, replyTo } = options;

  if (!to || (Array.isArray(to) && to.length === 0)) {
    console.warn('[Resend] Cannot send email: No recipient email provided.');
    return { success: false, error: 'Recipient email is missing' };
  }

  const client = getResendClient();
  if (!client) {
    console.warn('[Resend] Email dispatch skipped: RESEND_API_KEY is missing from environment variables.');
    return { success: false, error: 'RESEND_API_KEY is not configured on server' };
  }

  try {
    const recipients = Array.isArray(to) ? to : [to];

    const payload: any = {
      from,
      to: recipients,
      subject,
      html,
    };

    if (text) payload.text = text;
    if (replyTo) payload.reply_to = replyTo;

    const response = await client.emails.send(payload);

    if (response.error) {
      console.error('[Resend] API returned error:', response.error);
      return {
        success: false,
        error: response.error.message || 'Failed to send email via Resend',
        details: response.error,
      };
    }

    console.log(`[Resend] Email successfully sent to ${recipients.join(', ')} [ID: ${response.data?.id}]`);
    return {
      success: true,
      id: response.data?.id,
    };
  } catch (err: any) {
    console.error('[Resend] Unexpected exception during sendEmail:', err);
    return {
      success: false,
      error: err?.message || 'Unexpected server error sending email',
      details: err,
    };
  }
}
