console.log("The Proactive Pen content script loaded!");

const tooltip = document.createElement("div");
Object.assign(tooltip.style, {
  position: "absolute",
  background: "#fff",
  border: "1px solid #ccc",
  padding: "6px 10px",
  borderRadius: "4px",
  boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
  zIndex: "999999",
  display: "none",
  fontSize: "13px",
  maxWidth: "300px",
  cursor: "pointer",
});
document.body.appendChild(tooltip);

let debounceTimeout = null;
let currentController = null;

function showTooltip(html, x, y, applyCallback) {
  tooltip.innerHTML = html;
  tooltip.style.left = x + "px";
  tooltip.style.top = y + "px";
  tooltip.style.display = "block";
  tooltip.onclick = () => {
    applyCallback();
    tooltip.style.display = "none";
  };
}

function hideTooltip() {
  tooltip.style.display = "none";
}

async function fetchSuggestions(text) {
  if (!text || text.length < 3) return [];
  try {
    if (currentController) currentController.abort();
    currentController = new AbortController();
    
    const response = await fetch("http://localhost:3000/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "mistral",
        messages: [
          {
            role: "system",
            content: `You are an intelligent writing refinement assistant. Analyze the context and purpose of the text, then suggest ONE meaningful improvement.

ANALYSIS STEPS:
1. Detect the context (email, chat, social post, formal doc, creative writing, etc.)
2. Identify the tone (casual, professional, friendly, formal, urgent, etc.)
3. Find the most important improvement needed

WHAT TO REFINE:
- Grammar & spelling errors (always fix these)
- Awkward or unclear phrasing
- Tone mismatches (too casual for formal context, too stiff for friendly chat)
- Weak word choices that could be stronger
- Redundant or wordy expressions
- Missing politeness markers (please, thank you) in requests
- Overly aggressive or blunt language that could be softer
- Passive voice that should be active (in professional contexts)

REFINEMENT PRINCIPLES:
- Match the detected context and tone
- Make it sound natural and fluent
- Keep the user's core message intact
- Fix only ONE thing at a time (the most important)
- The "original" MUST be an exact substring from the input
- Suggest 5-20 word replacements (not too short, not too long)

OUTPUT (JSON only):
[{"original": "exact text from input", "corrected": "context-appropriate refined version"}]

If text is already well-written, return: []

EXAMPLES:
Input: "hey can u send me the report"
Context: Professional email
Output: [{"original": "hey can u send me the report", "corrected": "Hi, could you please send me the report?"}]

Input: "I am writing to inquire if you are available lol"
Context: Professional inquiry
Output: [{"original": "inquire if you are available lol", "corrected": "inquire if you are available"}]

Input: "thanks alot for you're help yesterday"
Context: Thank you message
Output: [{"original": "thanks alot for you're help", "corrected": "thanks a lot for your help"}]

Input: "The data shows we needs to pivot"
Context: Business report
Output: [{"original": "shows we needs to pivot", "corrected": "shows we need to pivot"}]`
          },
          {
            role: "user",
            content: `Analyze and refine this text: "${text}"\n\nReturn JSON only.`
          }
        ],
        temperature: 0.1,
        max_tokens: 200,
      }),
      signal: currentController.signal,
    }).catch(err => {
      if (err.name !== "AbortError") {
        console.error("Network error - Is the proxy running on port 3000?");
      }
      throw err;
    });

    currentController = null;

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (data.response) {
      try {
        let cleaned = data.response.trim();
        
        cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          cleaned = jsonMatch[0];
        }
        
        const suggestions = JSON.parse(cleaned);
        if (Array.isArray(suggestions) && suggestions.length > 0) {
          const validSuggestions = suggestions.filter(s => {
            if (!s.original || !s.corrected) return false;
            if (s.original === s.corrected) return false;
            if (text.indexOf(s.original) === -1) return false;
            return true;
          });
          return validSuggestions.slice(0, 1);
        }
      } catch (err) {
        console.error("Parse error:", err);
        console.error("Response was:", data.response);
      }
    }
    return [];
  } catch (err) {
    if (err.name === "AbortError") return [];
    return [];
  }
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
  target.dispatchEvent(new Event('input', { bubbles: true }));
}

function applyToContentEditable(target, original, corrected) {
  // First remove any existing highlights
  removeHighlights(target);
  
  const text = target.innerText || target.textContent;
  const index = text.indexOf(original);
  
  console.log("Applying to contentEditable:", { original, corrected, text, index });
  
  if (index === -1) {
    console.warn("Original text not found in target");
    return;
  }
  
  const before = text.substring(0, index);
  const after = text.substring(index + original.length);
  
  // Clear and rebuild content
  target.textContent = before + corrected + after;
  
  // Set cursor position
  try {
    const range = document.createRange();
    const sel = window.getSelection();
    const textNode = target.firstChild;
    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
      const newPos = before.length + corrected.length;
      range.setStart(textNode, Math.min(newPos, textNode.length));
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  } catch (err) {
    console.error("Cursor error:", err);
  }
  
  // Trigger input event so we can check for more suggestions
  target.dispatchEvent(new Event('input', { bubbles: true }));
}

function highlightText(target, original) {
  if (!target.isContentEditable) return;
  
  // Remove any existing highlights first
  removeHighlights(target);
  
  const text = target.innerText || target.textContent;
  const index = text.indexOf(original);
  
  console.log("Highlighting:", { original, text, index });
  
  if (index === -1) {
    console.warn("Text to highlight not found:", original);
    return;
  }
  
  const before = text.substring(0, index);
  const highlighted = text.substring(index, index + original.length);
  const after = text.substring(index + original.length);
  
  // Clear content
  target.innerHTML = '';
  
  // Add before text
  if (before) {
    target.appendChild(document.createTextNode(before));
  }
  
  // Add highlighted span
  const highlight = document.createElement('span');
  highlight.textContent = highlighted;
  highlight.style.backgroundColor = '#ffe58f';
  highlight.style.borderBottom = '2px solid #ff9800';
  highlight.style.cursor = 'pointer';
  highlight.style.padding = '2px 0';
  highlight.className = 'refyne-highlight';
  highlight.title = 'Click to fix';
  target.appendChild(highlight);
  
  // Add after text
  if (after) {
    target.appendChild(document.createTextNode(after));
  }
  
  console.log("✓ Highlight applied successfully");
}

function removeHighlights(target) {
  if (!target.isContentEditable) return;
  const highlights = target.querySelectorAll('.refyne-highlight');
  highlights.forEach(h => {
    const text = document.createTextNode(h.textContent);
    h.parentNode.replaceChild(text, h);
  });
  target.normalize();
}

let activeTarget = null;
let activeSuggestion = null;

function handleInput(e) {
  const target = e.target;
  const isEditable =
    target.isContentEditable ||
    target.tagName === "TEXTAREA" ||
    (target.tagName === "INPUT" && target.type === "text");
  
  if (!isEditable) return;

  hideTooltip();
  if (activeTarget && activeTarget !== target) {
    removeHighlights(activeTarget);
  }

  clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(async () => {
    const text = target.value || target.innerText;
    if (!text || text.length < 3) return;

    console.log("Checking text:", text.substring(0, 50) + "...");
    
    const suggestions = await fetchSuggestions(text);
    
    console.log("Suggestions received:", suggestions);
    
    if (!suggestions || suggestions.length === 0) {
      if (activeTarget === target) {
        removeHighlights(target);
        activeTarget = null;
        activeSuggestion = null;
      }
      return;
    }

    const suggestion = suggestions[0];
    console.log("✓ Suggestion found:", suggestion);
    
    activeTarget = target;
    activeSuggestion = suggestion;

    if (target.isContentEditable) {
      removeHighlights(target);
      highlightText(target, suggestion.original);
      
      const highlight = target.querySelector('.refyne-highlight');
      if (highlight) {
        highlight.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log("Highlight clicked, applying correction...");
          applyToContentEditable(target, suggestion.original, suggestion.corrected);
          activeTarget = null;
          activeSuggestion = null;
          // Check for next suggestion after a short delay
          setTimeout(() => {
            const evt = new Event('input', { bubbles: true });
            target.dispatchEvent(evt);
          }, 500);
        };
      } else {
        console.warn("Highlight element not found after creation");
      }
    } else {
      const rect = target.getBoundingClientRect();
      showTooltip(
        `<strong>Suggestion:</strong><br>"${suggestion.original}" → "${suggestion.corrected}"<br><small>Click to apply</small>`,
        rect.left + window.scrollX,
        rect.bottom + window.scrollY + 5,
        () => {
          console.log("Tooltip clicked, applying correction...");
          applyToTextarea(target, suggestion.original, suggestion.corrected);
          activeTarget = null;
          activeSuggestion = null;
          // Check for next suggestion
          setTimeout(() => {
            const evt = new Event('input', { bubbles: true });
            target.dispatchEvent(evt);
          }, 500);
        }
      );
    }
  }, 1000);
}

document.addEventListener("input", handleInput);
document.addEventListener("scroll", hideTooltip);
document.addEventListener("resize", hideTooltip);
document.addEventListener("mousedown", (e) => {
  if (!tooltip.contains(e.target) && !e.target.classList.contains('refyne-highlight')) {
    hideTooltip();
  }
});

console.log("The Proactive Pen is ready!");