import { formatDayHeading } from './dateUtils.js'
import { formatScore, readTally, sideLogged, sideScore } from './moodTally.js'

const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

const isBlank = (html) => (html ?? '').replace(/<[^>]*>|&nbsp;/g, '').trim() === ''

/** True when an entry has anything worth printing (today's empty editor slot doesn't). */
export function hasPrintableContent(j) {
  const t = readTally(j)
  return (
    !isBlank(j.content) ||
    sideLogged(t.me) ||
    sideLogged(t.others) ||
    Boolean(j.mood) ||
    Boolean(j.spouseMood) ||
    j.itemNotes.some((n) => !isBlank(n.notes))
  )
}

function moodLine(j) {
  const t = readTally(j)
  const parts = [['Me', t.me], ['Others', t.others]]
    .filter(([, side]) => sideLogged(side))
    .map(([label, side]) => `${label} ${formatScore(sideScore(side))}`)
  if (j.mood || j.spouseMood) parts.push(`${j.mood ?? ''}${j.spouseMood ?? ''}`)
  return parts.join(' · ')
}

/** Full HTML document: US Letter, two columns, one block per entry. */
export function buildJournalPrintHtml(entries, range) {
  const body = entries
    .map((j) => {
      const mood = moodLine(j)
      const notes = j.itemNotes
        .filter((n) => !isBlank(n.notes))
        .map((n) => `<div class="note"><div class="note-title">${esc(n.title)}</div>${n.notes}</div>`)
        .join('')
      return `<article>
  <h2>${esc(formatDayHeading(j.date))}${mood ? `<span class="mood">${esc(mood)}</span>` : ''}</h2>
  ${isBlank(j.content) ? '' : `<div class="content">${j.content}</div>`}
  ${notes}
</article>`
    })
    .join('\n')

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Journal ${esc(range.from)} to ${esc(range.to)}</title>
<style>
  @page { size: letter portrait; margin: 0.6in; }
  * { box-sizing: border-box; }
  body { font: 10pt/1.4 Georgia, 'Times New Roman', serif; color: #000; margin: 0; }
  h1 { font-size: 14pt; margin: 0 0 8pt; padding-bottom: 4pt; border-bottom: 1px solid #000; }
  .columns { column-count: 2; column-gap: 0.3in; column-rule: 1px solid #bbb; }
  article { margin: 0 0 12pt; }
  h2 { font-size: 10.5pt; margin: 0 0 3pt; padding-bottom: 2pt; border-bottom: 1px solid #ccc;
       break-after: avoid; display: flex; justify-content: space-between; gap: 8pt; }
  .mood { font-weight: normal; font-size: 8.5pt; color: #444; white-space: nowrap; }
  .content h1, .note h1 { font-size: 12.5pt; margin: 6pt 0 2pt; }
  .content h2, .note h2 { font-size: 11pt; margin: 5pt 0 2pt; padding: 0; border: 0; display: block; }
  .content p, .note p { margin: 0 0 4pt; }
  .content, .note { overflow-wrap: anywhere; }
  .note { margin-top: 5pt; padding-left: 6pt; border-left: 2px solid #999; }
  .note-title { font-weight: bold; font-size: 9pt; }
  img { max-width: 100%; }
</style></head>
<body>
<h1>Journal · ${esc(range.from)} – ${esc(range.to)}</h1>
<div class="columns">
${body}
</div>
</body></html>`
}

/** Opens the browser's print dialog for the entries (choose "Save as PDF" there). */
export function printJournal(entries, range) {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' })
  frame.srcdoc = buildJournalPrintHtml(entries, range)
  frame.onload = () => {
    const win = frame.contentWindow
    win.focus()
    win.print()
    // Remove after the dialog closes (afterprint), with a fallback.
    const cleanup = () => frame.remove()
    win.addEventListener('afterprint', cleanup)
    setTimeout(cleanup, 60000)
  }
  document.body.appendChild(frame)
}
