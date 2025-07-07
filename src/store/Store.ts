import { makeAutoObservable } from 'mobx'
import { fabric } from 'fabric'
import {
  getUid,
  isHtmlAudioElement,
  isHtmlImageElement,
  isHtmlVideoElement,
} from '@/utils'
import anime from 'animejs'
import {
  MenuOption,
  EditorElement,
  Animation,
  TimeFrame,
  VideoEditorElement,
  AudioEditorElement,
  Placement,
  ImageEditorElement,
  Effect,
  TextEditorElement,
  SvgEditorElement,
  SceneEditorElement,
  Scene,
  SceneLayer,
} from '../types'
import { FabricUitls } from '@/utils/fabric-utils'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'
import { handstandAnimation, walkingAnimations } from '@/utils/animations'
import { API_URL, GLOBAL_ELEMENTS_TIME, HANDSTAND, hideLoading, SCENE_ELEMENTS_LAYERS_TIME, SCENE_ELEMENTS_TIME, showLoading, WALKING } from '@/utils/constants'
import { initializeSceneObjectsIfMissing, loopAnimate, popAnimate } from './Hepler'
export class Store {
  canvas: fabric.Canvas | null
  backgroundColor: string
  selectedMenuOption: MenuOption
  audios: string[]
  videos: string[]
  images: string[]
  svgs: string[]
  scenes: Scene[] = [];
  editorElements: EditorElement[]
  selectedElement: EditorElement | null
  maxTime: number
  animations: Animation[]
  animationTimeLine: anime.AnimeTimelineInstance
  playing: boolean
  currentKeyFrame: number
  fps: number
  possibleVideoFormats: string[] = ['mp4', 'webm']
  selectedVideoFormat: 'mp4' | 'webm'
  audioContext: AudioContext | null = null
  audioSourceNodes: Map<string, MediaElementAudioSourceNode> = new Map()
  copiedElement: EditorElement | null = null
  currentAnimations: anime.AnimeInstance[] = []
  showStorylinePopup = false;
  activeSceneIndex: number = 0;
  scenesTotalTime = this.getScenesTotalTime();
  selectLayerObject?: (elementId: string) => void;
  audioRegistry: Map<string, HTMLAudioElement> = new Map();
  _lastTime: number = 0
  previewCanvas: fabric.Canvas | null = null;

  constructor() {
    this.canvas = null
    this.videos = []
    this.images = []
    this.svgs = []
    this.audios = []
    this.editorElements = []
    this.backgroundColor = '#404040'
    this.maxTime = this.getMaxTime()
    this.playing = false
    this.currentKeyFrame = 0
    this.selectedElement = null
    this.fps = 60
    this.animations = []
    this.animationTimeLine = anime.timeline()
    this.selectedMenuOption = 'Video'
    this.selectedVideoFormat = 'mp4'

    makeAutoObservable(this)
  }



    setPreviewCanvas(canvas: fabric.Canvas | null) {
    this.previewCanvas = canvas;
  }






  getMaxTime(): number {
    const sceneMax = this.scenes.reduce(
      (maxEnd, scene) => Math.max(maxEnd, scene.timeFrame.end),
      0
    );
    const globalMs = GLOBAL_ELEMENTS_TIME * 1000;
    return Math.max(sceneMax, globalMs);
  }

  getScenesTotalTime(): number {
    if (this.scenes.length === 0) return 0;
    return this.scenes.reduce(
      (maxEnd, scene) => Math.max(maxEnd, scene.timeFrame.end),
      0
    );
  }
  refreshMaxTime() {
    this.maxTime = this.getMaxTime();
  }
  setActiveScene(index: number) {
    this.activeSceneIndex = index;
    this.refreshElements();
  }

  addSceneResource(scene: Scene) {
    const SCENE_DURATION_MS = SCENE_ELEMENTS_TIME * 1000;
    const NESTED_DURATION_MS = SCENE_ELEMENTS_LAYERS_TIME * 1000;
    const idx = this.scenes.length;
    const sceneId = `scene-${idx}`;

    if (this.scenes.some(s => s.id === sceneId)) {
      console.warn(`Scene ${sceneId} already exists—skipping duplicate.`);
      return;
    }

    const sceneStart = idx * SCENE_DURATION_MS;
    const sceneEnd = sceneStart + SCENE_DURATION_MS;


    const processLayers = <T extends { id?: string }>(
      items: T[] | undefined,
      type: string,
      defaultDuration = NESTED_DURATION_MS
    ) => {
      return (items || []).map((item, i) => {
        const raw = item as T & { timeFrame?: { duration?: number } };
        return {
          ...item,
          id: raw.id ?? `${type}-${idx}-${i}`,
          layerType: type,
          timeFrame: {
            start: sceneStart,
            end: sceneStart + (raw.timeFrame?.duration ?? defaultDuration),
          },
        };
      });
    };



    const bgImage = scene.backgrounds?.[0]?.background_url || null;
    const nestedBgLayers = processLayers(scene.backgrounds?.slice(1), "background");
    const nestedGifLayers = processLayers(scene.gifs, "svg").map((gif, i) => ({
      ...gif,
      calculatedPosition: scene.gifs?.length ? this.calculateSvgPositions(scene.gifs.length)[i] : null
    }));
    const nestedAnimLayers = processLayers(scene.animations, "animation");
    const nestedElemLayers = processLayers(scene.elements, "element");


    const textArray = scene.text || [];
    const nestedTextLayers = textArray.length > 0 ? [{
      id: `text-${idx}`,
      value: textArray[0],
      layerType: "text" as const,
      placement: {
        x: 20, y: 20,
        width: (this.canvas?.width ?? 800) - 40,
        height: undefined,
      },
      properties: { fontSize: 24, fontFamily: "Arial", fill: "#000" },
      timeFrame: { start: sceneStart, end: sceneStart + NESTED_DURATION_MS },
    }] : [];



    const ttsAudioUrl = scene.tts_audio_url?.[0] || null;
    console.log(`ttsAudioUrl`)
    console.log(ttsAudioUrl)
    const fullUrl = `${API_URL}${ttsAudioUrl}`
    const nestedTtsLayers = ttsAudioUrl ? [{
      id: `tts-${idx}`,
      audioUrl: ttsAudioUrl,
      layerType: "tts" as const,
      timeFrame: { start: sceneStart, end: sceneStart + NESTED_DURATION_MS },
      played: false,

      audioElement: Object.assign(new Audio(fullUrl), { preload: 'auto' })
    }] : [];

    // Create scene object
    const sceneObj = {
      id: sceneId,
      name: `Scene ${idx + 1}`,
      layerType: "scene" as const,
      bgImage,
      timeFrame: { start: sceneStart, end: sceneEnd },
      backgrounds: nestedBgLayers,
      gifs: nestedGifLayers,
      animations: nestedAnimLayers,
      elements: nestedElemLayers,
      text: nestedTextLayers,
      tts: nestedTtsLayers,
    };
    //@ts-ignore
    this.scenes.push(sceneObj);
    const sceneElem: SceneEditorElement = {
      id: sceneObj.id,
      name: sceneObj.name,
      type: "scene",
      //@ts-ignore
      placement: {
        x: 0, y: 0,
        width: this.canvas?.width ?? 800,
        height: this.canvas?.height ?? 600,
      },
      timeFrame: sceneObj.timeFrame,
      properties: {
        sceneIndex: idx,
        bgImage: sceneObj.bgImage,
        //@ts-ignore
        backgrounds: sceneObj.backgrounds,
        //@ts-ignore
        gifs: sceneObj.gifs,
        //@ts-ignore
        animations: sceneObj.animations,
        elements: sceneObj.elements,
        //@ts-ignore
        text: sceneObj.text,
        tts: sceneObj.tts,
      },
      fabricObject: undefined,
    };
    this.editorElements.push(sceneElem);

    this.maxTime = this.getMaxTime();
    this.scenesTotalTime = this.getScenesTotalTime();
    this.refreshAnimations();
  }

  private calculateSvgPositions(count: number): { x: number, y: number, width: number, height: number }[] {
    if (count === 0) return [];
    const canvasWidth = this.canvas?.width || 800;
    const canvasHeight = this.canvas?.height || 600;
    const gap = 40;
    const svgWidth = 200;
    const svgHeight = 200;
    if (count === 1) {
      return [{
        x: (canvasWidth - svgWidth) / 2,
        y: (canvasHeight - svgHeight) / 2,
        width: svgWidth,
        height: svgHeight
      }];
    }
    const totalWidth = (count * svgWidth) + ((count - 1) * gap);
    const startX = (canvasWidth - totalWidth) / 2;

    return Array.from({ length: count }).map((_, i) => ({
      x: startX + (i * (svgWidth + gap)),
      y: (canvasHeight - svgHeight) / 2,
      width: svgWidth,
      height: svgHeight
    }));
  }
  setShowStorylinePopup(value: boolean) {
    this.showStorylinePopup = value;
  }
  createStoryline() {
    this.setShowStorylinePopup(true);
  }
  moveElement(draggedIndex: number, hoveredIndex: number) {
    const updatedElements = [...this.editorElements]
    const [draggedElement] = updatedElements.splice(draggedIndex, 1)
    updatedElements.splice(hoveredIndex, 0, draggedElement)
    this.setEditorElements(updatedElements)
  }
  reorderFabricObjects(draggedIndex: number, hoveredIndex: number) {
    const draggedElement = this.editorElements[draggedIndex]
    const hoveredElement = this.editorElements[hoveredIndex]
    const draggedFabricObject = draggedElement.fabricObject
    const hoveredFabricObject = hoveredElement.fabricObject
    if (draggedFabricObject && hoveredFabricObject) {
      const draggedIndexOnCanvas = this.canvas
        ?.getObjects()
        .indexOf(draggedFabricObject)
      const hoveredIndexOnCanvas = this.canvas
        ?.getObjects()
        .indexOf(hoveredFabricObject)
      if (
        draggedIndexOnCanvas !== undefined &&
        hoveredIndexOnCanvas !== undefined
      ) {
        if (draggedIndex < hoveredIndex) {
          draggedFabricObject.moveTo(hoveredIndexOnCanvas + 1)
        } else {
          draggedFabricObject.moveTo(hoveredIndexOnCanvas)
        }
        this.canvas?.renderAll()
      } else {
        console.error(
          'Error: Could not find valid indices for dragged or hovered objects.'
        )
      }
    }
  }
  cutElement() {
    if (!this.selectedElement) {
      console.warn('⚠️ No layer selected to cut.')
      return
    }
    if (this.copiedElement) {
      console.warn('⚠️ Clipboard not empty—overwriting with new cut.')
    }
    this.copiedElement = this.selectedElement
    if (this.selectedElement.fabricObject) {
      this.canvas?.remove(this.selectedElement.fabricObject)
      this.canvas?.renderAll()
    }
    this.removeEditorElement(this.selectedElement.id)
    this.selectedElement = null
    console.log('✂️ CUT element with ID:', this.copiedElement.id)
  }

  copyElement() {
    if (!this.selectedElement) {
      console.warn('⚠️ No layer selected for copying.')
      return
    }

    if (this.copiedElement) {
      console.warn('⚠️ Already copied a layer. Paste before copying again.')
      return
    }

    this.selectedElement.fabricObject?.clone((cloned: fabric.Object) => {
      if (!cloned) {
        console.error('🚨 Failed to clone fabric object!')
        return
      }

      cloned.set({
        left: this.selectedElement?.placement.x,
        top: this.selectedElement?.placement.y,
        selectable: true,
        evented: true,
      })

      this.copiedElement = {
        ...this.selectedElement,
        id: getUid(),
        name: `Layer (${this.selectedElement?.id})`,
        fabricObject: cloned,
      } as EditorElement

      console.log('✅ Copied Layer:', this.copiedElement.name)
    })
  }

  pasteElement() {
    if (!this.copiedElement) {
      console.warn('⚠️ No copied layer! Copy one first.');
      return;
    }

    const elementToPaste = { ...this.copiedElement };
    this.copiedElement = null;

    if (elementToPaste) {
      elementToPaste.fabricObject?.clone((cloned: fabric.Object) => {
        if (!cloned) {
          console.error('❌ Failed to clone Fabric.js object.');
          return;
        }
        let newProperties = { ...elementToPaste.properties };

        if (elementToPaste.type === 'audio') {
          const newAudioId = getUid();
          const newAudioElement = document.createElement('audio');
          newAudioElement.id = `audio-${newAudioId}`;
          newAudioElement.src = elementToPaste.properties.src;
          document.body.appendChild(newAudioElement);
          newProperties = {
            ...newProperties,
            elementId: newAudioElement.id,
          };
        }

        if (elementToPaste.type === 'video') {
          const newVideoId = getUid();
          const newVideoElement = document.createElement('video');
          newVideoElement.id = `video-${newVideoId}`;
          newVideoElement.src = elementToPaste.properties.src;
          newVideoElement.muted = false;
          document.body.appendChild(newVideoElement);
          newProperties = {
            ...newProperties,
            elementId: newVideoElement.id,
          };
        }

        const newElement = {
          ...elementToPaste,
          id: getUid(),
          name: `${elementToPaste.name}`,
          placement: {
            ...elementToPaste.placement,
            x: elementToPaste.placement.x + 50,
            y: elementToPaste.placement.y + 20,
          },
          timeFrame: {
            start: elementToPaste.timeFrame.start,
            end: elementToPaste.timeFrame.end,
          },
          properties: newProperties,
          fabricObject: cloned,
        } as EditorElement;

        this.addEditorElement(newElement);
        this.canvas?.add(cloned);
        this.canvas?.renderAll();

        console.log('✅ Pasted Full Layer:', newElement.name);
      });
    } else {
      console.warn('⚠️ Frame too small to paste!');
    }
  }

  deleteElement() {
    if (!this.selectedElement) {
      console.warn('⚠️ No layer selected to delete.')
      return
    }
    const elementToDelete = this.selectedElement
    this.removeEditorElement(elementToDelete.id)
    if (elementToDelete.fabricObject) {
      this.canvas?.remove(elementToDelete.fabricObject)
    }
    this.setSelectedElement(null)
    this.canvas?.discardActiveObject()
    this.canvas?.renderAll()
    this.refreshElements()
  }

  splitElement() {
    if (!this.selectedElement) {
      console.warn('⚠️ Cannot split audio layers.')
      return
    }
    const selectedElement = this.selectedElement
    const { start, end } = selectedElement.timeFrame
    const totalDuration = end - start
    if (totalDuration < 2000) {
      console.warn('⚠️ Frame too small to split!')
      return
    }
    const midTime = Math.floor((start + end) / 2)
    this.updateEditorElementTimeFrame(selectedElement, { end: midTime })
    selectedElement.fabricObject?.clone((cloned: fabric.Object) => {
      if (!cloned) {
        console.error('❌ Failed to clone Fabric.js object.')
        return
      }
      let newProperties = { ...selectedElement.properties }
      if (selectedElement.type === 'audio') {
        const newAudioId = getUid()
        const newAudioElement = document.createElement('audio')
        newAudioElement.id = `audio-${newAudioId}`
        newAudioElement.src = selectedElement.properties.src
        document.body.appendChild(newAudioElement)
        newProperties = {
          ...newProperties,
          elementId: newAudioElement.id,
        }
      }
      if (selectedElement.type === 'video') {
        const newVideoId = getUid()
        const newVideoElement = document.createElement('video')
        newVideoElement.id = `video-${newVideoId}`
        newVideoElement.src = selectedElement.properties.src
        newVideoElement.muted = false
        document.body.appendChild(newVideoElement)
        newProperties = {
          ...newProperties,
          elementId: newVideoElement.id,
        }
      }
      const newElement = {
        ...selectedElement,
        id: getUid(),
        name: `Layer (${selectedElement.id})`,
        type: selectedElement.type,
        placement: {
          ...selectedElement.placement,
          x: selectedElement.placement.x + 50,
          y: selectedElement.placement.y + 20,
        },
        timeFrame: { start: midTime, end: end },
        properties: newProperties,
        fabricObject: cloned,
      } as EditorElement
      this.addEditorElement(newElement)
      this.canvas?.add(cloned)
      this.canvas?.renderAll()
      this.refreshElements()
    })
  }
  deleteSceneLayer(sceneIndex: number, layerId: string) {
    const scene = this.scenes[sceneIndex];
    if (!scene) return;
    const removeById = <T extends { id: string }>(arr?: T[]) =>
      arr?.filter(item => item.id !== layerId);
    //@ts-ignore
    scene.backgrounds = removeById(scene.backgrounds);
    //@ts-ignore
    scene.gifs = removeById(scene.gifs);
    //@ts-ignore
    scene.animations = removeById(scene.animations);
    //@ts-ignore
    scene.elements = removeById(scene.elements);
    //@ts-ignore
    scene.text = removeById(scene.text);
    scene.tts = removeById(scene.tts);
    if (this.canvas) {
      const toRemove = this.canvas
        .getObjects()
        .filter(obj => obj.data?.elementId === layerId);
      toRemove.forEach(obj => this.canvas!.remove(obj));
    }
    this.canvas?.renderAll();
  }

  setFontSize(size: number) {
    if (!this.selectedElement || this.selectedElement.type !== 'text') return
    this.selectedElement.properties.fontSize = size
      ; (this.selectedElement.fabricObject as fabric.Text)?.set('fontSize', size)
    this.updateEditorElement(this.selectedElement)
    this.canvas?.renderAll()
  }
  setTextColor(color: string) {
    if (!this.selectedElement || this.selectedElement.type !== 'text') return
    this.selectedElement.properties.textColor = color
      ; (this.selectedElement.fabricObject as fabric.Text)?.set('fill', color)
    this.updateEditorElement(this.selectedElement)
    this.canvas?.renderAll()
  }
  toggleBold() {
    if (!this.selectedElement || this.selectedElement.type !== 'text') return
    const isBold = this.selectedElement.properties.fontWeight === 'bold'
    this.selectedElement.properties.fontWeight = isBold ? 'normal' : 'bold'
      ; (this.selectedElement.fabricObject as fabric.Text)?.set(
        'fontWeight',
        isBold ? 'normal' : 'bold'
      )
    this.updateEditorElement(this.selectedElement)
    this.canvas?.renderAll()
  }
  toggleItalic() {
    if (!this.selectedElement || this.selectedElement.type !== 'text') return
    const isItalic = this.selectedElement.properties.fontStyle === 'italic'
    this.selectedElement.properties.fontStyle = isItalic ? 'normal' : 'italic'
      ; (this.selectedElement.fabricObject as fabric.Text)?.set(
        'fontStyle',
        isItalic ? 'normal' : 'italic'
      )
    this.updateEditorElement(this.selectedElement)
    this.canvas?.renderAll()
  }
  setFontFamily(fontFamily: string) {
    if (!this.selectedElement || this.selectedElement.type !== 'text') return
    this.selectedElement.properties.fontFamily = fontFamily
      ; (this.selectedElement.fabricObject as fabric.Text)?.set(
        'fontFamily',
        fontFamily
      )
    this.updateEditorElement(this.selectedElement)
    this.canvas?.renderAll()
  }
  get currentTimeInMs() {
    return (this.currentKeyFrame * 1000) / this.fps
  }
  setCurrentTimeInMs(time: number) {
    this.currentKeyFrame = Math.floor((time / 1000) * this.fps)

  }
  setSelectedMenuOption(selectedMenuOption: MenuOption) {
    this.selectedMenuOption = selectedMenuOption
  }
  setCanvas(canvas: fabric.Canvas | null) {
    this.canvas = canvas
    if (canvas) {
      canvas.backgroundColor = this.backgroundColor
    }
  }
  setBackgroundColor(backgroundColor: string) {
    this.backgroundColor = backgroundColor
    if (this.canvas) {
      this.canvas.backgroundColor = backgroundColor
    }
  }
  updateEffect(id: string, effect: Effect) {
    const index = this.editorElements.findIndex((element) => element.id === id)
    const element = this.editorElements[index]
    if (isEditorVideoElement(element) || isEditorImageElement(element)) {
      element.properties.effect = effect
    }
    this.refreshElements()
  }
  setVideos(videos: string[]) {
    this.videos = videos
  }
  addVideoResource(video: string) {
    this.videos = [...this.videos, video]
  }
  addAudioResource(audio: string) {
    this.audios = [...this.audios, audio]
  }
  addImageResource(image: string) {
    this.images = [...this.images, image]
  }

  addSvgResource(svg: string) {
    this.svgs = [...this.svgs, svg]
    // this.svgs.push(svg);
  }
  addAnimation(animation: Animation) {
    this.animations = [...this.animations, animation]
    this.refreshAnimations()
  }
  updateAnimation(id: string, animation: Animation) {
    const index = this.animations.findIndex((a) => a.id === id)
    this.animations[index] = animation
    this.refreshAnimations()
  }
  refreshAnimations() {
    anime.remove(this.animationTimeLine)
    this.animationTimeLine = anime.timeline({
      duration: this.getMaxTime(),
      autoplay: false,
    })
    for (let i = 0; i < this.animations.length; i++) {
      const animation = this.animations[i]
      const editorElement = this.editorElements.find(
        (element) => element.id === animation.targetId
      )
      const fabricObject = editorElement?.fabricObject
      if (!editorElement || !fabricObject) {
        continue
      }
      fabricObject.clipPath = undefined
      switch (animation.type) {
        case 'fadeIn': {
          this.animationTimeLine.add(
            {
              opacity: [0, 1],
              duration: animation.duration,
              targets: fabricObject,
              easing: 'linear',
            },
            editorElement.timeFrame.start
          )
          break
        }
        case 'fadeOut': {
          this.animationTimeLine.add(
            {
              opacity: [1, 0],
              duration: animation.duration,
              targets: fabricObject,
              easing: 'linear',
            },
            editorElement.timeFrame.end - animation.duration
          )
          break
        }
        case 'slideIn': {
          const direction = animation.properties.direction
          const targetPosition = {
            left: editorElement.placement.x,
            top: editorElement.placement.y,
          }
          const startPosition = {
            left:
              direction === 'left'
                ? -editorElement.placement.width
                : direction === 'right'
                  ? this.canvas?.width
                  : editorElement.placement.x,
            top:
              direction === 'top'
                ? -editorElement.placement.height
                : direction === 'bottom'
                  ? this.canvas?.height
                  : editorElement.placement.y,
          }
          if (animation.properties.useClipPath) {
            const clipRectangle = FabricUitls.getClipMaskRect(editorElement, 50)
            fabricObject.set('clipPath', clipRectangle)
          }
          if (
            editorElement.type === 'text' &&
            animation.properties.textType === 'character'
          ) {
            this.canvas?.remove(...editorElement.properties.splittedTexts)
            // @ts-ignore
            editorElement.properties.splittedTexts =
              getTextObjectsPartitionedByCharacters(
                editorElement.fabricObject as fabric.IText,
                editorElement
              )
            editorElement.properties.splittedTexts.forEach((textObject) => {
              this.canvas!.add(textObject)
            })
            const duration = animation.duration / 2
            const delay =
              duration / editorElement.properties.splittedTexts.length
            for (
              let i = 0;
              i < editorElement.properties.splittedTexts.length;
              i++
            ) {
              const splittedText = editorElement.properties.splittedTexts[i]
              const offset = {
                left: splittedText.left! - editorElement.placement.x,
                top: splittedText.top! - editorElement.placement.y,
              }
              this.animationTimeLine.add(
                {
                  left: [
                    startPosition.left! + offset.left,
                    targetPosition.left + offset.left,
                  ],
                  top: [
                    startPosition.top! + offset.top,
                    targetPosition.top + offset.top,
                  ],
                  delay: i * delay,
                  duration: duration,
                  targets: splittedText,
                },
                editorElement.timeFrame.start
              )
            }
            this.animationTimeLine.add(
              {
                opacity: [1, 0],
                duration: 1,
                targets: fabricObject,
                easing: 'linear',
              },
              editorElement.timeFrame.start
            )
            this.animationTimeLine.add(
              {
                opacity: [0, 1],
                duration: 1,
                targets: fabricObject,
                easing: 'linear',
              },
              editorElement.timeFrame.start + animation.duration
            )

            this.animationTimeLine.add(
              {
                opacity: [0, 1],
                duration: 1,
                targets: editorElement.properties.splittedTexts,
                easing: 'linear',
              },
              editorElement.timeFrame.start
            )
            this.animationTimeLine.add(
              {
                opacity: [1, 0],
                duration: 1,
                targets: editorElement.properties.splittedTexts,
                easing: 'linear',
              },
              editorElement.timeFrame.start + animation.duration
            )
          }
          this.animationTimeLine.add(
            {
              left: [startPosition.left, targetPosition.left],
              top: [startPosition.top, targetPosition.top],
              duration: animation.duration,
              targets: fabricObject,
              easing: 'linear',
            },
            editorElement.timeFrame.start
          )
          break
        }
        case 'slideOut': {
          const direction = animation.properties.direction
          const startPosition = {
            left: editorElement.placement.x,
            top: editorElement.placement.y,
          }
          const targetPosition = {
            left:
              direction === 'left'
                ? -editorElement.placement.width
                : direction === 'right'
                  ? this.canvas?.width
                  : editorElement.placement.x,
            top:
              direction === 'top'
                ? -100 - editorElement.placement.height
                : direction === 'bottom'
                  ? this.canvas?.height
                  : editorElement.placement.y,
          }
          if (animation.properties.useClipPath) {
            const clipRectangle = FabricUitls.getClipMaskRect(editorElement, 50)
            fabricObject.set('clipPath', clipRectangle)
          }
          this.animationTimeLine.add(
            {
              left: [startPosition.left, targetPosition.left],
              top: [startPosition.top, targetPosition.top],
              duration: animation.duration,
              targets: fabricObject,
              easing: 'linear',
            },
            editorElement.timeFrame.end - animation.duration
          )
          break
        }
        case 'breathe': {
          const itsSlideInAnimation = this.animations.find(
            (a) => a.targetId === animation.targetId && a.type === 'slideIn'
          )
          const itsSlideOutAnimation = this.animations.find(
            (a) => a.targetId === animation.targetId && a.type === 'slideOut'
          )
          const timeEndOfSlideIn = itsSlideInAnimation
            ? editorElement.timeFrame.start + itsSlideInAnimation.duration
            : editorElement.timeFrame.start
          const timeStartOfSlideOut = itsSlideOutAnimation
            ? editorElement.timeFrame.end - itsSlideOutAnimation.duration
            : editorElement.timeFrame.end
          if (timeEndOfSlideIn > timeStartOfSlideOut) {
            continue
          }
          const duration = timeStartOfSlideOut - timeEndOfSlideIn
          const easeFactor = 4
          const suitableTimeForHeartbeat = ((1000 * 60) / 72) * easeFactor
          const upScale = 1.05
          const currentScaleX = fabricObject.scaleX ?? 1
          const currentScaleY = fabricObject.scaleY ?? 1
          const finalScaleX = currentScaleX * upScale
          const finalScaleY = currentScaleY * upScale
          const totalHeartbeats = Math.floor(
            duration / suitableTimeForHeartbeat
          )
          if (totalHeartbeats < 1) {
            continue
          }
          const keyframes = []
          for (let i = 0; i < totalHeartbeats; i++) {
            keyframes.push({ scaleX: finalScaleX, scaleY: finalScaleY })
            keyframes.push({ scaleX: currentScaleX, scaleY: currentScaleY })
          }
          this.animationTimeLine.add(
            {
              duration: duration,
              targets: fabricObject,
              keyframes,
              easing: 'linear',
              loop: true,
            },
            timeEndOfSlideIn
          )
          break
        }
      }
    }
  }
  removeAnimation(id: string) {
    this.animations = this.animations.filter((animation) => animation.id !== id)
    this.refreshAnimations()
  }
  setSelectedElement(el: EditorElement | null) {
    if (this.selectedElement?.id === el?.id) {
      return;
    }
    this.selectedElement = el;
    if (!this.canvas) return;
    this.canvas.discardActiveObject();
    if (el) {
      const fObj = el.fabricObject;
      if (Array.isArray(fObj) && fObj.length > 0) {
        const selection = new fabric.ActiveSelection(fObj, {
          canvas: this.canvas
        });
        this.canvas.setActiveObject(selection);
      } else if (fObj instanceof fabric.Object) {
        this.canvas.setActiveObject(fObj);
      }
    }
    this.canvas.requestRenderAll();
  }
  updateSelectedElement() {
    this.selectedElement =
      this.editorElements.find(
        (element) => element.id === this.selectedElement?.id
      ) ?? null
  }
  setEditorElements(editorElements: EditorElement[]) {
    this.editorElements = editorElements
    this.updateSelectedElement()
    this.refreshElements()
  }
  updateEditorElement(editorElement: EditorElement) {
    this.setEditorElements(
      this.editorElements.map((element) =>
        element.id === editorElement.id ? editorElement : element
      )
    )
  }

  updateEditorElementTimeFrame(
    editorElement: EditorElement,
    timeFrame: Partial<TimeFrame>
  ) {
    if (timeFrame.start != undefined && timeFrame.start < 0) {
      timeFrame.start = 0
    }
    if (timeFrame.end != undefined && timeFrame.end > this.maxTime) {
      timeFrame.end = this.maxTime
    }
    const newEditorElement = {
      ...editorElement,
      timeFrame: {
        ...editorElement.timeFrame,
        ...timeFrame,
      },
    }
    this.updateVideoElements()
    this.updateAudioElements()
    this.updateEditorElement(newEditorElement)
    this.refreshAnimations()
  }

  updateSceneLayerTimeFrame(
    sceneIndex: number,
    layerId: string,
    timeFrame: Partial<TimeFrame>
  ) {
    const scene = this.scenes[sceneIndex];
    if (!scene) return;

    const { start: sceneStart, end: sceneEnd } = scene.timeFrame;

    // clamp to scene boundaries
    if (timeFrame.start != null && timeFrame.start < sceneStart) {
      timeFrame.start = sceneStart;
    }
    if (timeFrame.end != null && timeFrame.end > sceneEnd) {
      timeFrame.end = sceneEnd;
    }

    const tryUpdate = <
      T extends { id: string; timeFrame: TimeFrame; layerType?: string }
    >(arr?: T[]): boolean => {
      if (!arr) return false;
      const idx = arr.findIndex(l => l.id === layerId);
      if (idx < 0) return false;

      const layer = arr[idx];
      const orig = { ...layer.timeFrame };

      // compute candidate new start/end
      const newStart = timeFrame.start != null
        ? timeFrame.start
        : orig.start;
      let newEnd = timeFrame.end != null
        ? timeFrame.end
        : orig.end;

      // commit the update
      arr[idx] = {
        ...layer,
        timeFrame: { start: newStart, end: newEnd },
      };
      return true;
    };


    if (
      tryUpdate(scene.backgrounds) ||
      tryUpdate(scene.gifs) ||
      tryUpdate(scene.animations) ||
      tryUpdate(scene.elements) ||
      //@ts-ignore
      tryUpdate(scene.text) ||
      tryUpdate(scene.tts)
    ) {

      const elem = this.editorElements.find(
        e => e.type === "scene" && e.properties.sceneIndex === sceneIndex
      ) as SceneEditorElement | undefined;
      if (elem) {
        const p = elem.properties as any;
        tryUpdate(p.backgrounds) ||
          tryUpdate(p.gifs) ||
          tryUpdate(p.animations) ||
          tryUpdate(p.elements) ||
          tryUpdate(p.text) ||
          tryUpdate(p.tts);
      }

      this.updateVideoElements();
      this.updateAudioElements();
      this.refreshAnimations();
    }
  }

  updateSceneTimeFrame(
    sceneIndex: number,
    tf: Partial<TimeFrame>
  ) {
    const scene = this.scenes[sceneIndex];
    if (!scene) return;

    const oldStart = scene.timeFrame.start;
    const oldEnd = scene.timeFrame.end;
    const oldDuration = oldEnd - oldStart;

    const newStart = tf.start != null ? tf.start : oldStart;
    const newEnd = tf.end != null ? tf.end : oldEnd;
    const newDuration = newEnd - newStart;

    if (newStart < 0) throw new Error("Scene start must be ≥ 0");
    if (newEnd <= newStart) throw new Error("Scene end must be > start");

    // Update scene time frame
    scene.timeFrame = { start: newStart, end: newEnd };

    const sceneElem = this.editorElements.find(
      e => e.type === "scene" && e.properties.sceneIndex === sceneIndex
    ) as SceneEditorElement | undefined;
    if (sceneElem) {
      sceneElem.timeFrame = { start: newStart, end: newEnd };
    }

    // NEW: Adjust layer positions without changing durations
    const adjustLayerPositions = (arr?: SceneLayer[]) => {
      arr?.forEach(layer => {
        // Calculate relative position within scene (0-1)
        const positionRatio = (layer.timeFrame.start - oldStart) / oldDuration;

        // Calculate new start position while keeping original duration
        const newLayerStart = newStart + (positionRatio * newDuration);
        const layerDuration = layer.timeFrame.end - layer.timeFrame.start;

        // Apply new position while maintaining duration
        layer.timeFrame = {
          start: Math.max(newStart, Math.min(newLayerStart, newEnd - layerDuration)),
          end: Math.min(newEnd, Math.max(newLayerStart + layerDuration, newStart + layerDuration))
        };

        // Ensure layer doesn't go outside scene boundaries
        if (layer.timeFrame.start < newStart) {
          layer.timeFrame.start = newStart;
          layer.timeFrame.end = newStart + layerDuration;
        }
        if (layer.timeFrame.end > newEnd) {
          layer.timeFrame.end = newEnd;
          layer.timeFrame.start = newEnd - layerDuration;
        }
      });
    };

    //@ts-ignore
    adjustLayerPositions(scene.backgrounds);
    //@ts-ignore
    adjustLayerPositions(scene.gifs);
    //@ts-ignore
    adjustLayerPositions(scene.animations);
    //@ts-ignore
    adjustLayerPositions(scene.elements);
    //@ts-ignore
    adjustLayerPositions(scene.text);
    //@ts-ignore
    adjustLayerPositions(scene.tts);

    if (sceneElem) {
      const p = sceneElem.properties as any;
      adjustLayerPositions(p.backgrounds);
      adjustLayerPositions(p.gifs);
      adjustLayerPositions(p.animations);
      adjustLayerPositions(p.elements);
      adjustLayerPositions(p.text);
      adjustLayerPositions(p.tts);
    }

    // KEEP ALL EXISTING CODE BELOW EXACTLY AS IS
    const startDelta = newStart - oldStart;
    if (startDelta !== 0) {
      const shiftNested = <T extends { timeFrame: TimeFrame }>(arr?: T[]) => {
        arr?.forEach(layer => {
          layer.timeFrame = {
            start: layer.timeFrame.start + startDelta,
            end: layer.timeFrame.end + startDelta,
          };
        });
      };

      shiftNested(scene.backgrounds);
      shiftNested(scene.gifs);
      shiftNested(scene.animations);
      shiftNested(scene.elements);
      shiftNested(scene.text);
      shiftNested(scene.tts);

      if (sceneElem) {
        const p = sceneElem.properties as any;
        shiftNested(p.backgrounds);
        shiftNested(p.gifs);
        shiftNested(p.animations);
        shiftNested(p.elements);
        shiftNested(p.text);
        shiftNested(p.tts);
      }
    }

    const durationDelta = newDuration - oldDuration;
    if (durationDelta !== 0) {
      for (let i = sceneIndex + 1; i < this.scenes.length; i++) {
        const s = this.scenes[i];
        s.timeFrame = {
          start: s.timeFrame.start + durationDelta,
          end: s.timeFrame.end + durationDelta,
        };
        const ee = this.editorElements.find(
          e => e.type === "scene" && e.properties.sceneIndex === i
        ) as SceneEditorElement | undefined;
        if (ee) {
          ee.timeFrame = {
            start: ee.timeFrame.start + durationDelta,
            end: ee.timeFrame.end + durationDelta,
          };
        }

        const shiftNested = <T extends { timeFrame: TimeFrame }>(arr?: T[]) => {
          arr?.forEach(layer => {
            layer.timeFrame = {
              start: layer.timeFrame.start + durationDelta,
              end: layer.timeFrame.end + durationDelta,
            };
          });
        };
        shiftNested(s.backgrounds);
        shiftNested(s.gifs);
        shiftNested(s.animations);
        shiftNested(s.elements);
        shiftNested(s.text);
        shiftNested(s.tts);

        if (ee) {
          const p = ee.properties as any;
          shiftNested(p.backgrounds);
          shiftNested(p.gifs);
          shiftNested(p.animations);
          shiftNested(p.elements);
          shiftNested(p.text);
          shiftNested(p.tts);
        }
      }
    }

    this.maxTime = this.getMaxTime();
    this.scenesTotalTime = this.getScenesTotalTime();
    this.refreshAnimations();
    this.setActiveScene(sceneIndex)

  }

  addEditorElement(editorElement: EditorElement) {
    const activeScene = this.editorElements.find(
      el => el.type === 'scene' &&
        (el as SceneEditorElement).properties.sceneIndex === this.activeSceneIndex
    ) as SceneEditorElement | undefined;
    if (activeScene) {
      if (!activeScene.properties.elements) {
        activeScene.properties.elements = [];
      }
      activeScene.properties.elements.push(editorElement);
      const sceneObj = this.scenes[this.activeSceneIndex];
      if (!sceneObj.elements) {
        sceneObj.elements = [];
      }
      sceneObj.elements.push(editorElement);
      this.updateEditorElement(activeScene);
    } else {
      this.setEditorElements([...this.editorElements, editorElement]);
    }
    console.groupEnd();
  }



  removeEditorElement(id: string) {
    this.setEditorElements(
      this.editorElements.filter((editorElement) => editorElement.id !== id)
    )
    this.refreshElements()
  }
  setMaxTime(maxTime: number) {
    const sceneCount = this.scenes.length;
    if (sceneCount > 0) {
      this.scenes.forEach((scene, index) => {
        const sceneEditorElement = this.editorElements.find(
          e =>
            e.type === "scene" &&
            (e as SceneEditorElement).properties.sceneIndex === index
        ) as SceneEditorElement | undefined;
        if (sceneEditorElement) {
          sceneEditorElement.timeFrame = {
            start: scene.timeFrame.start,
            end: scene.timeFrame.end
          };
        }
      });
    }
    const sceneTotalTime = this.getScenesTotalTime();
    this.maxTime = Math.max(maxTime, sceneTotalTime);
    this.refreshAnimations();
  }

  clearCurrentAnimations() {
    if (this.currentAnimations && this.currentAnimations.length) {
      this.currentAnimations.forEach((anim) => anim.pause());
    }
    this.currentAnimations = [];
  }
  assignAnimationToSelectedSvg(animationType: string) {
    if (!this.selectedElement || this.selectedElement.type !== 'svg') {
      console.warn('No SVG selected.');
      return;
    }
    this.clearCurrentAnimations();
    this.selectedElement.properties.animationType = animationType;
    this.updateEditorElement(this.selectedElement);
    console.log(
      `Assigned animation: ${animationType} to ${this.selectedElement.id}`
    );
  }
  applyWalkingAnimation(svgElement: fabric.Group) {
    if (!svgElement) return;
    this.clearCurrentAnimations();
    const allObjects = this.getAllObjectsRecursively(svgElement);
    console.log(
      'Available SVG Parts:',
      allObjects.map((obj) => (obj as any).dataName || obj.name)
    );
    Object.entries(walkingAnimations).forEach(([partId, animationData]) => {
      const targetElement = allObjects.find(
        (obj) => ((obj as any).dataName || obj.name) === partId
      );
      if (!targetElement) {
        console.warn(`⚠️ Missing SVG part: ${partId}, skipping animation.`);
        return;
      }
      console.log(`✅ Found SVG part: ${partId}, applying animation`);
      const animInstance = anime({
        targets: { angle: targetElement.angle || 0 },
        angle: animationData.keys.map((k) => k.v),
        duration: 1600,
        easing: 'linear',
        loop: true,
        update: (anim) => {
          targetElement.set('angle', Number(anim.animations[0].currentValue));
          this.canvas?.renderAll();
        },
      });
      this.currentAnimations.push(animInstance);
    });
    const groupAnim = anime({
      targets: svgElement,
      left: [
        {
          value: (svgElement.left || 0) + 300,
          duration: 10000,
          easing: 'linear',
        },
        {
          value: (svgElement.left || 0) + 300,
          duration: 500,
          easing: 'linear',
        },
        { value: svgElement.left || 0, duration: 0 },
      ],
      loop: true,
      update: () => {
        this.canvas?.renderAll();
      },
    });
    this.currentAnimations.push(groupAnim);
  }
  playSelectedSvgAnimation() {
    if (!this.selectedElement || this.selectedElement.type !== 'svg') {
      console.warn('⚠️ No SVG selected or invalid selection.');
      return;
    }
    this.clearCurrentAnimations();
    const animationType = this.selectedElement.properties.animationType;
    const fabricObject = this.selectedElement.fabricObject as fabric.Group;
    if (!fabricObject) {
      console.warn('⚠️ No fabric object found for the selected SVG.');
      return;
    }
    console.log(
      `  🎬 Playing animation: ${animationType} for SVG ID: ${this.selectedElement.id}`
    );
    if (animationType === WALKING) {
      this.applyWalkingAnimation(fabricObject);
    } else if (animationType === HANDSTAND) {
      this.applyHandstandAnimation(fabricObject);
    } else {
      console.warn('⚠️ Invalid animation type. No animation applied.');
    }
  }
  setPlaying(playing: boolean) {
    this.playing = playing;
    this.updateVideoElements();
    this.updateAudioElements();
    if (playing) {
      this._lastTime = -Infinity;
      this.scenes.forEach(scene =>
        scene.fabricObjects?.gifs.forEach(obj => {
          const tids: number[] = (obj as any).__timeoutIds || [];
          tids.forEach(id => clearTimeout(id));
          delete (obj as any).__timeoutIds;
          delete (obj as any).__hasPopped;
          delete (obj as any).__isLooping;
        })
      );
      this.playSelectedSvgAnimation();
      this.startedTime = Date.now();
      this.startedTimePlay = this.currentTimeInMs;
      requestAnimationFrame(() => {
        this.playFrames();
      });
    } else {
      this.currentAnimations.forEach(anim => anim.pause());
      this.scenes.forEach(scene => {
        scene.tts?.forEach((ttsItem: any) => {
          const audio = ttsItem.audioElement as HTMLAudioElement | undefined;
          if (audio && !audio.paused) {
            audio.pause();
          }
          ttsItem.played = false;
        });
        scene.fabricObjects?.gifs.forEach(obj => {
          const tids: number[] = (obj as any).__timeoutIds || [];
          tids.forEach(id => clearTimeout(id));
          delete (obj as any).__timeoutIds;

          delete (obj as any).__isLooping;
          delete (obj as any).__hasPopped;
        });
      });
    }
  }




  applyHandstandAnimation(svgElement: fabric.Group) {
    if (!svgElement) return;
    this.clearCurrentAnimations();
    console.log(
      `🤸 Handstand animation started for SVG ID: ${this.selectedElement?.id}`
    );
    const allObjects = this.getAllObjectsRecursively(svgElement);
    console.log(
      '🔍 Available SVG Parts:',
      allObjects.map((obj) => (obj as any).dataName || obj.name)
    );
    Object.entries(handstandAnimation).forEach(([partId, animationData]) => {
      const targetElement = allObjects.find(
        (obj) => ((obj as any).dataName || obj.name) === partId
      );
      if (!targetElement) {
        console.warn(`⚠️ Missing SVG part: ${partId}, skipping animation.`);
        return;
      }
      targetElement.set('angle', 0);
      if (partId === 'hand') {
        targetElement.setPositionByOrigin(new fabric.Point(-1, -180), 'center', 'top');
      }
      const animInstance = anime({
        targets: { angle: targetElement.angle || 0 },
        angle: animationData.keys.map((k) => k.v),
        duration: 3000,
        easing: 'linear',
        loop: true,
        update: (anim) => {
          targetElement.set('angle', Number(anim.animations[0].currentValue));
          this.canvas?.renderAll();
        },
      });
      this.currentAnimations.push(animInstance);
    });
  }
  startedTime = 0
  startedTimePlay = 0
  playFrames() {
    if (!this.playing) {
      return
    }
    const elapsedTime = Date.now() - this.startedTime
    const newTime = this.startedTimePlay + elapsedTime
    this.updateTimeTo(newTime)
    if (newTime > this.maxTime) {
      this.currentKeyFrame = 0
      this.setPlaying(false)
    } else {
      requestAnimationFrame(() => {
        this.playFrames()
      })
    }
  }




  updateTimeTo(newTime: number) {
    const forward = newTime > this._lastTime;
    this._lastTime = newTime;
    this.setCurrentTimeInMs(newTime);
    this.animationTimeLine.seek(newTime);
    if (this.canvas) {
      this.canvas.backgroundColor = this.backgroundColor;
    }

    const sceneSegments = this.editorElements
      .filter(e => e.type === "scene")
      .sort((a, b) =>
        (a as SceneEditorElement).properties.sceneIndex -
        (b as SceneEditorElement).properties.sceneIndex
      )
      .map(sc => {
        const se = sc as SceneEditorElement;
        return { sc: se, start: se.timeFrame.start, end: se.timeFrame.end };
      });

    const toggleVisibility = (
      objects: fabric.Object[] = [],
      sources: { timeFrame: { start: number; end: number } }[] = [],
      doPop: boolean = false,
      doLoop: boolean = false
    ) => {
      objects.forEach((obj, idx) => {
        const src = sources[idx];
        if (!src || !obj.set) return;
        const inRange = newTime >= src.timeFrame.start && newTime <= src.timeFrame.end;
        if (!inRange && (obj as any).__isLooping) {
          delete (obj as any).__isLooping;
        }
        obj.set({ visible: inRange });
        if (inRange) {
          this.canvas?.add(obj);

          if (doPop && forward && !(obj as any).__hasPopped) {
            (obj as any).__hasPopped = true;
            const timeoutId = window.setTimeout(() => popAnimate(obj, this.canvas), idx * 1000);
            (obj as any).__timeoutIds = ((obj as any).__timeoutIds || []).concat(timeoutId);
          }

          if (doLoop && forward && !(obj as any).__isLooping) {
            (obj as any).__isLooping = true;
            const timeoutId = window.setTimeout(() => loopAnimate(obj, this.canvas), idx * 1000);
            (obj as any).__timeoutIds = ((obj as any).__timeoutIds || []).concat(timeoutId);
          }
        }
      });
    };

    sceneSegments.forEach(({ sc }) => {
      const idx = sc.properties.sceneIndex;
      const scene = this.scenes[idx];
      initializeSceneObjectsIfMissing(
        scene,
        idx,
        this.editorElements as SceneEditorElement[],
        this.playing,
        forward,
        newTime,
        (ttsItem, time) => this._maybeStartTtsClip(ttsItem, time)
      );
      if (!scene.fabricObjects) return;
      if (scene.fabricObjects.background) {
        const inRange = newTime >= sc.timeFrame.start && newTime <= sc.timeFrame.end;
        scene.fabricObjects.background.set({ visible: inRange });
        if (inRange) this.canvas?.add(scene.fabricObjects.background);
      }
      const is0to3000 = sc.timeFrame.start === 0 && sc.timeFrame.end === SCENE_ELEMENTS_LAYERS_TIME;
      toggleVisibility(scene.fabricObjects.gifs, scene.gifs, true, is0to3000);
      toggleVisibility(scene.fabricObjects.backgrounds, scene.backgrounds);
      toggleVisibility(scene.fabricObjects.texts, scene.text);
      toggleVisibility(scene.fabricObjects.elements, scene.elements);
      toggleVisibility(scene.fabricObjects.tts, scene.tts);
    });
    this.editorElements.forEach((el) => {
      if (el.type !== "scene") {
        if (!el.fabricObject) return;
        const isInside =
          el.timeFrame.start <= newTime && newTime <= el.timeFrame.end;
        el.fabricObject.visible = isInside;
      }
    });
    this.updateAudioElements();
    this.canvas?.requestRenderAll();
  }


  _maybeStartTtsClip(ttsItem: any, now: number) {
    const { start } = ttsItem.timeFrame
    const audio = ttsItem.audioElement as HTMLAudioElement | undefined
    if (!audio) return
    audio.currentTime = Math.max(0, (now - start) / 1000)
    audio.play().catch(console.error)
    ttsItem.isAudioPlaying = true
    ttsItem.played = true
    audio.addEventListener('ended', () => {
      ttsItem.isAudioPlaying = false
    })
  }

  getAllObjectsRecursively(obj: fabric.Object): fabric.Object[] {
    let results: fabric.Object[] = [obj]
    if (obj.type === 'group') {
      const group = obj as fabric.Group
      group.getObjects().forEach((child) => {
        results = results.concat(this.getAllObjectsRecursively(child))
      })
    }
    return results
  }
  getCurrentTimeFrame(duration?: number): TimeFrame {
    const NESTED_DURATION_MS = SCENE_ELEMENTS_LAYERS_TIME * 1000;
    const activeScene = this.scenes[this.activeSceneIndex] as Scene & { timeFrame: TimeFrame };

    if (activeScene && activeScene.timeFrame) {
      const start = activeScene.timeFrame.start;
      const end = start + (duration ?? NESTED_DURATION_MS);
      return {
        start,
        end: Math.min(end, activeScene.timeFrame.end)
      };
    }
    return {
      start: 0,
      end: duration ?? this.maxTime
    };
  }
  handleSeek(seek: number) {
    if (this.playing) {
      this.setPlaying(false)
    }
    this._lastTime = -1;
    this.updateTimeTo(seek)
    this.updateVideoElements()
    this.updateAudioElements()
  }
  addVideo(index: number) {
    const videoElement = document.getElementById(`video-${index}`)
    if (!isHtmlVideoElement(videoElement)) {
      return
    }
    const videoDurationMs = videoElement.duration * 1000
    const aspectRatio = videoElement.videoWidth / videoElement.videoHeight
    const id = getUid()
    this.addEditorElement({
      id,
      name: `Media(video) ${index + 1}`,
      type: 'video',
      placement: {
        x: 0,
        y: 0,
        width: 100 * aspectRatio,
        height: 100,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      },
      timeFrame: this.getCurrentTimeFrame(videoDurationMs),
      properties: {
        elementId: `video-${id}`,
        src: videoElement.src,

        effect: {
          type: 'none',
        },
      },
    })
  }
  addImage(index: number) {
    const imageElement = document.getElementById(`image-${index}`)
    if (!isHtmlImageElement(imageElement)) {
      return
    }
    const aspectRatio = imageElement.naturalWidth / imageElement.naturalHeight
    const id = getUid()
    this.addEditorElement({
      id,
      name: `Media(image) ${index + 1}`,
      type: 'image',
      placement: {
        x: 0,
        y: 0,
        width: 100 * aspectRatio,
        height: 100,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      },
      timeFrame: this.getCurrentTimeFrame(),
      properties: {
        elementId: `image-${id}`,
        src: imageElement.src,
        effect: {
          type: 'none',
        },
      },
    })
  }
  addSvg(index: number) {
    console.log('Adding SVG:', index)
    const svgElement = document.getElementById(
      `svg-${index}`
    ) as HTMLImageElement | null
    if (!svgElement) {
      console.error('SVG Element not found:', `svg-${index}`)
      return
    }
    const id = getUid()
    const parser = new DOMParser()
    const serializer = new XMLSerializer()
    fetch(svgElement.src)
      .then((response) => response.text())
      .then((svgText) => {
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml')
        const svgRoot = svgDoc.documentElement
        if (!svgRoot.hasAttribute('xmlns')) {
          svgRoot.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
        }
        fabric.loadSVGFromString(
          serializer.serializeToString(svgRoot),
          (objects) => {
            if (!objects || objects.length === 0) {
              console.error(' Failed to load SVG objects')
              return
            }
            const objectMap = new Map<string, fabric.Object>()
            objects.forEach((obj) => {
              const fabricObj = obj as any
              if (fabricObj.id) {
                objectMap.set(fabricObj.id, fabricObj)
              }
            })
            const allParts: { id: string; obj: fabric.Object }[] = []
            const rebuildFabricObjectFromElement = (
              element: Element
            ): fabric.Object | null => {
              const nodeName = element.nodeName.toLowerCase()
              let result: fabric.Object | null = null

              if (nodeName === 'g') {
                const childFabricObjects: fabric.Object[] = []
                Array.from(element.children).forEach((child) => {
                  const childObj = rebuildFabricObjectFromElement(child)
                  if (childObj) {
                    childFabricObjects.push(childObj)
                  }
                })
                const rawGroupId = element.getAttribute('id')
                const groupId = rawGroupId || `group-${getUid()}`
                const groupName = rawGroupId || `unnamed-group-${groupId}`
                const group = new fabric.Group(childFabricObjects, {
                  name: groupName,
                  selectable: true,
                })
                group.toSVG = function () {
                  const objectsSVG = this.getObjects()
                    .map((obj) => obj.toSVG())
                    .join('')
                  return `<g id="${groupId}">${objectsSVG}</g>`
                }
                result = group
              } else if (nodeName === 'path') {
                const rawPathId = element.getAttribute('id')
                const pathId = rawPathId || `path-${getUid()}`
                if (rawPathId && objectMap.has(rawPathId)) {
                  result = objectMap.get(rawPathId)!
                  result.set('name', rawPathId)
                } else {
                  result = new fabric.Path('', {
                    name: rawPathId || `unnamed-path-${pathId}`,
                    selectable: true,
                  })
                }
              } else {
                return null
              }
              if (result) {
                if (!result.name || result.name.trim() === '') {
                  result.set(
                    'name',
                    nodeName === 'g'
                      ? `unnamed-group-${(result as any).id}`
                      : `unnamed-path-${(result as any).id}`
                  )
                }
                const resultId = (result as any).id
                if (resultId) {
                  allParts.push({ id: resultId, obj: result })
                }
              }
              return result
            }
            const topLevelFabricObjects: fabric.Object[] = []
            Array.from(svgRoot.children).forEach((child) => {
              const obj = rebuildFabricObjectFromElement(child)
              if (obj) {
                topLevelFabricObjects.push(obj)
              }
            })
            console.log(
              'Complete list of all parts (groups & paths):',
              allParts.map((p) => p.id)
            )
            const fullSvgGroup = new fabric.Group(topLevelFabricObjects, {
              name: 'full-svg',
              selectable: true,

            })
            const scaleFactor = 0.3
            const canvasWidth = this.canvas?.width ?? 800
            const canvasHeight = this.canvas?.height ?? 600
            const groupWidth = fullSvgGroup.width || 0
            const groupHeight = fullSvgGroup.height || 0
            fullSvgGroup.set({
              left: canvasWidth / 2 - (groupWidth * scaleFactor) / 2,
              top: canvasHeight / 2 - (groupHeight * scaleFactor) / 2,
              scaleX: scaleFactor,
              scaleY: scaleFactor,
              selectable: true,
              hasControls: true,
              padding: 50,
              objectCaching: false,

            })
            this.canvas?.add(fullSvgGroup)
            this.canvas?.renderAll()
            console.log(
              'SVG Added to Canvas. Canvas Objects:',
              this.canvas?.getObjects()
            )
            const addedSvg = fullSvgGroup.toSVG()
            console.log('Full SVG Group as SVG:\n', addedSvg)
            console.log(
              'Available SVG Parts for Animation:',
              allParts.map((p) => p.id)
            )
            const allNestedObjects = this.getAllObjectsRecursively(fullSvgGroup)
            console.log(
              ' All nested objects (including sub-groups and paths):',
              allNestedObjects
            )
            const editorElement: SvgEditorElement = {
              id,
              name: `SVG ${index + 1}`,
              type: 'svg',
              placement: {
                x: fullSvgGroup.left ?? 0,
                y: fullSvgGroup.top ?? 0,
                width: groupWidth * scaleFactor,
                height: groupHeight * scaleFactor,
                rotation: 0,
                scaleX: fullSvgGroup.scaleX ?? 1,
                scaleY: fullSvgGroup.scaleY ?? 1,
              },
              timeFrame: this.getCurrentTimeFrame(),
              properties: {
                elementId: `svg-${id}`,
                src: svgElement.src,
                animationType: undefined,
              },
              fabricObject: fullSvgGroup,
            }
            this.addEditorElement(editorElement)
            this.setSelectedElement(editorElement)
          }
        )
      })
      .catch((error) => console.error(' Error fetching SVG:', error))
  }


  addAudio(index: number) {
    const audioElement = document.getElementById(`audio-${index}`);
    if (!isHtmlAudioElement(audioElement)) return;


    const domId = `audio-${index}`;
    const audioDurationMs = audioElement.duration * 1000;
    const id = getUid();

    this.addEditorElement({
      id,
      name: `Media(audio) ${index + 1}`,
      type: 'audio',
      placement: {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      },
      timeFrame: this.getCurrentTimeFrame(audioDurationMs),
      properties: {
        elementId: domId,
        src: audioElement.src,
      },
    });
  }

  addText(options: { text: string; fontSize: number; fontWeight: number }) {
    const id = getUid()
    const index = this.editorElements.length
    this.addEditorElement({
      id,
      name: `Text ${index + 1}`,
      type: 'text',
      placement: {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      },
      timeFrame: this.getCurrentTimeFrame(),
      properties: {
        text: options.text,
        fontSize: options.fontSize,
        fontWeight: options.fontWeight,
        splittedTexts: [],
      },
    })
  }
  updateVideoElements() {
    this.editorElements
      .filter(
        (element): element is VideoEditorElement => element.type === 'video'
      )
      .forEach((element) => {
        const video = document.getElementById(
          element.properties.elementId
        ) as HTMLVideoElement | null
        if (!video || !isHtmlVideoElement(video)) return

        const { start, end } = element.timeFrame
        const current = this.currentTimeInMs
        const inRange = current >= start && current < end
        if (!inRange) {
          if (!video.paused) {
            video.pause()
          }
          return
        }
        const desiredTime = (current - start) / 1000
        const clampedTime = Math.max(0, desiredTime)
        if (!video.seeking && Math.abs(video.currentTime - clampedTime) > 0.2) {
          video.currentTime = clampedTime
        }
        if (this.playing) {
          if (video.paused) {
            video
              .play()
              .catch((err) => console.error('Error playing video:', err))
          }
        } else {
          if (!video.paused) {
            video.pause()
          }
        }
      })
  }
  updateAudioElements() {
    this.editorElements
      .filter(
        (element): element is AudioEditorElement => element.type === 'audio'
      )
      .forEach((element) => {
        const audio = document.getElementById(
          element.properties.elementId
        ) as HTMLAudioElement | null
        if (!audio) return

        const { start, end } = element.timeFrame
        const currentTimeMs = this.currentTimeInMs
        const isWithinRange = currentTimeMs >= start && currentTimeMs <= end

        if (this.playing && isWithinRange) {
          if (!(element.properties as any).isAudioPlaying) {
            const audioTime = (currentTimeMs - start) / 1000
            audio.currentTime = Math.max(0, audioTime)
            audio
              .play()
              .catch((err) => console.warn('⚠️ Audio play error:', err))
              ; (element.properties as any).isAudioPlaying = true
          }
        } else {
          if ((element.properties as any).isAudioPlaying) {
            audio.pause()
            audio.currentTime = 0
              ; (element.properties as any).isAudioPlaying = false
          }
        }
      })
  }


  updateSvgElements() {
    this.editorElements
      .filter((element): element is SvgEditorElement => element.type === 'svg')
      .forEach((element) => {
        const { start, end } = element.timeFrame
        const current = this.currentTimeInMs
        if (current < start || current > end) {
          return
        }
        const relativeTime = current - start
        if (element.properties.animationType === WALKING) {
          const groupCycle = 10500
          const groupTime = relativeTime % groupCycle
          const baseLeft = element.placement.x
          let newLeft = baseLeft
          if (groupTime < 10000) {
            newLeft = baseLeft + 300 * (groupTime / 10000)
          } else {
            newLeft = baseLeft + 300
          }
          element.fabricObject?.set('left', newLeft)
          if (!element.fabricObject) return
          const allObjects = this.getAllObjectsRecursively(element.fabricObject)
          Object.entries(walkingAnimations).forEach(
            ([partId, animationData]) => {
              const targetElement = allObjects.find(
                (obj) => ((obj as any).dataName || obj.name) === partId
              )
              if (!targetElement) {
                console.warn(
                  ` ⚠️ Missing SVG part: ${partId}, skipping walking angle update.`
                )
                return
              }
              const duration = 1600
              const animTime = relativeTime % duration
              const keys = animationData.keys.map((k) => k.v)
              let newAngle = keys[0]
              if (keys.length === 2) {
                const progress = animTime / duration
                newAngle = keys[0] + (keys[1] - keys[0]) * progress
              } else if (keys.length > 2) {
                const segmentDuration = duration / (keys.length - 1)
                const segmentIndex = Math.floor(animTime / segmentDuration)
                const segmentProgress =
                  (animTime % segmentDuration) / segmentDuration
                const startAngle = keys[segmentIndex]
                const endAngle = keys[segmentIndex + 1]
                newAngle =
                  startAngle + (endAngle - startAngle) * segmentProgress
              }
              targetElement.set('angle', newAngle)
            }
          )
        } else if (element.properties.animationType === HANDSTAND) {
          if (!element.fabricObject) return
          const cycleDuration = 3000
          const tHandstand = relativeTime % cycleDuration
          const allObjects = this.getAllObjectsRecursively(element.fabricObject)
          Object.entries(handstandAnimation).forEach(
            ([partId, animationData]) => {
              const targetElement = allObjects.find(
                (obj) => ((obj as any).dataName || obj.name) === partId
              )
              if (!targetElement) {
                console.warn(
                  `⚠️ Missing handstand SVG part: ${partId}, skipping angle update.`
                )
                return
              }
              const target = targetElement as any
              if (!target._handstandOriginSet) {
                target.setPositionByOrigin(
                  new fabric.Point(-1, -180),
                  'center',
                  'top'
                )
                target._handstandOriginSet = true
              }
              const keys = animationData.keys.map((k) => k.v)
              let newAngle = keys[0]
              if (keys.length === 2) {
                const progress = tHandstand / cycleDuration
                newAngle = keys[0] + (keys[1] - keys[0]) * progress
              } else if (keys.length > 2) {
                const segDuration = cycleDuration / (keys.length - 1)
                const segIndex = Math.floor(tHandstand / segDuration)
                const segProgress = (tHandstand % segDuration) / segDuration
                newAngle =
                  keys[segIndex] +
                  (keys[segIndex + 1] - keys[segIndex]) * segProgress
              }
              targetElement.set('angle', newAngle)
            }
          )
        }
        this.canvas?.renderAll()
      })
  }
  setVideoFormat(format: 'mp4' | 'webm') {
    this.selectedVideoFormat = format
  }

  saveCanvasToVideoWithAudio() {
    this.saveCanvasToVideoWithAudioWebmMp4();
  }

  saveCanvasToVideoWithAudioWebmMp4() {
    console.log('Modified to capture video & standalone audio at correct timeline positions');

    let mp4 = this.selectedVideoFormat === 'mp4';
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const stream = canvas.captureStream(30);

    const videoElements = this.editorElements.filter(isEditorVideoElement);
    const audioElements = this.editorElements.filter(isEditorAudioElement);
    const ttsItems = this.scenes.flatMap(scene => scene.tts ?? []);
    const hasMediaElements = videoElements.length > 0 || audioElements.length > 0 || ttsItems.length > 0;

    if (hasMediaElements) {
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      const audioContext = this.audioContext;
      const mixedAudioDestination = audioContext.createMediaStreamDestination();


      videoElements.forEach((video) => {
        const videoElement = document.getElementById(video.properties.elementId) as HTMLVideoElement;
        if (!videoElement) {
          console.warn('Skipping missing video element:', video.properties.elementId);
          return;
        }

        videoElement.muted = false;
        videoElement.play().catch((err) => console.error('Video play error:', err));

        let sourceNode = this.audioSourceNodes.get(video.properties.elementId);
        if (!sourceNode) {
          sourceNode = audioContext.createMediaElementSource(videoElement);
          this.audioSourceNodes.set(video.properties.elementId, sourceNode);
        }
        sourceNode.connect(mixedAudioDestination);
      });


      audioElements.forEach((audio) => {
        const audioElement = document.getElementById(audio.properties.elementId) as HTMLAudioElement;
        if (!audioElement) {
          console.warn('Skipping missing audio element:', audio.properties.elementId);
          return;
        }

        setTimeout(() => {
          audioElement.play().catch((err) => console.error('Audio play error:', err));
        }, audio.timeFrame.start);

        let sourceNode = this.audioSourceNodes.get(audio.properties.elementId);
        if (!sourceNode) {
          sourceNode = audioContext.createMediaElementSource(audioElement);
          this.audioSourceNodes.set(audio.properties.elementId, sourceNode);
        }
        sourceNode.connect(mixedAudioDestination);
      });

      const ttsPromises = ttsItems.map(ttsItem => {
        return new Promise<void>((resolve) => {
          const audioElement = ttsItem.audioElement as HTMLAudioElement | undefined;
          if (!audioElement) {
            console.warn('Skipping missing TTS audio element');
            return resolve();
          }


          audioElement.muted = false;
          audioElement.crossOrigin = 'anonymous';
          audioElement.preload = 'auto';
          audioElement.load();


          let sourceNode = this.audioSourceNodes.get(ttsItem.id);
          if (!sourceNode) {
            sourceNode = audioContext.createMediaElementSource(audioElement);
            this.audioSourceNodes.set(ttsItem.id, sourceNode);
          }
          sourceNode.connect(mixedAudioDestination);


          const onCanPlay = () => {
            audioElement.removeEventListener('canplay', onCanPlay);
            resolve();
          };
          audioElement.addEventListener('canplay', onCanPlay);


          setTimeout(() => {
            this._maybeStartTtsClip(ttsItem, ttsItem.timeFrame.start);
          }, ttsItem.timeFrame.start);
        });
      });


      mixedAudioDestination.stream.getAudioTracks().forEach((track) => {
        stream.addTrack(track);
      });


      const video = document.createElement('video');
      video.srcObject = stream;
      video.height = canvas.height;
      video.width = canvas.width;


      Promise.all(ttsPromises).then(() => {
        video.play().then(() => {
          console.log('Video playback started with all TTS audio ready');

          const mediaRecorder = new MediaRecorder(stream);
          const chunks: Blob[] = [];

          mediaRecorder.ondataavailable = function (e) {
            chunks.push(e.data);
          };

          mediaRecorder.onstop = async function () {
            const blob = new Blob(chunks, { type: 'video/webm' });

            if (mp4) {
              showLoading();
              try {
                const data = new Uint8Array(await blob.arrayBuffer());
                const ffmpeg = new FFmpeg();
                const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.2/dist/umd';

                await ffmpeg.load({
                  coreURL: await toBlobURL(`${baseURL} / ffmpeg - core.js`, 'text/javascript'),
                  wasmURL: await toBlobURL(`${baseURL} / ffmpeg - core.wasm`, 'application/wasm'),
                });

                await ffmpeg.writeFile('video.webm', data);
                await ffmpeg.exec([
                  '-y',
                  '-i',
                  'video.webm',
                  '-c:v',
                  'libx264',
                  ...(hasMediaElements ? ['-c:a', 'aac', '-b:a', '192k'] : []),
                  '-strict',
                  'experimental',
                  'video.mp4',
                ]);

                const output = await ffmpeg.readFile('video.mp4');
                const outputBlob = new Blob([output], { type: 'video/mp4' });
                const outputUrl = URL.createObjectURL(outputBlob);

                const a = document.createElement('a');
                a.download = 'video.mp4';
                a.href = outputUrl;
                a.click();
              } catch (error) {
                console.error('MP4 conversion failed:', error);

                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'video.webm';
                a.click();
              } finally {
                hideLoading();
              }
            } else {
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'video.webm';
              a.click();
            }
          };

          mediaRecorder.start();
          setTimeout(() => {
            mediaRecorder.stop();
          }, this.maxTime);
        });
      }).catch(err => {
        console.error('Error preparing TTS audio:', err);
      });
    } else {
      // Original code path when no media elements exist
      const video = document.createElement('video');
      video.srcObject = stream;
      video.height = canvas.height;
      video.width = canvas.width;

      video.play().then(() => {
        const mediaRecorder = new MediaRecorder(stream);
        const chunks: Blob[] = [];

        mediaRecorder.ondataavailable = function (e) {
          chunks.push(e.data);
        };

        mediaRecorder.onstop = async function () {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'video.webm';
          a.click();
        };

        mediaRecorder.start();
        setTimeout(() => {
          mediaRecorder.stop();
        }, this.maxTime);
      });
    }
  }

  refreshElements() {
    const store = this
    if (!store.canvas) return
    const canvas = store.canvas
    store.canvas.remove(...store.canvas.getObjects())
    const activeScene = this.editorElements.find(
      el => el.type === 'scene' &&
        (el as SceneEditorElement).properties.sceneIndex === this.activeSceneIndex
    ) as SceneEditorElement | undefined;
    if (activeScene) {
      console.log('Rendering active scene:', activeScene.id);
      console.log('Scene contains elements:', activeScene.properties.elements?.length || 0);
    } else {
      console.log('Rendering without active scene');
      console.log('Total elements:', this.editorElements.length);
    }
    console.groupEnd();
    for (let index = 0; index < store.editorElements.length; index++) {
      const element = store.editorElements[index]
      switch (element.type) {
        case 'video': {
          console.log('elementid', element.properties.elementId)
          if (document.getElementById(element.properties.elementId) == null)
            continue
          const videoElement = document.getElementById(
            element.properties.elementId
          )
          if (!isHtmlVideoElement(videoElement)) continue
          // const filters = [];
          // if (element.properties.effect?.type === "blackAndWhite") {
          //   filters.push(new fabric.Image.filters.Grayscale());
          // }
          const videoObject = new fabric.CoverVideo(videoElement, {
            name: element.id,
            left: element.placement.x,
            top: element.placement.y,
            width: element.placement.width,
            height: element.placement.height,
            scaleX: element.placement.scaleX,
            scaleY: element.placement.scaleY,
            angle: element.placement.rotation,
            objectCaching: false,
            selectable: true,
            lockUniScaling: true,
            // filters: filters,
            // @ts-ignore
            customFilter: element.properties.effect.type,
          })
          element.fabricObject = videoObject
          element.properties.imageObject = videoObject
          videoElement.width = 100
          videoElement.height =
            (videoElement.videoHeight * 100) / videoElement.videoWidth
          canvas.add(videoObject)
          canvas.on('object:modified', function (e) {
            if (!e.target) return
            const target = e.target
            if (target != videoObject) return
            const placement = element.placement
            const newPlacement: Placement = {
              ...placement,
              x: target.left ?? placement.x,
              y: target.top ?? placement.y,
              rotation: target.angle ?? placement.rotation,
              width:
                target.width && target.scaleX
                  ? target.width * target.scaleX
                  : placement.width,
              height:
                target.height && target.scaleY
                  ? target.height * target.scaleY
                  : placement.height,
              scaleX: 1,
              scaleY: 1,
            }
            const newElement = {
              ...element,
              placement: newPlacement,
            }
            store.updateEditorElement(newElement)
          })
          break
        }
        case 'image': {
          if (document.getElementById(element.properties.elementId) == null)
            continue
          const imageElement = document.getElementById(
            element.properties.elementId
          )
          if (!isHtmlImageElement(imageElement)) continue
          // const filters = [];
          // if (element.properties.effect?.type === "blackAndWhite") {
          //   filters.push(new fabric.Image.filters.Grayscale());
          // }
          const imageObject = new fabric.CoverImage(imageElement, {
            name: element.id,
            left: element.placement.x,
            top: element.placement.y,
            angle: element.placement.rotation,
            objectCaching: false,
            selectable: true,
            lockUniScaling: true,
            // filters
            // @ts-ignore
            customFilter: element.properties.effect.type,
          })
          // imageObject.applyFilters();
          element.fabricObject = imageObject
          element.properties.imageObject = imageObject
          const image = {
            w: imageElement.naturalWidth,
            h: imageElement.naturalHeight,
          }
          imageObject.width = image.w
          imageObject.height = image.h
          imageElement.width = image.w
          imageElement.height = image.h
          imageObject.scaleToHeight(image.w)
          imageObject.scaleToWidth(image.h)
          const toScale = {
            x: element.placement.width / image.w,
            y: element.placement.height / image.h,
          }
          imageObject.scaleX = toScale.x * element.placement.scaleX
          imageObject.scaleY = toScale.y * element.placement.scaleY
          canvas.add(imageObject)
          canvas.on('object:modified', function (e) {
            if (!e.target) return
            const target = e.target
            if (target != imageObject) return
            const placement = element.placement
            let fianlScale = 1
            if (target.scaleX && target.scaleX > 0) {
              fianlScale = target.scaleX / toScale.x
            }
            const newPlacement: Placement = {
              ...placement,
              x: target.left ?? placement.x,
              y: target.top ?? placement.y,
              rotation: target.angle ?? placement.rotation,
              scaleX: fianlScale,
              scaleY: fianlScale,
            }
            const newElement = {
              ...element,
              placement: newPlacement,
            }
            store.updateEditorElement(newElement)
          })
          break
        }
        case 'audio': {
          const rect = new fabric.Rect({
            left: element.placement.x,
            top: element.placement.y,
            width: element.placement.width,
            height: element.placement.height,
            fill: 'transparent',
            selectable: true,
            hasControls: true,
            lockScalingX: false,
            lockScalingY: false,

          });
          element.fabricObject = rect;
          canvas.add(rect);
          canvas.on('object:modified', function (e) {
            if (!e.target) return;
            const target = e.target;
            if (target !== rect) return;
            const placement = element.placement;
            const newPlacement = {
              ...placement,
              x: target.left ?? placement.x,
              y: target.top ?? placement.y,
              rotation: target.angle ?? placement.rotation,
              width: target.getScaledWidth() || placement.width,
              height: target.getScaledHeight() || placement.height,
              scaleX: target.scaleX ?? placement.scaleX,
              scaleY: target.scaleY ?? placement.scaleY,
            };
            const newElement = {
              ...element,
              placement: newPlacement,
            };
            store.updateEditorElement(newElement);
          });

          break;
        }
        case 'svg': {
          if (!element.fabricObject) {
            fabric.loadSVGFromURL(
              element.properties.src,
              (objects, options) => {
                const group = fabric.util.groupSVGElements(objects, {
                  ...options,
                  name: element.id,
                  left: element.placement.x,
                  top: element.placement.y,
                  scaleX: element.placement.scaleX,
                  scaleY: element.placement.scaleY,
                  angle: element.placement.rotation,
                  selectable: true,
                })
                element.fabricObject = group
                this.canvas?.add(group)
                this.canvas?.renderAll()
                this.canvas?.on('object:modified', (e) => {
                  if (!e.target || e.target !== group) return
                  const target = e.target
                  const placement = element.placement
                  const newPlacement = {
                    ...placement,
                    x: target.left ?? placement.x,
                    y: target.top ?? placement.y,
                    rotation: target.angle ?? placement.rotation,
                    scaleX: target.scaleX ?? placement.scaleX,
                    scaleY: target.scaleY ?? placement.scaleY,
                  }
                  this.updateEditorElement({
                    ...element,
                    placement: newPlacement,
                  })
                })
              }
            )
          } else {
            this.canvas?.add(element.fabricObject)
          }
          break
        }
        case 'text': {
          const textObject = new fabric.Textbox(element.properties.text, {
            name: element.id,
            left: element.placement.x,
            top: element.placement.y,
            scaleX: element.placement.scaleX,
            scaleY: element.placement.scaleY,
            width: element.placement.width,
            height: element.placement.height,
            angle: element.placement.rotation,
            fontSize: element.properties.fontSize,
            objectCaching: false,
            selectable: true,
            lockUniScaling: true,
            fontFamily: element.properties.fontFamily || 'Arial',
            fill: element.properties.textColor || '#ffffff',
            text: element.properties.text,
            fontWeight: element.properties.fontWeight || 'normal',
            fontStyle: element.properties.fontStyle || 'normal',
          })
          element.fabricObject = textObject
          canvas.add(textObject)
          canvas.on('object:modified', function (e) {
            if (!e.target) return
            const target = e.target
            if (target != textObject) return
            const placement = element.placement
            const newPlacement: Placement = {
              ...placement,
              x: target.left ?? placement.x,
              y: target.top ?? placement.y,
              rotation: target.angle ?? placement.rotation,
              width: target.width ?? placement.width,
              height: target.height ?? placement.height,
              scaleX: target.scaleX ?? placement.scaleX,
              scaleY: target.scaleY ?? placement.scaleY,
            }
            const newElement = {
              ...element,
              placement: newPlacement,
              properties: {
                ...element.properties,
                // @ts-ignore
                text: target?.text,
              },
            }
            store.updateEditorElement(newElement)
          })
          break
        }

        case 'scene': {
          if (element.properties.sceneIndex !== this.activeSceneIndex) {
            break;
          }
          const sceneData = this.scenes[element.properties.sceneIndex];
          const { x, y, width, height } = element.placement;
          const now = this.currentTimeInMs;
          if (!sceneData.fabricObjects) {
            sceneData.fabricObjects = {
              background: null,
              backgrounds: [],
              texts: [],
              gifs: [],
              elements: [],
              animations: [],
              tts: []
            };
          }
          canvas.clear();
          const parts: fabric.Object[] = [];
          const sceneObjectsMap: { [key: string]: fabric.Object } = {};
          const addObjectToScene = (obj: fabric.Object, data: {
            zIndex: number;
            elementId: string;
            source: any;
            timeFrame?: { start: number; end: number };
          }) => {
            obj.set({
              ...obj.toObject(),
              data,
              name: data.elementId,
              selectable: true,
              hasControls: true,
              visible: true,
              evented: true,
              hoverCursor: 'pointer',
              lockMovementX: data.zIndex === -1,
              lockMovementY: data.zIndex === -1,
              lockScalingX: data.zIndex === -1,
              lockScalingY: data.zIndex === -1,
              lockRotation: data.zIndex === -1
            });


            sceneObjectsMap[data.elementId] = obj;

            obj.on('modified', () => {
              if (data.source.placement) {
                data.source.placement.x = obj.left ?? data.source.placement.x;
                data.source.placement.y = obj.top ?? data.source.placement.y;
                data.source.placement.width = (obj.width ?? 0) * (obj.scaleX ?? 1);
                data.source.placement.height = (obj.height ?? 0) * (obj.scaleY ?? 1);
                data.source.placement.rotation = obj.angle ?? 0;
              }
            });


            obj.on('selected', () => {
              obj.bringToFront();
              canvas.requestRenderAll();
            });

            parts.push(obj);
          };
          this.selectLayerObject = (elementId: string) => {
            const obj = sceneObjectsMap[elementId];
            if (obj) {
              canvas.discardActiveObject();
              canvas.setActiveObject(obj);
              obj.bringToFront();
              canvas.requestRenderAll();

              obj.fire('selected');
            }
          };
          if (sceneData.bgImage) {
            const { start: t0, end: t1 } = sceneData.timeFrame;
            if (now >= t0 && now <= t1) {
              if (!sceneData.fabricObjects.background) {
                fabric.Image.fromURL(sceneData.bgImage, img => {
                  const scaleX = width / (img.width || 1);
                  const scaleY = height / (img.height || 1);
                  img.set({
                    left: x,
                    top: y,
                    scaleX,
                    scaleY,
                    visible: true,
                    selectable: false,
                    evented: false,
                    lockMovementX: true,
                    lockMovementY: true,
                    lockScalingX: true,
                    lockScalingY: true,
                    lockRotation: true
                  });
                  //@ts-ignore
                  sceneData.fabricObjects.background = img;
                  parts.push(img);
                  renderAllParts();
                }, { crossOrigin: 'anonymous' });
              } else {
                sceneData.fabricObjects.background.set({ visible: true });
                parts.push(sceneData.fabricObjects.background);
              }
            }
          }
          sceneData.backgrounds?.forEach((bg, index) => {
            const { start, end } = bg.timeFrame;
            if (now >= start && now <= end && bg.background_url) {
              //@ts-ignore
              if (!sceneData.fabricObjects.backgrounds[index]) {
                fabric.Image.fromURL(bg.background_url, img => {
                  const scaleX = width / (img.width || 1);
                  const scaleY = height / (img.height || 1);
                  img.set({
                    left: x,
                    top: y,
                    scaleX,
                    scaleY,
                    visible: true,
                    selectable: false,
                    evented: true,
                  });
                  //@ts-ignore
                  sceneData.fabricObjects.backgrounds[index] = img;
                  addObjectToScene(img, {
                    zIndex: 0,
                    elementId: bg.id,
                    source: bg,
                    timeFrame: bg.timeFrame
                  });
                  renderAllParts();
                }, { crossOrigin: 'anonymous' });
              }
            }
          });
          sceneData.text?.forEach((textItem, index) => {
            const { start, end } = textItem.timeFrame;
            if (now >= start && now <= end) {
              //@ts-ignore
              if (!sceneData.fabricObjects.texts[index]) {
                //@ts-ignore
                const txt = new fabric.Textbox(textItem.value, {
                  //@ts-ignore
                  left: x + (width - (textItem.placement.width || width)) / 2,
                  //@ts-ignore
                  top: y + height - (textItem.properties.fontSize || 24) - 20,
                  //@ts-ignore
                  width: textItem.placement.width,
                  //@ts-ignore
                  fontSize: textItem.properties.fontSize,
                  //@ts-ignore
                  fontFamily: textItem.properties.fontFamily,
                  //@ts-ignore
                  fill: textItem.properties.fill,
                  //@ts-ignore
                  textAlign: 'center',
                  visible: true,
                  lockUniScaling: false,
                  selectable: true
                });
                //@ts-ignore
                sceneData.fabricObjects.texts[index] = txt;
                addObjectToScene(txt, {
                  zIndex: 5,
                  elementId: textItem.id,
                  source: textItem,
                  timeFrame: textItem.timeFrame
                });
              } else {
                //@ts-ignore
                const txt = sceneData.fabricObjects.texts[index];
                txt.set({
                  //@ts-ignore
                  text: textItem.value,
                  //@ts-ignore
                  fontSize: textItem.properties.fontSize,
                  //@ts-ignore
                  fontFamily: textItem.properties.fontFamily,
                  //@ts-ignore
                  fill: textItem.properties.fill,
                  //@ts-ignore
                  width: textItem.placement.width,
                  //@ts-ignore
                  visible: true,
                  selectable: true
                });
                addObjectToScene(txt, {
                  zIndex: 5,
                  elementId: textItem.id,
                  source: textItem,
                  timeFrame: textItem.timeFrame
                });
              }
            }
          });
          sceneData.gifs?.forEach((gif, index) => {
            const { start, end } = gif.timeFrame;
            if (now < start || now > end) return;
            //@ts-ignore
            const pos = gif.calculatedPosition ?? {
              x: x + width * 0.35,
              y: y + height * 0.35,
              width: width * 0.3,
              height: height * 0.3,
            };

            const url = gif.svg_url.toLowerCase();
            //@ts-ignore
            let existingObj = sceneData.fabricObjects.gifs[index];

            if (existingObj && existingObj.type) {
              existingObj.set({ visible: true, selectable: true });
              addObjectToScene(existingObj, {
                zIndex: 2,
                elementId: gif.id,
                source: gif,
                timeFrame: gif.timeFrame,
              });
            } else {
              //@ts-ignore
              sceneData.fabricObjects.gifs[index] = {} as any;
              const onLoad = (obj: fabric.Object) => {
                obj.set({
                  left: pos.x,
                  top: pos.y,
                  visible: true,
                  selectable: true,
                  hasControls: true,
                });

                obj.scaleToWidth(pos.width);
                obj.scaleToHeight(pos.height);

                //@ts-ignore
                sceneData.fabricObjects.gifs[index] = obj;
                addObjectToScene(obj, {
                  zIndex: 2,
                  elementId: gif.id,
                  source: gif,
                  timeFrame: gif.timeFrame,
                });
                renderAllParts();
              };

              if (url.endsWith('.svg')) {
                fabric.loadSVGFromURL(
                  url,
                  (objects) => {
                    const grp = new fabric.Group(objects, {
                      left: pos.x,
                      top: pos.y,
                      selectable: true,
                      hasControls: true,
                      name: gif.id,
                      data: {
                        zIndex: 2,
                        elementId: gif.id,
                        source: gif,
                        timeFrame: gif.timeFrame,
                        mediaType: 'svg',
                      },
                    });
                    grp.scaleToWidth(pos.width);
                    grp.scaleToHeight(pos.height);
                    grp.setCoords();
                    onLoad(grp);
                  },
                  undefined,
                  { crossOrigin: 'anonymous' }
                );
              } else {
                fabric.Image.fromURL(
                  url,
                  onLoad,
                  { crossOrigin: 'anonymous' }
                );
              }
            }
          });



          sceneData.tts?.forEach((ttsItem, i) => {
            const { audioUrl } = ttsItem as any;


            if (!ttsItem.audioElement && audioUrl) {
              const fullUrl = `${API_URL}${audioUrl}`;
              const audio = new Audio(fullUrl);
              audio.preload = 'auto';
              audio.crossOrigin = 'anonymous';
              ttsItem.audioElement = audio;
              audio.addEventListener('ended', () => {
                ttsItem.played = false;
              });
            }
            const ICON_SIZE = 24;
            const padding = 10;
            const iconX = x + padding + (i * (ICON_SIZE + 5));
            const iconY = y + padding;
            //@ts-ignore
            if (!sceneData.fabricObjects.tts[i]) {
              const icon = new fabric.Text('🔊', {
                left: iconX,
                top: iconY,
                fontSize: ICON_SIZE,
                selectable: false,
                hoverCursor: 'pointer',
                name: ttsItem.id,
              });

              //@ts-ignore
              sceneData.fabricObjects.tts[i] = icon;
              addObjectToScene(icon, {
                zIndex: 6,
                elementId: ttsItem.id,
                source: ttsItem,
                timeFrame: ttsItem.timeFrame,
              });
            } else {
              //@ts-ignore
              const icon = sceneData.fabricObjects.tts[i] as fabric.Text;
              icon.set({ visible: true });
              addObjectToScene(icon, {
                zIndex: 6,
                elementId: ttsItem.id,
                source: ttsItem,
                timeFrame: ttsItem.timeFrame,
              });
            }
          });





          sceneData.elements?.forEach((childElement) => {
            //@ts-ignore
            const existing = sceneData.fabricObjects.elements.find(
              el => el?.data?.elementId === childElement.id
            );

            if (existing) {
              existing.set({ visible: true, selectable: true });
              addObjectToScene(existing, {
                zIndex: 3,
                elementId: childElement.id,
                source: childElement,
                timeFrame: childElement.timeFrame
              });
              return;
            }
            const pos = childElement.placement ?? {
              x: 100,
              y: 100,
              width: 100,
              height: 100,
              rotation: 0,
              scaleX: 1,
              scaleY: 1,
            };
            switch (childElement.type) {
              case 'text': {
                const obj = new fabric.Textbox(childElement.properties.text || 'Text', {
                  left: pos.x,
                  top: pos.y,
                  width: pos.width,
                  height: pos.height,
                  angle: pos.rotation,
                  fontSize: childElement.properties.fontSize || 24,
                  fontFamily: childElement.properties.fontFamily || 'Arial',
                  fill: childElement.properties.textColor || '#fff',
                  visible: true,
                  selectable: true,
                });
                //@ts-ignore
                sceneData.fabricObjects.elements.push(obj);
                addObjectToScene(obj, {
                  zIndex: 3,
                  elementId: childElement.id,
                  source: childElement,
                  timeFrame: childElement.timeFrame
                });
                break;
              }
              case 'image': {
                const src = childElement.properties.src;
                if (!src) return;

                fabric.Image.fromURL(
                  src,
                  (img) => {

                    const ratioX = pos.width / (img.width || 1);
                    const ratioY = pos.height / (img.height || 1);
                    const scale = Math.min(ratioX, ratioY);
                    img.set({
                      scaleX: scale,
                      scaleY: scale,
                      angle: pos.rotation || 0,
                      visible: true,
                      selectable: true,
                      name: childElement.id,
                      data: {
                        zIndex: 3,
                        elementId: childElement.id,
                        source: childElement,
                        timeFrame: childElement.timeFrame,
                        mediaType: 'image',
                      },
                      lockUniScaling: true,
                    });
                    const actualW = (img.width || 0) * scale;
                    const actualH = (img.height || 0) * scale;
                    img.set({
                      left: pos.x + (pos.width - actualW) / 2,
                      top: pos.y + (pos.height - actualH) / 2,
                    });
                    //@ts-ignore
                    sceneData.fabricObjects.elements.push(img);
                    canvas.add(img);
                    canvas.requestRenderAll();
                  },
                  { crossOrigin: 'anonymous' }
                );
                break;
              }
              case 'audio': {
                const obj = new fabric.Rect({
                  left: pos.x,
                  top: pos.y,
                  width: pos.width,
                  height: pos.height,
                  stroke: 'blue',
                  strokeWidth: 1,
                  fill: 'transparent',
                  selectable: true,
                  hasControls: true,
                  lockScalingX: false,
                  lockScalingY: false,
                });

                const group = new fabric.Group([obj], {
                  left: pos.x,
                  top: pos.y,
                  width: pos.width,
                  height: pos.height,
                  visible: true,
                  selectable: true,
                  data: {
                    zIndex: 3,
                    elementId: childElement.id,
                    source: childElement,
                    timeFrame: childElement.timeFrame,
                    mediaType: 'audio',
                    isAudioPlaying: false,
                    played: false
                  },
                  name: childElement.id
                });
                if (childElement.properties.src) {
                  const audio = document.createElement('audio');
                  audio.src = childElement.properties.src;
                  audio.crossOrigin = 'anonymous';
                  audio.preload = 'auto';
                  audio.loop = false;
                  audio.muted = false;
                  audio.id = childElement.id;
                  audio.style.display = 'none';
                  document.body.appendChild(audio);
                  this.audioRegistry.set(childElement.id, audio);
                  group.data.mediaElement = audio;
                  audio.addEventListener('ended', () => {
                    group.data.isAudioPlaying = false;
                    group.data.played = false;
                  });
                  if (this.playing) {
                    setTimeout(() => {
                      this.updateAudioElements();
                    }, 10);
                  }
                }
                //@ts-ignore
                sceneData.fabricObjects.elements.push(group);
                addObjectToScene(group, group.data);
                break;
              }

            }
          });


          const renderAllParts = () => {

            parts
              .sort((a, b) => (a.data?.zIndex || 0) - (b.data?.zIndex || 0))
              .forEach(obj => canvas.add(obj));

            canvas.requestRenderAll();
          };
          renderAllParts();
          break;
        }


        default: {
          throw new Error('Not implemented')
        }
      }
      if (element.fabricObject) {
        const fObj = element.fabricObject;

        if (Array.isArray(fObj)) {
          fObj.forEach(obj => {
            obj.off('selected');
            obj.on('selected', () => {
              store.setSelectedElement(element);
            });
          });
        } else {
          fObj.off('selected');
          fObj.on('selected', () => {
            store.setSelectedElement(element);
          });
        }
      }
    }
    if (store.selectedElement?.fabricObject) {
      const fabricObject = store.selectedElement.fabricObject;
      if (Array.isArray(fabricObject)) {
        canvas.setActiveObject(fabricObject[0]);
      } else {
        canvas.setActiveObject(fabricObject);
      }
      canvas.requestRenderAll();
    }
    this.refreshAnimations();
    this.updateTimeTo(this.currentTimeInMs);
    canvas.requestRenderAll();
  }
}
export function isEditorAudioElement(
  element: EditorElement
): element is AudioEditorElement {
  return element.type === 'audio'
}
export function isEditorVideoElement(
  element: EditorElement
): element is VideoEditorElement {
  return element.type === 'video'
}
export function isEditorImageElement(
  element: EditorElement
): element is ImageEditorElement {
  return element.type === 'image'
}
export function isEditorSvgElement(
  element: EditorElement
): element is SvgEditorElement {
  return element.type === 'svg'
}
export function isEditorSceneElement(
  element: EditorElement
): element is SceneEditorElement {
  return element.type === 'scene'
}
function getTextObjectsPartitionedByCharacters(
  textObject: fabric.Text,
  element: TextEditorElement
): fabric.Text[] {
  let copyCharsObjects: fabric.Text[] = []

  const characters = (textObject.text ?? '').split('').filter((m) => m !== '\n')
  const charObjects = textObject.__charBounds
  if (!charObjects) return []
  const charObjectFixed = charObjects
    .map((m, index) => m.slice(0, m.length - 1).map((m) => ({ m, index })))
    .flat()
  const lineHeight = textObject.getHeightOfLine(0)
  for (let i = 0; i < characters.length; i++) {
    if (!charObjectFixed[i]) continue
    const { m: charObject, index: lineIndex } = charObjectFixed[i]
    const char = characters[i]
    const scaleX = textObject.scaleX ?? 1
    const scaleY = textObject.scaleY ?? 1
    const charTextObject = new fabric.Text(char, {
      left: charObject.left * scaleX + element.placement.x,
      scaleX: scaleX,
      scaleY: scaleY,
      top: lineIndex * lineHeight * scaleY + element.placement.y,
      fontSize: textObject.fontSize,
      fontWeight: textObject.fontWeight,
      fill: '#fff',
    })
    copyCharsObjects.push(charTextObject)
  }
  return copyCharsObjects
}