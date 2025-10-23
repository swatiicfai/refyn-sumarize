console.log("Refyne content script loaded");

const tooltip = document.createElement("div");
Object.assign(tooltip.style, {
    position: "fixed",
    background: "#fff",
    border: "1px solid #ccc",
    padding: "12px 16px",
    borderRadius: "8px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
    zIndex: "1000000",
    display: "none",
    fontSize: "14px",
    maxWidth: "400px",
    minWidth: "300px",
    cursor: "pointer",
    fontFamily: "Arial, sans-serif",
    lineHeight: "1.5"
});
document.body.appendChild(tooltip);

let debounceTimeout = null;
let activeTarget = null;
let activeSuggestion = null;
let rewriterInstance = null;
let isDownloading = false;
let isEnabled = true;
let downloadAttempted = false;
let downloadProgress = 0;

function isChromeAIAvailable() {
    return 'Rewriter' in self;
}
async function monitorDownloadProgress() {
    if (!isChromeAIAvailable()) return;
    
    try {
        const checkProgress = setInterval(async () => {
            const availability = await Rewriter.availability();
            
            if (availability === 'available') {
                console.log("Download completed!");
                isDownloading = false;
                showStatusMessage("AI model ready! Start typing to get suggestions.", "success");
                setTimeout(hideStatusMessage, 3000);
                clearInterval(checkProgress);
            } else if (availability === 'downloading') {
                console.log("Download in progress...");
                isDownloading = true;
                showStatusMessage("Downloading AI model...", "info");
            }
        }, 2000);
        setTimeout(() => {
            clearInterval(checkProgress);
        }, 300000);
        
    } catch (error) {
        console.error("Download monitoring error:", error);
    }
}
async function initializeRewriter() {
    if (!isChromeAIAvailable()) {
        console.log("Rewriter API not available in this browser");
        showStatusMessage("AI features not available in this browser", "error");
        return false;
    }

    try {
        const availability = await Rewriter.availability();
        console.log("Rewriter availability:", availability);

        if (availability === 'unavailable') {
            console.log("Rewriter API is unavailable");
            showStatusMessage("AI model unavailable. Check Chrome flags.", "error");
            return false;
        }

        if (availability === 'downloadable' && !downloadAttempted) {
            console.log("AI model needs download - triggering...");
            isDownloading = true;
            downloadAttempted = true;
            showStatusMessage("Downloading AI model... This may take a few minutes.", "info");
            
            monitorDownloadProgress();
        }

        console.log("Creating Rewriter instance...");
        rewriterInstance = await Rewriter.create({
            outputLanguage: 'en',
            expectedInputLanguages: ['en'],
            expectedContextLanguages: ['en']
        });

        console.log("Rewriter initialized successfully");
        const finalAvailability = await Rewriter.availability();
        console.log("Final availability:", finalAvailability);
        
        if (finalAvailability === 'available') {
            console.log("Model is ready to use!");
            isDownloading = false;
            showStatusMessage("AI model ready!", "success");
            setTimeout(hideStatusMessage, 2000);
        } else if (finalAvailability === 'downloading') {
            console.log("Download in progress...");
            isDownloading = true;
            showStatusMessage("Downloading AI model...", "info");
        }
        
        return true;
    } catch (error) {
        console.error("Failed to initialize Rewriter:", error);
        
        if (error.message.includes('download') || error.message?.includes('Download')) {
            showStatusMessage("Download in progress...", "info");
            monitorDownloadProgress();
        } else {
            showStatusMessage("Failed to initialize AI features", "error");
        }
        return false;
    }
}

function showStatusMessage(message, type = "info") {
    let statusDiv = document.getElementById("refyne-status-message");
    if (!statusDiv) {
        statusDiv = document.createElement("div");
        statusDiv.id = "refyne-status-message";
        Object.assign(statusDiv.style, {
            position: "fixed",
            top: "20px",
            right: "20px",
            padding: "12px 16px",
            borderRadius: "6px",
            zIndex: "1000001",
            fontSize: "14px",
            fontFamily: "Arial, sans-serif",
            fontWeight: "500",
            maxWidth: "300px",
            transition: "opacity 0.3s"
        });
        document.body.appendChild(statusDiv);
    }

    const colors = {
        info: { bg: "#2196F3", text: "white" },
        success: { bg: "#4CAF50", text: "white" },
        error: { bg: "#F44336", text: "white" },
        warning: { bg: "#FF9800", text: "white" }
    };

    const color = colors[type] || colors.info;
    statusDiv.style.background = color.bg;
    statusDiv.style.color = color.text;
    statusDiv.textContent = message;
    statusDiv.style.display = "block";
    statusDiv.style.opacity = "1";
}

function hideStatusMessage() {
    const statusDiv = document.getElementById("refyne-status-message");
    if (statusDiv) {
        statusDiv.style.opacity = "0";
        setTimeout(() => {
            statusDiv.style.display = "none";
        }, 300);
    }
}

async function getSuggestions(text) {
    if (!text || text.trim().length < 5) return null;
    if (!rewriterInstance) return null;
    if (isDownloading) return null;
    if (!isEnabled) return null;

    try {
        const availability = await Rewriter.availability();
        if (availability !== 'available') return null;

        console.log("Getting suggestions for text:", text.substring(0, 50) + "...");
        
        const result = await rewriterInstance.rewrite(text, {
            context: "Improve this text for clarity, grammar, and professionalism while keeping the original meaning."
        });
        
        if (!result || result.trim() === text.trim()) return null;

        return {
            original: text,
            corrected: result,
            reason: "AI-improved version"
        };
    } catch (err) {
        console.error("Rewriter API error:", err);
        return null;
    }
}

function showTooltip(html, x, y, applyCallback) {
    tooltip.innerHTML = html;
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let finalX = x;
    let finalY = y;
    
    if (x + 400 > viewportWidth) finalX = viewportWidth - 420;
    if (y + 200 > viewportHeight) finalY = y - 220;
    
    tooltip.style.left = finalX + "px";
    tooltip.style.top = finalY + "px";
    tooltip.style.display = "block";

    tooltip.onclick = (e) => {
        e.stopPropagation();
        applyCallback();
        hideTooltip();
    };
}

function hideTooltip() {
    tooltip.style.display = "none";
}

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
            corrected 
        }).catch(err => console.log('Background message failed:', err));
        
        showStatusMessage("Suggestion applied!", "success");
        setTimeout(hideStatusMessage, 2000);
        return true;
    } catch (error) {
        console.error("Failed to apply suggestion:", error);
        showStatusMessage("Failed to apply suggestion", "error");
        setTimeout(hideStatusMessage, 2000);
        return false;
    }
}

async function handleInput(e) {
    const target = e.target;
    const isEditable = target.isContentEditable || 
                      target.tagName === "TEXTAREA" || 
                      (target.tagName === "INPUT" && ['text','email','search','url','textarea'].includes(target.type));

    if (!isEditable || !isEnabled) return;
    
    hideTooltip();
    clearTimeout(debounceTimeout);
    
    debounceTimeout = setTimeout(async () => {
        const text = getTextFromElement(target);
        if (!text || text.trim().length < 5) return;

        try {
            const response = await new Promise(resolve => {
                chrome.runtime.sendMessage({ action: 'checkEnabled' }, resolve);
            });
            isEnabled = response?.enabled !== false;
        } catch (err) {
            isEnabled = true;
        }

        if (!isEnabled) return;

        const availability = await Rewriter.availability();
        if (availability !== 'available') {
            if (availability === 'downloading') {
                showStatusMessage("AI model downloading...", "info");
                setTimeout(hideStatusMessage, 2000);
            }
            return;
        }

        const suggestion = await getSuggestions(text);
        if (!suggestion) return;

        activeTarget = target;
        activeSuggestion = suggestion;

        const rect = target.getBoundingClientRect();
        const tooltipContent = `
            <div style="font-weight:bold;color:#4caf50;margin-bottom:8px;font-size:16px;">Refyne AI Suggestion</div>
            <div style="color:#666;text-decoration:line-through;font-size:13px;margin-bottom:6px;padding:4px;background:#f5f5f5;border-radius:4px;">${suggestion.original}</div>
            <div style="color:#2e7d32;font-weight:500;margin-bottom:8px;padding:4px;background:#e8f5e8;border-radius:4px;">${suggestion.corrected}</div>
            <div style="font-size:12px;color:#666;text-align:center;border-top:1px solid #eee;padding-top:8px;">Click to apply suggestion</div>
        `;
        
        showTooltip(
            tooltipContent,
            rect.left + window.scrollX,
            rect.bottom + window.scrollY + 8,
            () => {
                applySuggestion(target, suggestion.original, suggestion.corrected);
                activeTarget = null;
                activeSuggestion = null;
            }
        );
    }, 2000);
}

async function getAIStatus() {
    if (!isChromeAIAvailable()) {
        return { status: 'unavailable', message: 'AI API Not Available' };
    }

    try {
        const availability = await Rewriter.availability();
        
        let message = '';
        switch(availability) {
            case 'available': message = 'AI Model Ready'; break;
            case 'downloadable': message = 'AI Model Needs Download'; break;
            case 'downloading': message = 'Downloading AI Model'; break;
            case 'unavailable': default: message = 'AI Model Unavailable'; break;
        }
        
        return { 
            status: availability, 
            message: message,
            progress: downloadProgress
        };
    } catch (error) {
        return { status: 'unavailable', message: 'Error Checking Status' };
    }
}
(async function init() {
    console.log("Refyne content script initializing...");
    console.log("Rewriter API available:", isChromeAIAvailable());
    
    try {
        const response = await new Promise(resolve => {
            chrome.runtime.sendMessage({ action: 'checkEnabled' }, resolve);
        });
        isEnabled = response?.enabled !== false;
    } catch (err) {
        isEnabled = true;
    }
    
    const initialized = await initializeRewriter();
    if (initialized) {
        console.log("Refyne initialized successfully!");
        
        document.addEventListener("input", handleInput, true);
        document.addEventListener("click", (e) => { 
            if (!tooltip.contains(e.target)) hideTooltip(); 
        }, true);
        document.addEventListener("scroll", hideTooltip, true);
    } else {
        console.log("Refyne initialization failed");
    }
})();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'enabledStateChanged') {
        isEnabled = request.enabled;
        if (!isEnabled) hideTooltip();
        showStatusMessage(isEnabled ? "Refyne enabled" : "Refyne disabled", isEnabled ? "success" : "warning");
        setTimeout(hideStatusMessage, 2000);
    }
    
    if (request.action === 'getAIStatus') {
        getAIStatus().then(status => sendResponse(status));
        return true;
    }
    
    if (request.action === 'checkText' && request.text) {
        showStatusMessage("Checking selected text...", "info");
        getSuggestions(request.text).then(suggestion => {
            if (suggestion) {
                showTooltip(
                    `<div style="font-weight:bold;color:#4caf50;margin-bottom:8px;">Suggestion:</div>
                     <div>${suggestion.corrected}</div>`,
                    window.innerWidth / 2,
                    window.innerHeight / 2,
                    () => {
                        showStatusMessage("Copy the suggestion manually", "info");
                        setTimeout(hideStatusMessage, 3000);
                        hideTooltip();
                    }
                );
            } else {
                showStatusMessage("No suggestions available", "info");
                setTimeout(hideStatusMessage, 3000);
            }
        });
    }
});