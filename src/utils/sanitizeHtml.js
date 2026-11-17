import DOMPurify from 'dompurify'

// Notes and journal entries are stored as HTML from the rich-text editor, but
// they also arrive from the cloud (another device, an imported backup), so
// anything rendered with innerHTML must be treated as untrusted: this strips
// scripts, event handlers, javascript: links, forms, frames and the like while
// keeping the formatting the editor produces.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

const CONFIG = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'option', 'iframe', 'frame', 'object', 'embed', 'link', 'meta', 'base', 'img', 'video', 'audio', 'source'],
}

/** @param {string|null|undefined} html @returns {string} markup safe to inject */
export function sanitizeHtml(html) {
  return html ? DOMPurify.sanitize(String(html), CONFIG) : ''
}
