class TooltipManager {
    constructor() {
      this.tooltip = null;
      this.statusDiv = null;
      this.textAnalyzer = new window.TextAnalyzer();
      this.initializeTooltip();
      this.initializeStyles();
    }
  
    initializeTooltip() {
      this.tooltip = document.createElement("div");
      Object.assign(this.tooltip.style, {
        position: "fixed",
        border: "2px solid #E0E7FF",
        padding: "0",
        borderRadius: "12px",
        boxShadow:
          "0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.1)",
        zIndex: "2147483647",
        display: "none",
        fontSize: "14px",
        maxWidth: "480px",
        minWidth: "380px",
        maxHeight: "600px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif",
        lineHeight: "1.6",
        background: "#FFFFFF",
        overflow: "hidden",
      });
      this.tooltip.id = "refyne-tooltip";
      document.body.appendChild(this.tooltip);
    }
  
    getSVGIcon(type) {
      const icons = {
        sparkle:
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.2H22l-6 4.8 2.4 7.2L12 17.2l-6.4 4 2.4-7.2-6-4.8h7.6z"/></svg>',
        chart:
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>',
        speaker:
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>',
        lock: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>',
        info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01" stroke="white" stroke-width="2"/></svg>',
        check:
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>',
        alert:
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 22h20L12 2zm0 6v6m0 4h.01"/></svg>',
        warning:
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>',
        lightbulb:
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 21h6m-4-18a6 6 0 016 6c0 2-1 4-3 5v2a1 1 0 01-1 1h-2a1 1 0 01-1-1v-2c-2-1-3-3-3-5a6 6 0 016-6z"/></svg>',
        alertCircle:
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01" stroke="white" stroke-width="2"/></svg>',
      };
      return icons[type] || "";
    }
  
    initializeStyles() {
      const animationStyles = document.createElement("style");
      animationStyles.textContent = `
              @keyframes refyneSlideIn {
                  from { 
                      opacity: 0; 
                      transform: translateY(-10px) scale(0.95);
                  }
                  to { 
                      opacity: 1; 
                      transform: translateY(0) scale(1);
                  }
              }
              
              @keyframes refyneFadeIn {
                  from { opacity: 0; }
                  to { opacity: 1; }
              }
              
              #refyne-tooltip {
                  animation: refyneSlideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                  pointer-events: auto !important;
              }
              
              .refyne-tab-content {
                  animation: refyneFadeIn 0.15s ease-out;
                  pointer-events: auto !important;
              }
              
              .refyne-listen-btn {
                  transition: all 0.2s ease;
              }
              
              .refyne-listen-btn:hover {
                  transform: translateY(-1px);
                  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
              }
              .refyne-listen-btn-small {
      transition: all 0.2s ease;
      padding: 8px 10px !important;
      min-width: auto !important;
  }
  
  .refyne-listen-btn-small:hover {
      transform: translateY(-1px) scale(1.05);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4) !important;
  }
              .refyne-tab-button {
                  flex: 1;
                  padding: 14px 20px;
                  border: none;
                  background: transparent;
                  cursor: pointer;
                  color: #6B7280;
                  font-size: 14px;
                  font-weight: 500;
                  transition: all 0.2s ease;
                  position: relative;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
              }
              
              .refyne-tab-button::after {
                  content: '';
                  position: absolute;
                  bottom: 0;
                  left: 0;
                  right: 0;
                  height: 3px;
                  background: linear-gradient(90deg, #6366F1, #8B5CF6);
                  transform: scaleX(0);
                  transition: transform 0.2s ease;
                  border-radius: 3px 3px 0 0;
              }
              
              .refyne-tab-button:hover {
                  background: #F9FAFB;
                  color: #374151;
              }
              
              .refyne-tab-button.active {
                  color: #6366F1;
                  font-weight: 600;
                  background: linear-gradient(to bottom, #F5F3FF, transparent);
              }
              
              .refyne-tab-button.active::after {
                  transform: scaleX(1);
              }
              
              .refyne-tab-content {
                  max-height: 450px;
                  overflow-y: auto;
                  padding: 20px;
              }
              
              .refyne-tab-content::-webkit-scrollbar {
                  width: 8px;
              }
              
              .refyne-tab-content::-webkit-scrollbar-track {
                  background: #F3F4F6;
                  border-radius: 4px;
                  margin: 8px 0;
              }
              
              .refyne-tab-content::-webkit-scrollbar-thumb {
                  background: linear-gradient(180deg, #C7D2FE, #A5B4FC);
                  border-radius: 4px;
                  border: 2px solid #F3F4F6;
              }
              
              .refyne-tab-content::-webkit-scrollbar-thumb:hover {
                  background: linear-gradient(180deg, #A5B4FC, #818CF8);
              }
              
              .refyne-metric-card {
                  transition: all 0.2s ease;
              }
              
              .refyne-metric-card:hover {
                  transform: translateY(-2px);
                  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
              }
              
              .refyne-tone-badge {
                  transition: all 0.2s ease;
              }
              
              .refyne-tone-badge:hover {
                  transform: scale(1.05);
                  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
              }
          `;
      document.head.appendChild(animationStyles);
    }
  
    positionTooltip(targetElement) {
      this.tooltip.style.display = "block";
      this.tooltip.style.visibility = "hidden";
  
      const tooltipRect = this.tooltip.getBoundingClientRect();
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
  
      this.tooltip.style.left = Math.round(left) + "px";
      this.tooltip.style.top = Math.round(top) + "px";
      this.tooltip.style.visibility = "visible";
    }
  
    positionCenter() {
      this.tooltip.style.display = "block";
      this.tooltip.style.visibility = "hidden";
      const tooltipRect = this.tooltip.getBoundingClientRect();
      const left = (window.innerWidth - tooltipRect.width) / 2 + window.scrollX;
      const top = (window.innerHeight - tooltipRect.height) / 2 + window.scrollY;
      this.tooltip.style.left = left + "px";
      this.tooltip.style.top = top + "px";
      this.tooltip.style.visibility = "visible";
    }
  
    generateInsightsHTML(insights) {
      if (!insights)
        return `
              <div style="text-align: center; padding: 60px 20px; color: #9CA3AF;">
                  <div style="margin-bottom: 16px;">${this.getSVGIcon(
                    "chart"
                  )}</div>
                  <div style="font-size: 16px; font-weight: 600; color: #6B7280; margin-bottom: 8px;">No insights available</div>
                  <div style="font-size: 13px; color: #9CA3AF;">Write more text to get detailed analysis</div>
              </div>
          `;
  
      return `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;">
                  <!-- Metrics Grid -->
                  <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 24px;">
                      <div class="refyne-metric-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px; color: white; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                          <div style="font-size: 32px; font-weight: 700; margin-bottom: 4px;">${
                            insights.wordCount
                          }</div>
                          <div style="font-size: 11px; opacity: 0.9; letter-spacing: 0.5px; text-transform: uppercase;">Words</div>
                      </div>
                      <div class="refyne-metric-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 20px; border-radius: 10px; color: white; box-shadow: 0 4px 6px rgba(240, 147, 251, 0.3);">
                          <div style="font-size: 32px; font-weight: 700; margin-bottom: 4px;">${
                            insights.sentenceCount
                          }</div>
                          <div style="font-size: 11px; opacity: 0.9; letter-spacing: 0.5px; text-transform: uppercase;">Sentences</div>
                      </div>
                      <div class="refyne-metric-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 20px; border-radius: 10px; color: white; box-shadow: 0 4px 6px rgba(79, 172, 254, 0.3);">
                          <div style="font-size: 32px; font-weight: 700; margin-bottom: 4px;">${
                            insights.readingTime
                          }<span style="font-size: 18px;">min</span></div>
                          <div style="font-size: 11px; opacity: 0.9; letter-spacing: 0.5px; text-transform: uppercase;">Read Time</div>
                      </div>
                      <div class="refyne-metric-card" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); padding: 20px; border-radius: 10px; color: white; box-shadow: 0 4px 6px rgba(67, 233, 123, 0.3);">
                          <div style="font-size: 32px; font-weight: 700; margin-bottom: 4px;">${
                            insights.readability
                          }<span style="font-size: 18px;">%</span></div>
                          <div style="font-size: 11px; opacity: 0.9; letter-spacing: 0.5px; text-transform: uppercase;">Readability</div>
                      </div>
                  </div>
  
                  ${
                    insights.tone.length > 0
                      ? `
                  <div style="margin-bottom: 24px;">
                      <div style="display: flex; align-items: center; margin-bottom: 14px;">
                          <div style="background: linear-gradient(135deg, #667eea, #764ba2); width: 4px; height: 20px; border-radius: 2px; margin-right: 10px;"></div>
                          <div style="font-weight: 700; color: #1F2937; font-size: 13px; letter-spacing: 0.3px; text-transform: uppercase;">Writing Tone</div>
                      </div>
                      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                          ${insights.tone
                            .map(
                              (tone) => `
                              <div class="refyne-tone-badge" style="background: ${this.textAnalyzer.getToneColor(
                                tone.name
                              )}; color: white; padding: 10px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                                  <span>${tone.name}</span>
                                  <span style="opacity: 0.85; font-size: 11px; background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 10px;">${
                                    tone.score
                                  }%</span>
                              </div>
                          `
                            )
                            .join("")}
                      </div>
                  </div>
                  `
                      : ""
                  }
  
                  ${
                    insights.issues.length > 0
                      ? `
                  <div style="margin-bottom: 24px;">
                      <div style="display: flex; align-items: center; margin-bottom: 14px;">
                          <div style="background: linear-gradient(135deg, #f093fb, #f5576c); width: 4px; height: 20px; border-radius: 2px; margin-right: 10px;"></div>
                          <div style="font-weight: 700; color: #1F2937; font-size: 13px; letter-spacing: 0.3px; text-transform: uppercase;">Improvement Areas</div>
                      </div>
                      <div style="background: linear-gradient(135deg, #FFFBEB, #FEF3C7); border: 2px solid #FDE68A; border-radius: 10px; padding: 16px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);">
                          ${insights.issues
                            .map(
                              (issue, index) => `
                              <div style="display: flex; align-items: start; margin-bottom: ${
                                index === insights.issues.length - 1
                                  ? "0"
                                  : "12px"
                              };">
                                  <span style="color: #F59E0B; margin-right: 10px; margin-top: 2px;">${this.getSVGIcon(
                                    "alertCircle"
                                  )}</span>
                                  <span style="color: #92400E; font-size: 13px; line-height: 1.6; font-weight: 500;">${issue}</span>
                              </div>
                          `
                            )
                            .join("")}
                      </div>
                  </div>
                  `
                      : ""
                  }
  
                  ${
                    insights.suggestions.length > 0
                      ? `
                  <div style="margin-bottom: 16px;">
                      <div style="display: flex; align-items: center; margin-bottom: 14px;">
                          <div style="background: linear-gradient(135deg, #43e97b, #38f9d7); width: 4px; height: 20px; border-radius: 2px; margin-right: 10px;"></div>
                          <div style="font-weight: 700; color: #1F2937; font-size: 13px; letter-spacing: 0.3px; text-transform: uppercase;">Writing Tips</div>
                      </div>
                      <div style="background: linear-gradient(135deg, #ECFDF5, #D1FAE5); border: 2px solid #A7F3D0; border-radius: 10px; padding: 16px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);">
                          ${insights.suggestions
                            .map(
                              (tip, index) => `
                              <div style="display: flex; align-items: start; margin-bottom: ${
                                index === insights.suggestions.length - 1
                                  ? "0"
                                  : "12px"
                              };">
                                  <span style="color: #10B981; margin-right: 10px; margin-top: 2px;">${this.getSVGIcon(
                                    "lightbulb"
                                  )}</span>
                                  <span style="color: #065F46; font-size: 13px; line-height: 1.6; font-weight: 500;">${tip}</span>
                              </div>
                          `
                            )
                            .join("")}
                      </div>
                  </div>
                  `
                      : ""
                  }
  
                  <!-- Footer Stats -->
                  <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #F3F4F6; display: flex; justify-content: space-around; text-align: center;">
                      <div>
                          <div style="font-size: 20px; font-weight: 700; color: #6366F1;">${
                            insights.avgSentenceLength
                          }</div>
                          <div style="font-size: 11px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.5px;">Avg Words/Sentence</div>
                      </div>
                      <div style="width: 2px; background: #E5E7EB;"></div>
                      <div>
                          <div style="font-size: 20px; font-weight: 700; color: #8B5CF6;">${
                            insights.paragraphCount
                          }</div>
                          <div style="font-size: 11px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.5px;">Paragraphs</div>
                      </div>
                  </div>
              </div>
          `;
    }
  
    async showWithInsights(targetElement, suggestion, insights, applyCallback) {
      const source = suggestion.source || "ai";
      const titleColor = source === "offline" ? "#F59E0B" : "#10B981";
      const titleBg = source === "offline" ? "linear-gradient(135deg, #FEF3C7, #FDE68A)" : "linear-gradient(135deg, #D1FAE5, #A7F3D0)";
      const titleIcon = source === "offline" ? this.getSVGIcon('lock') : this.getSVGIcon('sparkle');
      const titleText = source === "offline" ? "Offline Suggestion" : "AI Suggestion";
      
      let ttsEnabled = false;
      try {
          const settings = await new Promise(resolve => {
              chrome.storage.sync.get(['enableTTS'], resolve);
          });
          
          if (settings.enableTTS !== false && suggestion.corrected) {
              ttsEnabled = true;
          }
      } catch (error) {
          console.error("Error getting TTS settings:", error);
      }
  
      const insightsHtml = this.generateInsightsHTML(insights);
      const sourceIndicator = source === "offline" 
          ? `<span style="font-size: 11px; color: #9CA3AF; font-weight: 500;">Offline Mode</span>`
          : `<span style="font-size: 11px; color: #9CA3AF; font-weight: 500;">Powered by AI</span>`;
  
      const tooltipContent = `
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #F5F3FF, #EDE9FE); border-bottom: 2px solid #E0E7FF; padding: 4px;">
              <div style="display: flex;">
                  <button class="refyne-tab-button active" data-tab="suggestion">
                      <span style="margin-right: 6px; display: inline-flex; align-items: center;">${this.getSVGIcon('sparkle')}</span> Suggestion
                  </button>
                  <button class="refyne-tab-button" data-tab="insights">
                      <span style="margin-right: 6px; display: inline-flex; align-items: center;">${this.getSVGIcon('chart')}</span> Insights
                  </button>
              </div>
          </div>
          
          <!-- Suggestion Tab -->
          <div id="suggestion-tab" class="refyne-tab-content" style="overflow-y: visible;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
                  <div style="background: ${titleBg}; padding: 12px 16px; border-radius: 8px; border: 2px solid ${source === "offline" ? "#FDE68A" : "#A7F3D0"}; display: flex; align-items: center; gap: 8px; flex: 1;">
                      <span style="display: inline-flex; color: ${titleColor};">${titleIcon}</span>
                      <div style="font-weight: 700; color: ${titleColor}; font-size: 15px;">${titleText}</div>
                  </div>
                  ${ttsEnabled ? `
                  <button class="refyne-listen-btn" style="margin-left: 12px; padding: 10px 12px; background: linear-gradient(135deg, #6366F1, #8B5CF6); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3); min-width: auto;">
                      ${this.getSVGIcon('speaker')}
                  </button>
                  ` : ''}
              </div>
              
              <div style="background: #F9FAFB; border: 2px solid #E5E7EB; border-radius: 8px; padding: 14px; margin-bottom: 12px;">
                  <div style="font-size: 11px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; font-weight: 600;">Original</div>
                  <div style="color: #6B7280; text-decoration: line-through; font-size: 14px; line-height: 1.6;">${suggestion.original}</div>
              </div>
              
              <div style="background: linear-gradient(135deg, #ECFDF5, #D1FAE5); border: 2px solid #10B981; border-radius: 8px; padding: 14px; margin-bottom: 12px;">
                  <div style="font-size: 11px; color: #059669; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; font-weight: 600;">Improved</div>
                  <div style="color: #065F46; font-weight: 600; font-size: 14px; line-height: 1.6;">${suggestion.corrected}</div>
              </div>
              
              <div style="text-align: center; padding: 12px; background: linear-gradient(135deg, #EEF2FF, #E0E7FF); border-radius: 8px; border: 2px dashed #C7D2FE;">
                  <div style="font-size: 13px; color: #4F46E5; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 6px;">
                      ${this.getSVGIcon('info')} Click anywhere to apply suggestion
                  </div>
              </div>
          </div>
          
          <!-- Insights Tab -->
          <div id="insights-tab" class="refyne-tab-content" style="display: none;">
              ${insightsHtml}
          </div>
          
          <!-- Footer -->
          <div style="padding: 12px 20px; border-top: 2px solid #F3F4F6; background: #FAFAFA; display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 8px;">
                  <div style="width: 8px; height: 8px; border-radius: 50%; background: ${source === "offline" ? "#F59E0B" : "#10B981"};"></div>
                  ${sourceIndicator}
              </div>
              <div style="font-size: 10px; color: #D1D5DB; font-weight: 600;">REFYNE</div>
          </div>
      `;
      
      this.tooltip.innerHTML = tooltipContent;
      this.positionTooltip(targetElement);
      
      this.setupTabListeners(targetElement);
      this.setupListenButton(suggestion.corrected);
      this.setupClickHandler(applyCallback);
  }
  
    showCenteredSuggestion(suggestion, originalText) {
      const source = suggestion.source || "ai";
      const titleColor = source === "offline" ? "#F59E0B" : "#10B981";
      const titleBg =
        source === "offline"
          ? "linear-gradient(135deg, #FEF3C7, #FDE68A)"
          : "linear-gradient(135deg, #D1FAE5, #A7F3D0)";
      const titleIcon =
        source === "offline"
          ? this.getSVGIcon("lock")
          : this.getSVGIcon("sparkle");
      const titleText =
        source === "offline" ? "Offline Suggestion" : "AI Suggestion";
  
      const insights = this.textAnalyzer.analyzeText(originalText);
      const insightsHtml = this.generateInsightsHTML(insights);
  
      const tooltipContent = `
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #F5F3FF, #EDE9FE); border-bottom: 2px solid #E0E7FF; padding: 4px;">
                  <div style="display: flex;">
                      <button class="refyne-tab-button active" data-tab="suggestion">
                          <span style="margin-right: 6px; display: inline-flex; align-items: center;">${this.getSVGIcon(
                            "sparkle"
                          )}</span> Suggestion
                      </button>
                      <button class="refyne-tab-button" data-tab="insights">
                          <span style="margin-right: 6px; display: inline-flex; align-items: center;">${this.getSVGIcon(
                            "chart"
                          )}</span> Insights
                      </button>
                  </div>
              </div>
              
              <!-- Suggestion Tab -->
              <div id="suggestion-tab" class="refyne-tab-content" style="overflow-y: visible;">
                  <div style="background: ${titleBg}; padding: 14px 18px; border-radius: 8px; margin-bottom: 16px; text-align: center; border: 2px solid ${
        source === "offline" ? "#FDE68A" : "#A7F3D0"
      }; display: flex; align-items: center; justify-content: center; gap: 8px;">
                      <span style="display: inline-flex; color: ${titleColor};">${titleIcon}</span>
                      <div style="font-weight: 700; color: ${titleColor}; font-size: 16px;">${titleText}</div>
                  </div>
                  
                  <div style="background: #F9FAFB; border: 2px solid #E5E7EB; border-radius: 8px; padding: 16px; margin-bottom: 14px;">
                      <div style="font-size: 11px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; font-weight: 600;">Original</div>
                      <div style="color: #6B7280; text-decoration: line-through; font-size: 14px; line-height: 1.6;">${
                        suggestion.original
                      }</div>
                  </div>
                  
                  <div style="background: linear-gradient(135deg, #ECFDF5, #D1FAE5); border: 2px solid #10B981; border-radius: 8px; padding: 16px;">
                      <div style="font-size: 11px; color: #059669; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; font-weight: 600;">Improved</div>
                      <div style="color: #065F46; font-weight: 600; font-size: 14px; line-height: 1.6;">${
                        suggestion.corrected
                      }</div>
                  </div>
              </div>
              
              <!-- Insights Tab -->
              <div id="insights-tab" class="refyne-tab-content" style="display: none;">
                  ${insightsHtml}
              </div>
              
              <!-- Footer -->
              <div style="padding: 12px 20px; border-top: 2px solid #F3F4F6; background: #FAFAFA; display: flex; align-items: center; justify-content: center;">
                  <div style="font-size: 11px; color: #9CA3AF; font-weight: 500;">${
                    source === "offline" ? "Offline Mode" : "Powered by AI"
                  }</div>
              </div>
          `;
  
      this.tooltip.innerHTML = tooltipContent;
      this.positionCenter();
  
      this.setupTabListeners(null);
      this.setupClickHandler(() => this.hide());
    }
  
    showInsightsOnly(text, insights) {
      const insightsHtml = this.generateInsightsHTML(insights);
  
      const tooltipContent = `
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #F5F3FF, #EDE9FE); padding: 16px 20px; border-bottom: 2px solid #E0E7FF;">
                  <div style="font-weight: 700; color: #6366F1; font-size: 18px; text-align: center; display: flex; align-items: center; justify-content: center; gap: 8px;">
                      ${this.getSVGIcon("chart")} Writing Insights
                  </div>
              </div>
              
              <!-- Original Text -->
              <div style="padding: 20px; background: linear-gradient(135deg, #ECFDF5, #D1FAE5); border-bottom: 2px solid #A7F3D0;">
                  <div style="font-size: 11px; color: #059669; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; font-weight: 600;">Your Text</div>
                  <div style="color: #065F46; font-weight: 500; font-size: 13px; line-height: 1.6; max-height: 80px; overflow-y: auto;">${text}</div>
              </div>
              
              <!-- Insights -->
              <div class="refyne-tab-content">
                  ${insightsHtml}
              </div>
              
              <!-- Footer -->
              <div style="padding: 12px 20px; border-top: 2px solid #F3F4F6; background: #FAFAFA; text-align: center;">
                  <div style="font-size: 10px; color: #D1D5DB; font-weight: 600;">REFYNE</div>
              </div>
          `;
  
      this.tooltip.innerHTML = tooltipContent;
      this.positionCenter();
      this.setupClickHandler(() => this.hide());
    }
  
    setupTabListeners(targetElement) {
      const tabButtons = this.tooltip.querySelectorAll(".refyne-tab-button");
  
      tabButtons.forEach((button) => {
        button.addEventListener("click", (e) => {
          e.stopPropagation();
          const tabName = button.dataset.tab;
  
          tabButtons.forEach((btn) => btn.classList.remove("active"));
          button.classList.add("active");
  
          this.tooltip
            .querySelectorAll(".refyne-tab-content")
            .forEach((content) => {
              content.style.display = "none";
            });
          this.tooltip.querySelector(`#${tabName}-tab`).style.display = "block";
  
          if (targetElement) {
            setTimeout(() => this.positionTooltip(targetElement), 10);
          }
        });
      });
    }
  
    setupListenButton(text) {
      if (!text) return;
  
      const listenBtn = this.tooltip.querySelector(".refyne-listen-btn");
      if (listenBtn) {
        listenBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.speakText(text);
        });
      }
    }
  
    setupClickHandler(callback) {
      this.tooltip.onclick = (e) => {
        if (
          !e.target.closest(".refyne-listen-btn") &&
          !e.target.classList.contains("refyne-tab-button") &&
          !e.target.closest(".refyne-tab-button")
        ) {
          e.stopPropagation();
          callback();
        }
      };
    }
  
    async speakText(text) {
      try {
        const settings = await new Promise((resolve) => {
          chrome.storage.sync.get(["enableTTS"], resolve);
        });
  
        if (settings.enableTTS === false) return;
  
        if ("speechSynthesis" in window) {
          speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 0.9;
          utterance.pitch = 1.0;
          utterance.volume = 0.8;
          speechSynthesis.speak(utterance);
        }
      } catch (error) {
        console.error("TTS error:", error);
      }
    }
  
    hide() {
      this.tooltip.style.display = "none";
    }
  
    contains(element) {
      return this.tooltip.contains(element);
    }
  
    showStatus(message, type = "info") {
      if (!this.statusDiv) {
        this.statusDiv = document.createElement("div");
        this.statusDiv.id = "refyne-status-message";
        Object.assign(this.statusDiv.style, {
          position: "fixed",
          top: "20px",
          right: "20px",
          padding: "14px 18px",
          borderRadius: "10px",
          zIndex: "2147483647",
          fontSize: "14px",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
          fontWeight: "600",
          maxWidth: "320px",
          transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          boxShadow:
            "0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1)",
          backdropFilter: "blur(10px)",
        });
        document.body.appendChild(this.statusDiv);
      }
  
      const colors = {
        info: {
          bg: "linear-gradient(135deg, #3B82F6, #2563EB)",
          text: "white",
          icon: this.getSVGIcon("info"),
        },
        success: {
          bg: "linear-gradient(135deg, #10B981, #059669)",
          text: "white",
          icon: this.getSVGIcon("check"),
        },
        error: {
          bg: "linear-gradient(135deg, #EF4444, #DC2626)",
          text: "white",
          icon: this.getSVGIcon("alert"),
        },
        warning: {
          bg: "linear-gradient(135deg, #F59E0B, #D97706)",
          text: "white",
          icon: this.getSVGIcon("warning"),
        },
      };
  
      const color = colors[type] || colors.info;
      this.statusDiv.style.background = color.bg;
      this.statusDiv.style.color = color.text;
      this.statusDiv.innerHTML = `
              <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="display: inline-flex; align-items: center;">${color.icon}</span>
                  <span>${message}</span>
              </div>
          `;
      this.statusDiv.style.display = "block";
      this.statusDiv.style.opacity = "1";
      this.statusDiv.style.transform = "translateX(0)";
    }
  
    hideStatus() {
      if (this.statusDiv) {
        this.statusDiv.style.opacity = "0";
        this.statusDiv.style.transform = "translateX(400px)";
        setTimeout(() => {
          this.statusDiv.style.display = "none";
        }, 300);
      }
    }
  }
  window.TooltipManager = TooltipManager;
  