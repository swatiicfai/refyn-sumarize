/**
 * content.js
 * Content script injected into the active web page.
 * Handles communication with popup.js and external AI services.
 * This version supports both real-time text correction and page summarization.
 */

// Global variables for AI interaction
// NOTE: API_KEY is now retrieved dynamically from chrome.storage.local
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent";
const MAX_RETRIES = 3;
const MAX_TEXT_LENGTH = 15000; // API limits and performance considerations

// Global state for extension features (from the Refyne code provided)
let debounceTimeout = null;
let activeTarget = null;
let activeSuggestion = null;
let isEnabled = true;
let tooltipManager = null;
let aiEngine = null;
let textAnalyzer = null;

// --- 1. Helper Functions for Gemini API Communication with Retry ---

/**
 * Retrieves the Gemini API key from local storage.
 * @returns {Promise<string|null>} The API key or null if not found.
 */
function getApiKey() {
    return new Promise(resolve => {
        chrome.storage.local.get("geminiApiKey", (result) => {
            resolve(result.geminiApiKey || null);
        });
    });
}

/**
 * Implements exponential backoff for API calls.
 * @param {Function} apiCall - The function that returns a Promise for the API call.
 * @param {number} retries - Current number of retries left.
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(apiCall, retries = MAX_RETRIES) {
    try {
        const response = await apiCall();
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response;
    } catch (error) {
        if (retries === 0) {
            throw new Error(`API call failed after ${MAX_RETRIES} retries: ${error.message}`);
        }
        const delay = Math.pow(2, MAX_RETRIES - retries) * 1000; // Exponential delay
        console.warn(`API call failed. Retrying in ${delay / 1000}s... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry(apiCall, retries - 1);
    }
}

/**
 * Calls the Gemini API to summarize the provided text.
 * @param {string} text - The text to summarize.
 * @returns {Promise<string>} The generated summary or an error message.
 */
async function summarizeText(text) {
    const API_KEY = await getApiKey(); // Retrieve the stored API key

    if (!API_KEY) {
        return "Error: Gemini API Key is not set in the extension popup. Cannot perform online summarization.";
    }

    const systemPrompt = "You are a professional summarization assistant. Summarize the following document content concisely and clearly in two to three paragraphs. Focus only on the main topics and conclusions.";
    const userQuery = `Please summarize this content: \n\n ${text}`;

    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
    };

    const apiCall = () => fetch(API_URL + `?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    try {
        const response = await fetchWithRetry(apiCall);
        const result = await response.json();
        const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (generatedText) {
            return generatedText;
        } else {
            console.error("Gemini API response missing generated text:", result);
            return "AI failed to generate a summary. The input might be too complex or too short or the API key may be invalid.";
        }
    } catch (error) {
        console.error("Summarization API error:", error);
        return `AI service error: ${error.message}`;
    }
}

// --- 2. Feature-Specific Functions (from the Refyne code provided) ---

function getTextFromElement(el) {
    if (el.isContentEditable) return el.textContent || el.innerText || "";
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return el.value || "";
    return "";
}

function applySuggestion(target, original, corrected) {
    const currentText = getTextFromElement(target);
    if (!currentText.includes(original)) return false;

    try {
        if (target.isContentEditable) {
            target.textContent = currentText.replace(original, corrected);
            target.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            target.value = currentText.replace(original, corrected);
            const pos = currentText.indexOf(original) + corrected.length;
            target.setSelectionRange(pos, pos);
            target.dispatchEvent(new Event('input', { bubbles: true }));
        }

        chrome.runtime.sendMessage({ 
            action: 'correctionApplied', 
            original, 
            corrected,
            source: aiEngine.isOfflineMode() ? 'offline' : 'ai'
        }).catch(err => console.log('Background message failed:', err));
        
        tooltipManager.showStatus("Suggestion applied!", "success");
        setTimeout(() => tooltipManager.hideStatus(), 2000);
        return true;
    } catch (error) {
        console.error("Failed to apply suggestion:", error);
        tooltipManager.showStatus("Failed to apply suggestion", "error");
        setTimeout(() => tooltipManager.hideStatus(), 2000);
        return false;
    }
}

async function handleInput(e) {
    const target = e.target;
    const isEditable = target.isContentEditable || 
                        target.tagName === "TEXTAREA" || 
                        (target.tagName === "INPUT" && ['text','email','search','url','textarea'].includes(target.type));

    if (!isEditable || !isEnabled || !aiEngine || !textAnalyzer) return;
    
    tooltipManager.hide();
    clearTimeout(debounceTimeout);
    
    debounceTimeout = setTimeout(async () => {
        const text = getTextFromElement(target);
        if (!text || text.trim().length < 3) return;

        // Re-check enabled state (using the same structure as in the Refyne code)
        try {
            const response = await new Promise(resolve => {
                chrome.runtime.sendMessage({ action: 'checkEnabled' }, resolve);
            });
            isEnabled = response?.enabled !== false;
        } catch (err) {
            isEnabled = true;
        }

        if (!isEnabled) return;

        const suggestion = await aiEngine.getSuggestions(text);
        if (!suggestion) return;

        activeTarget = target;
        activeSuggestion = suggestion;

        const insights = textAnalyzer.analyzeText(text);
        
        tooltipManager.showWithInsights(
            target,
            suggestion,
            insights,
            () => {
                applySuggestion(target, suggestion.original, suggestion.corrected);
                activeTarget = null;
                activeSuggestion = null;
            }
        );
    }, 2000);
}


// --- 3. Page Text Extraction ---

/**
 * Extracts readable, visible text from the page DOM.
 * @returns {string} The concatenated text content.
 */
function extractPageText() {
    // Select common text-containing elements
    const selectors = 'p, h1, h2, h3, h4, h5, li, blockquote, article';
    const elements = document.querySelectorAll(selectors);
    let allText = [];

    elements.forEach(el => {
        const text = el.textContent.trim();
        // Simple check to ensure element is visible and has significant text
        if (text.length > 50 && el.offsetHeight > 0) {
            allText.push(text);
        }
    });

    let content = allText.join('\n\n');

    // Truncate content to avoid large API requests
    if (content.length > MAX_TEXT_LENGTH) {
        content = content.substring(0, MAX_TEXT_LENGTH);
        console.log(`Content truncated to ${MAX_TEXT_LENGTH} characters.`);
    }

    return content;
}

// --- 4. Initialization and Message Handling ---

async function init() {
    console.log("AI Assistant content script initializing...");
    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for robustness
    
    // NOTE: Requires external libraries TextAnalyzer, AIEngine, and TooltipManager
    // to be loaded in the page context.
    try {
        textAnalyzer = new window.TextAnalyzer();
        aiEngine = new window.AIEngine();
        tooltipManager = new window.TooltipManager();
    } catch (error) {
        console.error("Failed to initialize required components (TextAnalyzer, AIEngine, TooltipManager). Ensure they are included in manifest 'web_accessible_resources'.", error);
        return;
    }
    
    // Get initial enabled state
    try {
        const response = await new Promise(resolve => {
            chrome.storage.sync.get(['enableExtension'], resolve);
        });
        isEnabled = response?.enableExtension !== false;
    } catch (err) {
        console.error("Error checking enabled state:", err);
        isEnabled = true;
    }
    
    await aiEngine.initialize();
    
    console.log("AI Assistant initialized successfully!");
    console.log("AI Mode:", aiEngine.isAIAvailable() ? "Active" : "Unavailable");
    console.log("Offline Mode:", aiEngine.isOfflineMode() ? "Active" : "Inactive");
    
    function hideTooltipOnClick(e) {
        if (!tooltipManager.contains(e.target)) {
            tooltipManager.hide();
        }
    }
    
    function hideTooltipOnScroll(e) {
        if (tooltipManager.contains(e.target)) {
            return;
        }
        tooltipManager.hide();
    }
    
    // Clean up existing listeners before re-adding
    document.removeEventListener("input", handleInput, true);
    document.removeEventListener("click", hideTooltipOnClick, true);
    document.removeEventListener("scroll", hideTooltipOnScroll, true);
    
    // Attach new listeners for real-time analysis
    document.addEventListener("input", handleInput, true);
    document.addEventListener("click", hideTooltipOnClick, true);
    document.addEventListener("scroll", hideTooltipOnScroll, true);
}


/**
 * Listener for messages from the extension popup.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Mandatory: return true for asynchronous responses
    let isAsync = false;

    if (request.action === 'enabledStateChanged') {
        isEnabled = request.enabled;
        if (tooltipManager) {
            if (!isEnabled) {
                tooltipManager.hide();
                aiEngine?.stopSpeaking();
            }
            tooltipManager.showStatus(
                isEnabled ? "AI Assistant enabled" : "AI Assistant disabled", 
                isEnabled ? "success" : "warning"
            );
            setTimeout(() => tooltipManager.hideStatus(), 2000);
        }
    }
    
    if (request.action === 'showTextInsights' && request.text) {
        if (textAnalyzer && tooltipManager) {
             const insights = textAnalyzer.analyzeText(request.text);
             tooltipManager.showInsightsOnly(request.text, insights);
        }
    }
    
    if (request.action === 'getAIStatus') {
        if (aiEngine) {
             aiEngine.getStatus().then(status => sendResponse(status));
             return true; // Indicates an asynchronous response
        } else {
             sendResponse({ status: "unavailable", message: "Initialization Pending", mode: "offline" });
        }
    }
    
    if (request.action === 'checkText' && request.text) {
        if (aiEngine && tooltipManager) {
            tooltipManager.showStatus("Checking selected text...", "info");
            aiEngine.getSuggestions(request.text).then(suggestion => {
                if (suggestion) {
                    tooltipManager.showCenteredSuggestion(suggestion, request.text);
                } else {
                    tooltipManager.showStatus("No suggestions available", "info");
                    setTimeout(() => tooltipManager.hideStatus(), 3000);
                }
            });
            return true;
        }
    }

    // --- Summarization Logic (Updated) ---
    if (request.action === "summarizePage") {
        isAsync = true; // This response will be asynchronous

        (async () => {
            const pageText = extractPageText();
            if (pageText.length < 500) {
                // Not enough content to summarize
                sendResponse({
                    summary: "Page content is too short (less than 500 characters) to generate a meaningful summary.",
                    success: false
                });
                return;
            }

            const summary = await summarizeText(pageText);

            // Check for explicit error message from summarizeText (which indicates missing key or API failure)
            if (summary.startsWith("Error:")) {
                sendResponse({
                    summary: summary,
                    success: false
                });
            } else {
                 sendResponse({
                    summary: summary,
                    success: true
                });
            }
        })();
    }

    return isAsync;
});


// Start initialization when the DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

console.log("AI Assistant Content Script loaded.");
