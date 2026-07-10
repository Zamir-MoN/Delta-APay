import cron from 'node-cron';
import { google } from 'googleapis';
import { parseFamAppEmail } from '../utils/parser.util';
import { processPaymentEmail } from './verification.service';
import { prisma } from '../utils/prisma.util';

// Replace these with actual credentials later
const CLIENT_ID = process.env.GMAIL_CLIENT_ID || 'YOUR_CLIENT_ID';
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || 'YOUR_CLIENT_SECRET';
const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN || 'YOUR_REFRESH_TOKEN';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, 'https://developers.google.com/oauthplayground');
oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

export async function fetchUnreadEmails() {
  try {
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread from:no-reply@famapp.in',
    });

    const messages = res.data.messages || [];
    
    for (const msg of messages) {
      if (!msg.id) continue;

      // Check if already processed
      const exists = await prisma.parsedEmail.findUnique({ where: { messageId: msg.id } });
      if (exists) continue;

      const messageData = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full', // or 'raw'
      });

      // Extract body snippet or full text depending on payload
      const snippet = messageData.data.snippet || "";
      // In a real scenario, you'd decode the base64 body from payload.parts
      // For simplicity, let's assume we decode it here:
      let bodyData = snippet; 
      
      const payload = messageData.data.payload;
      if (payload?.parts) {
         for (const part of payload.parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
               bodyData = Buffer.from(part.body.data, 'base64').toString('utf-8');
               break;
            }
         }
      } else if (payload?.body?.data) {
         bodyData = Buffer.from(payload.body.data, 'base64').toString('utf-8');
      }

      const parsedData = parseFamAppEmail(bodyData);
      
      if (parsedData) {
        await processPaymentEmail(parsedData);
      }

      // Mark as processed in our DB
      await prisma.parsedEmail.create({
        data: { messageId: msg.id }
      });

      // Optionally, mark as read in Gmail
      await gmail.users.messages.modify({
        userId: 'me',
        id: msg.id,
        requestBody: {
          removeLabelIds: ['UNREAD']
        }
      });
    }
  } catch (error) {
    console.error('Error fetching emails:', error);
  }
}

export function startGmailCron() {
  if (process.env.ENABLE_CRON === 'true') {
     console.log('Starting Gmail Polling Cron Job (every 20 seconds)');
     cron.schedule('*/20 * * * * *', () => {
       fetchUnreadEmails();
     });
  }
}
