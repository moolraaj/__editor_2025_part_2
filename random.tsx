 

// 'use client';

// import { fabric } from 'fabric';
// import type { ScenePayload } from './types';

// interface PreviewCanvasProps {
//   scene: ScenePayload;
//   width?: number;
//   height?: number;
//   onDispose?: () => void;
// }

// export const PreviewCanvas: React.FC<PreviewCanvasProps> = ({
//   scene,
//   width = 800,
//   height = 600,
//   onDispose,
// }) => {
//   const canvasRef = useRef<fabric.Canvas>();
//   const containerRef = useRef<HTMLDivElement>(null);
//   const [layers, setLayers] = useState<fabric.Object[]>([]);

//   useEffect(() => {
//     // Create and mount a fresh <canvas>
//     const el = document.createElement('canvas');
//     el.width = width;
//     el.height = height;
//     containerRef.current!.innerHTML = '';
//     containerRef.current!.appendChild(el);

//     // Initialize Fabric canvas
//     const canvas = new fabric.Canvas(el, { backgroundColor: '#fff' });
//     canvasRef.current = canvas;

//     // Refresh list when objects change
//     const refresh = () => setLayers(canvas.getObjects());
//     canvas.on('object:added', refresh);
//     canvas.on('object:removed', refresh);

//     // Load assets and tag each with a layerId
//     const loadAssets = async () => {
//       if (scene.backgrounds[0]) {
//         await new Promise<void>(res =>
//           fabric.Image.fromURL(scene.backgrounds[0].background_url, img => {
//             img.set({ left: 0, top: 0, selectable: false });
//             img.scaleToWidth(width);
//             img.scaleToHeight(height);
//             (img as any).layerId = 'bg-0';
//             canvas.add(img);
//             res();
//           })
//         );
//       }

//       await Promise.all(
//         scene.svgs.map((svg, i) =>
//           new Promise<void>(res =>
//             fabric.Image.fromURL(svg.svg_url, img => {
//               img.set({ left: 50 + i * 30, top: 50 + i * 30, selectable: true });
//               img.scale(0.5);
//               (img as any).layerId = `svg-${i}`;
//               canvas.add(img);
//               res();
//             })
//           )
//         )
//       );

//       scene.text.forEach((txt, i) => {
//         const tb = new fabric.Textbox(txt, {
//           left: 20,
//           top: 20 + i * 25,
//           fontSize: 18,
//           fill: '#333',
//           selectable: true,
//         });
//         (tb as any).layerId = `text-${i}`;
//         canvas.add(tb);
//       });

//       canvas.requestRenderAll();
//       refresh();
//     };

//     loadAssets().catch(console.error);

//     return () => {
//       canvas.dispose();
//       onDispose?.();
//     };
//   }, [scene, width, height, onDispose]);

//   // Remove selected objects
//   const handleDelete = (obj: fabric.Object) => {
//     canvasRef.current?.remove(obj);
//   };


//   const handleSelect = (obj: fabric.Object) => {
//     const canvas = canvasRef.current;
//     if (!canvas) return;
//     canvas.setActiveObject(obj);
//     canvas.requestRenderAll();
//   };

//   return (
//     <>
//       <div
//         ref={containerRef}
//         style={{ width, height, border: '1px solid #ccc' }}
//       />
//       <ul className='temp_canvas_layers'>
//         {layers.map(obj => (
//           <li
//             key={(obj as any).layerId || obj.toString()}
//             style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
//             onClick={() => handleSelect(obj)}
//           >
//             <span>{(obj as any).layerId ?? obj.type}</span>
//             <button
//               className='delete_s_layer'
//               onClick={e => {
//                 e.stopPropagation();
//                 handleDelete(obj);
//               }}
//             >
//               x
//             </button>
//           </li>
//         ))}

//       </ul>
//     </>
//   );
// };





// 'use client';

// import React, { useContext, useEffect, useState } from 'react';
// import { FaTimes } from 'react-icons/fa';
// import { API_URL } from '@/utils/constants';
// import { StoreContext } from '@/store';
// import { PreviewCanvas } from './TempCanvas';
 

// interface SvgAsset { tags: string[]; svg_url: string; }
// interface BackgroundAsset { name: string; background_url: string; }
// interface AnimationAsset { name: string; }
// interface ScenePayload {
//   svgs: SvgAsset[];
//   backgrounds: BackgroundAsset[];
//   animations: AnimationAsset[];
//   text: string[];
//   tts_audio_url?: string[];
// }
// interface StoryLineResultsProps {
//   showResultPopup: boolean;
//   payloads: ScenePayload[];
//   sentences: string[];
//   setShowResultPopup: (open: boolean) => void;
// }

// const StoryLineResults: React.FC<StoryLineResultsProps> = ({
//   showResultPopup,
//   payloads,
//   sentences,
//   setShowResultPopup,
// }) => {
//   const store = useContext(StoreContext);
//   const [previewSceneIdx, setPreviewSceneIdx] = useState<number | null>(null);

//   useEffect(() => {
//     if (!showResultPopup && store.previewCanvas) {
//       store.previewCanvas.dispose();
//       store.setPreviewCanvas(null);
//     }
//   }, [showResultPopup, store]);

//   const download = async (path: string, filename: string) => {
//     try {
//       const res = await fetch(`${API_URL}${path}`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ texts: sentences }),
//       });
//       if (!res.ok) {
//         console.error(`Download failed: ${res.statusText}`);
//         return;
//       }
//       const blob = await res.blob();
//       const url = URL.createObjectURL(blob);
//       const a = document.createElement('a');
//       a.href = url;
//       a.download = filename;
//       document.body.appendChild(a);
//       a.click();
//       document.body.removeChild(a);
//       URL.revokeObjectURL(url);
//     } catch (err) {
//       console.error('Error downloading file:', err);
//     }
//   };

//   const handleAddToCanvas = () => {
//     payloads.forEach(scenePayload => {
//       store.addSceneResource({
//         backgrounds: scenePayload.backgrounds,
//         gifs: scenePayload.svgs,
//         animations: scenePayload.animations,
//         elements: [],
//         text: scenePayload.text,
//         tts_audio_url: scenePayload.tts_audio_url,
//       });
//     });
//     store.refreshElements();
//     setShowResultPopup(false);
//     setPreviewSceneIdx(null);
//   };

//   if (!showResultPopup) return null;

//   return (
//     <div className="popup_overlay">
//       <div className="popup_content">
//         <button
//           className="popup_close"
//           onClick={() => {
//             setShowResultPopup(false);
//             setPreviewSceneIdx(null);
//           }}
//         >
//           <FaTimes />
//         </button>

//         <div className="st_line_wrap_outer">
//           {payloads.map((payload, sceneIdx) => {
//             const hasAny =
//               payload.svgs.length > 0 ||
//               payload.backgrounds.length > 0 ||
//               payload.animations.length > 0;
//             return (
//               <div
//                 key={sceneIdx}
//                 className="st_wrapper_inner cursor-pointer"
//                 onClick={() => setPreviewSceneIdx(sceneIdx)}
//               >
//                 <div className="heading">
//                   <h3>Scene {sceneIdx + 1}</h3>
//                 </div>
//                 <div className="playloads">
//                   {!hasAny ? (
//                     <p className="text-sm text-gray-500">
//                       No matching data found for this scene.
//                     </p>
//                   ) : (
//                     <>
//                       {payload.backgrounds.length > 0 && (
//                         <div className="p_outer_wrapper">
//                           {payload.backgrounds.slice(0, 1).map((bg, i) => (
//                             <div key={i} className="p_inner_wrapper">
//                               <img
//                                 src={bg.background_url}
//                                 alt={bg.name}
//                                 className="p_img"
//                               />
//                             </div>
//                           ))}
//                         </div>
//                       )}
//                       {payload.svgs.length > 0 && (
//                         <div className="char_type">
//                           {payload.svgs.map((svg, i) => (
//                             <div key={i} className="svg_type_img">
//                               <img
//                                 src={svg.svg_url}
//                                 alt={svg.tags.join(', ')}
//                               />
//                             </div>
//                           ))}
//                         </div>
//                       )}
//                     </>
//                   )}
//                 </div>
//               </div>
//             );
//           })}
//         </div>

//         {previewSceneIdx !== null && (
//           <div className="canvas_wrapper">
//             <div className="preview_overlay">
//               <PreviewCanvas
//                 scene={payloads[previewSceneIdx]}
//                 width={700}
//                 height={450}
//                 onDispose={() => store.setPreviewCanvas(null)}
//               />
//               <button
//                 className="button_c_scene"
//                 onClick={() => setPreviewSceneIdx(null)}
//               >
//                 Save Preview
//               </button>
//             </div>
//           </div>
//         )}

//         <div className="st_line_buttons_outer">
//           <div className="st_line_buttons_inner space-x-2">
//             <button
//               className="buttons"
//               onClick={() => download('/download-all-images', 'all_images.zip')}
//             >
//               Download All Images
//             </button>
//             <button className="buttons" onClick={handleAddToCanvas}>
//               Add To Canvas
//             </button>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default StoryLineResults;




























// import React from 'react';
// import { fabric } from 'fabric';

// interface SceneEditorProps {
//   scene: ScenePayloadWithEdits;
//   onSave: (editedScene: ScenePayloadWithEdits) => void;
//   onClose: () => void;
// }

// export const SceneEditor: React.FC<SceneEditorProps> = ({ scene, onSave, onClose }) => {
//   const [editedScene, setEditedScene] = React.useState({ ...scene });
//   const canvasRef = React.useRef<fabric.Canvas | null>(null);
//   const [activeLayer, setActiveLayer] = React.useState<string | null>(null);
//   const [layerProperties, setLayerProperties] = React.useState<any>(null);


//   React.useEffect(() => {
//     const canvas = new fabric.Canvas('temp-canvas', {
//       width: 650,
//       height: 450,
//       backgroundColor: '#f0f0f0',
//       preserveObjectStacking: true
//     });
//     canvasRef.current = canvas;

//     loadAllLayersToCanvas(canvas, editedScene);

//     return () => {
//       canvas.dispose();
//     };
//   }, []);


//   React.useEffect(() => {
//     if (!activeLayer || !canvasRef.current) {
//       setLayerProperties(null);
//       return;
//     }

//     const canvas = canvasRef.current;
//     const obj = canvas.getObjects().find(o => o.name === activeLayer);
//     if (!obj) return;

//     const properties: any = {
//       name: activeLayer,
//       type: obj.data?.type,
//       left: obj.left,
//       top: obj.top,
//       angle: obj.angle,
//       scaleX: obj.scaleX,
//       scaleY: obj.scaleY
//     };

//     // Type-specific properties
//     if (obj instanceof fabric.Textbox) {
//       properties.text = obj.text;
//       properties.fontSize = obj.fontSize;
//       properties.fontFamily = obj.fontFamily;
//       properties.fill = obj.fill;
//     } else if (obj instanceof fabric.Group) {
//       properties.fill = obj.getObjects()[0]?.fill;
//     }

//     setLayerProperties(properties);
//   }, [activeLayer]);

//   const loadAllLayersToCanvas = (canvas: fabric.Canvas, sceneData) => {
//     canvas.clear();

//     // 1. Background Layer (base layer)
//     if (sceneData.backgrounds.length > 0) {
//       const bg = sceneData.backgrounds[0];
//       fabric.Image.fromURL(bg.background_url, img => {
//         img.set({
//           scaleX: canvas.width! / img.width!,
//           scaleY: canvas.height! / img.height!,
//           selectable: false,
//           evented: false,
//           name: 'background-layer',
//           data: { type: 'background', id: 'bg-base' }
//         });
//         canvas.add(img);
//         canvas.sendToBack(img);
//       });
//     }

//     // 2. Additional Background Layers
//     sceneData.backgrounds.slice(1).forEach((bg, index) => {
//       fabric.Image.fromURL(bg.background_url, img => {
//         img.set({
//           left: 0,
//           top: 0,
//           scaleX: canvas.width! / img.width!,
//           scaleY: canvas.height! / img.height!,
//           selectable: true,
//           name: `bg-layer-${index}`,
//           data: { type: 'background', id: `bg-${index}` }
//         });
//         canvas.add(img);
//         setupObjectControls(img);
//       });
//     });

//     // 3. SVG/Character Layers
//     sceneData.svgs.forEach((layer, index) => {
//       const url = layer.svg_url;
//       const id = `svg-${index}`;
//       const pos = editedScene.elementPositions?.[id] || { x: 20 + 30 * index, y: 20 + 30 * index, scaleX: 0.4, scaleY: 0.4, angle: 0 };

//       if (/\.svg(\?.*)?$/i.test(url)) {
//         // Real SVG: parse & group
//         fabric.loadSVGFromURL(url, (objects, options) => {
//           const group = fabric.util.groupSVGElements(objects, options);
//           group.set({
//             left: pos.x,
//             top: pos.y,
//             scaleX: pos.scaleX,
//             scaleY: pos.scaleY,
//             angle: pos.angle,
//             selectable: true,
//             name: id,
//             data: { type: 'svg', id }
//           });
//           canvas.add(group);
//           setupObjectControls(group);
//           canvas.renderAll();
//         });
//       } else {

//         fabric.Image.fromURL(url, img => {
//           img.set({
//             left: pos.x,
//             top: pos.y,
//             scaleX: pos.scaleX,
//             scaleY: pos.scaleY,
//             angle: pos.angle,
//             selectable: true,
//             name: id,
//             data: { type: 'svg', id }
//           });
//           canvas.add(img);
//           setupObjectControls(img);
//           canvas.renderAll();
//         });
//       }
//     });



//     sceneData.text?.forEach((text, index) => {
//       const editedText = sceneData.editedText?.[index] || text;
//       const txt = new fabric.Textbox(editedText, {
//         left: editedScene.elementPositions?.[`text-${index}`]?.x || 50,
//         top: editedScene.elementPositions?.[`text-${index}`]?.y || 50 + (index * 60),
//         width: 300,
//         fontSize: sceneData.textProperties?.[`text-${index}`]?.fontSize || 24,
//         fontFamily: sceneData.textProperties?.[`text-${index}`]?.fontFamily || 'Arial',
//         fill: sceneData.textProperties?.[`text-${index}`]?.fill || '#000000',
//         selectable: true,
//         name: `text-${index}`,
//         data: { type: 'text', id: `text-${index}` }
//       });
//       canvas.add(txt);
//       setupObjectControls(txt);
//     });




//     sceneData.tts_audio_url?.forEach((audioUrl, index) => {
//       const audioIcon = new fabric.Text('🔊', {
//         left: editedScene.elementPositions?.[`tts-${index}`]?.x || 700,
//         top: editedScene.elementPositions?.[`tts-${index}`]?.y || 20 + (index * 30),
//         fontSize: 24,
//         selectable: true,
//         name: `tts-${index}`,
//         data: { type: 'tts', id: `tts-${index}` }
//       });
//       canvas.add(audioIcon);
//       setupObjectControls(audioIcon);
//     });

//     canvas.renderAll();
//   };

//   const setupObjectControls = (obj: fabric.Object) => {
//     obj.on('selected', () => {
//       setActiveLayer(obj.name || null);
//       obj.bringToFront();
//     });

//     obj.on('modified', () => {
//       updateLayerProperties(obj);
//     });

//     obj.on('moving', () => {
//       updateLayerProperties(obj);
//     });

//     obj.on('scaling', () => {
//       updateLayerProperties(obj);
//     });

//     obj.on('rotating', () => {
//       updateLayerProperties(obj);
//     });
//   };

//   const updateLayerProperties = (obj: fabric.Object) => {
//     if (!obj.data) return;
//     setEditedScene(prev => {
//       const updated = { ...prev };
//       const { type, id } = obj.data;
//       updated.elementPositions = updated.elementPositions || {};
//       updated.elementPositions[id] = {
//         x: obj.left || 0,
//         y: obj.top || 0,
//         scaleX: obj.scaleX || 1,
//         scaleY: obj.scaleY || 1,
//         angle: obj.angle || 0
//       };
//       if (type === 'text' && obj instanceof fabric.Textbox) {
//         const textIndex = parseInt(id.split('-')[1]);
//         if (updated.text && updated.text[textIndex]) {
//           updated.editedText = updated.editedText || [...updated.text];
//           updated.editedText[textIndex] = obj.text || '';
//           updated.textProperties = updated.textProperties || {};
//           updated.textProperties[id] = {
//             fontSize: obj.fontSize,
//             fontFamily: obj.fontFamily,
//             fill: obj.fill
//           };
//         }
//       }
//       return updated;
//     });
//     if (obj.name === activeLayer) {
//       setLayerProperties(prev => ({
//         ...prev,
//         left: obj.left,
//         top: obj.top,
//         angle: obj.angle,
//         scaleX: obj.scaleX,
//         scaleY: obj.scaleY
//       }));
//     }
//   };
//   const handlePropertyChange = (property: string, value: any) => {
//     if (!activeLayer || !canvasRef.current) return;
//     const canvas = canvasRef.current;
//     const obj = canvas.getObjects().find(o => o.name === activeLayer);
//     if (!obj) return;
//     switch (property) {
//       case 'text':
//         if (obj instanceof fabric.Textbox) {
//           obj.set('text', value);
//         }
//         break;
//       case 'fontSize':
//         if (obj instanceof fabric.Textbox) {
//           obj.set('fontSize', Number(value));
//         }
//         break;
//       case 'fontFamily':
//         if (obj instanceof fabric.Textbox) {
//           obj.set('fontFamily', value);
//         }
//         break;
//       case 'fill':
//         if (obj instanceof fabric.Textbox || obj instanceof fabric.Group) {
//           obj.set('fill', value);
//           if (obj instanceof fabric.Group) {
//             obj.forEachObject(child => {
//               if (child.set) {
//                 child.set('fill', value);
//               }
//             });
//           }
//         }
//         break;
//       case 'left':
//       case 'top':
//       case 'angle':
//       case 'scaleX':
//       case 'scaleY':
//         obj.set(property, Number(value));
//         break;
//     }
//     canvas.requestRenderAll();
//     updateLayerProperties(obj);
//   };

//   const handleSave = () => {
//     const canvas = canvasRef.current;
//     if (canvas) {
//       canvas.getObjects().forEach(obj => {
//         if (obj.selectable) {
//           updateLayerProperties(obj);
//         }
//       });
//     }
//     onSave(editedScene);
//     onClose();
//   };

//   const findObjectByName = (name: string): fabric.Object | undefined =>
//     canvasRef.current?.getObjects().find(o => o.name === name);
//   const handleSelectLayer = (name: string) => {
//     const canvas = canvasRef.current!;
//     const obj = findObjectByName(name);
//     if (!obj) return;
//     canvas.setActiveObject(obj);
//     canvas.requestRenderAll();
//     setActiveLayer(name);
//   };

//   const handleDeleteLayer = (name: string) => {
//     const canvas = canvasRef.current!;
//     const obj = findObjectByName(name);
//     if (!obj) return;
//     canvas.remove(obj);
//     canvas.discardActiveObject();
//     canvas.requestRenderAll();
//     setActiveLayer(null);
//     setEditedScene(prev => {
//       const updated = { ...prev };
//       if (updated.elementPositions) {
//         delete updated.elementPositions[name];
//       }
//       if (name.startsWith('text-') && updated.editedText) {
//         const idx = parseInt(name.split('-')[1], 10);
//         updated.editedText = updated.editedText.filter((_, i) => i !== idx);
//       }
//       return updated;
//     });
//   };

//   return (
//     <>
//       <div className="ed_fixed">
//         <div className="editor_wrap">
//           <div className="editor-header">

//             <button onClick={onClose}>×</button>
//           </div>
//           <div className="scene-editor-modal">

//             <div className="editor-container">
//               <canvas id="temp-canvas" />

//               <div className="layer-properties-panel">
//                 {layerProperties && (
//                   <>
//                     <h4>Layer Properties</h4>
//                     <div className="property-grid">
//                       {layerProperties.type === 'text' && (
//                         <>
//                           <div className="property-row">
//                             <label>Text Content</label>
//                             <input
//                               type="text"
//                               value={layerProperties.text || ''}
//                               onChange={(e) => handlePropertyChange('text', e.target.value)}
//                             />
//                           </div>
//                           <div className="property-row">
//                             <label>Font Size</label>
//                             <input
//                               type="number"
//                               value={layerProperties.fontSize || 24}
//                               onChange={(e) => handlePropertyChange('fontSize', e.target.value)}
//                             />
//                           </div>
//                           <div className="property-row">
//                             <label>Font Family</label>
//                             <select
//                               value={layerProperties.fontFamily || 'Arial'}
//                               onChange={(e) => handlePropertyChange('fontFamily', e.target.value)}
//                             >
//                               <option value="Arial">Arial</option>
//                               <option value="Verdana">Verdana</option>
//                               <option value="Helvetica">Helvetica</option>
//                             </select>
//                           </div>
//                         </>
//                       )}

//                       <div className="property-row">
//                         <label>Color</label>
//                         <input
//                           type="color"
//                           value={layerProperties.fill || '#000000'}
//                           onChange={(e) => handlePropertyChange('fill', e.target.value)}
//                         />
//                       </div>

//                       <div className="property-row">
//                         <label>Position X</label>
//                         <input
//                           type="number"
//                           value={layerProperties.left || 0}
//                           onChange={(e) => handlePropertyChange('left', e.target.value)}
//                         />
//                       </div>

//                       <div className="property-row">
//                         <label>Position Y</label>
//                         <input
//                           type="number"
//                           value={layerProperties.top || 0}
//                           onChange={(e) => handlePropertyChange('top', e.target.value)}
//                         />
//                       </div>

//                       <div className="property-row">
//                         <label>Rotation</label>
//                         <input
//                           type="number"
//                           value={layerProperties.angle || 0}
//                           onChange={(e) => handlePropertyChange('angle', e.target.value)}
//                         />
//                       </div>

//                       <div className="property-row">
//                         <label>Scale X</label>
//                         <input
//                           type="number"
//                           step="0.1"
//                           value={layerProperties.scaleX || 1}
//                           onChange={(e) => handlePropertyChange('scaleX', e.target.value)}
//                         />
//                       </div>

//                       <div className="property-row">
//                         <label>Scale Y</label>
//                         <input
//                           type="number"
//                           step="0.1"
//                           value={layerProperties.scaleY || 1}
//                           onChange={(e) => handlePropertyChange('scaleY', e.target.value)}
//                         />
//                       </div>


//                     </div>
//                   </>
//                 )}
//               </div>
//             </div>

//             <div className="scene-layers-list">
//               <h3> {activeLayer ? `Editing - (${activeLayer})` : ''}</h3>
//               <ul>
//                 {canvasRef.current
//                   ?.getObjects()
//                   .map(obj => (
//                     <li key={obj.name} className="flex items-center space-x-2">
//                       <button
//                         onClick={() => handleSelectLayer(obj.name!)}
//                       >
//                         {obj.name}
//                       </button>
//                       <button
//                         onClick={() => handleDeleteLayer(obj.name!)}

//                         title="Delete this layer"
//                       >
//                         x
//                       </button>
//                     </li>
//                   ))}
//               </ul>
//             </div>

//           </div>

//           <div className="editor-controls">
//             <button onClick={handleSave}>Save Changes</button>
//             <button onClick={onClose}>x</button>
//           </div>
//         </div>
//       </div>
//     </>


//   );
// };






