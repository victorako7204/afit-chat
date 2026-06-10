const { GoogleGenAI } = require('@google/genai');
const { z } = require('zod');
const crypto = require('crypto');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PRIMARY_MODEL = 'gemini-3.5-flash';
const FALLBACK_MODEL = 'gemini-3.5-flash-8b';
const TIMEOUT_MS = 25000;
const MAX_RETRIES = 2;
const RATE_LIMIT_RPM = 15;
const RATE_LIMIT_RPD = 1500;

const BANNED_WORDS = (process.env.BANNED_WORDS || 'explicit,violence,hate,nsfw')
  .split(',')
  .map(w => w.trim().toLowerCase())
  .filter(Boolean);

const moduleSchema = z.object({
  title: z.string().min(5).max(100),
  subject: z.enum(['Math', 'Physics', 'GST', 'COS', 'Chemistry', 'Biology', 'Engineering', 'Computer Science', 'Other']),
  description: z.string().max(500),
  stages: z.array(z.object({
    heading: z.string().min(3).max(100),
    content: z.string().min(50).max(10000),
    quiz: z.array(z.object({
      question: z.string().min(10).max(500),
      options: z.array(z.string()).length(4),
      answer: z.string()
    })).max(5)
  })).min(3).max(10)
});

const requestTimestamps = [];

function isRateLimited() {
  const now = Date.now();
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - 60000) {
    requestTimestamps.shift();
  }
  if (requestTimestamps.length >= RATE_LIMIT_RPM) return true;

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayStartMs = dayStart.getTime();
  const dailyCount = requestTimestamps.filter(t => t >= dayStartMs).length;
  if (dailyCount >= RATE_LIMIT_RPD) return true;

  return false;
}

function recordRequest() {
  requestTimestamps.push(Date.now());
}

function hashTopic(topic) {
  return crypto.createHash('sha256').update(topic.toLowerCase().trim()).digest('hex');
}

function buildPrompt(topic) {
  return `You are an educational content generator for the Air Force Institute of Technology (AFIT), Nigeria. Create a structured learning module on the topic: "${topic}"
RULES:
Output ONLY valid JSON. No markdown, no explanations, no code blocks.
The JSON must match this exact structure:
{
"title": "Module title (5-100 chars)",
"subject": "One of: Math, Physics, GST, COS, Chemistry, Biology, Engineering, Computer Science, Other",
"description": "Brief description (max 500 chars)",
"stages": [
{
"heading": "Stage title (3-100 chars)",
"content": "Educational content with LaTeX math where needed. Use $...$ for inline, $$...$$ for display. Min 50 chars, max 10000.",
"quiz": [
{
"question": "Question text? (10-500 chars)",
"options": ["Option A", "Option B", "Option C", "Option D"],
"answer": "Must be exactly one of the options"
}
]
}
]
}
Create 3-5 stages with progressive difficulty.
Each stage should have 1-3 quiz questions (max 5 total per stage).
Content must be academically accurate and appropriate for university students.
Use proper LaTeX for mathematical expressions.
Do not include any harmful, explicit, or inappropriate content.
Keep total content under 4000 tokens.
Ensure the answer field exactly matches one of the options strings.`;
}

function checkContentSafety(text) {
  const lower = text.toLowerCase();
  for (const word of BANNED_WORDS) {
    if (lower.includes(word)) {
      return { safe: false, word };
    }
  }
  return { safe: true };
}

function cleanAndParseResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { success: false, error: { code: 'PARSE_ERROR', message: 'Empty or non-string AI response' } };
  }
  try {
    const parsed = JSON.parse(rawText);
    return { success: true, data: parsed };
  } catch (e) { /* continue */ }

  try {
    const cleaned = rawText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*$/gim, '')
      .replace(/^```\s*/gim, '')
      .trim();
    const parsed = JSON.parse(cleaned);
    return { success: true, data: parsed };
  } catch (e) { /* continue */ }

  return { success: false, error: { code: 'PARSE_ERROR', message: 'Failed to parse AI response as JSON' } };
}

function validateModuleSchema(data) {
  const result = moduleSchema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'AI generated invalid content structure',
        details: result.error.issues
      }
    };
  }

  for (const stage of result.data.stages) {
    for (const quiz of stage.quiz) {
      if (!quiz.options.includes(quiz.answer)) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Quiz answer "${quiz.answer}" not found in options for question: "${quiz.question}"`
          }
        };
      }
    }
  }

  return { success: true, data: result.data };
}

async function callGemini(topic, modelName, abortSignal) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts: [{ text: buildPrompt(topic) }] }],
        config: {
          temperature: 0.7,
          maxOutputTokens: 4000,
          responseMimeType: 'application/json'
        }
      }, { signal: abortSignal });

      const text = response.text;
      if (!text) {
        throw new Error('Empty response from Gemini');
      }
      return text;
    } catch (err) {
      lastError = err;

      if (err.name === 'AbortError' || err.message?.includes('aborted')) {
        throw new Error('TIMEOUT');
      }

      if (err.status === 400) {
        throw new Error('INVALID_REQUEST');
      }

      if (err.status === 401 || err.status === 403) {
        throw new Error('AUTH_ERROR');
      }

      if (err.status === 429) {
        const retryAfter = err.headers?.['retry-after'];
        const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt + 1) * 1000;
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
        throw new Error('RATE_LIMITED');
      }

      if (err.status === 503 || err.status === 504) {
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt + 1) * 1000));
          continue;
        }
        throw new Error('SERVER_ERROR');
      }

      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt + 1) * 1000));
        continue;
      }

      throw err;
    }
  }

  throw lastError || new Error('Unknown error in callGemini');
}

async function generateEducationalContent(topic, options = {}) {
  const { userId, requestId, onProgress } = options;

  if (onProgress) onProgress('Validating topic...');

  const topicValidation = z.string().min(3).max(100).safeParse(topic);
  if (!topicValidation.success) {
    return {
      success: false,
      error: {
        code: 'INVALID_TOPIC',
        message: 'Topic must be between 3 and 100 characters'
      }
    };
  }

  const sanitized = topic.replace(/<[^>]*>/g, '').replace(/[^\w\s\-.,!?]/g, '').trim();
  if (sanitized !== topic.trim()) {
    topic = sanitized;
  }

  if (isRateLimited()) {
    return {
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'AI quota exceeded. Please try again later.'
      }
    };
  }

  if (onProgress) onProgress('Checking cache...');

  let AICache;
  try {
    AICache = require('../models/AICache');
    const cached = await AICache.findByTopic(topic);
    if (cached) {
      if (onProgress) onProgress('Found cached module');
      return { success: true, data: cached.moduleData, cached: true };
    }
  } catch (e) {
    AICache = null;
  }

  if (onProgress) onProgress('Generating content with AI...');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let rawText = null;
  let modelUsed = PRIMARY_MODEL;

  try {
    try {
      recordRequest();
      rawText = await callGemini(topic, PRIMARY_MODEL, controller.signal);
    } catch (primaryErr) {
      if (primaryErr.message === 'TIMEOUT' || primaryErr.message === 'AUTH_ERROR' || primaryErr.message === 'INVALID_REQUEST') {
        throw primaryErr;
      }
      if (onProgress) onProgress('Primary model failed, trying fallback...');
      modelUsed = FALLBACK_MODEL;
      recordRequest();
      rawText = await callGemini(topic, FALLBACK_MODEL, controller.signal);
    }
  } catch (err) {
    clearTimeout(timeoutId);

    if (err.message === 'TIMEOUT') {
      return {
        success: false,
        error: {
          code: 'TIMEOUT',
          message: 'AI request timed out. Please try again.'
        }
      };
    }
    if (err.message === 'AUTH_ERROR') {
      console.error('Gemini API authentication error — check GEMINI_API_KEY');
      return {
        success: false,
        error: {
          code: 'AI_UNAVAILABLE',
          message: 'AI service configuration error. Please contact admin.'
        }
      };
    }
    if (err.message === 'RATE_LIMITED') {
      return {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'AI quota exceeded. Please try again later.'
        }
      };
    }
    if (err.message === 'SERVER_ERROR') {
      return {
        success: false,
        error: {
          code: 'AI_UNAVAILABLE',
          message: 'AI service temporarily unavailable. Please try again later.'
        }
      };
    }

    console.error('Gemini call failed:', err.message);
    return {
      success: false,
      error: {
        code: 'AI_UNAVAILABLE',
        message: 'AI service temporarily unavailable. Please try again later.'
      }
    };
  }

  clearTimeout(timeoutId);

  if (onProgress) onProgress('Validating response...');

  console.log(`📥 Raw response from ${modelUsed} (first 200 chars):`, rawText.substring(0, 200));

  const parseResult = cleanAndParseResponse(rawText);
  if (!parseResult.success) {
    console.error('Parse error. Raw response:', rawText.substring(0, 500));
    return {
      success: false,
      error: {
        code: 'PARSE_ERROR',
        message: 'Failed to parse AI response. Please try again.'
      }
    };
  }

  const validationResult = validateModuleSchema(parseResult.data);
  if (!validationResult.success) {
    console.error('Validation error:', validationResult.error, 'Raw response:', rawText.substring(0, 500));
    return {
      success: false,
      error: validationResult.error
    };
  }

  const moduleData = validationResult.data;

  const titleCheck = checkContentSafety(moduleData.title);
  if (!titleCheck.safe) {
    console.warn(`Content safety violation in title by user ${userId}: "${moduleData.title}" contains banned word "${titleCheck.word}"`);
    return {
      success: false,
      error: {
        code: 'CONTENT_REJECTED',
        message: 'Generated content violated safety guidelines.'
      }
    };
  }

  const descCheck = checkContentSafety(moduleData.description);
  if (!descCheck.safe) {
    console.warn(`Content safety violation in description by user ${userId}`);
    return {
      success: false,
      error: {
        code: 'CONTENT_REJECTED',
        message: 'Generated content violated safety guidelines.'
      }
    };
  }

  for (const stage of moduleData.stages) {
    const contentCheck = checkContentSafety(stage.content);
    if (!contentCheck.safe) {
      console.warn(`Content safety violation in stage "${stage.heading}" by user ${userId}`);
      return {
        success: false,
        error: {
          code: 'CONTENT_REJECTED',
          message: 'Generated content violated safety guidelines.'
        }
      };
    }
  }

  if (onProgress) onProgress('Saving to cache...');

  try {
    if (AICache) {
      await AICache.saveCache(topic, moduleData, modelUsed);
    }
  } catch (e) {
    console.error('Cache save failed:', e.message);
  }

  if (onProgress) onProgress('Complete');

  return {
    success: true,
    data: moduleData,
    provider: 'gemini',
    model: modelUsed,
    requestId
  };
}

module.exports = {
  generateEducationalContent,
  cleanAndParseResponse,
  validateModuleSchema,
  checkContentSafety,
  buildPrompt,
  isRateLimited,
  hashTopic,
  PRIMARY_MODEL,
  FALLBACK_MODEL,
  TIMEOUT_MS,
  MAX_RETRIES,
  RATE_LIMIT_RPM,
  RATE_LIMIT_RPD
};
