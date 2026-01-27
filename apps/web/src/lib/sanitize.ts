import DOMPurify, { Config } from 'dompurify';

/**
 * Decode HTML entities that may have been double-encoded
 * This handles cases where RSS feeds return escaped HTML
 */
function decodeHtmlEntities(html: string): string {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = html;
  return textarea.value;
}

// Configure DOMPurify for article content
const config: Config = {
  // Allow common HTML elements
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'a', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'ins',
    'img', 'figure', 'figcaption',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    'div', 'span', 'article', 'section', 'aside', 'header', 'footer',
    'video', 'audio', 'source', 'iframe',
    'sup', 'sub', 'abbr', 'cite', 'q', 'mark',
  ],

  // Allow common attributes
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'class', 'id',
    'width', 'height', 'loading', 'decoding',
    'target', 'rel',
    'colspan', 'rowspan', 'headers', 'scope',
    'controls', 'autoplay', 'loop', 'muted', 'poster',
    'frameborder', 'allowfullscreen', 'allow',
    'datetime', 'cite',
  ],

  // Add rel="noopener noreferrer" to links
  ADD_ATTR: ['target'],

  // Allow data: URLs for images (some feeds embed images this way)
  ALLOW_DATA_ATTR: false,

  // Allow YouTube, Vimeo, and common embed iframes
  ADD_URI_SAFE_ATTR: ['src'],
};

// Hook to add rel="noopener noreferrer" and target="_blank" to links
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }

  // Add lazy loading to images
  if (node.tagName === 'IMG') {
    node.setAttribute('loading', 'lazy');
    node.setAttribute('decoding', 'async');
  }
});

/**
 * Sanitize HTML content for safe rendering
 * Decodes HTML entities first to handle double-encoded content from RSS feeds
 */
export function sanitizeHtml(html: string): string {
  // Decode HTML entities in case content was double-encoded
  const decoded = decodeHtmlEntities(html);
  return DOMPurify.sanitize(decoded, config) as string;
}

/**
 * Sanitize HTML and return as TrustedHTML (for dangerouslySetInnerHTML)
 */
export function sanitizeForReact(html: string): { __html: string } {
  return { __html: sanitizeHtml(html) };
}
