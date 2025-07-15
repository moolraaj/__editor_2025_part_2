import React, { useContext, useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import { StoreContext } from '@/store';
import { observer } from 'mobx-react-lite';
import { ScenePayloadWithEdits } from '@/types';


interface SceneEditorProps {
  scene: ScenePayloadWithEdits;
  onSave: (editedScene: ScenePayloadWithEdits) => void;
  onClose: () => void;
  sceneIndex: number;
}

export const SceneEditor: React.FC<SceneEditorProps> = observer(({ scene, onSave, onClose, sceneIndex }) => {
  const store = useContext(StoreContext);
  const [canvasObjects, setCanvasObjects] = useState<fabric.Object[]>([]);
  const sceneId = `scene-${sceneIndex}`;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);



  const fileInputRef = useRef<HTMLInputElement>(null);


 

  function recolorGroupPaths(
    group: fabric.Group,
    newColor: string,
    includeNames: string[] = [],
    excludeNames: string[] = []
  ) {
    group.getObjects().forEach(obj => {
      if (obj.type !== 'path') return;
      const name = (obj as any).name as string | undefined;
      if (!name) return;
      if (includeNames.length && !includeNames.includes(name)) return;
      if (excludeNames.includes(name)) return;
      (obj as any).set('fill', newColor);
    });
    group.canvas?.requestRenderAll();
  }


  useEffect(() => {
    store.setEditedScene({ ...scene });
    return () => {
      store.setEditedScene(null);
      store.setActiveLayer(null);
      store.setSceneCanvas(null);
    };
  }, [scene, store]);
  useEffect(() => {
    if (!canvasRef.current) return;
    fabricRef.current = new fabric.Canvas(canvasRef.current, {
      preserveObjectStacking: true,
      width: 800,
      height: 500,
      backgroundColor: "#ededed",
      selection: true,
    });
    store.setSceneCanvas(fabricRef.current);
    if (store.editedScene) {
      loadAllLayersToCanvas(fabricRef.current, store.editedScene);
    }
    const canvas = fabricRef.current;
    const updateObjectsList = () => {
      const objs = canvas.getObjects();
      setCanvasObjects(objs);
      const active = canvas.getActiveObject();
      if (active) updateLayerProperties(active);
    };
    canvas.on('object:added', updateObjectsList);
    canvas.on('object:removed', updateObjectsList);
    canvas.on('object:modified', updateObjectsList);
    canvas.on('mouse:up', updateObjectsList);
    canvas.on('selection:created', e => {
      if (e.selected?.length === 1) store.setActiveLayer(e.selected[0].name || null);
    });
    canvas.on('selection:cleared', () => store.setActiveLayer(null));

    // cleanup only on unmount
    return () => {
      canvas.dispose();
      store.setSceneCanvas(null);
    };
  }, []);


  useEffect(() => {
    if (!store.sceneCanvas) return;
    if (!store.activeLayer && canvasObjects.length > 0) {
      const firstSelectable = canvasObjects.find(obj => obj.selectable && obj.name !== 'background-layer');
      if (firstSelectable) {
        store.sceneCanvas.setActiveObject(firstSelectable);
        store.setActiveLayer(firstSelectable.name || null);
      }
    }
  }, [canvasObjects, store]);

  const loadAllLayersToCanvas = (canvas: fabric.Canvas, sceneData: ScenePayloadWithEdits) => {
    canvas.clear();
    //@ts-ignore
    if (sceneData.backgrounds.length > 0) {
      //@ts-ignore
      const bg = sceneData.backgrounds[0];
      fabric.Image.fromURL(bg.background_url, img => {
        img.set({
          scaleX: canvas.width! / img.width!,
          scaleY: canvas.height! / img.height!,
          selectable: false,
          evented: false,
          name: 'background-layer',
          data: { type: 'background', id: 'bg-base' }
        });
        canvas.add(img);
        canvas.sendToBack(img);
      });
    }
    //@ts-ignore
    sceneData.backgrounds.slice(1).forEach((bg, index) => {
      fabric.Image.fromURL(bg.background_url, img => {
        img.set({
          left: 0,
          top: 0,
          scaleX: canvas.width! / img.width!,
          scaleY: canvas.height! / img.height!,
          selectable: true,
          name: `bg-layer-${index}`,
          data: { type: 'background', id: `bg-${index}` }
        });
        canvas.add(img);
        setupObjectControls(img);
      });
    });
    //@ts-ignore
    sceneData.svgs.forEach((layer, index) => {
      const url = layer.svg_url;
      const id = `svg-${index}-child`;
      const pos = sceneData.elementPositions?.[id] || {
        x: 20 + 30 * index,
        y: 20 + 30 * index,
        scaleX: 0.4,
        scaleY: 0.4,
        angle: 0
      };

      if (/\.svg(\?.*)?$/i.test(url)) {
        fabric.loadSVGFromURL(url, (objects, options) => {
          const group = fabric.util.groupSVGElements(objects, options);
          group.set({
            left: pos.x,
            top: pos.y,
            scaleX: pos.scaleX,
            scaleY: pos.scaleY,
            angle: pos.angle,
            selectable: true,
            name: id,
            data: { type: 'svg', id }
          });
          canvas.add(group);
          setupObjectControls(group);
          canvas.renderAll();
        });
      } else {
        fabric.Image.fromURL(url, img => {
          img.set({
            left: pos.x,
            top: pos.y,
            scaleX: pos.scaleX,
            scaleY: pos.scaleY,
            angle: pos.angle,
            selectable: true,
            name: id,
            data: { type: 'svg', id }
          });
          canvas.add(img);
          setupObjectControls(img);
          canvas.renderAll();
        });
      }
    });
    sceneData.text?.forEach((text, index) => {
      const editedText = sceneData.editedText?.[index] || text;
      const canvasWidth = canvas.width || 800;
      const canvasHeight = canvas.height || 500;
      const padding = 40;
      const textWidth = canvasWidth - (padding * 2);
      const lineHeight = 1.2;
      const fontSize = sceneData.textProperties?.[`text-${index}-child`]?.fontSize || 24;
      const textHeight = fontSize * lineHeight;
      const pos = sceneData.elementPositions?.[`text-${index}-child`] || {
        x: padding,
        //@ts-ignore
        y: canvasHeight - (sceneData.text.length - index) * (textHeight + 20),
      };
      const txt = new fabric.Textbox(editedText, {
        left: pos.x,
        top: pos.y,
        width: textWidth,
        fontSize: fontSize,
        fontFamily: sceneData.textProperties?.[`text-${index}-child`]?.fontFamily || 'Arial',
        fill: sceneData.textProperties?.[`text-${index}`]?.fill || '#000000',
        selectable: true,
        name: `text-${index}-child`,
        data: { type: 'text', id: `text-${index}-child` },
        textAlign: 'center',
        originX: 'left',
        originY: 'top',
        lockScalingX: true,
        lockUniScaling: true
      });
      canvas.add(txt);
      setupObjectControls(txt);
    });
    sceneData.tts_audio_url?.forEach((audioUrl, index) => {
      const audioIcon = new fabric.Text('🔊', {
        left: sceneData.elementPositions?.[`tts-${index}-child`]?.x || 700,
        top: sceneData.elementPositions?.[`tts-${index}-child`]?.y || 20 + (index * 30),
        fontSize: 24,
        selectable: true,
        name: `tts-${index}-child`,
        data: { type: 'tts', id: `tts-${index}-child` }
      });
      canvas.add(audioIcon);
      setupObjectControls(audioIcon);
    });
 

    canvas.renderAll();
  };

  const setupObjectControls = (obj: fabric.Object) => {
    obj.on('selected', () => {
      store.setActiveLayer(obj.name || null);
      obj.bringToFront();
    });

    obj.on('modified', () => updateLayerProperties(obj));
    obj.on('moving', () => updateLayerProperties(obj));
    obj.on('scaling', () => updateLayerProperties(obj));
    obj.on('rotating', () => updateLayerProperties(obj));
  };

  const updateLayerProperties = (obj: fabric.Object) => {
    if (!obj.data || !store.editedScene) return;

    const { type, id } = obj.data;
    const position = {
      x: obj.left || 0,
      y: obj.top || 0,
      scaleX: obj.scaleX || 1,
      scaleY: obj.scaleY || 1,
      angle: obj.angle || 0
    };

    store.updateSceneElementPosition(id, position);

    if (type === 'text' && obj instanceof fabric.Textbox) {
      store.updateSceneTextProperties(id, {
        text: obj.text,
        fontSize: obj.fontSize,
        fontFamily: obj.fontFamily,
        //@ts-ignore
        fill: obj.fill
      });
    }

    if (obj.name === store.activeLayer) {
      const properties: any = {
        name: store.activeLayer,
        type: obj.data?.type,
        left: obj.left,
        top: obj.top,
        angle: obj.angle,
        scaleX: obj.scaleX,
        scaleY: obj.scaleY
      };

      if (obj instanceof fabric.Textbox) {
        properties.text = obj.text;
        properties.fontSize = obj.fontSize;
        properties.fontFamily = obj.fontFamily;
        properties.fill = obj.fill;
      } else if (obj instanceof fabric.Group) {
        properties.fill = obj.getObjects()[0]?.fill;
      }

      store.setLayerProperties(properties);
    }
  };

  const handlePropertyChange = (property: string, value: any) => {
    if (!store.activeLayer || !store.sceneCanvas) return;

    const canvas = store.sceneCanvas;
    const obj = canvas.getActiveObject();
    if (!obj) return;

    switch (property) {
      case 'text':
        if (obj instanceof fabric.Textbox) obj.set('text', value);
        break;
      case 'fontSize':
        if (obj instanceof fabric.Textbox) obj.set('fontSize', Number(value));
        break;
      case 'fontFamily':
        if (obj instanceof fabric.Textbox) obj.set('fontFamily', value);
        break;
      case 'fill':
        if (obj instanceof fabric.Group && obj.data?.uploaded) {
          const onlyThese = [
            'pant-p2_00000181791082222361633450000004750754936289298353_',
            'pant-p2',
            'path33',
            'merged-path-front',
            'merged-path-back',
            'top-p1',
            'top-p2'
          ];
          recolorGroupPaths(obj, value, onlyThese, []);
        }
        else if (obj instanceof fabric.Textbox || obj instanceof fabric.Group) {
          //@ts-ignore
          obj.set('fill', value);
          if (obj instanceof fabric.Group) {
            obj.forEachObject(child => child.set?.('fill', value));
          }
          canvas.requestRenderAll();
        }
        break;
      case 'left':
      case 'top':
      case 'angle':
      case 'scaleX':
      case 'scaleY':
        obj.set(property, Number(value));
        break;
    }

    canvas.requestRenderAll();
    updateLayerProperties(obj);
  };

  const handleSave = () => {
    if (store.sceneCanvas) {
      store.sceneCanvas.getObjects().forEach(obj => {
        if (obj.name && obj.data?.id) {
          store.setSceneLayerPosition(sceneId, obj.data.id, {
            x: obj.left || 0,
            y: obj.top || 0,
            scaleX: obj.scaleX || 1,
            scaleY: obj.scaleY || 1,
            angle: obj.angle || 0
          });
        }
      });
    }
    //@ts-ignore
    onSave(store.editedScene);
    onClose();
  };



  const handleSelectLayer = (name: string) => {
    if (!store.sceneCanvas) return;
    const obj = store.sceneCanvas.getObjects().find(o => o.name === name);
    if (obj) {
      store.sceneCanvas.setActiveObject(obj);
      store.sceneCanvas.requestRenderAll();
      store.setActiveLayer(name);
    }
  };

  const handleDeleteLayer = (name: string) => {
    if (!store.sceneCanvas || !store.editedScene) return;
    const obj = store.sceneCanvas.getObjects().find(o => o.name === name);
    if (!obj) return;

    store.sceneCanvas.remove(obj);
    store.sceneCanvas.discardActiveObject();
    store.sceneCanvas.requestRenderAll();
    store.setActiveLayer(null);

    //@ts-ignore
    const updated = { ...store.editedScene };
    if (updated.elementPositions) {
      delete updated.elementPositions[name];
    }
    if (name.startsWith('text-') && updated.editedText) {
      const idx = parseInt(name.split('-')[1], 10);
      //@ts-ignore
      updated.editedText = updated.editedText.filter((_, i) => i !== idx);
    }
    store.setEditedScene(updated);
  };


  useEffect(() => {
    const canvas = fabricRef.current!;

    // recursive walker to dump every path & group
    function dumpLayers(obj: fabric.Object): any {
      const info: any = {
        type: obj.type,
        name: (obj as any).name,
        fill: (obj as any).fill,
        stroke: (obj as any).stroke,
      };
      if (obj instanceof fabric.Path) {
        info.pathData = (obj as any).path;
      }
      if (obj instanceof fabric.Group) {
        info.children = obj.getObjects().map(dumpLayers);
      }
      return info;
    }

    function handleObjectSelected(e: fabric.IEvent) {
      const tgt = e.target;
      
      if (tgt instanceof fabric.Group && tgt.data?.type === 'svg') {
        console.log('SVG layer tree:', dumpLayers(tgt));
      }
    }

    canvas.on('object:selected', handleObjectSelected);
    return () => {
      canvas.off('object:selected', handleObjectSelected);
    };
  }, []);



  useEffect(() => {
    const canvas = fabricRef.current!;

    function dumpLayers(obj: fabric.Object): any {
      const out: any = {
        type: obj.type,
        name: (obj as any).name,
        fill: (obj as any).fill,
        stroke: (obj as any).stroke,
      };
      if (obj instanceof fabric.Path) {
        out.pathData = (obj as any).path;
      }
      if (obj instanceof fabric.Group) {
        out.children = obj.getObjects().map(dumpLayers);
      }
      return out;
    }

    function onMove(e: fabric.IEvent) {
      const tgt = e.target;
      if (tgt instanceof fabric.Group && tgt.data?.uploaded) {
        console.clear();
        console.log('--- dragging SVG, layer tree ---');
        console.log(dumpLayers(tgt));
      }
    }
    canvas.on('object:moving', onMove);
    return () => { canvas.off('object:moving', onMove); };
  }, []);

  return (
    <>
      <div className="ed_fixed">
        <div className="editor_wrap">
          <div className="editor-header">
            <button onClick={onClose}>×</button>
          </div>

          
          <div className="mapping_svgs">
           
          </div>
          



          <div className="scene-editor-modal">

            <div className="upload_svg">


            </div>


            <div className="t_l_m">
              <div className="editor-container">
                <canvas
                  id="temp-canvas"
                  ref={canvasRef}
                  width={800}
                  height={500}
                />
              </div>
              <div className="mod_layerr">
                <div className="scene-layers-list">
                  <h3 className='l_label'>All Layers</h3>
                  <ul>
                    {canvasObjects
                      .filter(obj => obj.name !== 'background-layer')
                      .map(obj => (
                        <li
                          key={obj.name}
                          className={`flex space-x-2 ${store.activeLayer === obj.name ? 'active-layer' : ''}`}
                        >
                          <button onClick={() => handleSelectLayer(obj.name!)}>
                            {obj.name}
                          </button>
                          <button
                            onClick={() => handleDeleteLayer(obj.name!)}
                            title="Delete this layer"
                            className="delete-btn"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                  </ul>
                </div>
                <div className="layer-properties-panel">
                  <h3 className='l_label'>Layer Properties</h3>
                  {store.layerProperties ? (
                    <div className="property-grid">
                      {store.layerProperties.type === 'text' && (
                        <>
                          <div className="property-row">
                            <label>Text Content</label>
                          </div>
                          <div className="property-row">
                            <label>Font Size</label>
                            <p>{store.layerProperties.fontSize || 24}</p>
                          </div>
                          <div className="property-row">
                            <label>Font Family</label>
                            <select
                              value={store.layerProperties.fontFamily || 'Arial'}
                              onChange={(e) => handlePropertyChange('fontFamily', e.target.value)}
                            >
                              <option value="Arial">Arial</option>
                              <option value="Verdana">Verdana</option>
                              <option value="Helvetica">Helvetica</option>
                            </select>
                          </div>
                        </>
                      )}
                      <div className="property-row">
                        <label>Color</label>
                        <input
                          type="color"
                          value={store.layerProperties.fill || '#000000'}
                          onChange={(e) => handlePropertyChange('fill', e.target.value)}
                        />
                      </div>

                    
                    </div>
                  ) : (
                    <div className="no-layer-selected">

                    </div>
                  )}
                </div>



              </div>

            </div>

          </div>





          <div className="editor-controls">
            <button onClick={handleSave} className="save-btn">
              Save Changes
            </button>
            <button onClick={onClose} className="close-btn">
              Close
            </button>
          </div>
        </div>
      </div>

    </>
  );
});