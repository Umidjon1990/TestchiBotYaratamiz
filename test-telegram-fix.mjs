import FormData from 'form-data';
import { Client } from '@replit/object-storage';

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
const bucketId = 'replit-objstore-f00a83e7-474d-4079-93c4-d7b576bbad69';

console.log('=== Testing FIX: Explicit Headers ===');

// Initialize App Storage client
const client = new Client({ bucketId });

// Test with latest audio file
const filename = 'audio/2025/11/--2025-11-10T18-58-32.769Z.mp3';

try {
  console.log('1. Downloading audio...');
  const stream = await client.downloadAsStream(filename);
  
  // Convert stream to buffer
  const chunks = [];
  await new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve());
    stream.on('error', (error) => reject(error));
  });
  
  const audioBuffer = Buffer.concat(chunks);
  console.log('✓ Downloaded:', audioBuffer.length, 'bytes');
  
  console.log('\n2. Creating form-data...');
  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('audio', audioBuffer, {
    filename: 'podcast.mp3',
    contentType: 'audio/mpeg',
  });
  formData.append('caption', '🎧 Test');
  
  console.log('\n3. Sending with correct headers...');
  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendAudio`,
    {
      method: 'POST',
      headers: formData.getHeaders(),  // This is critical!
      body: formData,
    }
  );
  
  const result = await response.text();
  console.log('\nStatus:', response.status);
  console.log('Response:', result);
  
  if (response.ok) {
    console.log('\n✅ SUCCESS!');
  }
  
} catch (error) {
  console.error('\n❌ Error:', error.message);
}
