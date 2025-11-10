import { demoRepository } from "../storage/demoRepository";

/**
 * HTML escape function to prevent XSS attacks
 * Escapes <, >, &, ", ' characters
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Public Demo Routes
 * Serves publicly accessible demo pages for content preview
 */

export const demoRoutes = [
  {
    path: "/demo/:slug",
    method: "GET" as const,
    createHandler: async ({ mastra }: any) => {
      const logger = mastra?.getLogger();

      return async (c: any) => {
        const slug = c.req.param("slug");
        logger?.info("🌐 [Demo Route] Serving demo page", { slug });

        try {
          // Fetch demo from database
          const demo = await demoRepository.getDemoBySlug(slug, logger);

          if (!demo) {
            logger?.warn("⚠️ [Demo Route] Demo not found", { slug });
            return c.html(`
              <!DOCTYPE html>
              <html lang="ar" dir="rtl">
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Demo غَيْرُ مَوْجُودٍ</title>
                <style>
                  body { font-family: 'Arial', sans-serif; background: #f5f5f5; padding: 20px; }
                  .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; text-align: center; }
                  h1 { color: #e74c3c; }
                </style>
              </head>
              <body>
                <div class="container">
                  <h1>❌ Demo غَيْرُ مَوْجُودٍ</h1>
                  <p>هَذَا العَرْضُ التَّوْضِيحِيُّ غَيْرُ مَوْجُودٍ أَوْ تَمَّ حَذْفُهُ.</p>
                </div>
              </body>
              </html>
            `, 404);
          }

          logger?.info("✅ [Demo Route] Demo found, rendering HTML", {
            id: demo.id,
            title: demo.podcastTitle,
          });

          // Render demo as HTML
          const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(demo.podcastTitle)} - معاينة المحتوى</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Arial', 'Helvetica', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      line-height: 1.8;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 3px solid #667eea;
    }
    .status-badge {
      display: inline-block;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 15px;
    }
    .status-draft { background: #ffeaa7; color: #2d3436; }
    .status-approved { background: #55efc4; color: #00b894; }
    .status-posted { background: #74b9ff; color: #0984e3; }
    h1 {
      color: #2d3436;
      font-size: 32px;
      margin-bottom: 15px;
    }
    .meta {
      color: #636e72;
      font-size: 14px;
      margin-bottom: 10px;
    }
    .image-container {
      margin: 30px 0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    }
    .image-container img {
      width: 100%;
      height: auto;
      display: block;
    }
    .content {
      background: #f8f9fa;
      padding: 30px;
      border-radius: 12px;
      margin: 30px 0;
      white-space: pre-wrap;
      font-size: 18px;
      line-height: 2;
    }
    .audio-player {
      margin: 30px 0;
      padding: 25px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px;
      text-align: center;
    }
    .audio-player h3 {
      color: white;
      margin-bottom: 15px;
      font-size: 20px;
    }
    audio {
      width: 100%;
      max-width: 500px;
      border-radius: 30px;
    }
    .questions {
      margin-top: 40px;
    }
    .questions h2 {
      color: #2d3436;
      font-size: 28px;
      margin-bottom: 25px;
      padding-bottom: 15px;
      border-bottom: 2px solid #dfe6e9;
    }
    .question {
      background: #f8f9fa;
      padding: 25px;
      margin-bottom: 20px;
      border-radius: 12px;
      border-right: 4px solid #667eea;
    }
    .question h3 {
      color: #2d3436;
      margin-bottom: 15px;
      font-size: 20px;
    }
    .options {
      margin: 15px 0;
    }
    .option {
      padding: 12px 18px;
      margin: 8px 0;
      background: white;
      border-radius: 8px;
      border: 2px solid #dfe6e9;
      transition: all 0.3s ease;
    }
    .option.correct {
      background: #d5f4e6;
      border-color: #00b894;
      font-weight: bold;
    }
    .option.correct::before {
      content: "✓ ";
      color: #00b894;
      font-weight: bold;
    }
    .explanation {
      margin-top: 15px;
      padding: 15px;
      background: #fff3cd;
      border-radius: 8px;
      border-right: 3px solid #ffc107;
      font-style: italic;
    }
    .footer {
      margin-top: 50px;
      padding-top: 30px;
      border-top: 2px solid #dfe6e9;
      text-align: center;
      color: #636e72;
      font-size: 14px;
    }
    @media (max-width: 768px) {
      .container { padding: 20px; }
      h1 { font-size: 24px; }
      .content { font-size: 16px; padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="status-badge status-${demo.status}">${demo.status === 'draft' ? 'مُسَوَّدَة' : demo.status === 'approved' ? 'مُعْتَمَد' : 'مَنْشُور'}</span>
      <h1>🎙️ ${escapeHtml(demo.podcastTitle)}</h1>
      <div class="meta">
        📅 تَارِيخُ الإِنْشَاءِ: ${new Date(demo.createdAt).toLocaleDateString('ar-EG', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}
      </div>
      ${demo.updatedAt && demo.updatedAt.getTime() !== demo.createdAt.getTime() ? `
      <div class="meta">
        🔄 آخِرُ تَحْدِيثٍ: ${new Date(demo.updatedAt).toLocaleDateString('ar-EG', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}
      </div>
      ` : ''}
    </div>

    ${demo.imageUrl ? `
    <div class="image-container">
      <img src="${escapeHtml(demo.imageUrl)}" alt="${escapeHtml(demo.podcastTitle)}" onerror="this.style.display='none'">
    </div>
    ` : ''}

    <div class="content">${escapeHtml(demo.podcastContent)}

    ${demo.audioUrl ? `
    <div class="audio-player">
      <h3>🎧 استمع للبودكاست</h3>
      <audio controls>
        <source src="${escapeHtml(demo.audioUrl)}" type="audio/mpeg">
        متصفحك لا يدعم تشغيل الصوت.
      </audio>
    </div>
    ` : ''}

    ${demo.questions && demo.questions.length > 0 ? `
    <div class="questions">
      <h2>📝 اختبارات اليوم</h2>
      ${demo.questions.map((q: any, index: number) => `
        <div class="question">
          <h3>السُّؤَالُ ${index + 1}: ${escapeHtml(q.question)}</h3>
          <div class="options">
            ${q.options.map((opt: string, optIndex: number) => `
              <div class="option ${optIndex === q.correctAnswer ? 'correct' : ''}">
                ${String.fromCharCode(65 + optIndex)}) ${escapeHtml(opt)}
              </div>
            `).join('')}
          </div>
          <div class="explanation">
            💡 ${escapeHtml(q.explanation)}
          </div>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <div class="footer">
      <p>🤖 تَمَّ إِنْشَاءُ هَذَا المُحْتَوَى بِوَاسِطَةِ Content Maker Bot</p>
      <p>مُحْتَوَى تَعْلِيمِيٌّ بِمُسْتَوَى A2-B1 مَعَ التَّشْكِيلِ الكَامِلِ</p>
    </div>
  </div>
</body>
</html>
          `;

          return c.html(html);
        } catch (error) {
          logger?.error("❌ [Demo Route] Error serving demo", { error });
          return c.html(`
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>خَطَأ</title>
              <style>
                body { font-family: 'Arial', sans-serif; background: #f5f5f5; padding: 20px; }
                .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; text-align: center; }
                h1 { color: #e74c3c; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>❌ حَدَثَ خَطَأ</h1>
                <p>عُذْراً، حَدَثَ خَطَأٌ أَثْنَاءَ تَحْمِيلِ العَرْضِ التَّوْضِيحِيِّ.</p>
                <p style="color: #636e72; font-size: 14px; margin-top: 20px;">${error}</p>
              </div>
            </body>
            </html>
          `, 500);
        }
      };
    },
  },
];
