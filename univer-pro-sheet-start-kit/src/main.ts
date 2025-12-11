import './style.css'
import { setupToolbar } from './setup-toolbar'
import { setupUniver } from './setup-univer'

declare global {
  interface Window {
    univerAPI: unknown
  }
}

type ChatMessage = {
  role: 'user' | 'assistant' | 'system'
  text: string
}

function main() {
  const univerAPI = setupUniver()

  // test on dev
  window.univerAPI = univerAPI

  univerAPI.addEvent(univerAPI.Event.LifeCycleChanged, ({ stage }) => {
    if (stage === univerAPI.Enum.LifecycleStages.Rendered) {
      setupToolbar(univerAPI)
    }
  })

  initSidebar()
  initChat()
}

main()

function initSidebar() {
  document.getElementById('account-refresh')?.addEventListener('click', () => {
    // 预留：调用账户接口刷新信息
    alert('已预留账户信息刷新接口，可在此调用后端接口更新 UI。')
  })

  document.getElementById('logout')?.addEventListener('click', () => {
    // 预留：在此调用退出登录接口
    alert('退出登录（请在此接入真实登出接口）。')
  })

  const openChatBtn = document.getElementById('open-chat')
  const chatPanel = document.getElementById('chat-panel')
  const closeChatBtn = document.getElementById('close-chat')

  openChatBtn?.addEventListener('click', () => {
    chatPanel?.classList.add('open')
    chatPanel?.classList.remove('is-hidden')
  })
  closeChatBtn?.addEventListener('click', () => {
    chatPanel?.classList.remove('open')
    chatPanel?.classList.add('is-hidden')
  })
}

function initChat() {
  const messagesEl = document.getElementById('chat-messages')
  const fileInput = document.getElementById('chat-file') as HTMLInputElement | null
  const fileNamesEl = document.getElementById('file-names')
  const chatForm = document.getElementById('chat-form') as HTMLFormElement | null
  const chatInput = document.getElementById('chat-input') as HTMLTextAreaElement | null
  const streamToggle = document.getElementById('stream-toggle') as HTMLInputElement | null

  if (!messagesEl || !chatForm || !chatInput) {
    return
  }

  appendMessage(messagesEl, {
    role: 'system',
    text: '你好，我是 AI 助手。可以在左侧上传文件并告诉我你的需求。',
  })

  fileInput?.addEventListener('change', () => {
    const files = fileInput.files
    if (!files || files.length === 0) {
      fileNamesEl && (fileNamesEl.textContent = '未选择文件')
      return
    }
    const names = Array.from(files).map(file => file.name).join('、')
    fileNamesEl && (fileNamesEl.textContent = names)
  })

  chatInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      chatForm.requestSubmit()
    }
  })

  chatForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const text = chatInput.value.trim()
    if (!text) {
      return
    }

    appendMessage(messagesEl, { role: 'user', text })
    chatInput.value = ''

    const files = fileInput?.files ? Array.from(fileInput.files) : []
    const stream = streamToggle?.checked ?? true

    appendMessage(messagesEl, {
      role: 'system',
      text: `已发送给 Agent（待接入）：${stream ? '流式' : '非流式'}，文件数 ${files.length} 个。`,
    })

    const assistantNode = appendMessage(messagesEl, { role: 'assistant', text: stream ? '正在生成...' : '' })

    try {
      const reply = await sendToAgent(text, files, stream, (chunk) => {
        if (assistantNode) {
          assistantNode.textContent = (assistantNode.textContent || '') + chunk
        }
      })
      if (assistantNode) {
        assistantNode.textContent = reply
      }
    } catch (error) {
      if (assistantNode) {
        assistantNode.textContent = `Agent 调用失败：${String(error)}`
        assistantNode.classList.add('system')
      } else {
        appendMessage(messagesEl, { role: 'system', text: `Agent 调用失败：${String(error)}` })
      }
    }
  })
}

function appendMessage(container: HTMLElement, message: ChatMessage) {
  const el = document.createElement('div')
  el.className = `message ${message.role}`
  el.textContent = message.text
  container.appendChild(el)
  container.scrollTop = container.scrollHeight
  return el
}

async function sendToAgent(
  prompt: string,
  files: File[],
  stream: boolean,
  onToken?: (chunk: string) => void,
): Promise<string> {
  // 优先走后端代理（推荐，避免浏览器直连 OpenAI 跨域/泄密）
  const proxyEndpoint = (import.meta.env.VITE_AGENT_PROXY as string | undefined)?.trim()
  const apiKey = (import.meta.env.VITE_OPENAI_API_KEY as string | undefined)?.trim() || ''
  const baseURL = (import.meta.env.VITE_OPENAI_BASE_URL as string | undefined)?.trim() || 'https://api.openai.com/v1'
  const model = (import.meta.env.VITE_OPENAI_MODEL as string | undefined)?.trim() || 'gpt-4o-mini'

  const isPlaceholder = apiKey === 'sk-xxxx' || apiKey.toLowerCase().includes('your-key')

  // 如果配置了代理，直接调用代理，由后端持有 key 并转发
  if (proxyEndpoint) {
    const res = await fetch(proxyEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        model,
        stream,
        fileNames: files.map(f => f.name),
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText)
      throw new Error(`代理调用失败：${res.status} ${errText}`)
    }
    // 假定代理返回 { text: string } 或纯文本
    try {
      const data = await res.json()
      return data.text ?? JSON.stringify(data)
    } catch {
      return await res.text()
    }
  }

  // 真实调用示例（前端直连 OpenAI，注意生产环境请改走后端代理以保护密钥；可能遭遇 CORS）
  if (!apiKey || isPlaceholder) {
    throw new Error('缺少 VITE_OPENAI_API_KEY，请在项目根目录创建 .env（非 .env.sample）并写入真实 key，重启 dev。示例：VITE_OPENAI_API_KEY=sk-xxxx')
  }

  console.info('[chat] using OpenAI endpoint:', baseURL, 'model:', model, 'stream:', stream)

  // 可以在这里将文件信息上传到你的后端，再把 file_id 传给模型；此处仅展示文件名。
  const fileHint = files.length ? `（携带文件：${files.map(f => f.name).join('、')}）` : ''

  const messages = [
    { role: 'system', content: '你是一个办公助理，善于理解表格需求。' },
    { role: 'user', content: `${prompt} ${fileHint}` },
  ]

  if (!stream) {
    const res = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.3,
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText)
      throw new Error(`OpenAI 调用失败：${res.status} ${errText}`)
    }
    const data = await res.json()
    return data.choices?.[0]?.message?.content ?? '（无回复）'
  }

  const res = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      stream: true,
    }),
  })

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => res.statusText)
    throw new Error(`OpenAI 流式调用失败：${res.status} ${errText}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) continue
      const dataStr = trimmed.replace(/^data:\s*/, '')
      if (dataStr === '[DONE]') continue
      try {
        const json = JSON.parse(dataStr)
        const delta = json.choices?.[0]?.delta?.content
        if (delta) {
          fullText += delta
          onToken?.(delta)
        }
      } catch {
        // ignore malformed line
      }
    }
  }

  return fullText || '（无流式内容）'
}
