const text = `
Hey Imraj Mondal,

You have successfully received
₹1.0
from MD ZISHAN MANDAL

Transaction ID : 
FMPIB6280284185

Date : 
01:49 AM IST, 27 July 2026

Updated Balance :
₹10.6

UTR :
620837889918

Purpose : 
UPI
`;

const cleanText = text.replace(/\r\n/g, '\n');
console.log("Amount:", cleanText.match(/₹([\d.]+)/));
console.log("Sender:", cleanText.match(/from\s+([^\n]+)/i));
console.log("TxID:", cleanText.match(/Transaction ID\s*:\s*([a-zA-Z0-9]+)/i));
console.log("Date:", cleanText.match(/Date\s*:\s*([^\n]+)/i));
console.log("UTR:", cleanText.match(/UTR\s*:\s*(\d+)/i));
console.log("Purpose:", cleanText.match(/Purpose\s*:\s*([^\n]+)/i));
