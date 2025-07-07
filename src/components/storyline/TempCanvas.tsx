



import React from 'react';
import { fabric } from 'fabric';

interface SceneEditorProps {
  scene: ScenePayloadWithEdits;
  onSave: (editedScene: ScenePayloadWithEdits) => void;
  onClose: () => void;
}

export const SceneEditor: React.FC<SceneEditorProps> = ({ scene, onSave, onClose }) => {
  const [editedScene, setEditedScene] = React.useState<ScenePayloadWithEdits>({ ...scene });
  const canvasRef = React.useRef<fabric.Canvas | null>(null);
  const [activeLayer, setActiveLayer] = React.useState<string | null>(null);
  const [layerProperties, setLayerProperties] = React.useState<any>(null);

  // Initialize canvas and load all layers
  React.useEffect(() => {
    const canvas = new fabric.Canvas('temp-canvas', {
      width: 650,
      height: 450,
      backgroundColor: '#f0f0f0',
      preserveObjectStacking: true
    });
    canvasRef.current = canvas;

    loadAllLayersToCanvas(canvas, editedScene);

    return () => {
      canvas.dispose();
    };
  }, []);

  
  React.useEffect(() => {
    if (!activeLayer || !canvasRef.current) {
      setLayerProperties(null);
      return;
    }

    const canvas = canvasRef.current;
    const obj = canvas.getObjects().find(o => o.name === activeLayer);
    if (!obj) return;

    const properties: any = {
      name: activeLayer,
      type: obj.data?.type,
      left: obj.left,
      top: obj.top,
      angle: obj.angle,
      scaleX: obj.scaleX,
      scaleY: obj.scaleY
    };

    // Type-specific properties
    if (obj instanceof fabric.Textbox) {
      properties.text = obj.text;
      properties.fontSize = obj.fontSize;
      properties.fontFamily = obj.fontFamily;
      properties.fill = obj.fill;
    } else if (obj instanceof fabric.Group) {
      properties.fill = obj.getObjects()[0]?.fill;
    }

    setLayerProperties(properties);
  }, [activeLayer]);

  const loadAllLayersToCanvas = (canvas: fabric.Canvas, sceneData: ScenePayloadWithEdits) => {
    canvas.clear();

    // 1. Background Layer (base layer)
    if (sceneData.backgrounds.length > 0) {
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

    // 2. Additional Background Layers
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

    // 3. SVG/Character Layers
    sceneData.svgs.forEach((layer, index) => {
      const url = layer.svg_url;
      const id = `svg-${index}`;
      const pos = editedScene.elementPositions?.[id] || { x: 20 + 30 * index, y: 20 + 30 * index, scaleX: 0.4, scaleY: 0.4, angle: 0 };

      if (/\.svg(\?.*)?$/i.test(url)) {
        // Real SVG: parse & group
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
        // Raster image (PNG, JPG, etc.)
        fabric.Image.fromURL(url, img => {
          img.set({
            left: pos.x,
            top: pos.y,
            scaleX: pos.scaleX,
            scaleY: pos.scaleY,
            angle: pos.angle,
            selectable: true,
            name: id,
            data: { type: 'svg', id }  // you can still call it “svg” semantically
          });
          canvas.add(img);
          setupObjectControls(img);
          canvas.renderAll();
        });
      }
    });


    // 4. Text Layers
    sceneData.text?.forEach((text, index) => {
      const editedText = sceneData.editedText?.[index] || text;
      const txt = new fabric.Textbox(editedText, {
        left: editedScene.elementPositions?.[`text-${index}`]?.x || 50,
        top: editedScene.elementPositions?.[`text-${index}`]?.y || 50 + (index * 60),
        width: 300,
        fontSize: sceneData.textProperties?.[`text-${index}`]?.fontSize || 24,
        fontFamily: sceneData.textProperties?.[`text-${index}`]?.fontFamily || 'Arial',
        fill: sceneData.textProperties?.[`text-${index}`]?.fill || '#000000',
        selectable: true,
        name: `text-${index}`,
        data: { type: 'text', id: `text-${index}` }
      });
      canvas.add(txt);
      setupObjectControls(txt);
    });



    // 6. TTS Audio Indicators
    sceneData.tts_audio_url?.forEach((audioUrl, index) => {
      const audioIcon = new fabric.Text('🔊', {
        left: editedScene.elementPositions?.[`tts-${index}`]?.x || 700,
        top: editedScene.elementPositions?.[`tts-${index}`]?.y || 20 + (index * 30),
        fontSize: 24,
        selectable: true,
        name: `tts-${index}`,
        data: { type: 'tts', id: `tts-${index}` }
      });
      canvas.add(audioIcon);
      setupObjectControls(audioIcon);
    });

    canvas.renderAll();
  };

  const setupObjectControls = (obj: fabric.Object) => {
    obj.on('selected', () => {
      setActiveLayer(obj.name || null);
      obj.bringToFront();
    });

    obj.on('modified', () => {
      updateLayerProperties(obj);
    });

    obj.on('moving', () => {
      updateLayerProperties(obj);
    });

    obj.on('scaling', () => {
      updateLayerProperties(obj);
    });

    obj.on('rotating', () => {
      updateLayerProperties(obj);
    });
  };

  const updateLayerProperties = (obj: fabric.Object) => {
    if (!obj.data) return;

    setEditedScene(prev => {
      const updated = { ...prev };
      const { type, id } = obj.data;

      updated.elementPositions = updated.elementPositions || {};
      updated.elementPositions[id] = {
        x: obj.left || 0,
        y: obj.top || 0,
        scaleX: obj.scaleX || 1,
        scaleY: obj.scaleY || 1,
        angle: obj.angle || 0
      };

      if (type === 'text' && obj instanceof fabric.Textbox) {
        const textIndex = parseInt(id.split('-')[1]);
        if (updated.text && updated.text[textIndex]) {
          updated.editedText = updated.editedText || [...updated.text];
          updated.editedText[textIndex] = obj.text || '';

          updated.textProperties = updated.textProperties || {};
          updated.textProperties[id] = {
            fontSize: obj.fontSize,
            fontFamily: obj.fontFamily,
            fill: obj.fill
          };
        }
      }

      return updated;
    });

    // Update the properties panel if this is the active layer
    if (obj.name === activeLayer) {
      setLayerProperties(prev => ({
        ...prev,
        left: obj.left,
        top: obj.top,
        angle: obj.angle,
        scaleX: obj.scaleX,
        scaleY: obj.scaleY
      }));
    }
  };

  const handlePropertyChange = (property: string, value: any) => {
    if (!activeLayer || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const obj = canvas.getObjects().find(o => o.name === activeLayer);
    if (!obj) return;

    switch (property) {
      case 'text':
        if (obj instanceof fabric.Textbox) {
          obj.set('text', value);
        }
        break;
      case 'fontSize':
        if (obj instanceof fabric.Textbox) {
          obj.set('fontSize', Number(value));
        }
        break;
      case 'fontFamily':
        if (obj instanceof fabric.Textbox) {
          obj.set('fontFamily', value);
        }
        break;
      case 'fill':
        if (obj instanceof fabric.Textbox || obj instanceof fabric.Group) {
          obj.set('fill', value);
          if (obj instanceof fabric.Group) {
            obj.forEachObject(child => {
              if (child.set) {
                child.set('fill', value);
              }
            });
          }
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
    // Final capture of all layer states
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.getObjects().forEach(obj => {
        if (obj.selectable) {
          updateLayerProperties(obj);
        }
      });
    }

    onSave(editedScene);
    onClose();
  };

  const findObjectByName = (name: string): fabric.Object | undefined =>
    canvasRef.current?.getObjects().find(o => o.name === name);

  const handleSelectLayer = (name: string) => {
    const canvas = canvasRef.current!;
    const obj = findObjectByName(name);
    if (!obj) return;
    canvas.setActiveObject(obj);
    canvas.requestRenderAll();
    setActiveLayer(name);
  };

  const handleDeleteLayer = (name: string) => {
    const canvas = canvasRef.current!;
    const obj = findObjectByName(name);
    if (!obj) return;
    // 1) Remove from canvas
    canvas.remove(obj);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    setActiveLayer(null);

    // 2) Also remove from your editedScene payload (so on Save it’s gone)
    setEditedScene(prev => {
      const updated = { ...prev };
      // drop any elementPositions entry
      if (updated.elementPositions) {
        delete updated.elementPositions[name];
      }
      // if it’s a text layer
      if (name.startsWith('text-') && updated.editedText) {
        const idx = parseInt(name.split('-')[1], 10);
        updated.editedText = updated.editedText.filter((_, i) => i !== idx);
      }
      // for svgs, backgrounds, etc. you’d do likewise:
      // updated.svgs = updated.svgs.filter((_, i) => `svg-${i}` !== name)
      // updated.backgrounds = updated.backgrounds.filter((_, i) => `bg-${i}` !== name)
      return updated;
    });
  };

  return (
    <>
    <div className="ed_fixed">
    <div className="editor_wrap">
      <div className="editor-header">
        <h3>Scene Editor - {activeLayer || 'No layer selected'}</h3>
        <button onClick={onClose}>×</button>
      </div>
    <div className="scene-editor-modal">

      <div className="editor-container">
        <canvas id="temp-canvas" />

        {/* <div className="layer-properties-panel">
          {layerProperties && (
            <>
              <h4>Layer Properties</h4>
              <div className="property-grid">
                {layerProperties.type === 'text' && (
                  <>
                    <div className="property-row">
                      <label>Text Content</label>
                      <input
                        type="text"
                        value={layerProperties.text || ''}
                        onChange={(e) => handlePropertyChange('text', e.target.value)}
                      />
                    </div>
                    <div className="property-row">
                      <label>Font Size</label>
                      <input
                        type="number"
                        value={layerProperties.fontSize || 24}
                        onChange={(e) => handlePropertyChange('fontSize', e.target.value)}
                      />
                    </div>
                    <div className="property-row">
                      <label>Font Family</label>
                      <select
                        value={layerProperties.fontFamily || 'Arial'}
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
                    value={layerProperties.fill || '#000000'}
                    onChange={(e) => handlePropertyChange('fill', e.target.value)}
                  />
                </div>

                <div className="property-row">
                  <label>Position X</label>
                  <input
                    type="number"
                    value={layerProperties.left || 0}
                    onChange={(e) => handlePropertyChange('left', e.target.value)}
                  />
                </div>

                <div className="property-row">
                  <label>Position Y</label>
                  <input
                    type="number"
                    value={layerProperties.top || 0}
                    onChange={(e) => handlePropertyChange('top', e.target.value)}
                  />
                </div>

                <div className="property-row">
                  <label>Rotation</label>
                  <input
                    type="number"
                    value={layerProperties.angle || 0}
                    onChange={(e) => handlePropertyChange('angle', e.target.value)}
                  />
                </div>

                <div className="property-row">
                  <label>Scale X</label>
                  <input
                    type="number"
                    step="0.1"
                    value={layerProperties.scaleX || 1}
                    onChange={(e) => handlePropertyChange('scaleX', e.target.value)}
                  />
                </div>

                <div className="property-row">
                  <label>Scale Y</label>
                  <input
                    type="number"
                    step="0.1"
                    value={layerProperties.scaleY || 1}
                    onChange={(e) => handlePropertyChange('scaleY', e.target.value)}
                  />
                </div>


              </div>
            </>
          )}
        </div> */}
      </div>

      <div className="scene-layers-list">
        <h4>All Layers</h4>
        <ul>
          {canvasRef.current
            ?.getObjects()
            .map(obj => (
              <li key={obj.name} className="flex items-center space-x-2">
                <button
                  onClick={() => handleSelectLayer(obj.name!)}
                 
                >
                  {obj.name} <small>({obj.data?.type})</small>
                </button>
                <button
                  onClick={() => handleDeleteLayer(obj.name!)}
                 
                  title="Delete this layer"
                >
                  x
                </button>
              </li>
            ))}
        </ul>
      </div>




      
    </div>
    <div className="editor-controls">
        <button onClick={handleSave}>Save Changes</button>
        <button onClick={onClose}>x</button>
      </div>

    </div>

    </div>
    </>

    
  );
};