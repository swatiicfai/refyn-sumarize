class TextAnalyzer {
    analyzeText(text) {
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
        
        const tone = this.analyzeTone(text);
        const readability = this.calculateReadability(text);
        
        return {
            wordCount: words,
            sentenceCount: sentences,
            paragraphCount: paragraphs,
            avgSentenceLength,
            readingTime,
            issues,
            tone,
            readability,
            suggestions: this.generateWritingTips(text)
        };
    }
    
    analyzeTone(text) {
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
    
    calculateReadability(text) {
        const words = text.split(/\s+/).length;
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
        const syllables = this.estimateSyllables(text);
        
        if (sentences === 0 || words === 0) return 100;
        
        const avgWordsPerSentence = words / sentences;
        const avgSyllablesPerWord = syllables / words;
        
        let score = 100 - (avgWordsPerSentence + avgSyllablesPerWord * 10);
        return Math.max(0, Math.min(100, Math.round(score)));
    }
    
    estimateSyllables(text) {
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
    
    generateWritingTips(text) {
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
    
    getToneColor(toneName) {
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
    
    getToneEmoji(toneName) {
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
}
window.TextAnalyzer = TextAnalyzer;