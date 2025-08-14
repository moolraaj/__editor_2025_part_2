'use client';

import React, { useContext } from 'react';
import { FaTimes } from 'react-icons/fa';
import { API_URL } from '@/utils/constants';
import { StoreContext } from '@/store';
import { SceneEditor } from './TempCanvas';
import { AnimationTypes, Background, Gif, ScenePayloadWithEdits, Text } from '@/types';
import { FaEdit } from 'react-icons/fa'
import { TempCanvasViewer } from './TempCanvasViewer';
import { toast } from 'react-toastify';

import JSZip from 'jszip';
import { saveAs } from 'file-saver';


interface SvgAsset {
  tags: string[];
  svg_url: string;
}
interface BackgroundAsset {
  name: string;
  background_url: string;
}
interface AnimationAsset {
  name: string;
}
interface ScenePayload {
  svgs?: SvgAsset[];
  backgrounds?: BackgroundAsset[];
  animations?: AnimationAsset[];
  text?: string[];
  tts_audio_url?: string[];
}

interface StoryLineResultsProps {
  showResultPopup: boolean;
  payloads: ScenePayload[];
  sentences: string[];
  setShowResultPopup: (open: boolean) => void;
}

const StoryLineResults: React.FC<StoryLineResultsProps> = ({
  showResultPopup,
  payloads,
  sentences,
  setShowResultPopup,
}) => {
  const store = useContext(StoreContext);
  const [tempScenes, setTempScenes] = React.useState<ScenePayloadWithEdits[]>([]);
  const [editingSceneIndex, setEditingSceneIndex] = React.useState<number | null>(null);

  const sceneCanvasElsRef = React.useRef<(HTMLCanvasElement | null)[]>([]);
  const setSceneCanvasEl = (idx: number) => (el: HTMLCanvasElement | null) => {
    sceneCanvasElsRef.current[idx] = el;
  };

  const handleDownloadAllScenesPngZip = async () => {
    const zip = new JSZip();
    for (let i = 0; i < tempScenes.length; i++) {
      const canvas = sceneCanvasElsRef.current[i];
      if (!canvas) continue;
      const pngBlob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
      });
      const folder = zip.folder(`scene_${i + 1}`)!;
      folder.file(`scene_${i + 1}_image.png`, pngBlob);
    }
    const out = await zip.generateAsync({ type: 'blob' });
    saveAs(out, 'scenes.zip');
  };



  React.useEffect(() => {
    if (showResultPopup && payloads.length > 0 && tempScenes.length === 0) {

      const initial = payloads.map(p => ({
        ...p,
        editedBackgrounds: p.backgrounds || [],
        editedSvgs: p.svgs || [],
        editedText: p.text || [],
        tts_audio_url: p.tts_audio_url || [],
        elementPositions: {},
        textProperties: {},
        elements: [] as ScenePayloadWithEdits['elements'],
      })) as unknown as ScenePayloadWithEdits[];
      setTempScenes(initial);
    }
  }, [showResultPopup, payloads, tempScenes.length]);

  const download = async (path: string, filename: string) => {
    try {
      const res = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: sentences }),
      });
      if (!res.ok) throw new Error(res.statusText);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handleEditScene = (index: number) => {
    setEditingSceneIndex(index);
  };
  const handleSaveEditedScene = (edited: ScenePayloadWithEdits) => {
    setTempScenes(prev =>
      prev.map((s, i) => (i === editingSceneIndex ? {
        ...edited,
        svgs: s.svgs || [],
        backgrounds: s.backgrounds || [],
      } : s)
      ));
    setEditingSceneIndex(null);
  };
  const handleAddToCanvas = () => {
    tempScenes.forEach(scenePayload => {
      const elements = (scenePayload.elements || []).map(element => ({
        ...element,
        properties: {
          ...(element.properties || {}),
          src: element.type === 'svg' && element.content
            ? `data:image/svg+xml;base64,${btoa(element.content)}`
            : element.properties?.src
        }
      }));
      store.addSceneResource({
        backgrounds: scenePayload.editedBackgrounds as unknown as Background[],
        gifs: scenePayload.editedSvgs as unknown as Gif[],
        animations: scenePayload.animations as unknown as AnimationTypes[],
        //@ts-ignore
        elements: elements,
        text: scenePayload.editedText as unknown as Text[],
        tts_audio_url: scenePayload.tts_audio_url as unknown as string,
        sceneSvgs: [],
      });
    });
    store.refreshElements();
    setShowResultPopup(false);
    setTempScenes([]);
  };
  if (!showResultPopup) return null;
  const handleDeleteScene = (sceneIndex: number) => {
    if (tempScenes.length <= 1) {
      toast.error('You must keep at least one scene. Cannot delete the scene.')
      return;
    }
    if (!confirm(`Are you sure you want to delete Scene ${sceneIndex + 1}?`)) return;
    setTempScenes((prev) => prev.filter((_, idx) => idx !== sceneIndex));
    if (store.deleteScene) {
      store.deleteScene(sceneIndex);
      toast.success(`scene ${sceneIndex} deleted successfully`)
    }
  };

  return (
    <div className="popup_overlay">
      <div className="popup_content">
        {editingSceneIndex !== null && (
          <SceneEditor
            scene={tempScenes[editingSceneIndex]!}
            onSave={handleSaveEditedScene}
            onClose={() => setEditingSceneIndex(null)}
            sceneIndex={editingSceneIndex}

          />
        )}
        <button className="popup_close" onClick={() => setShowResultPopup(false)}>
          <FaTimes />
        </button>
        <div className="st_line_wrap_outer">
          {tempScenes.map((payload, idx) => {
            const backgrounds = payload.backgrounds || [];
            const svgs = payload.svgs || [];
            const animations = payload.animations || [];
            const hasAny = backgrounds.length > 0 || svgs.length > 0 || animations.length > 0;

            const isEdited =
              (payload.elements && payload.elements.length > 0) ||
              (payload.editedSvgs && payload.editedSvgs.length > 0);

            return (
              <div key={idx} className="st_wrapper_inner">
                <div className="heading">
                  <h3>Scene {idx + 1}</h3>
                </div>
                <div className="playloads">

                  {isEdited ? (

                    <TempCanvasViewer scene={payload} width={300} height={200} onCanvasReady={setSceneCanvasEl(idx)} />
                  ) : (

                    <>
                      {!hasAny ? (
                        <p className="text-sm text-gray-500">
                          No matching data found for this scene.
                        </p>
                      ) : (
                        <>
                          {backgrounds.length > 0 && (
                            <div className="p_outer_wrapper">
                              {backgrounds.slice(0, 1).map((bg: any, i: number) => (
                                <div key={i} className="p_inner_wrapper">
                                  <img
                                    src={bg.background_url}
                                    alt={bg.name}
                                    className="p_img"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                          {svgs.length > 0 && (
                            <div className="char_type">
                              {svgs.map((svg: any, i: number) => (
                                <div key={i} className="svg_type_img">
                                  <img src={svg.svg_url} alt={svg.tags.join(', ')} />
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}

                    </>
                  )}
                  <button
                    className="p-1 hover:bg-gray-200 rounded scene_edit_b"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditScene(idx);
                    }}
                    aria-label={`Edit scene ${idx + 1}`}
                  >
                    <FaEdit fontSize={30} />
                  </button>

                  <div className="del_sec">
                    {tempScenes.length <= 1 ? ('') : (<>
                      <button
                        className="p-1 hover:bg-red-200 rounded scene_delete_b"
                        onClick={() => handleDeleteScene(idx)}

                      >  x</button>
                    </>)}

                  </div>


                </div>
              </div>
            );
          })}
        </div>
        <div className="st_line_buttons_outer">
          <div className="st_line_buttons_inner space-x-2">
            <button className="buttons" onClick={handleDownloadAllScenesPngZip}>
              Download Scenes (PNG ZIP)
            </button>
            <button className="buttons" onClick={handleAddToCanvas}>
              Add To Canvas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoryLineResults;
