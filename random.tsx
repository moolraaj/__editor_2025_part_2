

  //  case 'scene': {
  //         if (element.properties.sceneIndex !== this.activeSceneIndex) {
  //           break;
  //         }
  //         if (element.fabricObject && Array.isArray(element.fabricObject)) {
  //           const sorted = [...element.fabricObject].sort((a, b) => {
  //             const aZ = a.data?.zIndex ?? 0;
  //             const bZ = b.data?.zIndex ?? 0;
  //             return aZ - bZ;
  //           });
  //           canvas.add(...sorted);
  //         } else {
  //           const now = this.currentTimeInMs;
  //           const sceneData = this.scenes[element.properties.sceneIndex];
  //           const { x, y, width, height } = element.placement;

  //           const parts: fabric.Object[] = [];
  //           let loaded = 0;
  //           const total = sceneData.backgrounds.length
  //             + sceneData.gifs.length
  //             + (sceneData.text?.length || 0);

  //           const tryComplete = () => {
  //             if (++loaded === total) {

  //               parts.sort((a, b) => (a.data?.zIndex || 0) - (b.data?.zIndex || 0));
  //               canvas.add(...parts);
  //               canvas.requestRenderAll();
  //             }
  //           };


  //           sceneData.text?.forEach(textItem => {
  //             const { start: t0, end: t1 } = textItem.timeFrame;
  //             if (now >= t0 && now <= t1) {
  //               const txt = new fabric.Textbox(textItem.value, {
  //                 name: textItem.id,
  //                 left: x + (width - (textItem.placement.width || width)) / 2,
  //                 top: y + height - (textItem.properties.fontSize || 24) - 20,
  //                 width: textItem.placement.width,
  //                 fontSize: textItem.properties.fontSize,
  //                 fontFamily: textItem.properties.fontFamily,
  //                 fill: textItem.properties.fill,
  //                 textAlign: 'center',
  //                 data: { timeFrame: textItem.timeFrame, zIndex: 5 },

  //                 // ─── ENABLE selection & controls ────────────────────────────────
  //                 selectable: true,
  //                 hasControls: true,
  //                 lockUniScaling: false,
  //               });
  //               // Fire selection back into your store
  //               txt.on('selected', () => store.setSelectedElement(textItem));
  //               parts.push(txt);
  //             }
  //             tryComplete();
  //           });

  //           // ─── 2) BACKGROUND layers ─────────────────────────────────────────────────
  //           sceneData.backgrounds.forEach(bg => {
  //             fabric.Image.fromURL(bg.background_url, img => {
  //               const { start: t0, end: t1 } = bg.timeFrame;
  //               if (now >= t0 && now <= t1) {
  //                 const scaleX = width / (img.width || 1);
  //                 const scaleY = height / (img.height || 1);
  //                 img.set({
  //                   left: x, top: y,
  //                   scaleX, scaleY,
  //                   data: { timeFrame: bg.timeFrame, zIndex: 0 },

  //                   // ─── ENABLE selection on non-primary backgrounds ───────────────
  //                   selectable: true,
  //                   hasControls: true,
  //                   lockMovementX: false,
  //                   lockMovementY: false,
  //                   lockScalingX: false,
  //                   lockScalingY: false,
  //                 });
  //                 img.on('selected', () => store.setSelectedElement(bg));
  //                 parts.push(img);
  //               }
  //               tryComplete();
  //             }, { crossOrigin: 'anonymous' });
  //           });

  //           // ─── 3) GIF/SVG layers ────────────────────────────────────────────────────
  //           sceneData.gifs.forEach(gif => {
  //             const pos = gif.calculatedPosition || {
  //               x: x + width * 0.35,
  //               y: y + height * 0.35,
  //               width: width * 0.3,
  //               height: height * 0.3,
  //             };
  //             const onLoad = (obj: fabric.Object) => {
  //               const { start: t0, end: t1 } = gif.timeFrame;
  //               if (now >= t0 && now <= t1) {
  //                 const scale = Math.min(
  //                   pos.width / (obj.width || 1),
  //                   pos.height / (obj.height || 1)
  //                 );
  //                 obj.set({
  //                   left: pos.x,
  //                   top: pos.y,
  //                   scaleX: scale,
  //                   scaleY: scale,
  //                   data: { timeFrame: gif.timeFrame, zIndex: 1 },

  //                   // ─── ENABLE selection & dragging ────────────────────────────
  //                   selectable: true,
  //                   hasControls: true,
  //                   lockUniScaling: false,
  //                 });
  //                 obj.on('selected', () => store.setSelectedElement(gif));
  //                 parts.push(obj);
  //               }
  //               tryComplete();
  //             };

  //             const url = gif.svg_url.toLowerCase();
  //             if (url.endsWith('.svg')) {
  //               fabric.loadSVGFromURL(url, (objs, opts) => {
  //                 const grp = fabric.util.groupSVGElements(objs, opts);
  //                 onLoad(grp);
  //               });
  //             } else {
  //               fabric.Image.fromURL(url, onLoad, { crossOrigin: 'anonymous' });
  //             }
  //           });
  //         }
  //         if (element.properties.elements?.length) {
  //           element.properties.elements.forEach(childElement => {
  //             if (this.currentTimeInMs >= childElement.timeFrame.start &&
  //               this.currentTimeInMs <= childElement.timeFrame.end) {
  //               const zIndex = childElement.type === 'svg' ? 1 : 1;
  //               switch (childElement.type) {
  //                 case 'text':
  //                   if (!childElement.fabricObject) {
  //                     const textObject = new fabric.Textbox(childElement.properties.text, {
  //                       name: childElement.id,
  //                       left: childElement.placement.x,
  //                       top: childElement.placement.y,
  //                       width: childElement.placement.width,
  //                       height: childElement.placement.height,
  //                       angle: childElement.placement.rotation,
  //                       fontSize: childElement.properties.fontSize,
  //                       fontFamily: childElement.properties.fontFamily || 'Arial',
  //                       fill: childElement.properties.textColor || '#ffffff',
  //                       fontWeight: childElement.properties.fontWeight || 'normal',
  //                       fontStyle: childElement.properties.fontStyle || 'normal',
  //                       data: { zIndex }
  //                     });
  //                     childElement.fabricObject = textObject;
  //                   }
  //                   canvas.add(childElement.fabricObject);
  //                   childElement.fabricObject.bringToFront();
  //                   break;
  //                 case 'image': {
  //                   if (childElement.fabricObject) {
  //                     canvas.add(childElement.fabricObject);
  //                     childElement.fabricObject.bringToFront();
  //                     break;
  //                   }
  //                   let imgElement = document.getElementById(childElement.properties.elementId) as HTMLImageElement;
  //                   if (!imgElement) {
  //                     imgElement = document.createElement('img');
  //                     imgElement.id = childElement.properties.elementId;
  //                     imgElement.src = childElement.properties.src;
  //                     imgElement.crossOrigin = 'anonymous';
  //                     imgElement.style.display = 'none';
  //                     document.body.appendChild(imgElement);
  //                   }
  //                   const onImageLoad = () => {
  //                     if (childElement.fabricObject) {
  //                       canvas.add(childElement.fabricObject);
  //                       childElement.fabricObject.bringToFront();
  //                       return;
  //                     }
  //                     const imgObj = new fabric.CoverImage(imgElement, {
  //                       name: childElement.id,
  //                       left: childElement.placement.x,
  //                       top: childElement.placement.y,
  //                       width: childElement.placement.width,
  //                       height: childElement.placement.height,
  //                       angle: childElement.placement.rotation,
  //                       selectable: true,
  //                       objectCaching: false,
  //                       data: { zIndex }
  //                     });
  //                     childElement.fabricObject = imgObj;
  //                     canvas.add(imgObj);
  //                     imgObj.bringToFront();
  //                     canvas.requestRenderAll();
  //                   };
  //                   if (imgElement.complete) {
  //                     onImageLoad();
  //                   } else {
  //                     imgElement.onload = onImageLoad;
  //                   }
  //                   break;
  //                 }
  //                 case 'video': {
  //                   const videoEl = document.getElementById(
  //                     childElement.properties.elementId
  //                   ) as HTMLVideoElement | null;
  //                   if (!videoEl || !isHtmlVideoElement(videoEl)) break;
  //                   if (!childElement.fabricObject) {
  //                     const onMeta = () => {
  //                       const vidObj = new fabric.Image(videoEl, {
  //                         name: childElement.id,
  //                         left: childElement.placement.x,
  //                         top: childElement.placement.y,
  //                         width: childElement.placement.width,
  //                         height: childElement.placement.height,
  //                         objectCaching: false,
  //                         selectable: true,
  //                         lockUniScaling: true,
  //                         data: { zIndex }
  //                       });

  //                       childElement.fabricObject = vidObj;
  //                       canvas.add(vidObj);
  //                       vidObj.bringToFront();
  //                       canvas.requestRenderAll();
  //                       videoEl.removeEventListener('loadedmetadata', onMeta);
  //                     };
  //                     videoEl.addEventListener('loadedmetadata', onMeta);
  //                     if (videoEl.readyState >= 1) onMeta();
  //                     break;
  //                   }
  //                   canvas.add(childElement.fabricObject as fabric.Image);
  //                   (childElement.fabricObject as fabric.Image).bringToFront();
  //                   this.updateVideoElements();
  //                   break;
  //                 }
  //                 case 'audio': {
  //                   if (!childElement.fabricObject) {
  //                     const audioRect = new fabric.Rect({
  //                       name: childElement.id,
  //                       left: childElement.placement.x,
  //                       top: childElement.placement.y,
  //                       width: childElement.placement.width,
  //                       height: childElement.placement.height,
  //                       fill: 'rgba(50, 100, 200, 0.3)',
  //                       stroke: 'blue',
  //                       strokeWidth: 2,
  //                       selectable: true,
  //                       data: { zIndex }
  //                     });
  //                     childElement.fabricObject = audioRect;
  //                   }
  //                   if (childElement.fabricObject) {
  //                     canvas.add(childElement.fabricObject);
  //                     childElement.fabricObject.bringToFront();
  //                     this.updateAudioElements();
  //                   }
  //                   break;
  //                 }
  //                 case 'svg': {
  //                   if (!childElement.fabricObject && childElement.properties.src) {
  //                     fabric.loadSVGFromURL(childElement.properties.src, (objects, options) => {
  //                       const group = fabric.util.groupSVGElements(objects, {
  //                         ...options,
  //                         name: childElement.id,
  //                         left: childElement.placement.x,
  //                         top: childElement.placement.y,
  //                         scaleX: childElement.placement.scaleX,
  //                         scaleY: childElement.placement.scaleY,
  //                         angle: childElement.placement.rotation,
  //                         selectable: true,
  //                         data: { zIndex: 1 }
  //                       });

  //                       childElement.fabricObject = group;
  //                       canvas.add(group);
  //                       group.bringToFront();
  //                       canvas.requestRenderAll();
  //                     });
  //                   } else if (childElement.fabricObject) {
  //                     canvas.add(childElement.fabricObject);
  //                     childElement.fabricObject.bringToFront();
  //                   }
  //                   break;
  //                 }
  //               }
  //             }
  //           });
  //         }
  //         break;
  //       }





  /// latest scene code  dated 29-5-205

   case 'scene': {
          if (element.properties.sceneIndex !== this.activeSceneIndex) {
            break;
          }

          if (element.fabricObject && Array.isArray(element.fabricObject)) {
            element.fabricObject.forEach(obj => canvas.remove(obj));
            const sortedObjects = [...element.fabricObject].sort((a, b) => {
              const aZ = a.data?.zIndex || (a.name?.startsWith('BG') ? 0 : 1);
              const bZ = b.data?.zIndex || (b.name?.startsWith('BG') ? 0 : 1);
              return aZ - bZ;
            });
            canvas.add(...sortedObjects);
          } else {
            const sceneData = this.scenes[element.properties.sceneIndex];
            const parts: fabric.Object[] = [];
            let loaded = 0;
            const total = sceneData.backgrounds.length + sceneData.gifs.length;
            const { x, y, width, height } = element.placement;

            const onPartLoaded = () => {
              if (++loaded === total) {
                parts.sort((a, b) => {
                  const aZ = a.data?.zIndex ?? (a.name?.startsWith('BG') ? 0 : 1);
                  const bZ = b.data?.zIndex ?? (b.name?.startsWith('BG') ? 0 : 1);
                  return aZ - bZ;
                });
                parts.forEach((obj, index) => {
                  if (obj.name?.startsWith('BG')) {
                    obj.sendToBack();
                  } else {
                    obj.bringToFront();
                  }
                });
                //@ts-ignore
                element.fabricObject = parts;
                canvas.requestRenderAll();
              }
            };


            sceneData.backgrounds.forEach((bg, i) => {
              fabric.Image.fromURL(
                bg.background_url,
                (img) => {
                  const scaleX = width / (img.width || 1);
                  const scaleY = height / (img.height || 1);
                  const scale = Math.max(scaleX, scaleY);
                  const isFirstBackground = i === 0;

                  img.set({
                    left: x,
                    top: y,
                    selectable: !isFirstBackground,
                    name: `BG ${i}`,
                    data: {
                      zIndex: 0,
                      isBackground: true
                    },
                    scaleX: scale,
                    scaleY: scale,
                    originX: 'left',
                    originY: 'top',
                    hasControls: !isFirstBackground,
                    hasBorders: !isFirstBackground,
                    lockMovementX: isFirstBackground,
                    lockMovementY: isFirstBackground,
                    lockScalingX: isFirstBackground,
                    lockScalingY: isFirstBackground,
                    lockRotation: isFirstBackground,
                    lockSkewingX: isFirstBackground,
                    lockSkewingY: isFirstBackground,
                    hoverCursor: isFirstBackground ? 'default' : 'move'
                  });
                  if (scaleX > scaleY) {
                    img.set({
                      top: y + (height - ((img.height || 0) * scale)) / 2
                    });
                  } else {
                    img.set({
                      left: x + (width - ((img.width || 0) * scale)) / 2
                    });
                  }
                  if (i > 0) {
                    img.set({
                      scaleX: (width * 0.3) / (img.width || 1),
                      scaleY: (height * 0.3) / (img.height || 1),
                      left: x + width - (width * 0.3) - 20,
                      top: y + height - (height * 0.3) - 20,
                      selectable: true
                    });
                  }
                  parts.push(img);
                  canvas.add(img);
                  img.sendToBack();
                  onPartLoaded();
                },
                { crossOrigin: 'anonymous' }
              );
            });
            sceneData.gifs.forEach((gif, i) => {
              const url = gif.svg_url.toLowerCase();
              const pos = (gif as any).calculatedPosition || {
                x: x + (width * 0.35),
                y: y + (height * 0.35),
                width: width * 0.3,
                height: height * 0.3
              };
              const handle = (obj: fabric.Object) => {
                const scaleX = pos.width / (obj.width || 1);
                const scaleY = pos.height / (obj.height || 1);
                const scale = Math.min(scaleX, scaleY);
                obj.set({
                  left: pos.x + (pos.width - ((obj.width || 0) * scale)) / 2,
                  top: pos.y + (pos.height - ((obj.height || 0) * scale)) / 2,
                  selectable: true,
                  name: `GIF ${i + 1}`,
                  data: {
                    zIndex: 1,
                    isForeground: true
                  },
                  scaleX: scale,
                  scaleY: scale,
                  originX: 'left',
                  originY: 'top'
                });
                parts.push(obj);
                canvas.add(obj);
                obj.bringToFront()
                onPartLoaded();
              };

              if (url.endsWith('.svg')) {
                fabric.loadSVGFromURL(url, (objs, opts) => {
                  const group = fabric.util.groupSVGElements(objs, opts);
                  handle(group);
                });
              } else {
                fabric.Image.fromURL(url, handle, { crossOrigin: 'anonymous' });
              }
            });
          }
          if (element.properties.elements?.length) {
            element.properties.elements.forEach(childElement => {
              if (this.currentTimeInMs >= childElement.timeFrame.start &&
                this.currentTimeInMs <= childElement.timeFrame.end) {
                const zIndex = childElement.type === 'svg' ? 1 : 1;
                switch (childElement.type) {
                  case 'text':
                    if (!childElement.fabricObject) {
                      const textObject = new fabric.Textbox(childElement.properties.text, {
                        name: childElement.id,
                        left: childElement.placement.x,
                        top: childElement.placement.y,
                        width: childElement.placement.width,
                        height: childElement.placement.height,
                        angle: childElement.placement.rotation,
                        fontSize: childElement.properties.fontSize,
                        fontFamily: childElement.properties.fontFamily || 'Arial',
                        fill: childElement.properties.textColor || '#ffffff',
                        fontWeight: childElement.properties.fontWeight || 'normal',
                        fontStyle: childElement.properties.fontStyle || 'normal',
                        data: { zIndex }
                      });
                      childElement.fabricObject = textObject;
                    }
                    canvas.add(childElement.fabricObject);
                    childElement.fabricObject.bringToFront();
                    break;
                  case 'image': {
                    if (childElement.fabricObject) {
                      canvas.add(childElement.fabricObject);
                      childElement.fabricObject.bringToFront();
                      break;
                    }
                    let imgElement = document.getElementById(childElement.properties.elementId) as HTMLImageElement;
                    if (!imgElement) {
                      imgElement = document.createElement('img');
                      imgElement.id = childElement.properties.elementId;
                      imgElement.src = childElement.properties.src;
                      imgElement.crossOrigin = 'anonymous';
                      imgElement.style.display = 'none';
                      document.body.appendChild(imgElement);
                    }
                    const onImageLoad = () => {
                      if (childElement.fabricObject) {
                        canvas.add(childElement.fabricObject);
                        childElement.fabricObject.bringToFront();
                        return;
                      }
                      const imgObj = new fabric.CoverImage(imgElement, {
                        name: childElement.id,
                        left: childElement.placement.x,
                        top: childElement.placement.y,
                        width: childElement.placement.width,
                        height: childElement.placement.height,
                        angle: childElement.placement.rotation,
                        selectable: true,
                        objectCaching: false,
                        data: { zIndex }
                      });
                      childElement.fabricObject = imgObj;
                      canvas.add(imgObj);
                      imgObj.bringToFront();
                      canvas.requestRenderAll();
                    };
                    if (imgElement.complete) {
                      onImageLoad();
                    } else {
                      imgElement.onload = onImageLoad;
                    }
                    break;
                  }
                  case 'video': {
                    const videoEl = document.getElementById(
                      childElement.properties.elementId
                    ) as HTMLVideoElement | null;
                    if (!videoEl || !isHtmlVideoElement(videoEl)) break;
                    if (!childElement.fabricObject) {
                      const onMeta = () => {
                        const vidObj = new fabric.Image(videoEl, {
                          name: childElement.id,
                          left: childElement.placement.x,
                          top: childElement.placement.y,
                          width: childElement.placement.width,
                          height: childElement.placement.height,
                          objectCaching: false,
                          selectable: true,
                          lockUniScaling: true,
                          data: { zIndex }
                        });

                        childElement.fabricObject = vidObj;
                        canvas.add(vidObj);
                        vidObj.bringToFront();
                        canvas.requestRenderAll();
                        videoEl.removeEventListener('loadedmetadata', onMeta);
                      };
                      videoEl.addEventListener('loadedmetadata', onMeta);
                      if (videoEl.readyState >= 1) onMeta();
                      break;
                    }
                    canvas.add(childElement.fabricObject as fabric.Image);
                    (childElement.fabricObject as fabric.Image).bringToFront();
                    this.updateVideoElements();
                    break;
                  }
                  case 'audio': {
                    if (!childElement.fabricObject) {
                      const audioRect = new fabric.Rect({
                        name: childElement.id,
                        left: childElement.placement.x,
                        top: childElement.placement.y,
                        width: childElement.placement.width,
                        height: childElement.placement.height,
                        fill: 'rgba(50, 100, 200, 0.3)',
                        stroke: 'blue',
                        strokeWidth: 2,
                        selectable: true,
                        data: { zIndex }
                      });
                      childElement.fabricObject = audioRect;
                    }
                    if (childElement.fabricObject) {
                      canvas.add(childElement.fabricObject);
                      childElement.fabricObject.bringToFront();
                      this.updateAudioElements();
                    }
                    break;
                  }
                  case 'svg': {
                    if (!childElement.fabricObject && childElement.properties.src) {
                      fabric.loadSVGFromURL(childElement.properties.src, (objects, options) => {
                        const group = fabric.util.groupSVGElements(objects, {
                          ...options,
                          name: childElement.id,
                          left: childElement.placement.x,
                          top: childElement.placement.y,
                          scaleX: childElement.placement.scaleX,
                          scaleY: childElement.placement.scaleY,
                          angle: childElement.placement.rotation,
                          selectable: true,
                          data: { zIndex: 1 }
                        });

                        childElement.fabricObject = group;
                        canvas.add(group);
                        group.bringToFront();
                        canvas.requestRenderAll();
                      });
                    } else if (childElement.fabricObject) {
                      canvas.add(childElement.fabricObject);
                      childElement.fabricObject.bringToFront();
                    }
                    break;
                  }
                }
              }
            });
          }
          break;
        }
 





        "use client";
        import { toJS } from "mobx";
        import React, { useContext, useState, useEffect } from "react";
        import { observer } from "mobx-react-lite";
        import { StoreContext } from "@/store";
        import { SeekPlayer } from "./timeline-related/SeekPlayer";
        import { TimeFrameView } from "./timeline-related/TimeFrameView";
        import type { SceneEditorElement } from "@/types";
        
        export const TimeLine: React.FC = observer(() => {
          const store = useContext(StoreContext);
          const [viewMode, setViewMode] = useState<"master" | "scene">("master");
          const [viewingScene, setViewingScene] = useState<number>(0);
          const [currentSceneIndex, setCurrentSceneIndex] = useState<number>(0);
        
          const totalTime = store.maxTime;
          const sceneCount = store.scenes.length;
          const perSceneLength = sceneCount > 0 ? totalTime / sceneCount : totalTime;
        
        
          const sceneElements = store.scenes.map((_, idx) =>
            store.editorElements.find(
              (e) =>
                e.type === "scene" &&
                (e as SceneEditorElement).properties.sceneIndex === idx
            ) as SceneEditorElement | undefined
          );
        
        
          let nowPct: number;
          if (viewMode === "master") {
            nowPct = (store.currentTimeInMs / totalTime) * 100;
          } else {
            const sceneStart = viewingScene * perSceneLength;
            const rawPct = ((store.currentTimeInMs - sceneStart) / perSceneLength) * 100;
            nowPct = Math.max(0, Math.min(rawPct, 100));
          }
        
        
          const handleSceneClick = (idx: number) => {
            const sceneStartTime = idx * perSceneLength;
            store.setCurrentTimeInMs(sceneStartTime);
            store.setActiveScene(idx);
            setCurrentSceneIndex(idx);
        
            const scene = store.scenes[idx];
            const sceneElement = store.editorElements.find(
              e => e.type === "scene" &&
                (e as SceneEditorElement).properties.sceneIndex === idx
            ) as SceneEditorElement | undefined;
        
            console.group(`Active Scene ${idx}`);
            console.log("MAIN SCENE LAYER:", {
              id: sceneElement?.id,
              name: sceneElement?.name,
              timeFrame: sceneElement?.timeFrame
            });
            console.log("NESTED LAYERS:");
            console.log("• backgrounds:", toJS(scene.backgrounds));
            console.log("• gifs:      ", toJS(scene.gifs));
            console.log("• animations:", toJS(scene.animations));
            console.log("• elements:  ", toJS(scene.elements));
            console.log("• text:      ", toJS(scene.text));
            console.groupEnd();
        
            if (store.canvas) {
              store.canvas.discardActiveObject();
              store.canvas.requestRenderAll();
            }
          };
        
        
          useEffect(() => {
            if (sceneCount === 0) return;
            const idx = Math.floor(store.currentTimeInMs / perSceneLength);
            const newIdx = Math.min(Math.max(idx, 0), sceneCount - 1);
        
            if (viewMode === "master") {
              if (newIdx !== store.activeSceneIndex) {
                store.setActiveScene(newIdx);
              }
              if (newIdx !== currentSceneIndex) {
                setCurrentSceneIndex(newIdx);
              }
            }
          }, [
            store.currentTimeInMs,
            sceneCount,
            perSceneLength,
            store,
            currentSceneIndex,
            viewMode,
          ]);
        
        
          useEffect(() => {
            if (viewMode !== "scene") return;
            const sceneStartTime = viewingScene * perSceneLength;
            const sceneEndTime = (viewingScene + 1) * perSceneLength;
            if (store.currentTimeInMs >= sceneEndTime) {
              store.setCurrentTimeInMs(sceneStartTime);
              store.setPlaying(false);
            }
          }, [
            store.currentTimeInMs,
            viewMode,
            viewingScene,
            perSceneLength,
            store,
          ]);
        
        
          const renderSceneLayers = (
            sceneElem: SceneEditorElement | undefined,
            idx: number
          ) => {
            if (!sceneElem) return null;
            const isActive = store.activeSceneIndex === idx;
        
            return (
              <div
                key={`scene-${idx}-${sceneElem.id}`}
        
                className={`rounded p-2 transition-all h-64 ${isActive ? "" : ""}`}
              >
                <div className="flex justify-between items-center mb-2">
                  <h3
                    className={`text-lg font-semibold ${isActive
                      ? "text-green-400 cursor-pointer"
                      : "text-white cursor-pointer"
                      }`}
                    onClick={() => handleSceneClick(idx)}
                  >
                    Scene {idx + 1} {isActive && "(Active)"}
                  </h3>
                </div>
                <TimeFrameView
                  key={`frame-${sceneElem.id}`}
                  element={sceneElem}
                  setCurrentSceneIndex={setCurrentSceneIndex}
                  handleSceneClick={handleSceneClick}
                />
              </div>
            );
          };
        
        
          const renderMasterView = () => (
            <div className="relative h-48" onDragOver={(e) => e.preventDefault()}>
              {sceneElements.map((sceneElem, idx) => {
                const sceneStart = idx * perSceneLength;
                const widthPct = (perSceneLength / totalTime) * 100;
                const leftPct = (sceneStart / totalTime) * 100;
        
                return (
                  <div
                    key={`scene-container-${idx}`}
                    className="absolute top-0"
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  >
                    {renderSceneLayers(sceneElem, idx)}
                  </div>
                );
              })}
        
              {store.editorElements.some((e) => e.type !== "scene") && (
                <div className="space-y-4 mt-4">
                  {store.editorElements
                    .filter((e) => e.type !== "scene")
                    .map((el) => (
                      <div key={`non-scene-${el.id}`} className="rounded-lg">
                        <TimeFrameView
                          key={`frame-non-scene-${el.id}`}
                          element={el}
                          setCurrentSceneIndex={setCurrentSceneIndex}
                          handleSceneClick={handleSceneClick}
                        />
                      </div>
                    ))}
                </div>
              )}
        
        
              <div
                className="w-[2px] bg-[#f87171] absolute top-0 bottom-0 z-20"
                style={{ left: `${nowPct}%` }}
              />
            </div>
          );
        
        
          const renderSceneView = () => {
            const sceneElem = sceneElements[viewingScene];
            if (!sceneElem) return null;
        
            return (
              <div className="relative h-48" onDragOver={(e) => e.preventDefault()}>
                <div>{renderSceneLayers(sceneElem, viewingScene)}</div>
                <div
                  className="w-[2px] bg-[#f87171] absolute top-0 bottom-0 z-20"
                  style={{ left: `${nowPct}%` }}
                />
              </div>
            );
          };
        
          return (
            <div className="flex flex-col space-y-6">
              <SeekPlayer
                viewMode={viewMode}
                sceneIndex={viewingScene}
                perSceneLength={perSceneLength}
              />
        
              {sceneElements.length !== 0 && (
                <div className="flex border-b border-gray-600">
                  <button
                    className={`text-white px-4 py-2 ${viewMode === "master" ? "bg-gray-700" : "hover:bg-gray-800"
                      }`}
                    onClick={() => setViewMode("master")}
                  >
                    All Scenes
                  </button>
        
                  <button
                    className={`text-white px-4 py-2 ${viewMode === "scene" ? "bg-gray-700" : "hover:bg-gray-800"
                      }`}
                    onClick={() => {
                      setViewMode("scene");
                      setViewingScene(currentSceneIndex);
                      handleSceneClick(currentSceneIndex);
                    }}
                  >
                    Scene {currentSceneIndex + 1}
                  </button>
                </div>
              )}
        
              {viewMode === "master" ? renderMasterView() : renderSceneView()}
            </div>
          );
        });
        