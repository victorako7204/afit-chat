# Gemini AI Module Generation Setup

## Overview

AFIT Chat uses Google's Gemini API (free tier) to generate educational modules with LaTeX math and quizzes. The system includes caching, rate limiting, content validation, and graceful fallback handling.

## Setup

### 1. Get a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key

### 2. Configure Environment Variables

Add to your `.env` file (or Render environment variables):

```bash
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash
GEMINI_FALLBACK_MODEL=gemini-3.5-flash-8b
BANNED_WORDS=explicit,violence,hate,nsfw
```

### 3. Install Dependencies

```bash
cd server
npm install @google/genai zod
```

## Rate Limit Strategy

### Gemini Free Tier Limits
- **15 requests per minute** (RPM)
- **1,000,000 tokens per minute** (TPM)
- **1,500 requests per day** (RPD)

### Server-Side Rate Limiting
- **In-memory sliding window**: Tracks timestamps of API calls
- **Per-user limit**: 5 generation requests per hour per user
- **Global limit**: 15 requests per minute, 1500 per day
- When exceeded, returns `429` with `Retry-After` header

### Multi-Instance Note
The rate limiter is per-server-instance. For multi-instance deployments on Render free tier (single instance), this is sufficient. For scaling to multiple instances, consider Redis-backed rate limiting.

## Architecture

```
Client (AbortController, 30s timeout)
  ↓
POST /api/v1/lessons/generate
  ↓
Rate Limit Check (5/hr per user)
  ↓
AI Content Service
  ↓
  ├─ Topic Validation (Zod)
  ├─ Rate Limit Check (15 RPM, 1500 RPD)
  ├─ Cache Check (SHA-256 hash, 24hr TTL)
  ├─ Gemini API Call (25s timeout)
  │   ├─ Primary: gemini-3.5-flash
  │   └─ Fallback: gemini-3.5-flash-8b
  ├─ Response Parsing (JSON)
  ├─ Schema Validation (Zod)
  ├─ Content Safety Filter
  └─ Cache Save
```

## Error Codes

| Code | Meaning | User Action |
|------|---------|-------------|
| `INVALID_TOPIC` | Topic too short/long | Adjust topic length (3-100 chars) |
| `RATE_LIMITED` | Quota exceeded | Wait and try again later |
| `TIMEOUT` | API response too slow | Try again |
| `AI_UNAVAILABLE` | Gemini API down | Try again later |
| `PARSE_ERROR` | Invalid JSON from AI | Try again |
| `VALIDATION_ERROR` | AI output doesn't match schema | Try again |
| `CONTENT_REJECTED` | Banned word detected | Try different topic |

## Testing

```bash
cd server
npm test -- --testPathPattern=aiContentService
```

### Mock Response Testing

For development without API calls, mock the Gemini response:

```javascript
const mockModule = {
  title: 'Introduction to Calculus',
  subject: 'Math',
  description: 'Basic calculus concepts',
  stages: [
    {
      heading: 'Limits',
      content: 'The concept of limits is fundamental to calculus...',
      quiz: [{
        question: 'What is a limit?',
        options: ['A value', 'An approach', 'A sum', 'A product'],
        answer: 'An approach'
      }]
    },
    // ... more stages
  ]
};
```

## Content Safety

The system checks generated content against a configurable banned words list:

```bash
BANNED_WORDS=explicit,violence,hate,nsfw
```

Violations are logged with userId, topic, and timestamp for auditing.

## Monitoring

Check Google AI Studio for API usage:
- Navigate to [AI Studio](https://aistudio.google.com)
- Click on your API key
- View usage statistics

## Troubleshooting

### "AI service is not configured"
- Ensure `GEMINI_API_KEY` is set in environment variables
- Restart the server after adding the key

### "AI quota exceeded"
- Check usage in Google AI Studio
- Free tier: 1,500 requests/day
- Wait until next day or upgrade plan

### "AI service temporarily unavailable"
- Gemini API may be experiencing issues
- The system automatically falls back to `gemini-3.5-flash-8b`
- Try again in a few minutes
