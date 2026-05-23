const dotenv = require('dotenv');
dotenv.config();

async function generateEducationalContent(messages, temperature = 0.3) {
  const endpoint = 'https://openrouter.ai/api/v1/chat/completions';

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.YOUR_SITE_URL || 'http://localhost:3000',
        'X-OpenRouter-Title': process.env.YOUR_SITE_NAME || 'Educational Platform',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen/qwen3.6-plus:free',
        messages,
        temperature,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenRouter Error [${response.status}]: ${errorData?.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;

  } catch (error) {
    console.error('Failed to communicate with OpenRouter:', error.message);
    throw error;
  }
}

module.exports = { generateEducationalContent };
