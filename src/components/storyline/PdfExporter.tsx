import React, { useCallback } from 'react'
import jsPDF from 'jspdf'
import { observer } from 'mobx-react-lite'
import { StoreContext } from '@/store'
const wait = (ms: number) => new Promise<void>(res => setTimeout(res, ms))
export const PdfExporter: React.FC = observer(() => {
  const store = React.useContext(StoreContext)
  const exportScenesAsPdf = useCallback(async () => {
    const canvas = store.canvas
    if (!canvas) {
      console.error('Canvas not initialized')
      return
    }
    const { width, height } = canvas
    //@ts-ignore
    const orientation = width > height ? 'landscape' : 'portrait'
    const pdf = new jsPDF({
      orientation,
      unit: 'px',
      format: [width, height],
    } as any)
    for (let i = 0; i < store.scenes.length; i++) {
      store.setActiveScene(i)
      const start = store.scenes[i]?.timeFrame?.start || 0
      store.updateTimeTo(start)
      await wait(1000)
      canvas.renderAll()
       //@ts-ignore
      const imgData = (canvas.lowerCanvasEl as HTMLCanvasElement)
        .toDataURL('image/png')
      if (i > 0) pdf.addPage()
        //@ts-ignore
      pdf.addImage(imgData, 'PNG' as any, 0, 0, width, height)
    }
    pdf.save('scenes.pdf')
  }, [store])
  if (store.scenes.length === 0) return null
  return (
    <button
      onClick={exportScenesAsPdf}
      className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-1 px-1 rounded-lg m-4 export_button"
    >
      GENERATE SCENES PDF
    </button>
  )
})
