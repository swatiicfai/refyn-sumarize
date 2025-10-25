console.log("Refyne content script loaded");

const tooltip = document.createElement("div");
Object.assign(tooltip.style, {
    position: "fixed",
    border: "1px solid #E5E7EB",
    padding: "20px",
    borderRadius: "16px",
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
    zIndex: "1000000",
    display: "none",
    fontSize: "14px",
    maxWidth: "420px",
    minWidth: "320px",
    cursor: "pointer",
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    lineHeight: "1.5",
    backdropFilter: "blur(8px)",
    background: "rgba(255, 255, 255, 0.95)"
});

function getToneColor(toneName) {
    const colors = {
        'Enthusiastic': '#F59E0B',
        'Polite': '#10B981', 
        'Concise': '#3B82F6',
        'Inquiring': '#8B5CF6',
        'Emphatic': '#EF4444',
        'Apologetic': '#6B7280'
    };
    return colors[toneName] || '#6B7280';
}

function getToneEmoji(toneName) {
    const emojis = {
        'Enthusiastic': '🎉',
        'Polite': '🙏',
        'Concise': '⚡',
        'Inquiring': '❓',
        'Emphatic': '💪',
        'Apologetic': '😔'
    };
    return emojis[toneName] || '📝';
}

document.body.appendChild(tooltip);

const animationStyles = document.createElement('style');
animationStyles.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    
    #refyne-tooltip {
        animation: fadeIn 0.3s ease-out;
    }
    
    .tab-content {
        animation: fadeIn 0.2s ease-out;
    }
    
    #listenSuggestion {
        transition: all 0.2s ease;
    }
    
    #listenSuggestion:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);
    }
    
    .tab-button {
        flex: 1;
        padding: 12px 16px;
        border: none;
        background: none;
        cursor: pointer;
        border-bottom: 2px solid transparent;
        color: #6B7280;
        font-size: 13px;
        font-weight: 500;
        transition: all 0.2s ease;
        border-radius: 8px 8px 0 0;
    }
    
    .tab-button:hover {
        background: #F9FAFB !important;
        color: #374151 !important;
    }
    
    .tab-button.active {
        border-bottom-color: #6366F1 !important;
        color: #6366F1 !important;
        font-weight: 600 !important;
        background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
        -webkit-background-clip: text !important;
        -webkit-text-fill-color: transparent !important;
        background-clip: text !important;
    }
    
    .tab-content {
        max-height: 400px;
        overflow-y: auto;
        padding: 4px;
    }
    
    .tab-content::-webkit-scrollbar {
        width: 4px;
    }
    
    .tab-content::-webkit-scrollbar-track {
        background: #F3F4F6;
        border-radius: 2px;
    }
    
    .tab-content::-webkit-scrollbar-thumb {
        background: #D1D5DB;
        border-radius: 2px;
    }
    
    .tab-content::-webkit-scrollbar-thumb:hover {
        background: #9CA3AF;
    }
`;
document.head.appendChild(animationStyles);

tooltip.id = "refyne-tooltip";

let debounceTimeout = null;
let activeTarget = null;
let activeSuggestion = null;
let rewriterInstance = null;
let isDownloading = false;
let isEnabled = true;
let downloadAttempted = false;
let downloadProgress = 0;
let offlineMode = false;
let offlineChecker = null;
let currentWritingStyle = 'professional';

let writingStyleConfig = {
    professional: {
        name: "Professional",
        prompt: "Improve this text for professional communication, making it clear, concise, and business-appropriate while maintaining the original meaning.",
       
    },
    casual: {
        name: "Casual", 
        prompt: "Make this text sound more casual, conversational, and friendly while keeping the original meaning.",
       
    },
    academic: {
        name: "Academic",
        prompt: "Make this text more formal, academic, and suitable for scholarly writing while preserving the original content.",
       
    },
    creative: {
        name: "Creative",
        prompt: "Make this text more creative, engaging, and expressive while maintaining the core message.",
      
    },
    concise: {
        name: "Concise", 
        prompt: "Make this text more concise and to the point, removing unnecessary words while keeping the essential meaning.",
       
    },
    formal: {
        name: "Formal",
        prompt: "Make this text more formal and polished, suitable for official documents or formal communication.",
      
    }
};

function initializeOfflineChecker() {
    offlineChecker = {
        rules: [
            {
                name: "subject_verb_agreement",
                pattern: /\b(He|She|It)\s+(have|do|are|were)\b/gi,
                replacement: (match, p1, p2) => {
                    const corrections = {
                        'have': 'has', 
                        'do': 'does', 
                        'are': 'is', 
                        'were': 'was'
                    };
                    return `${p1} ${corrections[p2.toLowerCase()] || p2}`;
                }
            },
            {
                name: "its_possessive",
                pattern: /\b(its)\s+(a|very|really|so)\b/gi,
                replacement: "it's $2"
            }
        ],
        
        dictionary: {
            'recieve': 'receive',
            'seperate': 'separate',
            'definately': 'definitely',
            'occured': 'occurred',
            'alot': 'a lot',
            'untill': 'until',
            'wich': 'which',
            'teh': 'the',
            'adn': 'and',
            'thier': 'their',
            'tounge': 'tongue',
            'truely': 'truly',
            'wierd': 'weird',
            'neccessary': 'necessary',
            'pronounciation': 'pronunciation'
        },

        checkText(text) {
            if (!text || text.trim().length < 3) return null;

            let corrected = text;
            let corrections = [];
            let hasCorrections = false;
            Object.keys(this.dictionary).forEach(misspelling => {
                const regex = new RegExp(`\\b${misspelling}\\b`, 'gi');
                if (regex.test(corrected)) {
                    const fixed = this.dictionary[misspelling];
                    corrected = corrected.replace(regex, fixed);
                    corrections.push({
                        original: misspelling,
                        corrected: fixed,
                        type: 'spelling'
                    });
                    hasCorrections = true;
                }
            });
            this.rules.forEach(rule => {
                const regex = new RegExp(rule.pattern.source, 'gi');
                let match;
                while ((match = regex.exec(corrected)) !== null) {
                    const original = match[0];
                    const fixed = typeof rule.replacement === 'function' 
                        ? rule.replacement(...match, match.index, corrected)
                        : original.replace(regex, rule.replacement);
                    
                    if (fixed !== original) {
                        corrected = corrected.slice(0, match.index) + fixed + 
                                   corrected.slice(match.index + original.length);
                        corrections.push({
                            original: original,
                            corrected: fixed,
                            type: 'grammar',
                            rule: rule.name
                        });
                        hasCorrections = true;
                        regex.lastIndex = 0;
                    }
                }
            });
            if (corrected.length > 0 && corrected[0] !== corrected[0].toUpperCase()) {
                corrected = corrected.charAt(0).toUpperCase() + corrected.slice(1);
                hasCorrections = true;
            }

            if (!hasCorrections) return null;

            return {
                original: text,
                corrected: corrected,
                corrections: corrections,
                reason: "Offline grammar and spelling check",
                source: "offline"
            };
        }
    };
    return true;
}

function isChromeAIAvailable() {
    return 'Rewriter' in self;
}

async function monitorDownloadProgress() {
    if (!isChromeAIAvailable()) return;
    
    try {
        const checkProgress = setInterval(async () => {
            try {
                const availability = await Rewriter.availability();
                
                if (availability === 'available') {
                    console.log("Download completed!");
                    isDownloading = false;
                    offlineMode = false;
                    showStatusMessage("AI model ready! Start typing to get suggestions.", "success");
                    setTimeout(hideStatusMessage, 3000);
                    clearInterval(checkProgress);
                } else if (availability === 'downloading') {
                    console.log("Download in progress...");
                    isDownloading = true;
                    showStatusMessage("Downloading AI model...", "info");
                }
            } catch (error) {
                console.error("Error checking availability:", error);
            }
        }, 2000);

        setTimeout(() => {
            clearInterval(checkProgress);
        }, 300000);
        
    } catch (error) {
        console.error("Download monitoring error:", error);
    }
}

async function speakSuggestion(text) {
    try {
        const settings = await new Promise(resolve => {
            chrome.storage.sync.get(['enableTTS'], resolve);
        });
        
        if (settings.enableTTS === false) return;
        
        if ('speechSynthesis' in window) {
            speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.9;
            utterance.pitch = 1.0;
            utterance.volume = 0.8;
            
            utterance.onerror = (event) => {
                console.error("Speech synthesis error:", event);
                showStatusMessage("Text-to-speech failed", "error");
                setTimeout(hideStatusMessage, 2000);
            };
            
            speechSynthesis.speak(utterance);
        } else {
            showStatusMessage("Text-to-speech not supported", "error");
            setTimeout(hideStatusMessage, 2000);
        }
    } catch (error) {
        console.error("TTS error:", error);
    }
}

function stopSpeaking() {
    if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
    }
}

async function initializeRewriter() {
    if (!isChromeAIAvailable()) {
        console.log("Rewriter API not available in this browser");
        showStatusMessage("AI features not available - using offline mode", "warning");
        offlineMode = true;
        return false;
    }

    try {
        const availability = await Rewriter.availability();
        console.log("Rewriter availability:", availability);

        if (availability === 'unavailable') {
            console.log("Rewriter API is unavailable");
            showStatusMessage("AI model unavailable - using offline mode", "warning");
            offlineMode = true;
            return false;
        }

        if (availability === 'downloadable' && !downloadAttempted) {
            console.log("AI model needs download - triggering...");
            isDownloading = true;
            downloadAttempted = true;
            showStatusMessage("Downloading AI model... This may take a few minutes. Using offline mode meanwhile.", "info");
            
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
        
        if (finalAvailability === 'available') {
            isDownloading = false;
            offlineMode = false;
            showStatusMessage("AI model ready!", "success");
            setTimeout(hideStatusMessage, 2000);
        } else if (finalAvailability === 'downloading') {
            isDownloading = true;
            offlineMode = true;
            showStatusMessage("Downloading AI model... Using offline mode.", "info");
        }
        
        return true;
    } catch (error) {
        console.error("Failed to initialize Rewriter:", error);
        
        if (error.message && (error.message.includes('download') || error.message.includes('Download'))) {
            showStatusMessage("Download in progress... Using offline mode.", "info");
            offlineMode = true;
            monitorDownloadProgress();
        } else {
            showStatusMessage("Failed to initialize AI features - using offline mode", "warning");
            offlineMode = true;
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

async function getAISuggestions(text) {
    if (!rewriterInstance || isDownloading || !isEnabled) return null;

    try {
        const availability = await Rewriter.availability();
        if (availability !== 'available') return null;

        console.log("Getting AI suggestions for text:", text.substring(0, 50) + "...");
        
        const result = await rewriterInstance.rewrite(text, {
            context: "Improve this text for clarity, grammar, and professionalism while keeping the original meaning."
        });
        
        if (!result || result.trim() === text.trim()) return null;

        return {
            original: text,
            corrected: result,
            reason: "AI-improved version",
            source: "ai"
        };
    } catch (err) {
        console.error("Rewriter API error:", err);
        return null;
    }
}

function getOfflineSuggestions(text) {
    if (!offlineChecker || !isEnabled) return null;
    
    try {
        const result = offlineChecker.checkText(text);
        return result;
    } catch (error) {
        console.error("Offline checker error:", error);
        return null;
    }
}

async function getSuggestions(text) {
    if (!text || text.trim().length < 3) return null;
    if (!isEnabled) return null;

    if (!offlineMode && !isDownloading) {
        const aiSuggestion = await getAISuggestions(text);
        if (aiSuggestion) return aiSuggestion;
    }

    const offlineSuggestion = getOfflineSuggestions(text);
    if (offlineSuggestion) return offlineSuggestion;

    return null;
}
function positionTooltip(targetElement, tooltipElement) {
  
    tooltipElement.style.display = "block";
    tooltipElement.style.visibility = "hidden"; 
    
    const tooltipRect = tooltipElement.getBoundingClientRect();
    const tooltipWidth = tooltipRect.width;
    const tooltipHeight = tooltipRect.height;
    
    const targetRect = targetElement.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let left = targetRect.left + scrollX;
    let top = targetRect.bottom + scrollY + 10;
    const centerOffset = (targetRect.width - tooltipWidth) / 2;
    left += centerOffset;
    if (left + tooltipWidth > viewportWidth + scrollX - 20) {
        left = viewportWidth + scrollX - tooltipWidth - 20;
    }
    if (left < scrollX + 20) {
        left = scrollX + 20;
    }
    const spaceBelow = viewportHeight - (targetRect.bottom - scrollY);
    const spaceAbove = targetRect.top - scrollY;
    if (spaceBelow < tooltipHeight + 20 && spaceAbove > tooltipHeight + 20) {
        top = targetRect.top + scrollY - tooltipHeight - 10;
    }
    if (top + tooltipHeight > viewportHeight + scrollY - 20) {
        top = viewportHeight + scrollY - tooltipHeight - 20;
    }
    if (top < scrollY + 20) {
        top = scrollY + 20;
    }
    tooltipElement.style.left = Math.round(left) + "px";
    tooltipElement.style.top = Math.round(top) + "px";
    tooltipElement.style.visibility = "visible"; 
    
    return { x: left, y: top };
}

function hideTooltip() {
    tooltip.style.display = "none";
}

function getTextFromElement(el) {
    if (el.isContentEditable) return el.textContent || el.innerText || "";
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return el.value || "";
    return "";
}

function analyzeText(text) {
    if (!text) return null;
    
    const words = text.trim().split(/\s+/).length;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
    const avgSentenceLength = sentences > 0 ? (words / sentences).toFixed(1) : 0;
    
    const readingTime = Math.ceil(words / 200);
    
    const issues = [];
    if (avgSentenceLength > 25) issues.push("Long sentences");
    if (text.length > 500 && paragraphs < 2) issues.push("Needs paragraph breaks");
    if (/(\b\w+\b)(?=.*\b\1\b)/i.test(text)) issues.push("Repeated words");
    if (text.includes('  ')) issues.push("Extra spaces");
    
    const tone = analyzeTone(text);
    const readability = calculateReadability(text);
    
    return {
        wordCount: words,
        sentenceCount: sentences,
        paragraphCount: paragraphs,
        avgSentenceLength,
        readingTime,
        issues,
        tone,
        readability,
        suggestions: generateWritingTips(text)
    };
}

function analyzeTone(text) {
    const tones = [];
    const textLower = text.toLowerCase();
    
    if (text.includes('!')) tones.push({ name: "Enthusiastic", score: 85 });
    if (textLower.includes('please') || textLower.includes('thank you') || textLower.includes('would you mind')) {
        tones.push({ name: "Polite", score: 90 });
    }
    if (text.length < 100) tones.push({ name: "Concise", score: 75 });
    if (text.includes('?')) tones.push({ name: "Inquiring", score: 70 });
    if (textLower.includes('important') || textLower.includes('crucial') || textLower.includes('essential')) {
        tones.push({ name: "Emphatic", score: 80 });
    }
    if (textLower.includes('sorry') || textLower.includes('apologize') || textLower.includes('unfortunately')) {
        tones.push({ name: "Apologetic", score: 65 });
    }
    
    return tones.slice(0, 3);
}

function calculateReadability(text) {
    const words = text.split(/\s+/).length;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    const syllables = estimateSyllables(text);
    
    if (sentences === 0 || words === 0) return 100;
    
    const avgWordsPerSentence = words / sentences;
    const avgSyllablesPerWord = syllables / words;
    
    let score = 100 - (avgWordsPerSentence + avgSyllablesPerWord * 10);
    return Math.max(0, Math.min(100, Math.round(score)));
}

function estimateSyllables(text) {
    const words = text.toLowerCase().split(/\s+/);
    let syllables = 0;
    
    words.forEach(word => {
        word = word.replace(/[^a-z]/g, '');
        if (word.length <= 3) {
            syllables += 1;
        } else {
            const vowelGroups = word.match(/[aeiouy]+/g);
            syllables += vowelGroups ? vowelGroups.length : 1;
        }
    });
    
    return syllables;
}

function generateWritingTips(text) {
    const tips = [];
    const words = text.split(/\s+/).length;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    const avgSentenceLength = words / sentences;
    
    if (avgSentenceLength > 25) {
        tips.push("Try breaking long sentences into shorter ones");
    }
    
    if (words > 200 && text.split(/\n\s*\n/).length < 2) {
        tips.push("Consider adding paragraph breaks");
    }
    
    if (text.includes('  ')) {
        tips.push("Remove extra spaces between words");
    }
    
    if (/(\b\w+\b)(?=.*\b\1\b)/i.test(text)) {
        tips.push("Avoid repeating the same words frequently");
    }
    
    if (/\b(am|is|are|was|were|be|being|been)\s+\w+ed\b/i.test(text)) {
        tips.push("Consider using active voice");
    }
    
    return tips.slice(0, 3);
}

function generateInsightsHTML(insights) {
    if (!insights) return `
        <div style="text-align: center; padding: 40px 20px; color: #666;">
          
            <div style="font-size: 14px; margin-bottom: 8px;">No insights available</div>
            <div style="font-size: 12px; color: #999;">Try writing more text to get detailed analysis</div>
        </div>
    `;
    
    return `
        <div style="font-family: 'Segoe UI', Arial, sans-serif;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 16px; border-radius: 12px; color: white; text-align: center;">
                    <div style="font-size: 24px; font-weight: 700; margin-bottom: 4px;">${insights.wordCount}</div>
                    <div style="font-size: 11px; opacity: 0.9;">WORDS</div>
                </div>
                <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 16px; border-radius: 12px; color: white; text-align: center;">
                    <div style="font-size: 24px; font-weight: 700; margin-bottom: 4px;">${insights.sentenceCount}</div>
                    <div style="font-size: 11px; opacity: 0.9;">SENTENCES</div>
                </div>
                <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 16px; border-radius: 12px; color: white; text-align: center;">
                    <div style="font-size: 24px; font-weight: 700; margin-bottom: 4px;">${insights.readingTime}m</div>
                    <div style="font-size: 11px; opacity: 0.9;">READ TIME</div>
                </div>
                <div style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); padding: 16px; border-radius: 12px; color: white; text-align: center;">
                    <div style="font-size: 24px; font-weight: 700; margin-bottom: 4px;">${insights.readability}%</div>
                    <div style="font-size: 11px; opacity: 0.9;">READABILITY</div>
                </div>
            </div>

            ${insights.tone.length > 0 ? `
            <div style="margin-bottom: 20px;">
                <div style="display: flex; align-items: center; margin-bottom: 12px;">
                    <div style="background: #8B5CF6; width: 4px; height: 16px; border-radius: 2px; margin-right: 8px;"></div>
                    <div style="font-weight: 600; color: #374151; font-size: 13px;">WRITING TONE</div>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    ${insights.tone.map(tone => `
                        <div style="background: ${getToneColor(tone.name)}; color: white; padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 500; display: flex; align-items: center; gap: 4px;">
                            <span>${getToneEmoji(tone.name)}</span>
                            ${tone.name}
                            <span style="opacity: 0.9; font-size: 10px;">${tone.score}%</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            ${insights.issues.length > 0 ? `
            <div style="margin-bottom: 20px;">
                <div style="display: flex; align-items: center; margin-bottom: 12px;">
                    <div style="background: #F59E0B; width: 4px; height: 16px; border-radius: 2px; margin-right: 8px;"></div>
                    <div style="font-weight: 600; color: #374151; font-size: 13px;">IMPROVEMENT AREAS</div>
                </div>
                <div style="background: #FFFBEB; border: 1px solid #FEF3C7; border-radius: 8px; padding: 12px;">
                    <ul style="margin: 0; padding-left: 16px; font-size: 12px; color: #92400E;">
                        ${insights.issues.map(issue => `
                            <li style="margin-bottom: 6px; line-height: 1.4;">
                                <span style="color: #D97706; margin-right: 4px;">⚠</span>
                                ${issue}
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </div>
            ` : ''}

            ${insights.suggestions.length > 0 ? `
            <div>
                <div style="display: flex; align-items: center; margin-bottom: 12px;">
                    <div style="background: #10B981; width: 4px; height: 16px; border-radius: 2px; margin-right: 8px;"></div>
                    <div style="font-weight: 600; color: #374151; font-size: 13px;">WRITING TIPS</div>
                </div>
                <div style="background: #ECFDF5; border: 1px solid #D1FAE5; border-radius: 8px; padding: 12px;">
                    <ul style="margin: 0; padding-left: 16px; font-size: 12px; color: #065F46;">
                        ${insights.suggestions.map(tip => `
                            <li style="margin-bottom: 6px; line-height: 1.4;">
                                <span style="color: #059669; margin-right: 4px;">💡</span>
                                ${tip}
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </div>
            ` : ''}

            <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #F3F4F6;">
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: #6B7280;">
                    <div>Avg. Sentence: <strong>${insights.avgSentenceLength} words</strong></div>
                    <div>Paragraphs: <strong>${insights.paragraphCount}</strong></div>
                </div>
            </div>
        </div>
    `;
}

async function showTooltipWithInsights(html, x, y, applyCallback, source = "ai", suggestionText = "", style = "professional", originalText = "") {
    const styleIcon = writingStyleConfig[style]?.icon || "💼";
    const styleName = writingStyleConfig[style]?.name || "Professional";
    
    const sourceIndicator = source === "offline" 
        ? `<div style="font-size:10px;color:#888;text-align:right;margin-top:8px;">🔒 Offline Mode • ${styleIcon} ${styleName}</div>`
        : `<div style="font-size:10px;color:#888;text-align:right;margin-top:8px;">🤖 AI Powered • ${styleIcon} ${styleName}</div>`;
    
    let listenButton = '';
    if (suggestionText) {
        try {
            const settings = await new Promise(resolve => {
                chrome.storage.sync.get(['enableTTS'], resolve);
            });
            
            if (settings.enableTTS !== false) {
                listenButton = `<button id="listenSuggestion" style="margin-top: 8px; padding: 6px 12px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 4px;">
                    Listen
                </button>`;
            }
        } catch (error) {
            console.error("Error getting TTS settings:", error);
        }
    }

    const insights = analyzeText(originalText);
    const insightsHtml = generateInsightsHTML(insights);

    const tooltipContent = `
        <div style="border-bottom: 1px solid #F3F4F6; margin-bottom: 16px; display: flex; background: #F9FAFB; border-radius: 12px 12px 0 0; padding: 4px;">
            <button class="tab-button active" data-tab="suggestion" style="display: flex; align-items: center; justify-content: center; gap: 6px;">
                Suggestion
            </button>
            <button class="tab-button" data-tab="insights" style="display: flex; align-items: center; justify-content: center; gap: 6px;">
                Insights
            </button>
        </div>
        
        <div id="suggestion-tab" class="tab-content">
            ${html}
            ${listenButton}
        </div>
        
        <div id="insights-tab" class="tab-content" style="display: none;">
            ${insightsHtml}
        </div>
        
        <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #F3F4F6;">
            ${sourceIndicator}
        </div>
    `;
    
    tooltip.innerHTML = tooltipContent;
    
    if (activeTarget) {
        positionTooltip(activeTarget, tooltip);
    } else {
        tooltip.style.display = "block";
        tooltip.style.visibility = "hidden";
        const tooltipRect = tooltip.getBoundingClientRect();
        const left = (window.innerWidth - tooltipRect.width) / 2 + window.scrollX;
        const top = (window.innerHeight - tooltipRect.height) / 2 + window.scrollY;
        tooltip.style.left = left + "px";
        tooltip.style.top = top + "px";
        tooltip.style.visibility = "visible";
    }
    const tabButtons = tooltip.querySelectorAll('.tab-button');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const tabName = button.dataset.tab;
            
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            document.querySelectorAll('.tab-content').forEach(content => {
                content.style.display = 'none';
            });
            tooltip.querySelector(`#${tabName}-tab`).style.display = 'block';
            if (activeTarget) {
                setTimeout(() => positionTooltip(activeTarget, tooltip), 10);
            }
        });
    });

    if (suggestionText && listenButton) {
        const listenBtn = tooltip.querySelector('#listenSuggestion');
        if (listenBtn) {
            listenBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                speakSuggestion(suggestionText);
            });
        }
    }

    tooltip.onclick = (e) => {
        if (!e.target.closest('#listenSuggestion') && 
            !e.target.classList.contains('tab-button') &&
            !e.target.closest('.tab-button')) {
            e.stopPropagation();
            applyCallback();
            hideTooltip();
        }
    };
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
            source: offlineMode ? 'offline' : 'ai'
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
        if (!text || text.trim().length < 3) return;

        try {
            const response = await new Promise(resolve => {
                chrome.runtime.sendMessage({ action: 'checkEnabled' }, resolve);
            });
            isEnabled = response?.enabled !== false;
        } catch (err) {
            isEnabled = true;
        }

        if (!isEnabled) return;

        const suggestion = await getSuggestions(text);
        if (!suggestion) return;

        activeTarget = target;
        activeSuggestion = suggestion;

        const source = suggestion.source || (offlineMode ? "offline" : "ai");
        const titleColor = source === "offline" ? "#FF9800" : "#4caf50";
        const titleText = source === "offline" ? "Refyne Offline Suggestion" : "Refyne AI Suggestion";
        
        const tooltipContent = `
            <div style="font-weight:bold;color:${titleColor};margin-bottom:8px;font-size:16px;">${titleText}</div>
            <div style="color:#666;text-decoration:line-through;font-size:13px;margin-bottom:6px;padding:4px;background:#f5f5f5;border-radius:4px;">${suggestion.original}</div>
            <div style="color:#2e7d32;font-weight:500;margin-bottom:8px;padding:4px;background:#e8f5e8;border-radius:4px;">${suggestion.corrected}</div>
            <div style="font-size:12px;color:#666;text-align:center;border-top:1px solid #eee;padding-top:8px;">Click to apply suggestion</div>
        `;
        
        // CHANGED: Remove x, y parameters - they're no longer needed
        showTooltipWithInsights(
            tooltipContent,
            null, // These parameters are now ignored
            null,
            () => {
                applySuggestion(target, suggestion.original, suggestion.corrected);
                activeTarget = null;
                activeSuggestion = null;
            },
            source,
            suggestion.corrected,
            currentWritingStyle,
            text
        );
    }, 2000);
}

async function getAIStatus() {
    if (!isChromeAIAvailable()) {
        return { 
            status: 'unavailable', 
            message: 'AI API Not Available',
            offline: true,
            mode: 'offline'
        };
    }

    try {
        const availability = await Rewriter.availability();
        
        let message = '';
        let mode = 'ai';
        switch(availability) {
            case 'available': 
                message = 'AI Model Ready'; 
                mode = 'ai';
                break;
            case 'downloadable': 
                message = 'AI Model Needs Download'; 
                mode = 'offline';
                break;
            case 'downloading': 
                message = 'Downloading AI Model'; 
                mode = 'offline';
                break;
            case 'unavailable': 
            default: 
                message = 'AI Model Unavailable'; 
                mode = 'offline';
                break;
        }
        
        return { 
            status: availability, 
            message: message,
            progress: downloadProgress,
            offline: mode === 'offline',
            mode: mode
        };
    } catch (error) {
        return { 
            status: 'unavailable', 
            message: 'Error Checking Status',
            offline: true,
            mode: 'offline'
        };
    }
}

(async function init() {
    console.log("Refyne content script initializing...");
    console.log("Rewriter API available:", isChromeAIAvailable());
    
    try {
        const response = await new Promise(resolve => {
            chrome.storage.sync.get(['enableExtension'], result => {
                resolve(result);
            });
        });
        isEnabled = response?.enableExtension !== false;
    } catch (err) {
        console.error("Error checking enabled state:", err);
        isEnabled = true;
    }
    
    const offlineInitialized = initializeOfflineChecker();
    console.log("Offline checker initialized:", offlineInitialized);
    
    const aiInitialized = await initializeRewriter();
    
    if (aiInitialized || offlineInitialized) {
        console.log("Refyne initialized successfully!");
        console.log("AI Mode:", aiInitialized ? "Active" : "Unavailable");
        console.log("Offline Mode:", offlineMode ? "Active" : "Inactive");
        
        function hideTooltipOnClick(e) {
            if (!tooltip.contains(e.target)) {
                hideTooltip();
            }
        }
        
        function hideTooltipOnScroll() {
            hideTooltip();
        }
        
        document.removeEventListener("input", handleInput, true);
        document.removeEventListener("click", hideTooltipOnClick, true);
        document.removeEventListener("scroll", hideTooltipOnScroll, true);
        
        document.addEventListener("input", handleInput, true);
        document.addEventListener("click", hideTooltipOnClick, true);
        document.addEventListener("scroll", hideTooltipOnScroll, true);
        
    } else {
        console.log("Refyne initialization failed completely");
        showStatusMessage("Refyne failed to initialize", "error");
        setTimeout(hideStatusMessage, 3000);
    }
})();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'enabledStateChanged') {
        isEnabled = request.enabled;
        if (!isEnabled) {
            hideTooltip();
            stopSpeaking(); 
        }
        showStatusMessage(isEnabled ? "Refyne enabled" : "Refyne disabled", isEnabled ? "success" : "warning");
        setTimeout(hideStatusMessage, 2000);
    }
    
    if (request.action === 'showTextInsights' && request.text) {
        const insights = analyzeText(request.text);
        const insightsHtml = generateInsightsHTML(insights);
        
        const x = window.innerWidth / 2;
        const y = window.innerHeight / 2;
        
        showTooltipWithInsights(
            `<div style="font-weight:bold;color:#2196F3;margin-bottom:12px;font-size:16px;text-align:center;">📊 Writing Insights</div>
             <div style="color:#2e7d32;font-weight:500;margin-bottom:12px;padding:12px;background:#e8f5e8;border-radius:8px;border-left:4px solid #4CAF50;">${request.text}</div>`,
            x,
            y,
            () => {
                hideTooltip();
            },
            "insights",
            "",
            currentWritingStyle,
            request.text
        );
    }
    
    if (request.action === 'getAIStatus') {
        getAIStatus().then(status => sendResponse(status));
        return true;
    }
    
    if (request.action === 'checkText' && request.text) {
        showStatusMessage("Checking selected text...", "info");
        getSuggestions(request.text).then(suggestion => {
            if (suggestion) {
                const source = suggestion.source || (offlineMode ? "offline" : "ai");
                const titleColor = source === "offline" ? "#FF9800" : "#4caf50";
                const titleText = source === "offline" ? "Refyne Offline Suggestion" : "Refyne AI Suggestion";
                
                const x = window.innerWidth / 2;
                const y = window.innerHeight / 2;
                
                showTooltipWithInsights(
                    `<div style="font-weight:bold;color:${titleColor};margin-bottom:12px;font-size:16px;text-align:center;">${titleText}</div>
                     <div style="color:#666;text-decoration:line-through;font-size:13px;margin-bottom:8px;padding:8px;background:#f5f5f5;border-radius:6px;border-left:3px solid #ccc;">${suggestion.original}</div>
                     <div style="color:#2e7d32;font-weight:500;margin-bottom:12px;padding:8px;background:#e8f5e8;border-radius:6px;border-left:3px solid #4CAF50;">${suggestion.corrected}</div>`,
                    x,
                    y,
                    () => {
                        showStatusMessage("Copy the suggestion manually", "info");
                        setTimeout(hideStatusMessage, 3000);
                        hideTooltip();
                    },
                    source,
                    suggestion.corrected,
                    currentWritingStyle,
                    request.text
                );
            } else {
                showStatusMessage("No suggestions available", "info");
                setTimeout(hideStatusMessage, 3000);
            }
        });
    }
});