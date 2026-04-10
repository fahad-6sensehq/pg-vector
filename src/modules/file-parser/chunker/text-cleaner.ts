export function cleanText(raw: string): string {
    let text = raw;

    // Fix broken hyphenations across line breaks (e.g. "knowl-\nedge" → "knowledge")
    text = text.replace(/(\w)-\s*\n\s*(\w)/g, '$1$2');

    // Normalize unicode quotes and dashes
    text = text.replace(/[\u2018\u2019]/g, "'");
    text = text.replace(/[\u201C\u201D]/g, '"');
    text = text.replace(/[\u2013\u2014]/g, '-');
    text = text.replace(/\u2026/g, '...');

    // Normalize various whitespace characters to regular space
    text = text.replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ');

    // Remove page-number-like artifacts (standalone numbers on their own line)
    text = text.replace(/^\s*\d{1,4}\s*$/gm, '');

    // Collapse runs of 3+ newlines into double-newlines (paragraph boundaries)
    text = text.replace(/\n{3,}/g, '\n\n');

    // Collapse multiple spaces into one
    text = text.replace(/ {2,}/g, ' ');

    // Trim leading/trailing whitespace on each line
    text = text
        .split('\n')
        .map((line) => line.trim())
        .join('\n');

    return text.trim();
}
