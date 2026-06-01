const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Module = require('../models/Module');
const { generateEducationalContent } = require('../services/aiContentService');

router.post('/generate', auth, async (req, res, next) => {
  try {
    const { topic } = req.body;

    if (!topic || typeof topic !== 'string' || topic.trim().length < 3) {
      return res.status(400).json({ message: 'Topic must be at least 3 characters' });
    }

    console.log(`🔑 Key check: DEEPSEEK=${!!process.env.DEEPSEEK_API_KEY}, OPENROUTER=${!!process.env.OPENROUTER_API_KEY}`);

    if (!process.env.DEEPSEEK_API_KEY && !process.env.OPENROUTER_API_KEY) {
      console.error('❌ No AI API key configured on Render. Add DEEPSEEK_API_KEY or OPENROUTER_API_KEY to Render env vars.');
      return res.status(503).json({
        message: 'AI service is not configured. Please add DEEPSEEK_API_KEY to the server environment variables.',
        detail: 'missing_api_keys'
      });
    }

    const normalizedTopic = topic.trim().toLowerCase();
    const escapedTopic = normalizedTopic.replace(/[-\/\\^$*+%.()|[\]{}]/g, '\\$&');

    let existingModule = await Module.findOne({
      isPublic: true,
      $or: [
        { title: { $regex: `^${escapedTopic}$`, $options: 'i' } },
        { tags: { $in: [normalizedTopic] } }
      ]
    }).limit(1);

    if (existingModule) {
      existingModule.views = (existingModule.views || 0) + 1;
      await existingModule.save();

      return res.json({
        message: 'Module found in cache',
        module: existingModule,
        cached: true
      });
    }

    let generatedCourse;
    let attempts = 0;
    const maxAttempts = 3;
    let lastError = null;

    while (attempts < maxAttempts) {
      try {
        console.log(`🔄 Generation attempt ${attempts + 1}/${maxAttempts}`);

        const rawText = await generateEducationalContent([
          {
            role: "system",
            content: `You are the AFIT Academic Engine — an expert educational content creator for Air Force Institute of Technology (AFIT) students.

CRITICAL RULES:
1. You MUST return ONLY a valid JSON object. No markdown, no code blocks, no explanations.
2. Do NOT wrap the response in \`\`\`json or \`\`\` markers.
3. Use proper LaTeX for math: $E=mc^2$, $\\frac{dy}{dx}$, $\\sum_{i=1}^{n}$, $\\int_a^b f(x)dx$, etc.
4. Content must be practical, exam-focused, and simplified for Nigerian university students.
5. Each quiz must have exactly 4 options and correctAnswer must match one option exactly.
6. Ensure all JSON keys and string values use proper double quotes.`
          },
          {
            role: "user",
            content: `Create a complete learning module for the topic: "${topic}"

Return ONLY this JSON structure (no other text):
{
  "courseTitle": "Clear, descriptive title for the course",
  "subject": "Math|Physics|GST|COS|Chemistry|Biology|Engineering|Computer Science|Other",
  "description": "2-3 sentence overview of what this module covers and why it matters",
  "tags": ["relevant", "searchable", "tags", "for", "this", "topic"],
  "modules": [
    {
      "moduleId": 1,
      "moduleTitle": "Clear stage title",
      "content": "Detailed step-by-step explanation. Use LaTeX for formulas. Make it engaging, practical, and exam-focused. Break complex ideas into simple steps.",
      "quiz": [
        {
          "question": "Clear, specific question that tests understanding?",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correctAnswer": "Option A"
        }
      ]
    }
  ]
}

STRICT REQUIREMENTS:
- Generate exactly 3 to 5 modules (stages) for comprehensive coverage
- Each module must have 1 to 3 quiz questions
- All quiz options must be distinct, plausible, and clearly different
- correctAnswer must EXACTLY match one of the 4 options (case-sensitive match)
- Subject must be exactly one of: Math, Physics, GST, COS, Chemistry, Biology, Engineering, Computer Science, Other
- Use realistic, accurate content appropriate for a Nigerian university curriculum
- Include practical examples and applications where possible`
          }
        ]);

        console.log("📥 Raw response length:", rawText?.length);

        generatedCourse = JSON.parse(rawText);

        if (generatedCourse && generatedCourse.courseTitle && Array.isArray(generatedCourse.modules) && generatedCourse.modules.length > 0) {
          console.log('✅ Course generated successfully');
          break;
        } else {
          console.log('⚠️ Invalid course structure, retrying...');
        }

        attempts++;
      } catch (apiError) {
        attempts++;
        lastError = apiError.message;
        console.error(`❌ API call attempt ${attempts} failed:`, apiError.message);

        if (attempts >= maxAttempts) {
          console.log('❌ All attempts failed. Searching for similar modules...');

          const similarModules = await Module.find({
            isPublic: true,
            $or: [
              { title: { $regex: escapedTopic.split(' ')[0], $options: 'i' } },
              { tags: { $in: normalizedTopic.split(' ') } },
              { subject: { $in: ['Math', 'Physics', 'Engineering', 'Computer Science'] } }
            ]
          }).sort({ views: -1 }).limit(3);

          if (similarModules.length > 0) {
            const fallbackModule = similarModules[0];
            fallbackModule.views = (fallbackModule.views || 0) + 1;
            await fallbackModule.save();

            return res.json({
              message: 'AI service had issues. Here is a similar module:',
              module: fallbackModule,
              cached: true,
              fallback: true
            });
          }

          console.error(`❌ All ${maxAttempts} AI attempts failed. Last error:`, lastError);
          console.error(`🔑 Keys at failure: DEEPSEEK=${!!process.env.DEEPSEEK_API_KEY}, OPENROUTER=${!!process.env.OPENROUTER_API_KEY}`);

          return res.status(503).json({
            message: 'AI service is temporarily unavailable. Please try again later or create a module manually.',
            error: lastError
          });
        }
      }
    }

    if (!generatedCourse || !generatedCourse.courseTitle || !Array.isArray(generatedCourse.modules)) {
      return res.status(500).json({
        message: 'Failed to generate module content. Please try a different topic.'
      });
    }

    const module = new Module({
      title: generatedCourse.courseTitle || topic.trim(),
      subject: generatedCourse.subject || 'Other',
      description: generatedCourse.description || `AI-generated module on ${topic}`,
      tags: generatedCourse.tags || [topic.trim().toLowerCase()],
      stages: generatedCourse.modules.map(mod => ({
        moduleId: mod.moduleId || undefined,
        heading: mod.moduleTitle || 'Untitled Stage',
        content: mod.content || '',
        quiz: (mod.quiz || []).map(q => ({
          question: q.question || '',
          options: Array.isArray(q.options) ? q.options : [],
          answer: q.correctAnswer || q.options?.[0] || ''
        }))
      })),
      creator: req.user?._id,
      creatorName: 'AI-DeepSeek',
      isPublic: true,
      isVerified: false,
      views: 0
    });

    await module.save();
    await module.populate('creator', 'name');

    res.status(201).json({
      message: 'Module generated and saved successfully',
      module,
      cached: false
    });

  } catch (error) {
    console.error('Error generating module:', error);
    next(error);
  }
});

module.exports = router;
