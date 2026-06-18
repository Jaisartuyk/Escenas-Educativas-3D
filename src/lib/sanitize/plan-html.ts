export function sanitizePlanHtml(html: string | null | undefined): string | null {
  if (!html) return null

  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\s*(script|style|iframe|object|embed|form|input|button|textarea|select|option|meta|link|svg|math)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|form|input|button|textarea|select|option|meta|link|svg|math)\b[^>]*\/?\s*>/gi, '')
    .replace(/\s+on[a-z-]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\s+on[a-z-]+\s*=\s*'[^']*'/gi, '')
    .replace(/\s+on[a-z-]+\s*=\s*[^\s>]+/gi, '')
    .replace(/\s+(href|src|xlink:href)\s*=\s*"\s*(javascript:|vbscript:|data:text\/html)[^"]*"/gi, ' $1="#"')
    .replace(/\s+(href|src|xlink:href)\s*=\s*'\s*(javascript:|vbscript:|data:text\/html)[^']*'/gi, ' $1=\'#\'')
    .replace(/\s+(href|src|xlink:href)\s*=\s*(javascript:|vbscript:|data:text\/html)[^\s>]*/gi, ' $1="#"')
}
