document.getElementById('testModel').addEventListener('click', async () => {
  const output = document.getElementById('output');
  output.textContent = "Checking connection to Ollama...";

  try {
    const response = await fetch('http://localhost:3000/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'phi3',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Say hello from Refyne(A real-time, on-device AI writing coach that corrects grammar, refines tone, and drafts content instantly).' }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      output.textContent = `Error: ${errorData.error || 'Request failed'}`;
      console.error('Server error:', errorData);
      return;
    }

    const data = await response.json();
    console.log('Response data:', data);
    const resultText = data.response || "No response received.";
    output.textContent = resultText;

  } catch (err) {
    output.textContent = `Connection error: ${err.message}`;
    console.error('Fetch error:', err);
  }
});

document.getElementById('rewriteBtn').addEventListener('click', async () => {
  const keyword = document.getElementById('keywordInput').value.trim();
  const output = document.getElementById('output');
  
  if (!keyword) {
    output.textContent = "Please enter a keyword or sentence.";
    return;
  }

  output.textContent = "Generating alternatives...";

  try {
    const response = await fetch('http://localhost:3000/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'phi3',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that suggests alternative phrasing. Provide exactly 3 alternatives, each on a new line, numbered 1-3.' },
          { role: 'user', content: `Suggest 3 alternative ways to phrase this in a professional tone: "${keyword}"` }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      output.textContent = `Error: ${errorData.error || 'Request failed'}`;
      console.error('Server error:', errorData);
      return;
    }

    const data = await response.json();
    console.log('Rewrite response:', data);
    
    const resultText = data.response || "No suggestions found.";
    output.textContent = resultText;

  } catch (err) {
    output.textContent = `Connection error: ${err.message}`;
    console.error('Fetch error:', err);
  }
});