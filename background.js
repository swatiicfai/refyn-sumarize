console.log("Refyne background service worker initialized");

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    enabled: true,
    autoCheck: true,
    correctionsCount: 0,
    wordsImproved: 0,
    installDate: Date.now(),
    version: '2.0.2'
  });
  chrome.contextMenus.create({
    id: 'refyne-check',
    title: 'Check with Refyne',
    contexts: ['selection']
  }, () => {
    if (chrome.runtime.lastError) {
      console.log('Context menu error:', chrome.runtime.lastError);
    } else {
      console.log('Context menu created');
    }
  });
  
  chrome.contextMenus.create({
    id: 'refyne-insights',
    title: 'Get writing insights',
    contexts: ['selection']
  }, () => {
    if (chrome.runtime.lastError) {
      console.log('Insights context menu error:', chrome.runtime.lastError);
    } else {
      console.log('Insights context menu created');
    }
  });
  
  try {
    if (chrome.action && chrome.action.setBadgeText) {
      chrome.action.setBadgeText({ text: 'ON' });
      chrome.action.setBadgeBackgroundColor({ color: '#4caf50' });
    } else if (chrome.browserAction) {
      chrome.browserAction.setBadgeText({ text: 'ON' });
      chrome.browserAction.setBadgeBackgroundColor({ color: '#4caf50' });
    }
  } catch (error) {
    console.log('Badge setup failed:', error);
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'refyne-check' && info.selectionText) {
    chrome.tabs.sendMessage(tab.id, {
      action: 'checkText',
      text: info.selectionText
    }).catch(err => console.log('Context menu message failed:', err));
  }
  
  if (info.menuItemId === 'refyne-insights' && info.selectionText) {
    chrome.tabs.sendMessage(tab.id, {
      action: 'showTextInsights',
      text: info.selectionText
    }).catch(err => console.log('Insights context menu failed:', err));
  }
});

function setupActionListener() {
  if (chrome.action && chrome.action.onClicked) {
    chrome.action.onClicked.addListener((tab) => {
      toggleExtensionState();
    });
  } else if (chrome.browserAction && chrome.browserAction.onClicked) {
    chrome.browserAction.onClicked.addListener((tab) => {
      toggleExtensionState();
    });
  } else {
    console.log('Action onClicked API not available');
  }
}

setupActionListener();

function toggleExtensionState() {
  chrome.storage.local.get('enabled', ({ enabled }) => {
    const newState = !enabled;
    chrome.storage.local.set({ enabled: newState }, () => {
      try {
        if (chrome.action && chrome.action.setBadgeText) {
          chrome.action.setBadgeText({ text: newState ? 'ON' : 'OFF' });
          chrome.action.setBadgeBackgroundColor({ color: newState ? '#4caf50' : '#666' });
        } else if (chrome.browserAction) {
          chrome.browserAction.setBadgeText({ text: newState ? 'ON' : 'OFF' });
          chrome.browserAction.setBadgeBackgroundColor({ color: newState ? '#4caf50' : '#666' });
        }
      } catch (error) {
        console.log('Badge update failed:', error);
      }
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (tab.url && tab.url.startsWith('http')) {
            chrome.tabs.sendMessage(tab.id, {
              action: 'enabledStateChanged',
              enabled: newState
            }).catch(err => console.log('Tab message failed:', err));
          }
        });
      });
    });
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'correctionApplied') {
    chrome.storage.local.get(['correctionsCount', 'wordsImproved'], (result) => {
      const newCorrections = (result.correctionsCount || 0) + 1;
      const originalWords = request.original.split(/\s+/).length;
      const correctedWords = request.corrected.split(/\s+/).length;
      const wordsChanged = Math.abs(correctedWords - originalWords);
      const newWords = (result.wordsImproved || 0) + wordsChanged;

      chrome.storage.local.set({
        correctionsCount: newCorrections,
        wordsImproved: newWords
      });
      
      try {
        if (chrome.action && chrome.action.setBadgeText) {
          chrome.action.setBadgeText({ 
            text: newCorrections > 0 ? String(newCorrections) : 'ON' 
          });
        } else if (chrome.browserAction) {
          chrome.browserAction.setBadgeText({ 
            text: newCorrections > 0 ? String(newCorrections) : 'ON' 
          });
        }
      } catch (error) {
        console.log('Badge update failed:', error);
      }
      
      console.log(`Correction applied (${request.source || 'ai'}):`, {
        original: request.original,
        corrected: request.corrected
      });
    });

    sendResponse({ success: true });
  }

  if (request.action === 'checkEnabled') {
    chrome.storage.local.get('enabled', ({ enabled }) => {
      sendResponse({ enabled: enabled !== false });
    });
    return true;
  }

  if (request.action === 'getStats') {
    chrome.storage.local.get(['correctionsCount', 'wordsImproved'], (result) => {
      sendResponse({
        correctionsCount: result.correctionsCount || 0,
        wordsImproved: result.wordsImproved || 0
      });
    });
    return true;
  }
});
// NO EXTRA CLOSING BRACE HERE
