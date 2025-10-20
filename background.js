// Background service worker for Refyne

console.log('Refyne background service worker initialized');

// Initialize storage with defaults
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({
      enabled: true,
      autoCheck: true,
      sound: false,
      tone: 'professional',
      speed: 'normal',
      excludedSites: '',
      correctionsCount: 0,
      wordsImproved: 0,
      installDate: Date.now(),
      version: '2.0.0'
    });
    
    // Open welcome page
    chrome.tabs.create({
      url: 'welcome.html'
    });
  } else if (details.reason === 'update') {
    console.log('Refyne updated to', chrome.runtime.getManifest().version);
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'correctionApplied') {
    // Track statistics
    chrome.storage.local.get(['correctionsCount', 'wordsImproved'], (result) => {
      const newCorrections = (result.correctionsCount || 0) + 1;
      const wordsDiff = request.corrected.split(' ').length - request.original.split(' ').length;
      const newWords = (result.wordsImproved || 0) + Math.abs(wordsDiff);
      
      chrome.storage.local.set({
        correctionsCount: newCorrections,
        wordsImproved: newWords
      });
      
      // Update badge
      chrome.action.setBadgeText({ text: String(newCorrections) });
      chrome.action.setBadgeBackgroundColor({ color: '#667eea' });
    });
    
    sendResponse({ success: true });
  }
  
  if (request.action === 'checkEnabled') {
    chrome.storage.local.get(['enabled', 'excludedSites'], (result) => {
      const url = new URL(sender.tab.url);
      const excluded = (result.excludedSites || '').split('\n').some(site => 
        url.hostname.includes(site.trim())
      );
      
      sendResponse({ enabled: result.enabled && !excluded });
    });
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'playSound') {
    // Play notification sound
    chrome.storage.local.get(['sound'], (result) => {
      if (result.sound) {
        // Play system notification
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/pen.png',
          title: 'Refyne',
          message: 'Suggestion applied!',
          silent: false
        });
      }
    });
    sendResponse({ success: true });
  }
});

// Context menu for manual checking
chrome.contextMenus.create({
  id: 'refyne-check',
  title: 'Check with Refyne',
  contexts: ['selection']
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'refyne-check' && info.selectionText) {
    // Send selected text to content script for checking
    chrome.tabs.sendMessage(tab.id, {
      action: 'checkText',
      text: info.selectionText
    });
  }
});

// Keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
  if (command === 'manual-check') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'manualCheck'
      });
    });
  }
  
  if (command === 'toggle-refyne') {
    chrome.storage.local.get(['enabled'], (result) => {
      const newState = !result.enabled;
      chrome.storage.local.set({ enabled: newState });
      
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/pen.png',
        title: 'Refyne',
        message: `Refyne is now ${newState ? 'enabled' : 'disabled'}`,
        silent: true
      });
    });
  }
});

// Daily stats reset
chrome.alarms.create('dailyReset', {
  when: getNextMidnight(),
  periodInMinutes: 1440 // 24 hours
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'dailyReset') {
    chrome.storage.local.set({
      correctionsCount: 0,
      wordsImproved: 0
    });
    
    chrome.action.setBadgeText({ text: '' });
  }
});

function getNextMidnight() {
  const now = new Date();
  const midnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0, 0, 0, 0
  );
  return midnight.getTime();
}

// Network status monitoring
let isOnline = true;

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.url.includes('localhost:3000')) {
      // Track proxy requests
      console.log('Proxy request:', details.url);
    }
  },
  { urls: ['http://localhost:3000/*'] }
);

chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    if (details.url.includes('localhost:3000')) {
      console.error('Proxy connection failed');
      isOnline = false;
      
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#f44336' });
    }
  },
  { urls: ['http://localhost:3000/*'] }
);

// Periodic health check
setInterval(async () => {
  try {
    const response = await fetch('http://localhost:3000/api/health');
    if (response.ok) {
      isOnline = true;
      chrome.storage.local.get(['correctionsCount'], (result) => {
        if (result.correctionsCount > 0) {
          chrome.action.setBadgeText({ text: String(result.correctionsCount) });
          chrome.action.setBadgeBackgroundColor({ color: '#667eea' });
        }
      });
    }
  } catch (err) {
    isOnline = false;
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#f44336' });
  }
}, 30000); // Check every 30 seconds