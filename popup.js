// Tab switching
document.querySelectorAll('.tab-button').forEach(button => {
  button.addEventListener('click', () => {
    const tab = button.dataset.tab;
    
    document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    button.classList.add('active');
    document.getElementById(tab).classList.add('active');
  });
});

// Status check
async function checkStatus() {
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  
  try {
    const response = await fetch('http://localhost:3000/api/health');
    const data = await response.json();
    
    if (data.status) {
      dot.classList.remove('offline');
      text.textContent = 'Online';
    }
  } catch (err) {
    dot.classList.add('offline');
    text.textContent = 'Offline';
  }
}

// Test button
document.getElementById('testBtn').addEventListener('click', async () => {
  const output = document.getElementById('testOutput');
  output.style.display = 'block';
  output.textContent = 'Testing connection...';
  
  try {
    const response = await fetch('http://localhost:3000/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'mistral',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Say "Refyne is working perfectly!" in a creative way.' }
        ]
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      output.textContent = `Error: ${errorData.error || 'Request failed'}\n${errorData.details || ''}`;
      return;
    }
    
    const data = await response.json();
    console.log('Test response:', data);
    
    if (data.response) {
      output.textContent = `✅ Success!\n\n${data.response}`;
    } else if (data.error) {
      output.textContent = `⚠️ ${data.error}`;
    } else {
      output.textContent = '⚠️ No response received from model';
    }
  } catch (err) {
    output.textContent = `❌ Connection Error:\n${err.message}\n\nMake sure:\n- Ollama is running (ollama serve)\n- Proxy server is running (node ollama-proxy.mjs)`;
  }
});

// Load settings
function loadSettings() {
  chrome.storage.local.get([
    'enabled', 'autoCheck', 'sound', 'tone', 'speed', 
    'excludedSites', 'correctionsCount', 'wordsImproved'
  ], (result) => {
    document.getElementById('enabledToggle').checked = result.enabled !== false;
    document.getElementById('autoCheckToggle').checked = result.autoCheck !== false;
    document.getElementById('soundToggle').checked = result.sound || false;
    document.getElementById('toneSelect').value = result.tone || 'professional';
    document.getElementById('speedSelect').value = result.speed || 'normal';
    document.getElementById('excludedSites').value = result.excludedSites || '';
    document.getElementById('correctionsCount').textContent = result.correctionsCount || 0;
    document.getElementById('wordsImproved').textContent = result.wordsImproved || 0;
  });
}

// Save settings
document.getElementById('saveSettings').addEventListener('click', () => {
  const settings = {
    enabled: document.getElementById('enabledToggle').checked,
    autoCheck: document.getElementById('autoCheckToggle').checked,
    sound: document.getElementById('soundToggle').checked,
    tone: document.getElementById('toneSelect').value,
    speed: document.getElementById('speedSelect').value,
    excludedSites: document.getElementById('excludedSites').value
  };
  
  chrome.storage.local.set(settings, () => {
    // Show success feedback
    const btn = document.getElementById('saveSettings');
    const originalText = btn.textContent;
    btn.textContent = '✓ Saved!';
    btn.style.background = '#4caf50';
    
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.background = '';
    }, 2000);
  });
});

// Open documentation
document.getElementById('openDocs').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://github.com/yourusername/refyne' });
});

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  checkStatus();
  loadSettings();
  setInterval(checkStatus, 5000);
});