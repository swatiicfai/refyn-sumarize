// Improved content script with better state management and UX

console.log("Refyne v2 content script loaded!");

// ==================== CONFIG ====================
const CONFIG = {
  debounceDelay: 1200,
  minTextLength: 5,
  maxSuggestions: 1,
  highlightColor: '#fff3cd',
  highlightBorder: '2px solid #ffc107',
  apiUrl: 'http://localhost:3000/api/generate'
};

// ==================== STATE MANAGEMENT ====================
class RefyneState {
  constructor() {
    this.activeElement = null;
    this.currentSuggestion = null;
    this.isApplying = false;
    this.debounceTimer = null;
    this.abortController = null;
  }

  reset() {
    this.activeElement = null;
    this.currentSuggestion = null;
    this.isApplying = false;
    if (this.abortController) this.abortController.abort();
  }
}

const state = new RefyneState();

// ==================== UI COMPONENTS ====================
class TooltipManager {
  constructor() {
    this.tooltip = this.createTooltip();
    document.body.appendChild(this.tooltip);
  }

  createTooltip() {
    const tooltip = document.createElement('div');
    tooltip.id = 'refyne-tooltip';
    Object.assign(tooltip.style, {
      position: 'fixed',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      padding: '12px 16px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      zIndex: '2147483647',
      display: 'none',
      fontSize: '13px',
      maxWidth: '350px',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    });
    
    tooltip.addEventListener('mouseenter', () => {
      tooltip.style.transform = 'scale(1.02)';
    });
    
    tooltip.addEventListener('mouseleave', () => {
      tooltip.style.transform = 'scale(1)';
    });
    
    return tooltip;
  }

  show(suggestion, rect) {
    const { original, corrected, reason } = suggestion;
    
    this.tooltip.innerHTML = `
      <div style="margin-bottom: 6px;">
        <strong style="font-size: 11px; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.5px;">Suggestion</strong>
      </div>
      <div style="margin-bottom: 8px;">
        <div style="text-decoration: line-through; opacity: 0.8; margin-bottom: 4px;">"${original}"</div>
        <div style="font-weight: 600;">"${corrected}"</div>
      </div>
      ${reason ? `<div style="font-size: 11px; opacity: 0.85; font-style: italic;">${reason}</div>` : ''}
      <div style="margin-top: 8px; font-size: 11px; opacity: 0.7;">Click to apply</div>
    `;
    
    // Position tooltip
    const tooltipRect = this.tooltip.getBoundingClientRect();
    let top = rect.bottom + window.scrollY + 8;
    let left = rect.left + window.scrollX;
    
    // Keep tooltip in viewport
    if (left + tooltipRect.width > window.innerWidth) {
      left = window.innerWidth - tooltipRect.width - 10;
    }
    
    this.tooltip.style.left = left + 'px';
    this.tooltip.style.top = top + 'px';
    this.tooltip.style.display = 'block';
  }

  hide() {
    this.tooltip.style.display = 'none';
  }
}

const tooltipManager = new TooltipManager();

// ==================== HIGHLIGHTING ====================
class HighlightManager {
  constructor() {
    this.activeHighlight = null;
  }

  highlightText(element, original) {
    this.removeHighlight();
    
    if (!element.isContentEditable) return null;
    
    const text = element.textContent;
    const index = text.indexOf(original);
    
    if (index === -1) return null;
    
    const range = document.createRange();
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let charCount = 0;
    let startNode = null;
    let startOffset = 0;
    let endNode = null;
    let endOffset = 0;
    
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const nodeLength = node.textContent.length;
      
      if (!startNode && charCount + nodeLength > index) {
        startNode = node;
        startOffset = index - charCount;
      }
      
      if (startNode && charCount + nodeLength >= index + original.length) {
        endNode = node;
        endOffset = index + original.length - charCount;
        break;
      }
      
      charCount += nodeLength;
    }
    
    if (startNode && endNode) {
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
      
      const highlight = document.createElement('span');
      highlight.className = 'refyne-highlight';
      Object.assign(highlight.style, {
        backgroundColor: CONFIG.highlightColor,
        borderBottom: CONFIG.highlightBorder,
        cursor: 'pointer',
        padding: '2px 0',
        borderRadius: '2px',
        transition: 'all 0.2s ease'
      });
      
      try {
        range.surroundContents(highlight);
        this.activeHighlight = highlight;
        return highlight;
      } catch (e) {
        console.warn('Could not surround range:', e);
        return null;
      }
    }
    
    return null;
  }

  removeHighlight() {
    const highlights = document.querySelectorAll('.refyne-highlight');
    highlights.forEach(h => {
      const parent = h.parentNode;
      while (h.firstChild) {
        parent.insertBefore(h.firstChild, h);
      }
      parent.removeChild(h);
      parent.normalize();
    });
    this.activeHighlight = null;
  }
}

const highlightManager = new HighlightManager();

// ==================== API ====================
async function fetchSuggestions(text) {
  if (!text || text.length < CONFIG.minTextLength) return [];
  
  try {
    if (state.abortController) state.abortController.abort();
    state.abortController = new AbortController();
    
    const response = await fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'mistral',
        messages: [
          {
            role: 'system',
            content: `You are a writing refinement assistant. Analyze text and suggest ONE improvement.

RESPONSE FORMAT (JSON only):
[{"original": "exact text to replace", "corrected": "improved version", "reason": "brief explanation"}]

RULES:
- "original" must be 5-30 words from the input text
- Fix grammar, clarity, or tone issues
- Keep changes natural and minimal
- Return [] if text is perfect

EXAMPLE:
Input: "I goed to store yesterday"
Output: [{"original": "I goed to store", "corrected": "I went to the store", "reason": "Grammar correction"}]`
          },
          {
            role: 'user',
            content: `Analyze: "${text}"`
          }
        ],
        temperature: 0.1,
        max_tokens: 150
      }),
      signal: state.abortController.signal
    });

    if (!response.ok) return [];

    const data = await response.json();
    if (!data.response) return [];

    let cleaned = data.response.trim()
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (jsonMatch) cleaned = jsonMatch[0];
    
    const suggestions = JSON.parse(cleaned);
    return Array.isArray(suggestions) 
      ? suggestions.filter(s => 
          s.original && 
          s.corrected && 
          s.original !== s.corrected &&
          text.includes(s.original)
        ).slice(0, CONFIG.maxSuggestions)
      : [];
      
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Refyne API error:', err);
    }
    return [];
  }
}

// ==================== SUGGESTION APPLICATION ====================
function applySuggestion(element, original, corrected) {
  if (state.isApplying) return;
  state.isApplying = true;
  
  highlightManager.removeHighlight();
  tooltipManager.hide();
  
  if (element.isContentEditable) {
    const text = element.textContent;
    const index = text.indexOf(original);
    
    if (index !== -1) {
      element.textContent = text.substring(0, index) + corrected + text.substring(index + original.length);
      
      // Set cursor after replacement
      const range = document.createRange();
      const sel = window.getSelection();
      const textNode = element.firstChild;
      
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        const newPos = index + corrected.length;
        range.setStart(textNode, Math.min(newPos, textNode.length));
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  } else {
    const text = element.value;
    const index = text.indexOf(original);
    
    if (index !== -1) {
      element.value = text.substring(0, index) + corrected + text.substring(index + original.length);
      const newPos = index + corrected.length;
      element.setSelectionRange(newPos, newPos);
    }
  }
  
  element.dispatchEvent(new Event('input', { bubbles: true }));
  
  state.reset();
  state.isApplying = false;
  
  // Check for more suggestions after a delay
  setTimeout(() => {
    if (!state.isApplying) {
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, 800);
}

// ==================== MAIN HANDLER ====================
async function handleInput(e) {
  const element = e.target;
  
  const isEditable = 
    element.isContentEditable ||
    element.tagName === 'TEXTAREA' ||
    (element.tagName === 'INPUT' && element.type === 'text');
  
  if (!isEditable || state.isApplying) return;
  
  // Clean up previous state
  if (state.activeElement !== element) {
    highlightManager.removeHighlight();
    tooltipManager.hide();
  }
  
  state.activeElement = element;
  
  clearTimeout(state.debounceTimer);
  state.debounceTimer = setTimeout(async () => {
    const text = element.value || element.textContent;
    if (!text || text.length < CONFIG.minTextLength) return;
    
    const suggestions = await fetchSuggestions(text);
    
    if (suggestions.length === 0) {
      highlightManager.removeHighlight();
      tooltipManager.hide();
      state.currentSuggestion = null;
      return;
    }
    
    const suggestion = suggestions[0];
    state.currentSuggestion = suggestion;
    
    if (element.isContentEditable) {
      const highlight = highlightManager.highlightText(element, suggestion.original);
      
      if (highlight) {
        const rect = highlight.getBoundingClientRect();
        tooltipManager.show(suggestion, rect);
        
        highlight.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          applySuggestion(element, suggestion.original, suggestion.corrected);
        };
        
        highlight.onmouseenter = () => {
          highlight.style.backgroundColor = '#ffe082';
        };
        
        highlight.onmouseleave = () => {
          highlight.style.backgroundColor = CONFIG.highlightColor;
        };
      }
    } else {
      const rect = element.getBoundingClientRect();
      tooltipManager.show(suggestion, rect);
    }
  }, CONFIG.debounceDelay);
}

// ==================== EVENT LISTENERS ====================
document.addEventListener('input', handleInput, true);

document.addEventListener('click', (e) => {
  if (e.target.id === 'refyne-tooltip' && state.currentSuggestion) {
    applySuggestion(
      state.activeElement,
      state.currentSuggestion.original,
      state.currentSuggestion.corrected
    );
  } else if (!e.target.closest('.refyne-highlight') && !e.target.closest('#refyne-tooltip')) {
    tooltipManager.hide();
  }
});

document.addEventListener('scroll', () => {
  if (state.activeElement && state.currentSuggestion) {
    const highlight = document.querySelector('.refyne-highlight');
    if (highlight) {
      const rect = highlight.getBoundingClientRect();
      tooltipManager.show(state.currentSuggestion, rect);
    }
  }
}, true);

window.addEventListener('resize', () => {
  tooltipManager.hide();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // ESC to dismiss suggestion
  if (e.key === 'Escape') {
    highlightManager.removeHighlight();
    tooltipManager.hide();
    state.reset();
  }
  
  // Ctrl/Cmd + Enter to apply suggestion
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && state.currentSuggestion) {
    e.preventDefault();
    applySuggestion(
      state.activeElement,
      state.currentSuggestion.original,
      state.currentSuggestion.corrected
    );
  }
});

console.log("✨ Refyne is ready! Press ESC to dismiss, Ctrl+Enter to apply.");