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
let lastText = "";

// Utility: Show tooltip
function showTooltip(target, html, x, y, applyCallback) {
  tooltip.innerHTML = html;
  tooltip.style.left = x + "px";
  tooltip.style.top = y + "px";
  tooltip.style.display = "block";
  tooltip.onclick = () => {
    applyCallback();
    tooltip.style.display = "none";
  };
}

// Hide tooltip
function hideTooltip() {
  tooltip.style.display = "none";
}

// Fetch suggestions from proxy
async function fetchSuggestions(text) {
  if (!text || text.length < 3) return [];
  try {
    if (currentController) currentController.abort();
    currentController = new AbortController();
    const response = await fetch("http://localhost:3000/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "phi3",
        messages: [
          {
            role: "system",
            content:
              "You are a grammar and style assistant. Return ONLY a JSON array of suggestions in the form [{text, suggestion, index, length}].",
          },
          {
            role: "user",
            content: `Analyze the following text and return corrections as JSON: "${text}"`,
          },
        ],
        temperature: 0.3,
        max_tokens: 300,
      }),
      signal: currentController.signal,
    });

    currentController = null;

    if (!response.ok) {
      console.error("Ollama API error:", response.statusText);
      return [];
    }

    const data = await response.json();
    if (data.response) {
      try {
        const suggestions = JSON.parse(data.response);
        if (Array.isArray(suggestions)) return suggestions;
      } catch (err) {
        console.error("Failed to parse suggestions:", err, data.response);
      }
    }
    return [];
  } catch (err) {
    if (err.name === "AbortError") return [];
    console.error("Fetch suggestions error:", err);
    return [];
  }
}

// Apply highlights incrementally in contentEditable
function applyHighlights(target, suggestions) {
  if (!target.isContentEditable) return;

  const text = target.innerText;
  target.innerHTML = ""; // Clear for incremental rebuild

  let lastIndex = 0;

  suggestions.forEach((s) => {
    const safeStart = Math.max(0, s.index);
    const safeEnd = Math.min(text.length, s.index + s.length);

    // Normal text
    target.appendChild(document.createTextNode(text.slice(lastIndex, safeStart)));

    // Highlight
    const span = document.createElement("span");
    span.textContent = text.slice(safeStart, safeEnd);
    span.style.backgroundColor = "#ffe58f";
    span.style.borderBottom = "2px solid #ff9800";
    span.dataset.suggestion = s.suggestion;
    span.dataset.original = s.text || span.textContent;
    span.className = "proactive-pen-highlight";

    // Click to apply suggestion
    span.addEventListener("click", () => {
      span.textContent = s.suggestion;
      span.style.backgroundColor = "#c8e6c9";
      span.style.borderBottom = "2px solid #4caf50";
    });

    target.appendChild(span);
    lastIndex = safeEnd;
  });

  // Remaining text
  target.appendChild(document.createTextNode(text.slice(lastIndex)));
}

// Handle input in any editable field
function handleInput(e) {
  const target = e.target;
  const isEditable =
    target.isContentEditable ||
    target.tagName === "TEXTAREA" ||
    (target.tagName === "INPUT" && target.type === "text");
  if (!isEditable) return;

  const text = target.value || target.innerText;
  if (!text || text === lastText) return;

  clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(async () => {
    lastText = text;
    const suggestions = await fetchSuggestions(text);
    if (!suggestions || suggestions.length === 0) return;

    if (target.isContentEditable) {
      applyHighlights(target, suggestions);
    } else {
      // For textarea/input: floating suggestion box
      const s = suggestions[0];
      const rect = target.getBoundingClientRect();
      showTooltip(
        target,
        `<strong>Suggestion:</strong> ${s.suggestion}<br><small>Original: ${s.text}</small>`,
        rect.left + window.scrollX,
        rect.bottom + window.scrollY + 5,
        () => {
          target.value =
            text.slice(0, s.index) + s.suggestion + text.slice(s.index + s.length);
        }
      );
    }
  }, 500);
}

// Event listeners
document.addEventListener("input", handleInput);
document.addEventListener("scroll", hideTooltip);
document.addEventListener("resize", hideTooltip);
document.addEventListener("mousedown", (e) => {
  if (!tooltip.contains(e.target)) hideTooltip();
});

console.log("The Proactive Pen is ready!");
