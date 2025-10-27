// --- Configuration ---
const MIN_CONTENT_LENGTH = 150;
let isTTS = false; // Flag to track TTS setting, loaded from popup state.

// --- Utility Functions ---

/**
 * Strips HTML, reduces whitespace, and cleans up text content from the body.
 * It removes non-content elements like scripts, styles, headers, and footers.
 * @param {string} htmlString - The raw innerHTML of the body.
 * @returns {string} The cleaned, plain text content.
 */
function cleanTextContent(htmlString) {
    // 1. Create a temporary element to strip HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlString;
    
    // Remove scripts, styles, and other non-content elements that clutter content
    ['script', 'style', 'iframe', 'noscript', 'header', 'footer', 'nav', 'aside'].forEach(selector => {
        tempDiv.querySelectorAll(selector).forEach(el => el.remove());
    });

    // 2. Extract plain text
    let text = tempDiv.textContent || tempDiv.innerText || '';

    // 3. Normalize whitespace
    // Replace multiple newlines/tabs/spaces with a single space
    text = text.replace(/[\n\t\r]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

    return text;
}


/**
 * Performs a basic, extractive summarization by taking the first few sentences.
 * This is the core "Offline Mode" logic.
 * @param {string} content The clean text content of the page.
 * @returns {string} The basic summary text.
 */
function fallbackSummarizeText(content) {
    // Attempt to split the content into sentences (basic rule: split by period, exclamation, or question mark followed by space)
    const sentences = content.match(/[^.!?]+[.!?]\s*/g) || [];

    if (sentences.length === 0) {
        return "LOCAL SUMMARY FAILED: The page content is too short or contains no readable sentences to summarize.";
    }

    // Take the first 3 to 5 sentences for a brief summary, but not more than 25% of the total sentences
    const sentenceCount = Math.min(Math.ceil(sentences.length * 0.25), 5); 
    const summary = sentences.slice(0, Math.max(3, sentenceCount)).join(' ').trim();

    return summary.length > 0 
        ? "LOCAL SUMMARY: " + summary
        : "LOCAL SUMMARY FAILED: Could not generate a coherent local summary from available text.";
}

// --- Text-to-Speech (TTS) Handler ---

/**
 * Reads the given text aloud using the browser's SpeechSynthesis API.
 * @param {string} text The text to be spoken.
 */
function speakText(text) {
    if (!isTTS) {
        console.warn("TTS is disabled by the popup toggle.");
        return;
    }

    if ('speechSynthesis' in window) {
        // Stop any currently speaking utterance before starting a new one
        window.speechSynthesis.cancel(); 

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0; 
        utterance.pitch = 1.0;

        window.speechSynthesis.speak(utterance);
        console.log("Speaking summary started.");
    } else {
        console.error("Browser does not support the Web Speech API for Text-to-Speech.");
    }
}


// --- Main Message Listener ---

/**
 * Handles messages sent from the extension popup (e.g., summarize, speak, toggle state).
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    
    // 1. Summarization Request Handler
    if (request.action === "summarizePage") {
        const rawContent = document.body ? document.body.innerHTML : '';
        const cleanContent = cleanTextContent(rawContent);

        if (cleanContent.length < MIN_CONTENT_LENGTH) {
            sendResponse({
                success: false,
                summary: `Content is too short or sparse (less than ${MIN_CONTENT_LENGTH} characters of clean text) to summarize.`,
            });
            // Return true to indicate we will send a response asynchronously
            return true; 
        }

        const summary = fallbackSummarizeText(cleanContent);
        
        sendResponse({
            success: true,
            summary: summary,
        });
        
        // Return true to indicate we will send a response asynchronously
        return true; 
    }

    // 2. Text-to-Speech Request Handler
    if (request.action === "speakText") {
        if (request.text) {
            speakText(request.text);
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, message: "No text provided for TTS." });
        }
        // Return true to indicate we will send a response asynchronously
        return true;
    }
    
    // 3. State Change Handler (from toggles)
    if (request.action === "enabledStateChanged" || request.action === "ttsStateChanged") {
        const isEnabled = request.enabled !== undefined ? request.enabled : true;
        
        // Update TTS flag if provided in the message
        if (request.enableTTS !== undefined) {
             isTTS = request.enableTTS;
        }

        // If the entire extension is disabled or TTS is disabled, stop speech
        if ((!isEnabled || !isTTS) && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        console.log(`State updated. Extension Enabled: ${isEnabled}, TTS: ${isTTS}`);
        // No response is needed for state changes, so return is not strictly required but harmless.
        return true; 
    }
});

console.log("Refyne Assistant Content Script Initialized (Offline Fallback Mode).");
