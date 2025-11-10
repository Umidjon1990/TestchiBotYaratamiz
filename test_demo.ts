import { demoRepository } from './src/mastra/storage/demoRepository.js';

async function testDemoRepository() {
  console.log('🧪 Testing Demo Repository...\n');
  
  const demo = await demoRepository.createDemoSession({
    podcastTitle: 'تَعَلُّمُ الذَّكَاءِ الاصْطِنَاعِيِّ',
    podcastContent: 'هَذَا بُودْكَاسْتٌ تَجْرِيبِيٌّ عَنِ الذَّكَاءِ الاصْطِنَاعِيِّ وَالتَّعْلِيمِ.',
    questions: [
      {
        question: 'مَا هُوَ الذَّكَاءُ الاصْطِنَاعِيُّ؟',
        options: ['بَرْنَامَجٌ حَاسُوبِيٌّ', 'رَجُلٌ آلِيٌّ', 'نِظَامٌ ذَكِيٌّ', 'لُعْبَةٌ'],
        correctAnswer: 2,
        explanation: 'الذَّكَاءُ الاصْطِنَاعِيُّ هُوَ نِظَامٌ ذَكِيٌّ يُحَاكِي الذَّكَاءَ البَشَرِيَّ'
      }
    ],
    imageUrl: 'https://example.com/test.jpg',
    audioUrl: 'https://example.com/test.mp3'
  });
  
  console.log('✅ Demo created:', {
    id: demo.id,
    slug: demo.slug,
    title: demo.podcastTitle
  });
  
  console.log('\n📊 Demo URL: http://localhost:5000/demo/' + demo.slug);
  
  return demo;
}

testDemoRepository()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
