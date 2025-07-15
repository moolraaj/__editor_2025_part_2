'use client';

import React, { useContext, useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';
import { API_URL } from '@/utils/constants';
import { StoreContext } from '@/store';
import { SceneEditor } from './TempCanvas';
import { ScenePayloadWithEdits } from '@/types';


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



  useEffect(()=>{
  console.log(`tempScenes`)
  console.log(tempScenes)
  },[])

 
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

      }));
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
      store.addSceneResource({
        //@ts-ignore
        backgrounds: scenePayload.editedBackgrounds!,
        //@ts-ignore
        gifs: scenePayload.editedSvgs!,
        //@ts-ignore
        animations: scenePayload.animations || [],
        //@ts-ignore
        elements: [],
        //@ts-ignore
        text: scenePayload.editedText!,
        //@ts-ignore
        tts_audio_url: scenePayload.tts_audio_url!,
      });
    });
    store.refreshElements();
    setShowResultPopup(false);
    setTempScenes([]);
  };

  if (!showResultPopup) return null;

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

            return (
              <div
                key={idx}
                className="st_wrapper_inner"
                onClick={() => handleEditScene(idx)}
              >
                <div className="heading">
                  <h3>Scene {idx + 1}</h3>
                </div>
                <div className="playloads">
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
                              <img
                                src={svg.svg_url}
                                alt={svg.tags.join(', ')}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="st_line_buttons_outer">
          <div className="st_line_buttons_inner space-x-2">
            <button
              className="buttons"
              onClick={() => download('/download-all-images', 'all_images.zip')}
            >
              Download All Images
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
