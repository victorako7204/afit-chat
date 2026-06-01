const dotenv = require('dotenv');
dotenv.config();

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';

const OPENROUTER_FALLBACKS = [
  'deepseek/deepseek-chat-v3-0324:free',
  'meta-llama/llama-4-maverick:free',
  'qwen/qwen3-235b-a22b:free',
  'google/gemma-4-31b-it:free'
];

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

function cleanResponse(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Empty or invalid response from AI');
  }
  return text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*$/gim, '')
    .replace(/^```\s*/gim, '')
    .trim();
}

function validateModuleStructure(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Response is not a valid object');
  }
  if (!data.courseTitle || typeof data.courseTitle !== 'string') {
    throw new Error('Missing or invalid courseTitle');
  }
  if (!Array.isArray(data.modules) || data.modules.length === 0) {
    throw new Error('Missing or empty modules array');
  }
  data.modules.forEach((mod, i) => {
    if (!mod.moduleTitle || typeof mod.moduleTitle !== 'string') {
      throw new Error(`Module ${i} missing moduleTitle`);
    }
    if (!mod.content || typeof mod.content !== 'string') {
      throw new Error(`Module ${i} missing content`);
    }
    if (!Array.isArray(mod.quiz)) {
      throw new Error(`Module ${i} missing quiz array`);
    }
    mod.quiz.forEach((q, j) => {
      if (!q.question || !Array.isArray(q.options) || q.options.length !== 4) {
        throw new Error(`Module ${i}, Quiz ${j} has invalid structure`);
      }
    });
  });
  return true;
}

async function callDeepSeek(messages) {
  if (!DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY not configured');
  }

  const response = await fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: messages,
      temperature: 0.2,
      max_tokens: 4000,
      top_p: 0.9,
      response_format: { type: 'json_object' }
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`DeepSeek Error [${response.status}]: ${errorData?.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content;
}

async function callOpenRouter(messages, modelIndex = 0) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('No fallback API available');
  }
  if (modelIndex >= OPENROUTER_FALLBACKS.length) {
    throw new Error('All fallback models exhausted');
  }

  const model = OPENROUTER_FALLBACKS[modelIndex];
  console.log(`🔄 OpenRouter fallback: ${model}`);

  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': process.env.YOUR_SITE_URL || 'https://afit-chat.vercel.app',
      'X-Title': 'AFIT Academic Engine',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: 0.2,
      max_tokens: 4000,
      response_format: { type: 'json_object' }
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const status = response.status;

    if ([429, 503, 504, 502].includes(status)) {
      await new Promise(r => setTimeout(r, 1000));
      return callOpenRouter(messages, modelIndex + 1);
    }

    throw new Error(`OpenRouter Error [${status}]: ${errorData?.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content;
}

async function generateEducationalContent(messages) {
  let rawText = null;
  let source = '';

  try {
    console.log('🤖 Trying DeepSeek API...');
    rawText = await callDeepSeek(messages);
    source = 'deepseek';
    console.log('✅ DeepSeek responded successfully');
  } catch (deepseekError) {
    console.error('❌ DeepSeek failed:', deepseekError.message);

    try {
      console.log('🔄 Falling back to OpenRouter...');
      rawText = await callOpenRouter(messages);
      source = 'openrouter';
      console.log('✅ OpenRouter fallback succeeded');
    } catch (openrouterError) {
      console.error('❌ OpenRouter also failed:', openrouterError.message);
      throw new Error('All AI services unavailable. Please try again later.');
    }
  }

  if (!rawText) {
    throw new Error('Empty response from AI');
  }

  console.log(`📥 Raw response from ${source} (first 200 chars):`, rawText.substring(0, 200));

  const cleanedText = cleanResponse(rawText);
  const parsed = JSON.parse(cleanedText);
  validateModuleStructure(parsed);

  console.log(`✅ Module generated successfully via ${source}`);
  return JSON.stringify(parsed);
}

module.exports = { generateEducationalContent };
