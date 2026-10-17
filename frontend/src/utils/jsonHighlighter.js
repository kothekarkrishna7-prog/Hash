/**
 * Formats a JSON string and generates syntax-highlighted HTML spans.
 * @param {string} jsonString
 * @returns {string} HTML string with colored tokens
 */
export function highlightJson(jsonString) {
  if (!jsonString) return '';
  let formatted = '';
  try {
    const obj = JSON.parse(jsonString);
    formatted = JSON.stringify(obj, null, 2);
  } catch {
    // If not JSON, return escaped string
    return escapeHtml(jsonString);
  }

  // Tokenize JSON for syntax highlighting
  const escaped = escapeHtml(formatted);
  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'json-number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'json-key';
        } else {
          cls = 'json-string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'json-boolean';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
