// --- Configuration ---
const MIN_CONTENT_LENGTH = 150;
let isTTS = false; // Flag to track TTS setting

// --- Utility Functions ---

/**
 * Strips HTML, reduces whitespace, and cleans up text content from the body.
 * @param {string} htmlString - The raw innerHTML of the body.
 * @returns {string} The cleaned, plain text.
 */
function cleanTextContent(htmlString) {
    // 1. Create a temporary element to strip HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlString;
    
    // Remove scripts, styles, and other non-content elements
    ['script', 'style', 'iframe', 'noscript', 'header', 'footer', 'nav', '.sidebar'].forEach(selector => {
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
 * This is a highly simplified fallback for environments without a robust LLM API.
 * @param {string} content The clean text content of the page.
 * @returns {string} The basic summary text.
 */
function fallbackSummarizeText(content) {
    // Attempt to split the content into sentences (basic rule: split by period followed by space)
    const sentences = content.match(/[^.!?]+[.!?]/g) || [];

    if (sentences.length === 0) {
        return "The page content is too short or contains no readable sentences to summarize.";
    }

    // Take the first 3 to 5 sentences for a brief summary, or up to 25% of sentences
    const sentenceCount = Math.min(Math.ceil(sentences.length * 0.25), 5); 
    const summary = sentences.slice(0, Math.max(3, sentenceCount)).join(' ').trim();

    return summary.length > 0 
        ? "LOCAL SUMMARY (Extractive): " + summary
        : "Could not generate a coherent local summary from available text.";
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

    // Check if the SpeechSynthesis API is supported
    if ('speechSynthesis' in window) {
        // Stop any currently speaking utterance
        window.speechSynthesis.cancel(); 

        const utterance = new SpeechSynthesisUtterance(text);
        
        // Optional: Set voice, pitch, and rate for better quality
        // Note: Voices are browser/system dependent. 'default' is often adequate.
        utterance.rate = 1.0; 
        utterance.pitch = 1.0;
        // utterance.voice = window.speechSynthesis.getVoices().find(voice => voice.name === 'Google US English'); 

        window.speechSynthesis.speak(utterance);
        console.log("Speaking summary...");
    } else {
        console.error("Browser does not support the Web Speech API for Text-to-Speech.");
    }
}


// --- Main Message Listener ---

/**
 * Handles messages sent from the extension popup.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Check if the action is to summarize the page
    if (request.action === "summarizePage") {
        const rawContent = document.body ? document.body.innerHTML : '';
        const cleanContent = cleanTextContent(rawContent);

        if (cleanContent.length < MIN_CONTENT_LENGTH) {
            sendResponse({
                success: false,
                summary: `Content is too short (less than ${MIN_CONTENT_LENGTH} characters) or mostly unreadable to summarize.`,
            });
            return true; // Keep the message channel open for sendResponse
        }

        // Use the local fallback summarization
        const summary = fallbackSummarizeText(cleanContent);
        
        // Send the result back to the popup
        sendResponse({
            success: true,
            summary: summary,
        });
        
        return true; // Keep the message channel open for sendResponse
    }

    // Check if the action is to read the text aloud
    if (request.action === "speakText") {
        if (request.text) {
            speakText(request.text);
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, message: "No text provided for TTS." });
        }
        return true;
    }
    
    // Handle state changes from the popup
    if (request.action === "enabledStateChanged") {
        // The 'enabled' state mostly affects the popup UI, but we can update TTS setting too
        isTTS = request.enableTTS !== undefined ? request.enableTTS : isTTS;
        console.log(`Extension enabled state received. TTS is now: ${isTTS}`);
        return true;
    }
    
    if (request.action === "ttsStateChanged") {
        isTTS = request.enableTTS;
        console.log(`TTS state updated to: ${isTTS}`);
        if (!isTTS && 'speechSynthesis' in window) {
            // If TTS is disabled, stop any current speech
            window.speechSynthesis.cancel();
        }
        return true;
    }
});

console.log("Refyne Assistant Content Script Initialized (Offline Fallback Mode).");
