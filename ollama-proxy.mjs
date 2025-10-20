import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const OLLAMA_URL = 'http://localhost:11434';

// Context detection system
const CONTEXT_PATTERNS = {
  email: {
    patterns: [/dear|hi|hello|regards|sincerely|subject:/i, /@\w+\.\w+/],
    tone: 'professional'
  },
  social: {
    patterns: [/lol|omg|btw|tbh|imho|^hey|^sup/i],
    tone: 'casual'
  },
  formal: {
    patterns: [/hereby|pursuant|therefore|aforementioned|kindly/i],
    tone: 'formal'
  },
  technical: {
    patterns: [/function|class|variable|API|database|server|code/i],
    tone: 'technical'
  },
  creative: {
    patterns: [/once upon|story|chapter|character|plot/i],
    tone: 'creative'
  }
};

function detectContext(text) {
  for (const [context, config] of Object.entries(CONTEXT_PATTERNS)) {
    if (config.patterns.some(pattern => pattern.test(text))) {
      return { context, tone: config.tone };
    }
  }
  return { context: 'general', tone: 'neutral' };
}

// Advanced system prompt generator
function generateSystemPrompt(detectedContext) {
  const baseRules = `You are an intelligent writing assistant. Analyze text and suggest ONE meaningful improvement.

CRITICAL RULES:
1. Return ONLY valid JSON: [{"original": "...", "corrected": "...", "reason": "..."}]
2. "original" must be 5-30 words and exist exactly in the input
3. "corrected" should be natural and context-appropriate
4. "reason" should be brief (under 10 words)
5. Return [] if text is already perfect
6. NEVER add markdown, explanations, or extra text`;

  const contextRules = {
    email: `
CONTEXT: Professional Email
FOCUS ON:
- Professional greetings (Hi/Hello vs hey)
- Clear subject lines
- Polite closings (Best regards, Thank you)
- Remove casual language (lol, btw, etc)
- Add "please" and "thank you" where appropriate`,

    social: `
CONTEXT: Social Media / Chat
FOCUS ON:
- Keep it casual but readable
- Fix major grammar errors only
- Don't make it too formal
- Maintain conversational tone`,

    formal: `
CONTEXT: Formal Document
FOCUS ON:
- Passive voice → Active voice
- Verbose phrases → Concise alternatives
- Maintain professional terminology
- Ensure proper grammar`,

    technical: `
CONTEXT: Technical Writing
FOCUS ON:
- Clarity and precision
- Consistent terminology
- Remove ambiguity
- Proper technical terms`,

    creative: `
CONTEXT: Creative Writing
FOCUS ON:
- Show vs Tell improvements
- More vivid descriptions
- Stronger word choices
- Maintain author's voice`,

    general: `
CONTEXT: General Writing
FOCUS ON:
- Grammar and spelling
- Clarity improvements
- Remove redundancy
- Natural phrasing`
  };

  const examples = `
EXAMPLES:

Input: "hey can u send the report asap"
Context: Email
Output: [{"original": "hey can u send the report asap", "corrected": "Hi, could you please send the report as soon as possible?", "reason": "More professional tone"}]

Input: "I seen that movie yesterday it was good"
Context: Social
Output: [{"original": "I seen that movie", "corrected": "I saw that movie", "reason": "Grammar correction"}]

Input: "The thing is very important for success"
Context: Formal
Output: [{"original": "The thing is very important", "corrected": "This factor is crucial", "reason": "More precise language"}]

Input: "The solution works good and is reliable"
Context: Technical
Output: [{"original": "works good", "corrected": "works well", "reason": "Correct adverb usage"}]`;

  return `${baseRules}\n\n${contextRules[detectedContext.context] || contextRules.general}\n\n${examples}`;
}

// Smart text analyzer
function analyzeText(text) {
  const analysis = {
    length: text.length,
    wordCount: text.split(/\s+/).length,
    hasErrors: false,
    detectedIssues: []
  };

  // Common error patterns
  const errorPatterns = [
    { regex: /\b(your|you're)\s+(going|gonna)\b/i, issue: 'contraction' },
    { regex: /\b(could|should|would)\s+of\b/i, issue: 'common_mistake' },
    { regex: /\b(alot|alright)\b/i, issue: 'spelling' },
    { regex: /[.!?]\s*[a-z]/g, issue: 'capitalization' },
    { regex: /\s{2,}/g, issue: 'spacing' },
  ];

  errorPatterns.forEach(({ regex, issue }) => {
    if (regex.test(text)) {
      analysis.hasErrors = true;
      analysis.detectedIssues.push(issue);
    }
  });

  return analysis;
}

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    const data = await response.json();
    
    const mistralInstalled = data.models?.some(m => m.name.includes('mistral'));
    
    res.json({
      status: 'Ollama running',
      models: data.models || [],
      mistralReady: mistralInstalled,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({
      error: 'Cannot connect to Ollama',
      message: err.message,
      hint: 'Run: ollama serve'
    });
  }
});

// Main generation endpoint
app.post('/api/generate', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { text, context: userContext, tone: userTone } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Analyze input
    const analysis = analyzeText(text);
    const detectedContext = userContext ? 
      { context: userContext, tone: userTone || 'neutral' } : 
      detectContext(text);

    console.log(`[${new Date().toISOString()}] Analyzing text:`, {
      length: text.length,
      context: detectedContext.context,
      tone: detectedContext.tone,
      hasErrors: analysis.hasErrors
    });

    // Generate context-aware system prompt
    const systemPrompt = generateSystemPrompt(detectedContext);

    // Call Ollama
    const ollamaResponse = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'mistral',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze this ${detectedContext.context} text: "${text}"` }
        ],
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 200,
          top_p: 0.9
        }
      })
    });

    if (!ollamaResponse.ok) {
      const errorText = await ollamaResponse.text();
      console.error('Ollama error:', errorText);
      return res.status(ollamaResponse.status).json({
        error: 'Ollama request failed',
        details: errorText
      });
    }

    const data = await ollamaResponse.json();
    const responseText = data.message?.content || data.response || '';

    // Parse and validate response
    let suggestions = [];
    try {
      let cleaned = responseText.trim()
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
        suggestions = JSON.parse(cleaned);
        
        // Validate suggestions
        suggestions = suggestions.filter(s => 
          s.original && 
          s.corrected && 
          s.original !== s.corrected &&
          text.includes(s.original)
        );
      }
    } catch (parseError) {
      console.error('Parse error:', parseError);
      console.error('Response was:', responseText);
    }

    const processingTime = Date.now() - startTime;
    
    res.json({
      suggestions,
      meta: {
        context: detectedContext.context,
        tone: detectedContext.tone,
        analysis,
        processingTime: `${processingTime}ms`,
        model: 'mistral'
      }
    });

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: err.message
    });
  }
});

// Batch processing endpoint
app.post('/api/batch', async (req, res) => {
  const { texts } = req.body;
  
  if (!Array.isArray(texts)) {
    return res.status(400).json({ error: 'texts must be an array' });
  }

  try {
    const results = await Promise.all(
      texts.map(text => 
        fetch('http://localhost:3000/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        }).then(r => r.json())
      )
    );
    
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stats endpoint
let requestCount = 0;
let suggestionCount = 0;

app.use((req, res, next) => {
  if (req.path === '/api/generate') requestCount++;
  next();
});

app.get('/api/stats', (req, res) => {
  res.json({
    requests: requestCount,
    suggestions: suggestionCount,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║     🚀 Refyne Proxy Server v2.0          ║
╚═══════════════════════════════════════════╝

✓ Server running on http://localhost:${PORT}
✓ Health check: GET /api/health
✓ Generate: POST /api/generate
✓ Batch: POST /api/batch
✓ Stats: GET /api/stats

📋 Checklist:
  1. Ollama running? → ollama serve
  2. Mistral installed? → ollama pull mistral
  3. Extension loaded? → chrome://extensions

Ready to refine your writing! 🎯
`);
});