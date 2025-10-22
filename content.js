console.log("Refyne content script loaded!");

const tooltip = document.createElement("div");
Object.assign(tooltip.style, {
  position: "fixed",
  background: "#fff",
  border: "1px solid #ccc",
  padding: "8px 12px",
  borderRadius: "6px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  zIndex: "1000000",
  display: "none",
  fontSize: "14px",
  maxWidth: "350px",
  cursor: "pointer",
  fontFamily: "Arial, sans-serif",
  lineHeight: "1.4"
});
document.body.appendChild(tooltip);

let debounceTimeout = null;
let currentController = null;
let activeTarget = null;
let activeSuggestion = null;

function showTooltip(html, x, y, applyCallback) {
  tooltip.innerHTML = html;
  tooltip.style.left = x + "px";
  tooltip.style.top = y + "px";
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

async function fetchSuggestions(text) {
  if (!text || text.trim().length < 3) return [];
  
  try {
    if (currentController) currentController.abort();
    currentController = new AbortController();
    
    const response = await fetch("http://localhost:3000/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text }),
      signal: currentController.signal,
    }).catch(err => {
      if (err.name !== "AbortError") {
        console.error("Network error:", err);
      }
      throw err;
    });

    currentController = null;

    if (!response.ok) {
      console.error("Server response not OK:", response.status);
      return [];
    }

    const data = await response.json();
    console.log("Raw API response:", data);
    
    if (data.suggestions && Array.isArray(data.suggestions)) {
      const validSuggestions = data.suggestions.filter(s => {
        if (!s.original || !s.corrected) return false;
        if (s.original === s.corrected) return false;
        if (!text.includes(s.original)) {
          console.log("Original text not found in input:", s.original);
          return false;
        }
        return true;
      });
      console.log("Valid suggestions:", validSuggestions);
      return validSuggestions.slice(0, 1);
    }
    
    return [];
  } catch (err) {
    if (err.name === "AbortError") return [];
    console.error("Fetch error:", err);
    return [];
  }
}

function getTextFromElement(element) {
  if (element.isContentEditable) {
    return element.textContent || element.innerText || "";
  } else if (element.tagName === "TEXTAREA" || element.tagName === "INPUT") {
    return element.value || "";
  }
  return "";
}

function applySuggestion(target, original, corrected) {
  const currentText = getTextFromElement(target);
  const index = currentText.indexOf(original);
  
  if (index === -1) {
    console.warn("Original text not found for replacement");
    return false;
  }
  
  if (target.isContentEditable) {
    applyToContentEditable(target, original, corrected);
  } else {
    applyToTextarea(target, original, corrected);
  }
  
  return true;
}

function applyToTextarea(target, original, corrected) {
  const text = target.value;
  const index = text.indexOf(original);
  if (index === -1) return;
  
  const before = text.substring(0, index);
  const after = text.substring(index + original.length);
  target.value = before + corrected + after;
  
  const newCursorPos = before.length + corrected.length;
  target.setSelectionRange(newCursorPos, newCursorPos);
  
  // Trigger events to notify other scripts
  target.dispatchEvent(new Event('input', { bubbles: true }));
  target.dispatchEvent(new Event('change', { bubbles: true }));
}

function applyToContentEditable(target, original, corrected) {
  // Save current selection
  const selection = window.getSelection();
  const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  
  // Remove any existing highlights
  removeHighlights(target);
  
  const text = target.textContent || target.innerText || "";
  const index = text.indexOf(original);
  
  if (index === -1) return;
  
  const before = text.substring(0, index);
  const after = text.substring(index + original.length);
  
  // Clear and rebuild content
  target.textContent = before + corrected + after;
  
  // Try to restore cursor position
  try {
    const newRange = document.createRange();
    const textNode = target.firstChild;
    
    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
      const newPos = Math.min(before.length + corrected.length, textNode.length);
      newRange.setStart(textNode, newPos);
      newRange.collapse(true);
      
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
  } catch (err) {
    console.error("Cursor restoration error:", err);
  }
  
  // Trigger input event
  target.dispatchEvent(new Event('input', { bubbles: true }));
}

function highlightText(target, original) {
  if (!target.isContentEditable) return null;
  
  const text = target.textContent || target.innerText || "";
  const index = text.indexOf(original);
  if (index === -1) return null;
  
  const before = text.substring(0, index);
  const highlighted = text.substring(index, index + original.length);
  const after = text.substring(index + original.length);
  
  // Clear and rebuild with highlight
  target.innerHTML = '';
  
  if (before) {
    target.appendChild(document.createTextNode(before));
  }
  
  const highlightSpan = document.createElement('span');
  highlightSpan.textContent = highlighted;
  highlightSpan.style.backgroundColor = '#fff3cd';
  highlightSpan.style.border = '1px solid #ffc107';
  highlightSpan.style.borderRadius = '3px';
  highlightSpan.style.padding = '1px 3px';
  highlightSpan.style.cursor = 'pointer';
  highlightSpan.style.color = '#000';
  highlightSpan.className = 'refyne-highlight';
  highlightSpan.title = 'Click to apply suggestion';
  
  target.appendChild(highlightSpan);
  
  if (after) {
    target.appendChild(document.createTextNode(after));
  }
  
  return highlightSpan;
}

function removeHighlights(target) {
  if (!target.isContentEditable) return;
  
  const highlights = target.querySelectorAll('.refyne-highlight');
  highlights.forEach(highlight => {
    const textNode = document.createTextNode(highlight.textContent);
    highlight.parentNode.replaceChild(textNode, highlight);
  });
  
  // Normalize text nodes
  target.normalize();
}

function handleInput(e) {
  const target = e.target;
  const isEditable =
    target.isContentEditable ||
    target.tagName === "TEXTAREA" ||
    (target.tagName === "INPUT" && (target.type === "text" || target.type === "email" || target.type === "search" || !target.type));
  
  if (!isEditable) return;

  // Hide previous tooltip and remove highlights
  hideTooltip();
  if (activeTarget && activeTarget !== target) {
    removeHighlights(activeTarget);
    activeTarget = null;
    activeSuggestion = null;
  }

  // Clear existing timeout
  clearTimeout(debounceTimeout);
  
  // Set new timeout
  debounceTimeout = setTimeout(async () => {
    const text = getTextFromElement(target);
    
    if (!text || text.trim().length < 3) {
      console.log("Text too short or empty");
      return;
    }

    console.log("Analyzing text:", text.substring(0, 50) + "...");
    
    const suggestions = await fetchSuggestions(text);
    console.log("Received suggestions:", suggestions);
    
    if (!suggestions || suggestions.length === 0) {
      console.log("No suggestions available");
      if (activeTarget === target) {
        removeHighlights(target);
        activeTarget = null;
        activeSuggestion = null;
      }
      return;
    }

    const suggestion = suggestions[0];
    console.log("Using suggestion:", suggestion);
    
    activeTarget = target;
    activeSuggestion = suggestion;

    if (target.isContentEditable) {
      const highlightElement = highlightText(target, suggestion.original);
      
      if (highlightElement) {
        highlightElement.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log("Applying suggestion to contenteditable");
          applySuggestion(target, suggestion.original, suggestion.corrected);
          setTimeout(() => {
            removeHighlights(target);
            activeTarget = null;
            activeSuggestion = null;
            // Re-check for more suggestions
            handleInput({ target });
          }, 300);
        };
      }
    } else {
      // For textareas and inputs
      const rect = target.getBoundingClientRect();
      const tooltipContent = `
        <div style="font-weight: bold; margin-bottom: 4px;">Suggestion:</div>
        <div style="margin-bottom: 4px;">
          <span style="color: #666; text-decoration: line-through;">${suggestion.original}</span>
          <span style="margin: 0 4px;">→</span>
          <span style="color: #2e7d32; font-weight: 500;">${suggestion.corrected}</span>
        </div>
        <div style="font-size: 11px; color: #666;">Click to apply</div>
      `;
      
      showTooltip(
        tooltipContent,
        rect.left + window.scrollX,
        rect.bottom + window.scrollY + 8,
        () => {
          console.log("Applying suggestion to textarea/input");
          applySuggestion(target, suggestion.original, suggestion.corrected);
          activeTarget = null;
          activeSuggestion = null;
          setTimeout(() => handleInput({ target }), 300);
        }
      );
    }
  }, 800); // Reduced debounce time for better responsiveness
}

// Enhanced event listeners
document.addEventListener("input", handleInput, true);
document.addEventListener("click", (e) => {
  if (!tooltip.contains(e.target) && !e.target.classList.contains('refyne-highlight')) {
    hideTooltip();
  }
}, true);

// Handle page changes and dynamic content
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Re-initialize event listeners for new content
          if (node.querySelectorAll) {
            const editableElements = node.querySelectorAll('[contenteditable="true"], textarea, input[type="text"], input[type="email"]');
            editableElements.forEach(el => {
              el.addEventListener('input', handleInput, true);
            });
          }
        }
      });
    }
  });
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

console.log("The Proactive Pen is ready and enhanced!");