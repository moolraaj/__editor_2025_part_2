import React, { useCallback } from 'react'
import jsPDF from 'jspdf'
import { observer } from 'mobx-react-lite'
import { StoreContext } from '@/store'
export const PdfExporter: React.FC = observer(() => {
  const store = React.useContext(StoreContext)
  const exportScenesAsPdf = useCallback(async () => {
    if (!store.canvas) {
      console.error('Canvas not initialized')
      return
    }
    const canvasEl = document.getElementById('canvas') as HTMLCanvasElement
    const { width, height } = store.canvas
    const pdf = new jsPDF(
      ({
        //@ts-ignore
        orientation: width > height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [width, height],
      } as any)
    )
    for (let i = 0; i < store.scenes.length; i++) {
      store.setActiveScene(i)
    
      await new Promise<void>(resolve =>
        requestAnimationFrame(() => resolve())
      )
      const imgData = canvasEl.toDataURL('image/png')
      if (i > 0) pdf.addPage()
        //@ts-ignore
      pdf.addImage(imgData, 'PNG' as any, 0, 0, width, height)
    }
    pdf.save('scenes.pdf')
  }, [store])
  return (
    <>
      {store.scenes.length === 0 ? null : (
        <button
          onClick={exportScenesAsPdf}
          className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold mx-2 py-2 px-4 rounded mt-6"
        >
          GENERATE SCENES PDF
        </button>
      )}
    </>
  )
})
