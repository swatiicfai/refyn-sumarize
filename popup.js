document.addEventListener("DOMContentLoaded", async function () {
    // --- UI Element References ---
    const ui = {
        toggleEnabled: document.getElementById("toggleEnabled"),
        toggleTTS: document.getElementById("toggleTTS"),
        summarizeBtn: document.getElementById("summarizePageButton"),
        speakBtn: document.getElementById("readSummaryButton"),
        summaryOutput: document.getElementById("summaryOutput"),
        correctionsCount: document.getElementById("correctionsCount"),
        wordsImproved: document.getElementById("wordsImproved"),
        keyStatus: document.getElementById("keyStatus"),
        modeIndicator: document.getElementById("modeIndicator"),
        // apiKeyInput: document.getElementById("geminiApiKeyInput"), // Not in popup.html
        // saveApiKeyButton: document.getElementById("saveApiKeyButton"), // Not in popup.html
    };

    let summaryText = ""; // Global state for the summary

    // --- Utility: Storage Handler ---
    const StorageHandler = {
        isChromeStorage: typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local,
        get: function(keys, callback) {
            if (this.isChromeStorage) {
                chrome.storage.local.get(keys, callback);
            } else {
                // Fallback for non-extension environments (e.g., testing in plain browser)
                const result = {};
                (Array.isArray(keys) ? keys : [keys]).forEach(key => {
                    const value = localStorage.getItem(key);
                    try {
                        result[key] = value !== null ? JSON.parse(value) : undefined;
                    } catch (e) {
                        result[key] = value;
                    }
                });
                callback(result);
            }
        },
        set: function(items, callback = () => {}) {
            if (this.isChromeStorage) {
                chrome.storage.local.set(items, callback);
            } else {
                // Fallback for non-extension environments
                Object.keys(items).forEach(key => {
                    localStorage.setItem(key, JSON.stringify(items[key]));
                });
                callback();
            }
        }
    };
    
    // --- Core Functions ---
    
    // Function to update the Speak button disabled state
    function updateSpeakButtonState() {
        const isTTS = ui.toggleTTS.checked;
        ui.speakBtn.disabled = !isTTS || summaryText.length === 0 || window.speechSynthesis.speaking;
    }

    // Function to handle reading the summary aloud
    async function handleSpeak() {
        if (summaryText.length === 0) return;
        
        // Toggle play/pause
        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            updateSpeakButtonState();
            return; 
        }

        // Start speaking
        try {
            // Find the active tab to send the message to content.js
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0] && tabs[0].id) {
                await chrome.tabs.sendMessage(tabs[0].id, {
                    action: "speakText",
                    text: summaryText,
                });
            }
        } catch (error) {
            console.error("TTS message failed:", error);
        }
        updateSpeakButtonState();
    }

    // Function to handle the summarization click
    async function handleSummarize() {
        ui.summarizeBtn.disabled = true;
        window.speechSynthesis.cancel(); // Stop any ongoing speech

        const keyResult = await new Promise(resolve => {
            StorageHandler.get("geminiApiKey", resolve);
        });
        const hasKey = !!keyResult.geminiApiKey;
        const modeLabel = hasKey ? "AI Summary (Online)" : "Fallback Summary (Offline)";

        showSummaryResult(`Loading ${modeLabel}...`, "loading");

        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0] && tabs[0].id) {
                // Send a message to content.js to trigger the summarization logic
                const response = await chrome.tabs.sendMessage(tabs[0].id, {
                    action: "summarizePage",
                });

                if (response && response.success) {
                    summaryText = response.summary; 
                    showSummaryResult(summaryText, ""); 
                } else if (response && response.summary) {
                    summaryText = "";
                    showSummaryResult(response.summary, "error");
                } else {
                    summaryText = "";
                    showSummaryResult("Failed to get summary. Content script might be unavailable.", "error");
                }
            } else {
                 summaryText = "";
                 showSummaryResult("No active tab found.", "error");
            }
        } catch (error) {
            summaryText = "";
            console.error("Summarization error:", error);
            showSummaryResult(`An error occurred: ${error.message}`, "error");
        } finally {
            ui.summarizeBtn.disabled = false;
            updateSpeakButtonState();
        }
    }
    
    /**
     * Updates the summary output area with the result.
     * @param {string} text - The summary text or status message.
     * @param {string} type - The result type ('loading', 'error', or empty string for success).
     */
    function showSummaryResult(text, type) {
        ui.summaryOutput.textContent = text;
        let className = "summary-output";
        if (type === 'loading') {
            className += " loading";
        } else if (type === 'error') {
            className += " error";
        }
        ui.summaryOutput.className = className;
    }

    // Function to handle the Enabled Toggle
    function handleToggleEnabled() {
        const isEnabled = ui.toggleEnabled.checked;
        StorageHandler.set({ 'enabled': isEnabled });
        ui.summarizeBtn.disabled = !isEnabled;
        
        if (!isEnabled && window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
        }
        
        if (chrome.tabs) {
             chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0] && tabs[0].id) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: "enabledStateChanged",
                        enabled: isEnabled,
                    }).catch(err => console.log("Enabled state message failed:", err));
                }
            });
        }
        updateExtensionBadge(isEnabled);
        updateSpeakButtonState();
    }

    // Function to handle the TTS Toggle
    function handleToggleTTS() {
        const isTTS = ui.toggleTTS.checked;
        StorageHandler.set({ 'enableTTS': isTTS });
        updateSpeakButtonState();
        
        if (chrome.tabs) {
             chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0] && tabs[0].id) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: "ttsStateChanged",
                        enableTTS: isTTS,
                    }).catch(err => console.log("TTS state message failed:", err));
                }
            });
        }
    }

    // --- AI/Mode Status Logic (from old popup.js) ---
    
    /**
     * Checks for the API key and updates the UI mode indicator.
     */
    async function checkAIStatus() {
        StorageHandler.get("geminiApiKey", (result) => {
            const apiKey = result.geminiApiKey;
            if (apiKey) {
                updateStatus("online", "AI Key is set and ready.", "online");
            } else {
                updateStatus("offline", "Key not set. Using Offline Mode.", "offline");
            }
        });
    }

    /**
     * Updates the mode indicator and key status text.
     */
    function updateStatus(status, message, mode) {
        if (ui.keyStatus) {
            ui.keyStatus.textContent = message;
        }

        if (ui.modeIndicator) {
            ui.modeIndicator.textContent = "";
            let iconPath, modeLabel, modeClass;
            
            if (mode === 'online') {
                modeLabel = "AI Mode";
                modeClass = "mode-online";
                iconPath = '<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1010 10A10 10 0 0012 2z"></path><path d="M12 6v6l4 2"></path></svg>';
            } else {
                modeLabel = "Offline Mode";
                modeClass = "mode-offline";
                iconPath = '<svg class="svg-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 22h20L12 2zm0 6v6m0 4h.01"/></svg>';
            }

            ui.modeIndicator.innerHTML = `${iconPath}<span>${modeLabel}</span>`;
            ui.modeIndicator.className = 'mode-indicator ' + modeClass; 
        }
    }

    /**
     * Updates the extension badge text and color.
     */
    function updateExtensionBadge(isEnabled) {
        if (typeof chrome !== 'undefined' && chrome.action) {
            const text = isEnabled ? 'ON' : '';
            const color = isEnabled ? '#6366F1' : [128, 128, 128, 255]; 

            chrome.action.setBadgeText({ text: text });
            chrome.action.setBadgeBackgroundColor({ color: color });
        }
    }
    
    // --- Initialization and Load Settings ---
    
    function loadSettings() {
        // Load all settings from local storage
        StorageHandler.get(["enabled", "enableTTS", "correctionsCount", "wordsImproved", "geminiApiKey"], (result) => {
            const isEnabled = result.enabled !== false; 
            const enableTTS = result.enableTTS !== false; 
            
            // UI updates
            ui.toggleEnabled.checked = isEnabled;
            ui.toggleTTS.checked = enableTTS;
            ui.correctionsCount.textContent = result.correctionsCount || 0;
            ui.wordsImproved.textContent = result.wordsImproved || 0;
            
            // Set initial button states
            ui.summarizeBtn.disabled = !isEnabled;
            
            // Set up listener to re-evaluate the speak button state after speech ends
            if ('speechSynthesis' in window) {
                window.speechSynthesis.onend = updateSpeakButtonState;
                window.speechSynthesis.onerror = updateSpeakButtonState;
            }
            updateSpeakButtonState();

            // Inform content script of initial TTS state
            if (chrome.tabs) {
                 chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0] && tabs[0].id) {
                        chrome.tabs.sendMessage(tabs[0].id, {
                            action: "ttsStateChanged",
                            enableTTS: enableTTS
                        }).catch(err => console.log("Initial TTS state message failed:", err));
                    }
                });
            }

            // Update mode indicator and badge
            checkAIStatus();
            updateExtensionBadge(isEnabled);
        });
    }

    // --- Event Listeners Initialization ---
    if (typeof chrome !== 'undefined' && chrome.tabs) {
        ui.summarizeBtn.addEventListener('click', handleSummarize);
        ui.speakBtn.addEventListener('click', handleSpeak);
    } else {
         console.warn("Chrome tabs API not available. Summarization/Speak buttons will not function.");
    }
    
    ui.toggleEnabled.addEventListener('change', handleToggleEnabled);
    ui.toggleTTS.addEventListener('change', handleToggleTTS);
    
    // Listen for usage stat updates
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local') {
                if (changes.correctionsCount) {
                    ui.correctionsCount.textContent = changes.correctionsCount.newValue || 0;
                }
                if (changes.wordsImproved) {
                    ui.wordsImproved.textContent = changes.wordsImproved.newValue || 0;
                }
                if (changes.geminiApiKey) {
                    checkAIStatus(); // Re-check status when key changes
                }
            }
        });
    }

    // Start the process
    loadSettings();
});
