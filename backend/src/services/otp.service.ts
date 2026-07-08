import dotenv from 'dotenv';
dotenv.config();

// Twilio Config
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

export const sendSMSOTP = async (phone: string, otpCode: string): Promise<{ success: boolean; provider: string; error?: string }> => {
  if (!accountSid || !authToken || !twilioPhone) {
    console.log(`\n==========================================`);
    console.log(`[DEV MODE OTP] Phone: ${phone} | OTP Code: ${otpCode}`);
    console.log(`==========================================\n`);
    return {
      success: false,
      provider: 'DEV_FALLBACK',
      error: 'Twilio credentials not configured in backend/.env'
    };
  }

  try {
    // Dynamic import to prevent app crash if twilio dependency is loading
    const twilio = require('twilio');
    const client = twilio(accountSid, authToken);

    // Format phone number to E.164 (Twilio requirement)
    let formattedPhone = phone.trim();
    if (!formattedPhone.startsWith('+')) {
      if (formattedPhone.length === 10) {
        formattedPhone = `+91${formattedPhone}`; // Default to India (+91)
      } else {
        formattedPhone = `+${formattedPhone}`;
      }
    }

    const message = await client.messages.create({
      body: `Your AttendX verification code is: ${otpCode}. Valid for 5 minutes. Please do not share this OTP.`,
      from: twilioPhone,
      to: formattedPhone
    });

    console.log(`[Twilio OTP Success] Message SID: ${message.sid} to ${formattedPhone}`);
    return { success: true, provider: 'TWILIO' };
  } catch (err: any) {
    console.error('[Twilio OTP Error]:', err);
    return { success: false, provider: 'TWILIO', error: err.message };
  }
};
