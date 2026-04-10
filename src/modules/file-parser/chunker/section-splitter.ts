export interface Section {
    heading: string | null;
    content: string;
}

const HEADING_PATTERNS = [
    /^#{1,6}\s+(.+)$/,                // Markdown headings
    /^([A-Z][A-Z\s&,]{4,})$/,         // ALL CAPS lines (min 5 chars)
    /^(\d+\.[\d.]*)\s+(.+)$/,         // Numbered sections like "1.2 Title"
];

function isHeading(line: string): string | null {
    const trimmed = line.trim();
    if (!trimmed) return null;

    for (const pattern of HEADING_PATTERNS) {
        const match = trimmed.match(pattern);
        if (match) {
            // For markdown headings, strip the # prefix
            if (pattern === HEADING_PATTERNS[0]) return match[1].trim();
            // For numbered sections, return the full match
            if (pattern === HEADING_PATTERNS[2]) return trimmed;
            return match[0].trim();
        }
    }
    return null;
}

export function splitSections(text: string): Section[] {
    const blocks = text.split(/\n{2,}/);
    const sections: Section[] = [];

    let currentHeading: string | null = null;
    let currentContent: string[] = [];

    for (const block of blocks) {
        const trimmed = block.trim();
        if (!trimmed) continue;

        const lines = trimmed.split('\n');
        const firstLineHeading = isHeading(lines[0]);

        if (firstLineHeading) {
            // Flush the previous section
            if (currentContent.length > 0) {
                sections.push({
                    heading: currentHeading,
                    content: currentContent.join('\n\n').trim(),
                });
                currentContent = [];
            }

            currentHeading = firstLineHeading;

            // If there's content beyond the heading line, keep it
            if (lines.length > 1) {
                currentContent.push(lines.slice(1).join('\n').trim());
            }
        } else {
            currentContent.push(trimmed);
        }
    }

    // Flush the last section
    if (currentContent.length > 0) {
        sections.push({
            heading: currentHeading,
            content: currentContent.join('\n\n').trim(),
        });
    }

    // If no sections were found (no headings at all), return the entire text as one section
    if (sections.length === 0 && text.trim()) {
        sections.push({ heading: null, content: text.trim() });
    }

    return sections;
}
