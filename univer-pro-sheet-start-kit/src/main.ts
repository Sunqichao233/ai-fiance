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

    try {
      const reply = await sendToAgent(text, files, stream)
      appendMessage(messagesEl, { role: 'assistant', text: reply })
    } catch (error) {
      appendMessage(messagesEl, { role: 'system', text: `Agent 调用失败：${String(error)}` })
    }
  })
}

function appendMessage(container: HTMLElement, message: ChatMessage) {
  const el = document.createElement('div')
  el.className = `message ${message.role}`
  el.textContent = message.text
  container.appendChild(el)
  container.scrollTop = container.scrollHeight
}

async function sendToAgent(prompt: string, files: File[], stream: boolean): Promise<string> {
  // 预留：在此接入你的 Agent/LLM API
  // 你可以使用 fetch 发送 prompt 和文件到后端，或调用浏览器侧 SDK。
  // 下面是一个占位实现。
  await new Promise(resolve => setTimeout(resolve, 400))
  const fileInfo = files.length ? `，包含文件：${files.map(f => f.name).join('、')}` : ''
  return `（占位回复）收到你的问题：“${prompt}”，${stream ? '将以流式返回' : '将以整段返回'}${fileInfo}。`
}
