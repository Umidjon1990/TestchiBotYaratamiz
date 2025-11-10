import FormData from 'form-data';
import { Client } from '@replit/object-storage';

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
const bucketId = 'replit-objstore-f00a83e7-474d-4079-93c4-d7b576bbad69';

console.log('=== Testing Telegram Audio Upload ===');
console.log('Chat ID:', chatId);
console.log('Bucket ID:', bucketId);

// Initialize App Storage client
const client = new Client({ bucketId });

// Test with latest audio file
const filename = 'audio/2025/11/--2025-11-10T18-58-32.769Z.mp3';

try {
  console.log('\n1. Downloading audio from App Storage...');
  console.log('Filename:', filename);
  
  const stream = await client.downloadAsStream(filename);
  
  // Convert stream to buffer
  const chunks = [];
  
  await new Promise((resolve, reject) => {
    stream.on('data', (chunk) => {
      chunks.push(chunk);
    });
    
    stream.on('end', () => {
      resolve();
    });
    
    stream.on('error', (error) => {
      reject(error);
    });
  });
  
  const audioBuffer = Buffer.concat(chunks);
  console.log('✓ Downloaded:', audioBuffer.length, 'bytes');
  
  console.log('\n2. Creating form data...');
  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('audio', audioBuffer, {
    filename: 'podcast.mp3',
    contentType: 'audio/mpeg',
    knownLength: audioBuffer.length,
  });
  formData.append('caption', '🎧 Test Audio');
  
  console.log('✓ Form data created');
  
  console.log('\n3. Sending to Telegram...');
  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendAudio`,
    {
      method: 'POST',
      body: formData,
    }
  );
  
  const result = await response.text();
  console.log('\n4. Response:');
  console.log('Status:', response.status, response.statusText);
  console.log('Body:', result);
  
  if (response.ok) {
    console.log('\n✅ SUCCESS! Audio sent to Telegram!');
  } else {
    console.log('\n❌ FAILED! See error above');
  }
  
} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error('Stack:', error.stack);
}
