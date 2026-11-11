import Editor, {
  EditorProvider,
  Toolbar,
  BtnBold,
  BtnItalic,
  BtnUnderline,
  BtnBulletList,
  BtnNumberedList,
  createButton,
} from 'react-simple-wysiwyg'

// The only text colours on offer — mid-tones that stay readable on both the
// light and dark themes. "Clear formatting" returns text to the default colour.
export const TEXT_COLORS = [
  { name: 'Red', value: '#d64545' },
  { name: 'Orange', value: '#e0973b' },
  { name: 'Green', value: '#2f9e63' },
  { name: 'Blue', value: '#3b6fe0' },
  { name: 'Purple', value: '#8e5cd9' },
]

// Two heading sizes. Clicking the active one again turns the line back into
// normal text.
const headingButton = (title, label, tag) =>
  createButton(title, <span style={{ fontWeight: 700, fontSize: '0.8em' }}>{label}</span>, ({ $selection }) => {
    const el = $selection?.nodeType === 1 ? $selection : $selection?.parentElement
    const inThis = Boolean(el?.closest?.(tag))
    document.execCommand('formatBlock', false, inThis ? 'DIV' : tag.toUpperCase())
  })
const BtnHeading1 = headingButton('Large heading', 'H1', 'h1')
const BtnHeading2 = headingButton('Small heading', 'H2', 'h2')

// The library's own clear-formatting only strips inline styles (bold, colour…),
// leaving headings and lists. This clears everything on the selection.
const BtnClearAll = createButton('Clear all formatting', 'T̲ₓ', () => {
  document.execCommand('removeFormat')
  document.execCommand('unlink')
  document.execCommand('formatBlock', false, 'DIV')
  for (const list of ['insertUnorderedList', 'insertOrderedList']) {
    if (document.queryCommandState(list)) document.execCommand(list)
  }
})

const ColorButtons = TEXT_COLORS.map(({ name, value }) =>
  createButton(
    `${name} text`,
    <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', background: value, verticalAlign: 'middle' }} />,
    () => document.execCommand('foreColor', false, value)
  )
)


export function RichTextEditor({ value, onChange, className = 'rich-text-editor', placeholder }) {
  return (
    <EditorProvider>
      <Editor
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        containerProps={{ className }}
      >
        <Toolbar>
          <BtnBold />
          <BtnItalic />
          <BtnUnderline />
          <BtnHeading1 />
          <BtnHeading2 />
          <BtnBulletList />
          <BtnNumberedList />
          {ColorButtons.map((Btn, i) => (
            <Btn key={TEXT_COLORS[i].name} />
          ))}
          <BtnClearAll />
        </Toolbar>
      </Editor>
    </EditorProvider>
  )
}
