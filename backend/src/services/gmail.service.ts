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
      q: 'is:unread from:no-reply@famapp.in newer_than:1d subject:"Money Received"',
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
        format: 'full', 
      });

      let bodyData = messageData.data.snippet || ""; 
      const payload = messageData.data.payload;
      
      function getPartData(parts: any[], mimeType: string): string {
         for (const part of parts) {
            if (part.mimeType === mimeType && part.body?.data) {
               return Buffer.from(part.body.data, 'base64').toString('utf-8');
            }
            if (part.parts) {
               const found = getPartData(part.parts, mimeType);
               if (found) return found;
            }
         }
         return '';
      }

      let html = '';
      let plain = '';
      
      if (payload?.parts) {
         html = getPartData(payload.parts, 'text/html');
         plain = getPartData(payload.parts, 'text/plain');
      } else if (payload?.body?.data) {
         if (payload.mimeType === 'text/html') {
             html = Buffer.from(payload.body.data, 'base64').toString('utf-8');
         } else {
             plain = Buffer.from(payload.body.data, 'base64').toString('utf-8');
         }
      }

      if (html) {
         // Simply strip HTML tags and replace with newlines
         bodyData = html.replace(/<[^>]*>?/gm, '\n');
      } else if (plain) {
         bodyData = plain;
      }

      const parsedData = parseFamAppEmail(bodyData);
      
      if (parsedData) {
        await processPaymentEmail(parsedData);
      }

      // Mark as processed in our DB
      await prisma.parsedEmail.create({
        data: { messageId: msg.id }
      });

      // NOTE: Intentionally removed gmail.modify to prevent 403 Forbidden Error
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
