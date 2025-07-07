'use client';

import React, { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import type { ScenePayload } from './types';

interface PreviewCanvasProps {
  scene: ScenePayload;
  width?: number;
  height?: number;
  onDispose?: () => void;
}

export const PreviewCanvas: React.FC<PreviewCanvasProps> = ({
  scene,
  width = 800,
  height = 600,
  onDispose,
}) => {
  const canvasRef = useRef<fabric.Canvas>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [layers, setLayers] = useState<fabric.Object[]>([]);

  useEffect(() => {
    // Create and mount a fresh <canvas>
    const el = document.createElement('canvas');
    el.width = width;
    el.height = height;
    containerRef.current!.innerHTML = '';
    containerRef.current!.appendChild(el);

    // Initialize Fabric canvas
    const canvas = new fabric.Canvas(el, { backgroundColor: '#fff' });
    canvasRef.current = canvas;

    // Refresh list when objects change
    const refresh = () => setLayers(canvas.getObjects());
    canvas.on('object:added', refresh);
    canvas.on('object:removed', refresh);

    // Load assets and tag each with a layerId
    const loadAssets = async () => {
      if (scene.backgrounds[0]) {
        await new Promise<void>(res =>
          fabric.Image.fromURL(scene.backgrounds[0].background_url, img => {
            img.set({ left: 0, top: 0, selectable: false });
            img.scaleToWidth(width);
            img.scaleToHeight(height);
            (img as any).layerId = 'bg-0';
            canvas.add(img);
            res();
          })
        );
      }

      await Promise.all(
        scene.svgs.map((svg, i) =>
          new Promise<void>(res =>
            fabric.Image.fromURL(svg.svg_url, img => {
              img.set({ left: 50 + i * 30, top: 50 + i * 30, selectable: true });
              img.scale(0.5);
              (img as any).layerId = `svg-${i}`;
              canvas.add(img);
              res();
            })
          )
        )
      );

      scene.text.forEach((txt, i) => {
        const tb = new fabric.Textbox(txt, {
          left: 20,
          top: 20 + i * 25,
          fontSize: 18,
          fill: '#333',
          selectable: true,
        });
        (tb as any).layerId = `text-${i}`;
        canvas.add(tb);
      });

      canvas.requestRenderAll();
      refresh();
    };

    loadAssets().catch(console.error);

    return () => {
      canvas.dispose();
      onDispose?.();
    };
  }, [scene, width, height, onDispose]);

  // Remove selected objects
  const handleDelete = (obj: fabric.Object) => {
    canvasRef.current?.remove(obj);
  };

  
  const handleSelect = (obj: fabric.Object) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setActiveObject(obj);
    canvas.requestRenderAll();
  };

  return (
    <>
      <div
        ref={containerRef}
        style={{ width, height, border: '1px solid #ccc' }}
      />
      <ul className='temp_canvas_layers'>
        {layers.map(obj => (
          <li
            key={(obj as any).layerId || obj.toString()}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            onClick={() => handleSelect(obj)}
          >
            <span>{(obj as any).layerId ?? obj.type}</span>
            <button
              className='delete_s_layer'
              onClick={e => {
                e.stopPropagation();
                handleDelete(obj);
              }}
            >
              x
            </button>
          </li>
        ))}
        
      </ul>
    </>
  );
};