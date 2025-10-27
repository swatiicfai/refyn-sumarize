document.addEventListener("DOMContentLoaded", async function () {
    const toggle = document.getElementById("toggleEnabled");
    const statusDiv = document.getElementById("status");
    const correctionsCount = document.getElementById("correctionsCount");
    const wordsImproved = document.getElementById("wordsImproved");
    const modeIndicator = document.getElementById("modeIndicator");
    const toggleTTS = document.getElementById("toggleTTS");
    
    // New elements for summarization
    const summarizeButton = document.getElementById("summarizePageButton");
    const summaryOutput = document.getElementById("summaryOutput");

    // Elements for API Key handling
    const apiKeyInput = document.getElementById("geminiApiKeyInput"); // Assuming this ID
    const saveApiKeyButton = document.getElementById("saveApiKeyButton"); // Assuming this ID
    const keyStatus = document.getElementById("keyStatus"); // Assuming the 'Key not set.' element has this ID

    // --- Initial Load from Storage ---

    chrome.storage.local.get(
        ["enabled", "correctionsCount", "wordsImproved", "geminiApiKey"], // Added geminiApiKey
        (result) => {
            toggle.checked = result.enabled !== false;
            correctionsCount.textContent = result.correctionsCount || 0;
            wordsImproved.textContent = result.wordsImproved || 0;
            
            // Populate API Key field if already set
            if (apiKeyInput && result.geminiApiKey) {
                apiKeyInput.value = result.geminiApiKey;
                // Mask the key on load for security, showing only the length
                apiKeyInput.type = 'password'; 
                keyStatus.textContent = "Key is set.";
            } else if (keyStatus) {
                keyStatus.textContent = "Key not set.";
            }

            updateExtensionBadge(toggle.checked);
        }
    );
    chrome.storage.sync.get(["enableTTS"], (result) => {
        toggleTTS.checked = result.enableTTS !== false;
    });

    // --- API Key Save Handler ---
    if (saveApiKeyButton && apiKeyInput) {
        saveApiKeyButton.addEventListener("click", function () {
            const key = apiKeyInput.value.trim();
            if (key) {
                // Save the key using Chrome storage
                chrome.storage.local.set({ geminiApiKey: key }, () => {
                    keyStatus.textContent = "Key saved successfully.";
                    apiKeyInput.type = 'password';
                    apiKeyInput.value = key; // Keep the key masked
                    // Re-check AI status after saving the key
                    checkAIStatus(); 
                });
            } else {
                chrome.storage.local.remove('geminiApiKey', () => {
                    keyStatus.textContent = "Key cleared.";
                    apiKeyInput.type = 'text'; // Show placeholder text again
                    checkAIStatus();
                });
            }
        });
    }


    // --- Other Event Listeners ---

    toggleTTS.addEventListener("change", function () {
        chrome.storage.sync.set({ enableTTS: this.checked });
    });

    toggle.addEventListener("change", function () {
        const isEnabled = this.checked;
        chrome.storage.local.set({ enabled: isEnabled }, () => {
            updateExtensionBadge(isEnabled);
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0] && tabs[0].id) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: "enabledStateChanged",
                        enabled: isEnabled,
                    }).catch((err) => console.log("Tab message failed:", err));
                }
            });
        });
    });

    // Attach summarization listener if elements exist
    if (summarizeButton && summaryOutput) {
        summarizeButton.addEventListener("click", handleSummarizationClick);
    }
    
    // Check AI status immediately
    checkAIStatus();

    // Listen for usage stat updates
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            if (changes.correctionsCount) {
                correctionsCount.textContent = changes.correctionsCount.newValue || 0;
            }
            if (changes.wordsImproved) {
                wordsImproved.textContent = changes.wordsImproved.newValue || 0;
            }
            if (changes.geminiApiKey) {
                if (changes.geminiApiKey.newValue) {
                    keyStatus.textContent = "Key is set.";
                    apiKeyInput.type = 'password';
                } else {
                    keyStatus.textContent = "Key not set. Using Offline Mode.";
                    apiKeyInput.type = 'text';
                }
                // Re-check AI status when key changes to update mode indicator
                checkAIStatus(); 
            }
        }
    });

    // --- Summarization Handler (Refined for mode clarity) ---

    async function handleSummarizationClick() {
        summarizeButton.disabled = true;

        // Determine the current operational mode for the loading message
        const keyResult = await new Promise(resolve => {
            chrome.storage.local.get("geminiApiKey", resolve);
        });
        const hasKey = !!keyResult.geminiApiKey;
        const modeLabel = hasKey ? "AI Summary (Online)" : "Fallback Summary (Offline)";

        showSummaryResult(`Loading ${modeLabel}...`, "info");

        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0] && tabs[0].id) {
                // Send message to content.js to trigger the summarization logic
                // content.js decides if it runs AI or the offline fallback based on the key
                const response = await chrome.tabs.sendMessage(tabs[0].id, {
                    action: "summarizePage",
                });

                if (response && response.success) {
                    showSummaryResult(response.summary, "success");
                } else if (response && response.summary) {
                    // Handles the 'content too short' error message or explicit API error
                    showSummaryResult(response.summary, "error");
                } else {
                    showSummaryResult("Failed to get summary. Content script might be unavailable.", "error");
                }
            } else {
                 showSummaryResult("No active tab found.", "error");
            }
        } catch (error) {
            console.error("Summarization error:", error);
            showSummaryResult(`An error occurred: ${error.message}`, "error");
        } finally {
            summarizeButton.disabled = false;
        }
    }

    // --- Utility Functions ---

    /**
     * Updates the summary output area with the result.
     * @param {string} text - The summary text or status message.
     * @param {string} type - The result type ('info', 'success', 'error').
     */
    function showSummaryResult(text, type) {
        summaryOutput.textContent = text;
        // The class name will control styling (e.g., color, background)
        summaryOutput.className = `summary-output ${type}`; 
    }


    async function checkAIStatus() {
        // First, check if the key is stored locally
        const keyResult = await new Promise(resolve => {
            chrome.storage.local.get("geminiApiKey", resolve);
        });
        const hasKey = !!keyResult.geminiApiKey;
        
        // If the user has explicitly set a key, assume online/AI mode is preferred
        if (hasKey) {
            updateStatus("available", "API Key Loaded. AI Ready (Online Mode).", "ai");
            if (keyStatus) keyStatus.textContent = "Key is set.";
        } else {
            if (keyStatus) keyStatus.textContent = "Key not set. Using Offline Mode.";
            
            // Proceed to check for system support if key is not set
            try {
                const tabs = await chrome.tabs.query({
                    active: true,
                    currentWindow: true,
                });
                
                if (tabs[0] && tabs[0].id) {
                    // Ask content script for status (which includes offline/internal AI status)
                    const response = await chrome.tabs.sendMessage(tabs[0].id, {
                        action: "getAIStatus",
                    });

                    if (response) {
                        updateStatus(response.status, response.message, response.mode);
                        return;
                    }
                }
            } catch (error) {
                // This usually happens if the content script hasn't loaded or page is restricted
                console.log("Could not get AI status from content script, falling back to system check:", error);
            }
            
            // If content script failed to respond or didn't have AI capabilities (response.mode === "offline")
            const hasAISupport = await checkSystemAISupport();
            if (hasAISupport) {
                 // The system *could* support AI, but the key is missing, so we use offline fallback.
                 updateStatus("downloadable", "AI Supported, but Key is missing. Using Offline Fallback.", "offline");
            } else {
                 // System does not support AI, so we default to offline fallback.
                 updateStatus("unavailable", "AI Not Supported - Using Offline Fallback", "offline");
            }
        }
    }

    async function checkSystemAISupport() {
        const chromeVersion = navigator.userAgent.match(/Chrome\/([0-9]+)/)?.[1];
        if (!chromeVersion || parseInt(chromeVersion) < 137) {
            return false;
        }
        
        const userAgent = navigator.userAgent;
        const isSupportedOS =
            userAgent.includes("Windows") ||
            userAgent.includes("Mac OS") ||
            userAgent.includes("Linux") ||
            userAgent.includes("CrOS");

        return isSupportedOS;
    }

    function updateStatus(status, message, mode) {
        if (modeIndicator) {
            const iconSvg = mode === "offline" 
                ? '<svg class="svg-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 22h20L12 2zm0 6v6m0 4h.01"/></svg>'
                : '<svg class="svg-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.2H22l-6 4.8 2.4 7.2L12 17.2l-6.4 4 2.4-7.2-6-4.8h7.6z"/></svg>';
            
            modeIndicator.innerHTML = `${iconSvg}<span>${mode === "offline" ? "Offline" : "AI"} Mode</span>`;
            
            if (mode === "offline") {
                modeIndicator.style.background = "linear-gradient(135deg, #FEF3C7, #FDE68A)";
                modeIndicator.style.color = "#92400E";
                modeIndicator.style.borderColor = "#F59E0B";
            } else {
                modeIndicator.style.background = "linear-gradient(135deg, #D1FAE5, #A7F3D0)";
                modeIndicator.style.color = "#065F46";
                modeIndicator.style.borderColor = "#10B981";
            }
        }
        let statusIcon, statusClass;
        switch (status) {
            case "available":
                statusIcon = '<svg class="svg-icon" viewBox="0 0 24 24" fill="currentColor" style="width: 16px; height: 16px; margin-right: 8px;"><path d="M20 6L9 17l-5-5"/></svg>';
                statusClass = "status ready";
                break;
            case "downloading":
            case "downloadable":
                statusIcon = '<svg class="svg-icon" viewBox="0 0 24 24" fill="currentColor" style="width: 16px; height: 16px; margin-right: 8px;"><path d="M12 2a10 10 0 1010 10A10 10 0 0012 2zm0 18a8 8 0 118-8 8 8 0 01-8 8z"/><path d="M12 6v6l4 2"/></svg>';
                statusClass = "status downloading";
                break;
            case "unavailable":
            default:
                statusIcon = '<svg class="svg-icon" viewBox="0 0 24 24" fill="currentColor" style="width: 16px; height: 16px; margin-right: 8px;"><path d="M12 2L2 22h20L12 2zm0 6v6m0 4h.01"/></svg>';
                statusClass = "status error";
                break;
        }

        statusDiv.className = statusClass;
        statusDiv.innerHTML = `${statusIcon}${message}`;
    }

    function updateExtensionBadge(isEnabled) {
        chrome.action.setBadgeText({ text: isEnabled ? "ON" : "OFF" });
        chrome.action.setBadgeBackgroundColor({
            color: isEnabled ? "#6366F1" : "#9CA3AF",
        });
    }

    chrome.storage.local.get(["correctionsCount", "wordsImproved"], (result) => {
        correctionsCount.textContent = result.correctionsCount || 0;
        wordsImproved.textContent = result.wordsImproved || 0;
    });
});
