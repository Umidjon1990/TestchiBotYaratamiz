import FormData from 'form-data';
import { Client } from '@replit/object-storage';
import { Readable } from 'stream';

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
const bucketId = 'replit-objstore-f00a83e7-474d-4079-93c4-d7b576bbad69';

console.log('=== Using Stream Body (Proper Way) ===');

const client = new Client({ bucketId });
const filename = 'audio/2025/11/--2025-11-10T18-58-32.769Z.mp3';

try {
  console.log('1. Downloading...');
  const stream = await client.downloadAsStream(filename);
  
  const chunks = [];
  await new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve());
    stream.on('error', reject);
  });
  
  const audioBuffer = Buffer.concat(chunks);
  console.log('✓ Downloaded:', audioBuffer.length, 'bytes');
  
  console.log('\n2. Creating multipart form...');
  const formData = new FormData();
  formData.append('chat_id', chatId);
  
  // Pass buffer as stream
  const audioStream = Readable.from(audioBuffer);
  formData.append('audio', audioStream, {
    filename: 'test.mp3',
    contentType: 'audio/mpeg',
  });
  
  console.log('\n3. Sending (piped stream body)...');
  
  // Use form-data's submit method or convert to proper fetch body
  const response = await new Promise((resolve, reject) => {
    formData.submit({
      protocol: 'https:',
      host: 'api.telegram.org',
      path: `/bot${token}/sendAudio`,
      method: 'POST',
    }, (err, res) => {
      if (err) return reject(err);
      resolve(res);
    });
  });
  
  const chunks2 = [];
  for await (const chunk of response) {
    chunks2.push(chunk);
  }
  const result = Buffer.concat(chunks2).toString();
  
  console.log('\nStatus:', response.statusCode);
  console.log('Response:', result);
  
  if (response.statusCode === 200) {
    console.log('\n✅ SUCCESS!');
  }
  
} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
}
