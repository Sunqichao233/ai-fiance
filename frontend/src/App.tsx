import { useEffect, useRef } from 'react'

import './style.css'
import '@univerjs/ui/dist/style.css'
import '@univerjs/docs-ui/dist/style.css'

import { LocaleType, Tools, Univer } from '@univerjs/core'
import { defaultTheme } from '@univerjs/design'
import { UniverDocsPlugin } from '@univerjs/docs'
import { UniverRenderEnginePlugin } from '@univerjs/engine-render'
import { UniverUIPlugin } from '@univerjs/ui'

export default function App() {
  const editorContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!editorContainerRef.current) return

    const univer = new Univer({
      locale: LocaleType.EN_US,
      theme: defaultTheme,
    })

    univer.registerPlugin(UniverRenderEnginePlugin)
    univer.registerPlugin(UniverUIPlugin, {
      container: editorContainerRef.current,
      headerToolbar: true,
      footerToolbar: true,
    })
    univer.registerPlugin(UniverDocsPlugin)

    const docId = Tools.generateRandomId(6)
    univer.createUniverDoc({ id: docId, locale: LocaleType.EN_US })

    return () => {
      univer.dispose()
    }
  }, [])

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-title">Univer Document</div>
        <div className="app-subtitle">Blank document ready to edit</div>
      </header>
      <div className="editor-wrapper">
        <div ref={editorContainerRef} className="editor-surface" />
      </div>
    </main>
  )
}
