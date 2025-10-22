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

// Simplified system prompt for better JSON compliance
function generateSystemPrompt(detectedContext) {
  const basePrompt = `You are a writing assistant. Analyze the text and suggest ONE improvement.
Return ONLY valid JSON array format: [{"original": "text", "corrected": "text", "reason": "brief reason"}]
Rules:
- "original" must exist exactly in the input (5-30 words)
- "corrected" should match the context
- Return [] if no improvements needed
- No extra text, only JSON

Context: ${detectedContext.context} (${detectedContext.tone} tone)
Focus: Fix grammar, clarity, tone, or word choice`;

  return basePrompt;
}

// Main generation endpoint - FIXED for content.js compatibility
app.post('/api/generate', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { text } = req.body; // Only expect text from content script
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ 
        error: 'Text is required',
        suggestions: [] 
      });
    }

    // Simple validation
    if (text.trim().length < 3) {
      return res.json({ suggestions: [] });
    }

    const detectedContext = detectContext(text);
    
    console.log(`[${new Date().toISOString()}] Processing:`, {
      length: text.length,
      context: detectedContext.context,
      preview: text.substring(0, 50) + '...'
    });

    const systemPrompt = generateSystemPrompt(detectedContext);

    // Call Ollama with simplified request
    const ollamaResponse = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'mistral',
        messages: [
          { 
            role: 'system', 
            content: systemPrompt 
          },
          { 
            role: 'user', 
            content: `Text: "${text}"\n\nReturn JSON array only:` 
          }
        ],
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 150,
          top_p: 0.8
        }
      })
    });

    if (!ollamaResponse.ok) {
      throw new Error(`Ollama error: ${ollamaResponse.status}`);
    }

    const data = await ollamaResponse.json();
    const responseText = data.message?.content || '';

    // Parse response
    let suggestions = [];
    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          suggestions = parsed.filter(s => 
            s && 
            s.original && 
            s.corrected && 
            s.original !== s.corrected &&
            text.includes(s.original)
          ).slice(0, 2); // Max 2 suggestions
        }
      }
    } catch (parseError) {
      console.error('Parse error:', parseError.message);
      console.error('Raw response:', responseText.substring(0, 200));
      suggestions = [];
    }

    const processingTime = Date.now() - startTime;
    
    // Return EXACTLY what content.js expects
    res.json({
      suggestions: suggestions, // This is the key field content.js looks for
      meta: {
        context: detectedContext.context,
        processingTime: `${processingTime}ms`
      }
    });

  } catch (err) {
    console.error('Server error:', err);
    // Return proper structure even on error
    res.status(500).json({
      error: err.message,
      suggestions: [] // Always include suggestions array
    });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    const data = await response.json();
    
    const mistralInstalled = data.models?.some(m => 
      m.name.includes('mistral') || m.name.includes('llama')
    );
    
    res.json({
      status: 'Ollama running',
      mistralReady: mistralInstalled,
      models: data.models?.map(m => m.name) || []
    });
  } catch (err) {
    res.status(503).json({
      error: 'Cannot connect to Ollama',
      suggestions: [] // Consistent structure
    });
  }
});

// Simple test endpoint for content script
app.post('/api/test', async (req, res) => {
  // Return a mock suggestion for testing
  res.json({
    suggestions: [
      {
        original: "test text",
        corrected: "improved test text", 
        reason: "test suggestion"
      }
    ]
  });
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`
✅ Refyne Server Fixed for Content Script
📍 Port: ${PORT}
🔗 Health: http://localhost:${PORT}/api/health
📝 Generate: POST http://localhost:${PORT}/api/generate

Now compatible with content.js structure!
`);
});