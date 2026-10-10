import fs from 'fs';
import path from 'path';

// Load .env manually for this test script
const envContent = fs.readFileSync(path.resolve('.env'), 'utf8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let val = match[2] || '';
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
});

console.log('Testing Resend API Key:', process.env.RESEND_API_KEY ? 'Present (' + process.env.RESEND_API_KEY.slice(0, 8) + '...)' : 'MISSING');

import { sendEmail } from '../lib/email/resend.ts';

async function testResend() {
  console.log('Dispatching test email to delivered@resend.dev...');
  const result = await sendEmail({
    to: 'delivered@resend.dev',
    subject: '🧪 Hunger Platform - Resend API Verification',
    html: '<h1>Integration Verified!</h1><p>Resend email system is working smoothly on the Hunger platform.</p>',
    text: 'Integration Verified! Resend email system is working smoothly on the Hunger platform.'
  });

  console.log('Resend Response Result:', result);
  if (result.success) {
    console.log('🎉 RESEND API LIVE CALL SUCCEEDED! Email ID:', result.id);
  } else {
    console.log('⚠️ Resend API responded with error or restriction:', result.error);
    console.log('Note: If on unverified free tier, Resend allows sending to the account owner email.');
  }
}

testResend();
