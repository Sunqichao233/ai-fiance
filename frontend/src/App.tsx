import { useEffect, useMemo, useRef, useState } from 'react'

import './style.css'
import '@univerjs/design/lib/index.css'
import '@univerjs/ui/lib/index.css'
import '@univerjs/docs-ui/lib/index.css'

import { LocaleType, Univer } from '@univerjs/core'
import { defaultTheme } from '@univerjs/design'
import { UniverDocsPlugin } from '@univerjs/docs'
import { UniverRenderEnginePlugin } from '@univerjs/engine-render'
import { UniverUIPlugin } from '@univerjs/ui'

import { applyOps, createSocket } from './collab'
import type { BroadcastPayload, Operation } from './collab'

export default function App() {
  const [collabContent, setCollabContent] = useState('')
  const [collabVersion, setCollabVersion] = useState(0)
  const [collabStatus, setCollabStatus] = useState<'connected' | 'disconnected'>('disconnected')
  const [remoteUsers, setRemoteUsers] = useState<string[]>([])

  const editorContainerRef = useRef<HTMLDivElement | null>(null)
  const socketRef = useRef<ReturnType<typeof createSocket> | null>(null)

  const docId = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    const existing = params.get('doc') || localStorage.getItem('demoDocId') || ''
    const isValidHex = /^[a-fA-F0-9]{24}$/.test(existing)
    if (isValidHex) {
      localStorage.setItem('demoDocId', existing)
      return existing
    }
    const generated = crypto.randomUUID().replace(/-/g, '').slice(0, 24)
    localStorage.setItem('demoDocId', generated)
    return generated
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('demo_token') || import.meta.env.VITE_DEMO_TOKEN || 'dev-secret-token'
    const socket = createSocket(token)
    socketRef.current = socket

    socket.on('connect', () => {
      setCollabStatus('connected')
      socket.emit('join_session', { docId })
    })
    socket.on('disconnect', () => setCollabStatus('disconnected'))

    socket.on('session_joined', (payload: { content: string; version: number }) => {
      setCollabContent(payload.content || '')
      setCollabVersion(payload.version || 0)
    })

    socket.on('broadcast_op', (payload: BroadcastPayload) => {
      if (payload.docId !== docId) return
      setCollabContent((prev) => applyOps(prev, payload.ops))
      setCollabVersion(payload.version)
    })

    socket.on('user_cursor', ({ userId }) => {
      setRemoteUsers((prev) => {
        const set = new Set(prev)
        set.add(userId)
        return Array.from(set)
      })
    })

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
    }
  }, [docId])

  useEffect(() => {
    if (!editorContainerRef.current) return

    // Univer 文档创建
    const univer = new Univer({
      locale: LocaleType.EN_US,
      theme: defaultTheme,
    })

    univer.registerPlugin(UniverRenderEnginePlugin)
    univer.registerPlugin(UniverUIPlugin, { container: editorContainerRef.current })
    univer.registerPlugin(UniverDocsPlugin)

    univer.createUniverDoc({ id: docId, locale: LocaleType.EN_US })

    return () => {
      univer.dispose()
    }
  }, [docId])

  const handleCollabChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value
    setCollabContent(next)
    const socket = socketRef.current
    if (!socket) return
    const ops: Operation[] = [{ type: 'replace', text: next, pos: 0 }]
    socket.emit('edit_op', { docId, baseVersion: collabVersion, ops })
  }

  const handleCursorUpdate = (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const socket = socketRef.current
    if (!socket) return
    const target = event.target as HTMLTextAreaElement
    socket.emit('cursor_update', {
      docId,
      cursor: { pos: target.selectionStart, selection: [target.selectionStart, target.selectionEnd] },
    })
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-title">Univer Document (Doc ID: {docId})</div>
        <div className="app-subtitle">内嵌编辑器 + 协作通道（Socket.IO demo）</div>
      </header>
      <div className="editor-wrapper">
        <div ref={editorContainerRef} className="editor-surface" />
      </div>
      <section className="collab-panel">
        <div className="collab-header">
          <div>
            <div className="collab-title">协同文本区（示例 OT 通道）</div>
            <div className="collab-meta">
              状态: <span className={`pill pill-${collabStatus}`}>{collabStatus}</span> | 版本: {collabVersion} | 其他用户: {remoteUsers.length}
            </div>
          </div>
          <div className="collab-help">输入将通过 socket 发送 replace 操作，远端广播自动应用</div>
        </div>
        <textarea
          className="collab-editor"
          value={collabContent}
          onChange={handleCollabChange}
          onSelect={handleCursorUpdate}
          onKeyUp={handleCursorUpdate}
          placeholder="在此输入内容，测试协同同步..."
        />
      </section>
    </main>
  )
}
