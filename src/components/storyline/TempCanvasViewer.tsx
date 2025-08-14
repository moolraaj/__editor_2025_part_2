'use client';
import React, { useEffect, useRef } from 'react';
import { fabric } from 'fabric';
import { ScenePayloadWithEdits } from '@/types';

interface TempCanvasViewerProps {
    scene: ScenePayloadWithEdits;
    width?: number;
    height?: number;
    onCanvasReady?: (canvasEl: HTMLCanvasElement | null) => void;
    onFabricReady?: (canvasEl: HTMLCanvasElement | null) => void;
    
}

export const TempCanvasViewer: React.FC<TempCanvasViewerProps> = ({
    scene,
    width = 200,
    height = 200,
    onCanvasReady,
    onFabricReady
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fabricRef = useRef<fabric.Canvas | null>(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        onCanvasReady?.(canvasRef.current);
 

        if (fabricRef.current) {
            try {
                fabricRef.current.dispose();
            } catch { }
        }

        const canvas = new fabric.Canvas(canvasRef.current, {
            width,
            height,
            selection: false
        });
        fabricRef.current = canvas;
        canvas.clear();

        const BASE_WIDTH = 800;
        const BASE_HEIGHT = 500;
        const scaleRatio = Math.min(width / BASE_WIDTH, height / BASE_HEIGHT);
        const scalePos = (pos: any) => ({
            x: (pos.x || 0) * scaleRatio,
            y: (pos.y || 0) * scaleRatio,

            scaleX: (pos.scaleX ?? 1) * scaleRatio,
            scaleY: (pos.scaleY ?? 1) * scaleRatio,
            angle: pos.angle || 0
        });
        if ((scene.backgrounds?.length ?? 0) > 0) {
            const bg = scene.backgrounds![0];
            fabric.Image.fromURL(bg.background_url, (img) => {
                img.set({
                    scaleX: width / img.width!,
                    scaleY: height / img.height!,
                    selectable: false,
                    evented: false
                });
                canvas.add(img);
                canvas.sendToBack(img);
            },{ crossOrigin: 'anonymous' });
        }

        scene.backgrounds?.slice(1).forEach((bg) => {
            fabric.Image.fromURL(bg.background_url, (img) => {
                img.set({
                    left: 0,
                    top: 0,
                    scaleX: width / img.width!,
                    scaleY: height / img.height!,
                    selectable: false,
                    evented: false
                });
                canvas.add(img);
            },{ crossOrigin: 'anonymous' });
        });
        scene.svgs?.forEach((layer, index) => {
            const url = layer.svg_url || layer.url || layer.src;
            if (!url) return;

            const id = `svg-${index}-child`;
            const defaultPos = {
                x: 50 + index * 80,
                y: 100,
                scaleX: 0.2,
                scaleY: 0.2,
                angle: 0
            };
            const originalPos = scene.elementPositions?.[id] || defaultPos;
            const pos = scalePos(originalPos);
            if (/\.svg(\?.*)?$/i.test(url)) {
                fabric.loadSVGFromURL(url, (objects, options) => {
                    const group = fabric.util.groupSVGElements(objects, options);
                    group.set({
                        left: pos.x,
                        top: pos.y,
                        scaleX: pos.scaleX,
                        scaleY: pos.scaleY,
                        angle: pos.angle,
                        selectable: false,
                        evented: false,
                        name: id
                    });
                    canvas.add(group);
                    canvas.renderAll();
                }, { crossOrigin: 'anonymous' } as any);
            } else {
                fabric.Image.fromURL(url, (img) => {
                    img.set({
                        left: pos.x,
                        top: pos.y,
                        scaleX: pos.scaleX,
                        scaleY: pos.scaleY,
                        angle: pos.angle,
                        selectable: false,
                        evented: false,
                        name: id
                    });
                    canvas.add(img);
                    canvas.renderAll();
                },{ crossOrigin: 'anonymous' });
            }
        });
        scene.elements?.forEach((element, index) => {
            const originalPos =
                scene.elementPositions?.[element.id] || {
                    x: 50 + index * 80,
                    y: 100,
                    scaleX: 0.4,
                    scaleY: 0.4,
                    angle: 0
                };
            const pos = scalePos(originalPos);
            switch (element.type) {
                case "svg": {
                    const parts = element?.properties?.parts as Array<{
                        path: any[];
                        name?: string;
                        fill?: string;
                        stroke?: string;
                    }>;
                    const recreated = parts.map((p) =>
                        new fabric.Path(p.path, {
                            name: p.name,
                            fill: p.fill,
                            stroke: p.stroke,
                            selectable: false,
                            evented: false
                        })
                    );
                    const group = new fabric.Group(recreated, {
                        left: pos.x,
                        top: pos.y,
                        scaleX: pos.scaleX,
                        scaleY: pos.scaleY,
                        angle: pos.angle,
                        originX: "left",
                        originY: "top",
                        selectable: false,
                        evented: false,
                        name: element.id
                    });
                    const bounds = group.getBoundingRect();
                    group.set({
                        left: pos.x - bounds.left * pos.scaleX,
                        top: pos.y - bounds.top * pos.scaleY
                    });
                    canvas.add(group);
                    break;
                }
            }
        });
        scene.text?.forEach((t, idx) => {
            const editedText = scene.editedText?.[idx] || t;
            const originalPos =
                scene.elementPositions?.[`text-${idx}-child`] || {
                    x: 50,
                    y: 200 + idx * 30
                };
            const pos = scalePos(originalPos);
            const txt = new fabric.Textbox(editedText, {
                left: pos.x,
                top: pos.y,
                width: 300 * scaleRatio,
                fontSize:
                    (scene.textProperties?.[`text-${idx}-child`]?.fontSize || 20) *
                    scaleRatio,
                fontFamily:
                    scene.textProperties?.[`text-${idx}-child`]?.fontFamily || 'Arial',
                fill: scene.textProperties?.[`text-${idx}-child`]?.fill || '#000',
                selectable: false,
                evented: false
            });
            canvas.add(txt);
        });
        scene.tts_audio_url?.forEach((audioUrl, idx) => {
            const originalPos =
                scene.elementPositions?.[`tts-${idx}-child`] || {
                    x: BASE_WIDTH - 40,
                    y: 20 + idx * 30
                };
            const pos = scalePos(originalPos);

            const audioIcon = new fabric.Text('🔊', {
                left: pos.x,
                top: pos.y,
                fontSize: 20 * scaleRatio,
                selectable: false,
                evented: false
            });
            canvas.add(audioIcon);
        });
        return () => {
            canvas.dispose();
             onCanvasReady?.(null)
        };
    }, [scene, width, height,onCanvasReady,onFabricReady]);
    return <canvas ref={canvasRef} />;
};
