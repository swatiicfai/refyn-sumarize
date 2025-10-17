import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());
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
app.get('/api/health', async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    const data = await response.json();
    res.json({ status: 'Ollama running', models: data.models || [] });
  } catch (err) {
    res.status(503).json({ error: 'Cannot connect to Ollama', message: err.message });
  }
});
app.post('/api/generate', async (req, res) => {
  if (!req.body.prompt && !req.body.messages) {
    return res.status(400).json({ error: 'Prompt or messages required' });
  }
  const messages = req.body.messages || [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: req.body.prompt }
  ];

  const body = {
    model: req.body.model || 'phi3',
    messages: messages,
    stream: false,
    options: {
      temperature: req.body.temperature || 0.7,
      num_predict: req.body.max_tokens || 200
    }
  };

  try {
    console.log('Sending request to Ollama:', JSON.stringify(body, null, 2));
    
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Ollama error response:', errorText);
      return res.status(response.status).json({ 
        error: 'Ollama request failed', 
        details: errorText 
      });
    }

    const data = await response.json();
    console.log('Ollama response:', JSON.stringify(data, null, 2));
    const responseText = data.message?.content || data.response || 'No response generated';
    
    res.json({ response: responseText });
  } catch (err) {
    console.error('Error contacting Ollama:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Proxy running on http://localhost:${PORT}`);
  console.log(`Health: GET http://localhost:${PORT}/api/health`);
  console.log(`Generate: POST http://localhost:${PORT}/api/generate`);
  console.log('\nMake sure Ollama is running: ollama serve');
  console.log('And phi3 model is installed: ollama pull phi3');
});