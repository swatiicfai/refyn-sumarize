document.addEventListener('DOMContentLoaded', async function() {
    const toggle = document.getElementById('toggleEnabled');
    const statusDiv = document.getElementById('status');
    const correctionsCount = document.getElementById('correctionsCount');
    const wordsImproved = document.getElementById('wordsImproved');
    const modeIndicator = document.getElementById('modeIndicator');
  
    chrome.storage.local.get(['enabled', 'correctionsCount', 'wordsImproved'], (result) => {
      toggle.checked = result.enabled !== false;
      correctionsCount.textContent = result.correctionsCount || 0;
      wordsImproved.textContent = result.wordsImproved || 0;
    });
  
    async function checkAIStatus() {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0] && tabs[0].id) {
          const response = await chrome.tabs.sendMessage(tabs[0].id, { 
            action: 'getAIStatus' 
          });
          
          if (response) {
            updateStatus(response.status, response.message, response.mode);
            return;
          }
        }
      } catch (error) {
        console.log('Could not get AI status from content script:', error);
      }
      const hasAISupport = await checkSystemAISupport();
      if (hasAISupport) {
        updateStatus('available', 'AI Model Ready', 'ai');
      } else {
        updateStatus('unavailable', 'AI Not Supported - Using Offline Mode', 'offline');
      }
    }
  
    async function checkSystemAISupport() {
      const chromeVersion = navigator.userAgent.match(/Chrome\/([0-9]+)/)?.[1];
      if (!chromeVersion || parseInt(chromeVersion) < 137) {
        return false;
      }
      const userAgent = navigator.userAgent;
      const isSupportedOS = userAgent.includes('Windows') || 
                           userAgent.includes('Mac OS') || 
                           userAgent.includes('Linux') ||
                           userAgent.includes('CrOS');
      
      return isSupportedOS;
    }
  
    function updateStatus(status, message, mode) {
      statusDiv.textContent = message;
      if (modeIndicator) {
        if (mode === 'offline') {
          modeIndicator.textContent = 'Offline Mode';
          modeIndicator.style.color = '#FF9800';
        } else {
          modeIndicator.textContent = '🤖 AI Mode';
          modeIndicator.style.color = '#4CAF50';
        }
      }
      
      switch(status) {
        case 'available':
          statusDiv.className = 'status ready';
          statusDiv.textContent = '✅ ' + message;
          break;
        case 'downloading':
          statusDiv.className = 'status downloading';
          statusDiv.textContent = '📥 ' + message;
          break;
        case 'downloadable':
          statusDiv.className = 'status downloading';
          statusDiv.textContent = '⏳ ' + message;
          break;
        case 'unavailable':
        default:
          statusDiv.className = 'status error';
          statusDiv.textContent = '🔒 ' + message;
          break;
      }
    }
  
    checkAIStatus();
    
    toggle.addEventListener('change', function() {
      chrome.storage.local.set({ enabled: this.checked }, () => {
        chrome.action.setBadgeText({ text: this.checked ? 'ON' : 'OFF' });
        chrome.action.setBadgeBackgroundColor({ color: this.checked ? '#4caf50' : '#666' });
        
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0] && tabs[0].id) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'enabledStateChanged',
              enabled: this.checked
            }).catch(err => console.log('Tab message failed:', err));
          }
        });
      });
    });
  
    chrome.storage.local.get(['correctionsCount', 'wordsImproved'], (result) => {
      correctionsCount.textContent = result.correctionsCount || 0;
      wordsImproved.textContent = result.wordsImproved || 0;
    });
  });