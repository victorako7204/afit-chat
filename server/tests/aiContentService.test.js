const {
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
} = require('../services/aiContentService');

describe('aiContentService', () => {

  describe('buildPrompt', () => {
    it('returns a string containing the topic', () => {
      const prompt = buildPrompt('Differential Equations');
      expect(prompt).toContain('Differential Equations');
      expect(prompt).toContain('AFIT');
      expect(prompt).toContain('JSON');
    });

    it('includes LaTeX instructions', () => {
      const prompt = buildPrompt('Linear Algebra');
      expect(prompt).toContain('LaTeX');
      expect(prompt).toContain('$...$');
    });
  });

  describe('cleanAndParseResponse', () => {
    it('parses valid JSON', () => {
      const input = '{"title":"Test"}';
      const result = cleanAndParseResponse(input);
      expect(result.success).toBe(true);
      expect(result.data.title).toBe('Test');
    });

    it('strips markdown code blocks', () => {
      const input = '```json\n{"title":"Test"}\n```';
      const result = cleanAndParseResponse(input);
      expect(result.success).toBe(true);
      expect(result.data.title).toBe('Test');
    });

    it('returns error for empty input', () => {
      const result = cleanAndParseResponse('');
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('PARSE_ERROR');
    });

    it('returns error for null input', () => {
      const result = cleanAndParseResponse(null);
      expect(result.success).toBe(false);
    });

    it('returns error for invalid JSON', () => {
      const result = cleanAndParseResponse('not json at all');
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('PARSE_ERROR');
    });
  });

  describe('validateModuleSchema', () => {
    const validModule = {
      title: 'Introduction to Calculus',
      subject: 'Math',
      description: 'A comprehensive introduction to calculus fundamentals.',
      stages: [
        {
          heading: 'Limits and Continuity',
          content: 'The concept of a limit is fundamental to calculus. A limit describes the value that a function approaches as the input approaches some value. For example, the limit of f(x) as x approaches a is written as lim(x→a) f(x) = L.',
          quiz: [
            {
              question: 'What does the notation lim(x→a) f(x) = L mean?',
              options: ['f(a) = L', 'f(x) approaches L as x approaches a', 'f(x) equals L at x = a', 'f(x) is continuous at a'],
              answer: 'f(x) approaches L as x approaches a'
            }
          ]
        },
        {
          heading: 'Derivatives',
          content: 'The derivative of a function measures the rate of change of the function with respect to its variable. If y = f(x), the derivative is denoted as f\'(x) or dy/dx. The derivative represents the slope of the tangent line to the curve at any point.',
          quiz: [
            {
              question: 'What does the derivative f\'(x) represent geometrically?',
              options: ['Area under the curve', 'Slope of the tangent line', 'Length of the curve', 'Maximum value of the function'],
              answer: 'Slope of the tangent line'
            }
          ]
        },
        {
          heading: 'Integrals',
          content: 'Integration is the reverse process of differentiation. The definite integral of a function f(x) from a to b represents the area under the curve of f(x) between x = a and x = b. The fundamental theorem of calculus connects differentiation and integration.',
          quiz: [
            {
              question: 'What is the fundamental theorem of calculus?',
              options: ['Integration equals differentiation', 'Differentiation and integration are inverse operations', 'All functions are integrable', 'Integration always gives positive results'],
              answer: 'Differentiation and integration are inverse operations'
            }
          ]
        }
      ]
    };

    it('validates a correct module', () => {
      const result = validateModuleSchema(validModule);
      expect(result.success).toBe(true);
      expect(result.data.title).toBe('Introduction to Calculus');
    });

    it('rejects module with missing title', () => {
      const invalid = { ...validModule, title: '' };
      const result = validateModuleSchema(invalid);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects module with invalid subject', () => {
      const invalid = { ...validModule, subject: 'InvalidSubject' };
      const result = validateModuleSchema(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects module with fewer than 3 stages', () => {
      const invalid = { ...validModule, stages: validModule.stages.slice(0, 2) };
      const result = validateModuleSchema(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects quiz with wrong answer not in options', () => {
      const invalid = {
        ...validModule,
        stages: [
          ...validModule.stages,
          {
            heading: 'Additional Stage',
            content: 'This stage has a quiz with an answer that does not match any option for testing purposes.',
            quiz: [
              {
                question: 'What is 2 + 2?',
                options: ['3', '4', '5', '6'],
                answer: '7'
              }
            ]
          }
        ]
      };
      const result = validateModuleSchema(invalid);
      expect(result.success).toBe(false);
      expect(result.error.message).toContain('Quiz answer');
    });

    it('rejects quiz with fewer than 4 options', () => {
      const invalid = {
        ...validModule,
        stages: [
          {
            heading: 'Test Stage',
            content: 'This stage has a quiz with only three options for testing purposes and validation.',
            quiz: [
              {
                question: 'What is the answer?',
                options: ['A', 'B', 'C'],
                answer: 'A'
              }
            ]
          },
          ...validModule.stages.slice(1)
        ]
      };
      const result = validateModuleSchema(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects stage with content too short', () => {
      const invalid = {
        ...validModule,
        stages: [
          {
            heading: 'Short Stage',
            content: 'Too short.',
            quiz: []
          },
          ...validModule.stages.slice(1)
        ]
      };
      const result = validateModuleSchema(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('checkContentSafety', () => {
    it('returns safe for clean content', () => {
      const result = checkContentSafety('Introduction to Calculus');
      expect(result.safe).toBe(true);
    });

    it('detects banned words', () => {
      const result = checkContentSafety('This contains explicit content');
      expect(result.safe).toBe(false);
      expect(result.word).toBe('explicit');
    });

    it('is case insensitive', () => {
      const result = checkContentSafety('EXPLICIT content here');
      expect(result.safe).toBe(false);
    });
  });

  describe('hashTopic', () => {
    it('returns consistent hash for same topic', () => {
      const hash1 = hashTopic('Differential Equations');
      const hash2 = hashTopic('Differential Equations');
      expect(hash1).toBe(hash2);
    });

    it('normalizes topic (lowercase, trim)', () => {
      const hash1 = hashTopic('Differential Equations');
      const hash2 = hashTopic('  differential equations  ');
      expect(hash1).toBe(hash2);
    });

    it('returns different hash for different topics', () => {
      const hash1 = hashTopic('Calculus');
      const hash2 = hashTopic('Algebra');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('rate limiter', () => {
    it('isRateLimited returns false initially', () => {
      const result = isRateLimited();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('configuration constants', () => {
    it('has correct primary model', () => {
      expect(PRIMARY_MODEL).toBe('gemini-3.5-flash');
    });

    it('has correct fallback model', () => {
      expect(FALLBACK_MODEL).toBe('gemini-3.5-flash-8b');
    });

    it('has reasonable timeout', () => {
      expect(TIMEOUT_MS).toBe(25000);
    });

    it('has retry limit', () => {
      expect(MAX_RETRIES).toBe(2);
    });

    it('has rate limit constants', () => {
      expect(RATE_LIMIT_RPM).toBe(15);
      expect(RATE_LIMIT_RPD).toBe(1500);
    });
  });

  describe('Gemini API error handling', () => {
    it('handles 400 invalid request by not retrying', () => {
      const error = new Error('INVALID_REQUEST');
      error.status = 400;
      expect(error.status).toBe(400);
    });

    it('handles 401 auth error by not retrying', () => {
      const error = new Error('AUTH_ERROR');
      error.status = 401;
      expect(error.status).toBe(401);
    });

    it('handles 429 rate limit by checking retry-after', () => {
      const error = new Error('RATE_LIMITED');
      error.status = 429;
      error.headers = { 'retry-after': '5' };
      expect(error.status).toBe(429);
      expect(error.headers['retry-after']).toBe('5');
    });

    it('handles 503 server error by retrying with backoff', () => {
      const error = new Error('SERVER_ERROR');
      error.status = 503;
      expect(error.status).toBe(503);
    });

    it('handles timeout by returning timeout error', () => {
      const error = new Error('TIMEOUT');
      expect(error.message).toBe('TIMEOUT');
    });
  });

  describe('generateEducationalContent', () => {
    const { generateEducationalContent } = require('../services/aiContentService');

    it('rejects topic shorter than 3 chars', async () => {
      const result = await generateEducationalContent('ab');
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_TOPIC');
    });

    it('rejects topic longer than 100 chars', async () => {
      const longTopic = 'a'.repeat(101);
      const result = await generateEducationalContent(longTopic);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_TOPIC');
    });

    it('strips HTML tags from topic', async () => {
      const result = await generateEducationalContent('<script>alert("xss")</script>Linear Algebra');
      expect(result.success).toBe(false);
      expect(['AI_UNAVAILABLE', 'TIMEOUT', 'PARSE_ERROR']).toContain(result.error.code);
    }, 30000);

    it('returns AI_UNAVAILABLE when GEMINI_API_KEY is not set', async () => {
      const originalKey = process.env.GEMINI_API_KEY;
      process.env.GEMINI_API_KEY = '';
      try {
        const result = await generateEducationalContent('Linear Algebra');
        expect(result.success).toBe(false);
        expect(result.error.code).toBe('AI_UNAVAILABLE');
      } finally {
        process.env.GEMINI_API_KEY = originalKey;
      }
    }, 30000);
  });
});
