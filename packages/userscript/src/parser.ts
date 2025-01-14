import type { Conversation, ConversationLine } from './type'

export function getConversation(): Conversation[] {
    const items: Conversation[] = []
    document.querySelectorAll('main .group').forEach((item) => {
        const avatarEl = item.querySelector<HTMLImageElement>('span img:not([aria-hidden="true"])')
        // actually we can get the name from the avatar's alt
        // but let's keep it anonymous for privacy reasons
        const name = avatarEl?.getAttribute('alt') ? 'You' : 'ChatGPT'
        const avatar = avatarEl ? getBase64FromImg(avatarEl) : ''

        const textNode = item.querySelector<HTMLDivElement>('.markdown') ?? item.querySelector('.w-full .whitespace-pre-wrap')
        if (!textNode) return

        const lines = parseTextNode(textNode)
        items.push({ author: { name, avatar }, lines })
    })

    return items
}

function parseTextNode(textNode: HTMLDivElement): ConversationLine[] {
    const warningClassName = 'bg-orange-500/10'
    const dangerClassName = 'bg-red-500/10'

    const childNodes = textNode.childNodes ? Array.from(textNode.childNodes) : []
    const validChildNodes = childNodes.filter((c) => {
        if (c instanceof Text) return true

        // filter out the alert box
        if (c instanceof Element) {
            return !(c.classList.contains(warningClassName) || c.classList.contains(dangerClassName))
        }

        // other nodes are not supported
        return false
    })
    if (validChildNodes.length === 0) return [[{ type: 'text', text: textNode.textContent ?? '' }]]
    if (validChildNodes.length === 1 && validChildNodes[0] instanceof Text) return [[{ type: 'text', text: validChildNodes[0].textContent ?? '' }]]

    const lines: ConversationLine[] = []
    Array.from(textNode.children).forEach((child) => {
        if (child.classList.contains(warningClassName)) return
        if (child.classList.contains(dangerClassName)) return

        switch (child.tagName.toUpperCase()) {
            case 'HR': {
                lines.push([{ type: 'hr' }])
                break
            }
            case 'H1':
            case 'H2':
            case 'H3':
            case 'H4':
            case 'H5':
            case 'H6': {
                const text = child.textContent ?? ''
                lines.push([{ type: 'heading', level: parseInt(child.tagName[1]), text }])
                break
            }
            case 'BLOCKQUOTE': {
                const text = child.textContent ?? ''
                lines.push([{ type: 'quote', text }])
                break
            }
            case 'PRE': {
                const codeEl = child.querySelector('code')
                if (codeEl) {
                    const code = codeEl.textContent ?? ''
                    const classList = Array.from(codeEl.classList)
                    const lang = classList.find(c => c.startsWith('language-'))?.replace('language-', '') ?? ''
                    lines.push([{ type: 'code-block', lang, code }])
                }
                break
            }
            case 'OL': {
                const items = Array.from(child.children).map(item => item.textContent ?? '')
                lines.push([{ type: 'ordered-list-item', items }])
                break
            }
            case 'UL': {
                const items = Array.from(child.children).map(item => item.textContent ?? '')
                lines.push([{ type: 'unordered-list-item', items }])
                break
            }
            case 'TABLE': {
                const headers = Array.from(child.querySelector('thead tr')?.children ?? []).map(item => item.textContent ?? '')
                const rows = Array.from(child.querySelector('tbody')?.children ?? []).map(row => Array.from(row.children).map(item => item.textContent ?? ''))
                lines.push([{ type: 'table', headers, rows }])
                break
            }
            case 'P':
            default: {
                const line: ConversationLine = []
                const nodes = Array.from(child.childNodes)
                if (nodes.length === 0) {
                    const text = child.textContent ?? ''
                    line.push({ type: 'text', text })
                }
                else {
                    nodes.forEach((item) => {
                        switch (item.nodeType) {
                            case document.ELEMENT_NODE: {
                                const element = item as HTMLElement
                                const tagName = element.tagName.toUpperCase()

                                if (element instanceof HTMLAnchorElement) {
                                    const href = element.getAttribute('href') ?? ''
                                    const text = element.textContent ?? href
                                    line.push({ type: 'link', text, href })
                                }
                                else if (element instanceof HTMLImageElement) {
                                    const src = element.getAttribute('src') ?? ''
                                    line.push({ type: 'image', src })
                                }
                                else if (tagName === 'B' || tagName === 'STRONG') {
                                    const text = element.textContent ?? ''
                                    line.push({ type: 'bold', text })
                                }
                                else if (tagName === 'I' || tagName === 'EM') {
                                    const text = element.textContent ?? ''
                                    line.push({ type: 'italic', text })
                                }
                                else if (tagName === 'CODE') {
                                    const code = element.textContent ?? ''
                                    line.push({ type: 'code', code })
                                }
                                else {
                                    const text = element.textContent ?? ''
                                    line.push({ type: 'text', text })
                                }
                                break
                            }
                            case document.TEXT_NODE:
                            default: {
                                const text = item.textContent ?? ''
                                line.push({ type: 'text', text })
                                break
                            }
                        }
                    })
                }
                lines.push(line)
                break
            }
        }
    })

    return lines
}

function getBase64FromImg(el: HTMLImageElement) {
    const canvas = document.createElement('canvas')
    canvas.width = el.naturalWidth
    canvas.height = el.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''
    ctx.drawImage(el, 0, 0)
    return canvas.toDataURL('image/png')
}
