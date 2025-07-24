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
  LayerProperties,
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
  layerProperties: LayerProperties | null = null;
  editedScene: null = null;
  activeLayer: string | null = null;
  sceneCanvas: fabric.Canvas | null = null;
  sceneLayerPositions: Record<string, Record<string, {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    angle: number;
  }>> = {};
  sceneModifiedStates?: Set<number>;
  videoRegistry = new Map<string, HTMLVideoElement>();




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

  setActiveLayer(layer: string | null) {
    this.activeLayer = layer;
  }

  setSceneCanvas(canvas: fabric.Canvas | null) {
    this.sceneCanvas = canvas;
  }


  setLayerProperties(properties: any) {
    this.layerProperties = properties
  }

  setEditedScene(scene: any) {
    this.editedScene = scene;
  }


  updateSceneElementPosition(id: string, position: {
    x: number; y: number; scaleX: number; scaleY: number; angle: number
  }) {
    if (!this.editedScene) return;

    this.editedScene = {
      //@ts-ignore
      ...this.editedScene,
      elementPositions: {
        //@ts-ignore
        ...this.editedScene.elementPositions,
        [id]: position
      }
    };
  }

  updateSceneTextProperties(id: string, properties: {
    text?: string;
    fontSize?: number;
    fontFamily?: string;
    fill?: string
  }) {
    if (!this.editedScene) return;
    //@ts-ignore
    const updated = { ...this.editedScene };

    if (properties.text !== undefined) {
      const textIndex = parseInt(id.split('-')[1]);
      if (updated.text && updated.text[textIndex]) {
        updated.editedText = updated.editedText || [...updated.text];
        updated.editedText[textIndex] = properties.text;
      }
    }

    updated.textProperties = updated.textProperties || {};
    updated.textProperties[id] = {
      ...updated.textProperties[id],
      ...properties
    };

    this.editedScene = updated;
  }


  setSceneLayerPosition(sceneId: string, layerId: string, position: {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    angle: number;
  }) {
    if (!this.sceneLayerPositions[sceneId]) {
      this.sceneLayerPositions[sceneId] = {};
    }
    this.sceneLayerPositions[sceneId][layerId] = position;
  }

  getSceneLayerPositions(sceneId: string) {
    return this.sceneLayerPositions[sceneId] || {};
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


    const nestedBgLayers = (scene.backgrounds || [])
      .slice(1)
      .map((bg, i) => ({
        ...bg,
        id: `bg-${i}`,
        layerType: 'background' as const,
        timeFrame: { start: sceneStart, end: sceneStart + NESTED_DURATION_MS }
      }));


    const nestedGifLayers = (scene.gifs || []).map((gif, i) => ({
      ...gif,
      id: `svg-${i}-child`,
      layerType: 'svg' as const,
      timeFrame: { start: sceneStart, end: sceneStart + NESTED_DURATION_MS },
      calculatedPosition: this.calculateSvgPositions((scene.gifs || []).length)[i]
    }));


    const nestedAnimLayers = (scene.animations || []).map((anim, i) => ({
      ...anim,
      id: `animation-${i}-child`,
      layerType: 'animation' as const,
      timeFrame: { start: sceneStart, end: sceneStart + NESTED_DURATION_MS }
    }));


    const nestedElemLayers = (scene.elements || []).map((el, i) => ({
      ...el,
      id: `element-${i}`,
      layerType: 'element' as const,
      timeFrame: { start: sceneStart, end: sceneStart + NESTED_DURATION_MS }
    }));


    const nestedTextLayers = (scene.text || []).map((txt, i) => ({
      id: `text-${i}-child`,
      value: txt,
      layerType: 'text' as const,
      placement: {
        x: 20,
        y: 20,
        width: (this.canvas?.width ?? 800) - 40,
        height: undefined
      },
      properties: { fontSize: 24, fontFamily: "Arial", fill: "#000" },
      timeFrame: { start: sceneStart, end: sceneStart + NESTED_DURATION_MS }
    }));

    //@ts-ignore
    const nestedTtsLayers = (scene.tts_audio_url || []).map((url, i) => ({
      id: `tts-${i}-child`,
      audioUrl: url,
      layerType: 'tts' as const,
      timeFrame: { start: sceneStart, end: sceneStart + NESTED_DURATION_MS },
      played: false,
      audioElement: Object.assign(new Audio(`${API_URL}${url}`), { preload: 'auto' })
    }));

    const nestedSvgLayers = (scene.sceneSvgs || []).map((svgEl, i) => ({
      ...svgEl,
      id: `svg-${i}-child`,
      layerType: 'svg' as const,
      timeFrame: { start: sceneStart, end: sceneStart + NESTED_DURATION_MS },
      calculatedPosition: this.calculateSvgPositions((scene.sceneSvgs || []).length)[i],
      properties: {
        ...svgEl.properties,
        animationType: svgEl.properties.animationType ?? undefined
      },
    }));


    const sceneObj = {
      id: sceneId,
      name: `Scene ${idx + 1}`,
      layerType: "scene" as const,
      bgImage: scene.backgrounds?.[0]?.background_url || null,
      timeFrame: { start: sceneStart, end: sceneEnd },
      backgrounds: nestedBgLayers,
      gifs: nestedGifLayers,
      animations: nestedAnimLayers,
      elements: nestedElemLayers,
      text: nestedTextLayers,
      tts: nestedTtsLayers,
      sceneSvgs: nestedSvgLayers,


    };

    //@ts-ignore
    this.scenes.push(sceneObj);


    const sceneElem: SceneEditorElement = {
      id: sceneObj.id,
      name: sceneObj.name,
      type: "scene",
      //@ts-ignore
      placement: {
        x: 0,
        y: 0,
        width: this.canvas?.width ?? 800,
        height: this.canvas?.height ?? 600,
      },
      timeFrame: sceneObj.timeFrame,
      properties: {
        sceneIndex: idx,
        bgImage: sceneObj.bgImage,
        backgrounds: sceneObj.backgrounds,
        gifs: sceneObj.gifs,
        animations: sceneObj.animations,
        elements: sceneObj.elements,
        //@ts-ignore
        text: sceneObj.text,
        tts: sceneObj.tts,
        sceneSvgs: sceneObj.sceneSvgs,

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
      const newStart = timeFrame.start != null ? timeFrame.start : orig.start;
      const newEnd = timeFrame.end != null ? timeFrame.end : orig.end;

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
      tryUpdate(scene.tts) ||
      tryUpdate(scene.sceneSvgs)       // ← added
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
          tryUpdate(p.tts) ||
          tryUpdate(p.sceneSvgs);       // ← added
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

    // Adjust layer positions without changing durations
    const adjustLayerPositions = (arr?: SceneLayer[]) => {
      arr?.forEach(layer => {
        const positionRatio = (layer.timeFrame.start - oldStart) / oldDuration;
        const newLayerStart = newStart + positionRatio * newDuration;
        const layerDuration = layer.timeFrame.end - layer.timeFrame.start;

        layer.timeFrame = {
          start: Math.max(newStart, Math.min(newLayerStart, newEnd - layerDuration)),
          end: Math.min(newEnd, Math.max(newLayerStart + layerDuration, newStart + layerDuration)),
        };

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
    //@ts-ignore
    adjustLayerPositions(scene.sceneSvgs);   // ← added

    if (sceneElem) {
      const p = sceneElem.properties as any;
      adjustLayerPositions(p.backgrounds);
      adjustLayerPositions(p.gifs);
      adjustLayerPositions(p.animations);
      adjustLayerPositions(p.elements);
      adjustLayerPositions(p.text);
      adjustLayerPositions(p.tts);
      adjustLayerPositions(p.sceneSvgs);     // ← added
    }

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
      shiftNested(scene.sceneSvgs);            // ← added

      if (sceneElem) {
        const p = sceneElem.properties as any;
        shiftNested(p.backgrounds);
        shiftNested(p.gifs);
        shiftNested(p.animations);
        shiftNested(p.elements);
        shiftNested(p.text);
        shiftNested(p.tts);
        shiftNested(p.sceneSvgs);              // ← added
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
        shiftNested(s.sceneSvgs);              // ← added

        if (ee) {
          const p = ee.properties as any;
          shiftNested(p.backgrounds);
          shiftNested(p.gifs);
          shiftNested(p.animations);
          shiftNested(p.elements);
          shiftNested(p.text);
          shiftNested(p.tts);
          shiftNested(p.sceneSvgs);            // ← added
        }
      }
    }

    this.maxTime = this.getMaxTime();
    this.scenesTotalTime = this.getScenesTotalTime();
    this.refreshAnimations();
    this.setActiveScene(sceneIndex);
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
    const sel = this.selectedElement;
    if (!sel || sel.type !== 'svg') return;

    this.clearCurrentAnimations();

    // try scene first
    const sceneSvgs = this.scenes[this.activeSceneIndex]?.sceneSvgs || [];
    const sceneItem = sceneSvgs.find(s => s.id === sel.id);
    if (sceneItem) {
      sceneItem.properties.animationType = animationType;
      // mirror back onto sel for play method
      sel.properties.animationType = animationType;
      console.log(`Assigned scene SVG anim="${animationType}" to ${sel.id}`);
    } else {
      // global SVG
      sel.properties.animationType = animationType;
      this.updateEditorElement(sel);
      console.log(`Assigned global SVG anim="${animationType}" to ${sel.id}`);
    }
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

    // default to the selectedElement's property
    let animationType = this.selectedElement.properties.animationType;

    // 1) Grab the correct fabric.Group *and* scene-level properties if any
    let svgGroup: fabric.Group | undefined;
    const sceneIdx = (this.selectedElement.properties as any).sceneIndex;
    if (typeof sceneIdx === 'number') {
      const sceneSvgs = this.scenes[sceneIdx]?.sceneSvgs || [];
      const sceneItem = sceneSvgs.find(s => s.id === this.selectedElement!.id);
      if (sceneItem) {
        svgGroup = sceneItem.fabricObject as fabric.Group;
        // **override** animationType from scene data
        animationType = sceneItem.properties.animationType;
      }
    }

    // 2) fallback to global
    if (!svgGroup) {
      svgGroup = this.selectedElement.fabricObject as fabric.Group;
    }
    if (!svgGroup) {
      console.warn('⚠️ No fabric object found for the selected SVG.');
      return;
    }

    console.log(`🎬 Playing animation: ${animationType} for SVG ID: ${this.selectedElement.id}`);

    if (animationType === WALKING) {
      this.applyWalkingAnimation(svgGroup);
    } else if (animationType === HANDSTAND) {
      this.applyHandstandAnimation(svgGroup);
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
          // if further need any loop applying on the element comment these 

          // delete (obj as any).__timeoutIds;
          // delete (obj as any).__hasEverPopped;
          // delete (obj as any).__isLooping;
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

      console.log(`✅ Found SVG part: ${partId}, applying handstand animation`);

      const animInstance = anime({
        targets: { angle: targetElement.angle || 0 },
        angle: animationData.keys.map((k) => k.v),
        duration: 3000,
        easing: 'linear',
        loop: true,
        update: (anim) => {
          // Update the target's angle property on each frame.
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
    this.setCurrentTimeInMs(newTime)
    this.animationTimeLine.seek(newTime)
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

          if (doPop && forward && !(obj as any).__hasEverPopped) {
            (obj as any).__hasEverPopped = true;
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
      if (!scene.fabricObjects.sceneSvgs) {
        scene.fabricObjects.sceneSvgs = [];
      }
      if (scene.sceneSvgs) {
        scene.sceneSvgs.forEach((svgItem, i) => {
          const inRange = newTime >= svgItem.timeFrame.start && newTime <= svgItem.timeFrame.end;
          if (!inRange && scene.fabricObjects?.sceneSvgs?.[i]) {
            this.canvas?.remove(scene.fabricObjects.sceneSvgs[i]);
          }
        });
      }
      if (scene.fabricObjects.background) {
        const inRange = newTime >= sc.timeFrame.start && newTime <= sc.timeFrame.end;
        scene.fabricObjects.background.set({ visible: inRange });
        if (inRange) this.canvas?.add(scene.fabricObjects.background);
      }
      const is0to3000 = sc.timeFrame.start === 0 && sc.timeFrame.end === SCENE_ELEMENTS_LAYERS_TIME;
      toggleVisibility(scene.fabricObjects.gifs, scene.gifs, true, is0to3000);
      toggleVisibility(scene.fabricObjects.backgrounds, scene.backgrounds);
      toggleVisibility(scene.fabricObjects.texts, scene.text);
      toggleVisibility(scene.fabricObjects.tts, scene.tts);
      toggleVisibility(scene.fabricObjects.sceneSvgs, scene.sceneSvgs, true, is0to3000);
      toggleVisibility(scene.fabricObjects.elements, scene.elements);


      scene.elements?.forEach((element, i) => {
        if (!scene.fabricObjects!.elements[i]) {
          let fabricObj: fabric.Object;

          if (element.type === 'svg' || (element as any).svg_url) {
            // Handle SVG elements
            const url = (element as any).svg_url;
            fabricObj = new fabric.Group([], {
              __isSvg: true,
              visible: false
            });

            // Load the SVG and add to the group
            if (url) {
              fabric.loadSVGFromURL(url, (objects, options) => {
                const svgGroup = fabric.util.groupSVGElements(objects, options);
                (fabricObj as fabric.Group).addWithUpdate(svgGroup);
                scene.canvas?.renderAll();
              });
            }
          } else {
            // Handle other element types (create appropriate fabric object)
            fabricObj = new fabric.Object({
              visible: false
            });
          }

          scene.fabricObjects!.elements[i] = fabricObj;
        }
      });

      if (scene.sceneSvgs && scene.fabricObjects.sceneSvgs) {
        scene.sceneSvgs.forEach((svgItem, i) => {
          const svgObj = scene.fabricObjects.sceneSvgs[i];
          const inRange = newTime >= svgItem.timeFrame.start && newTime <= svgItem.timeFrame.end;
          if (svgObj) {
            svgObj.set({ visible: inRange });
            if (inRange) {
              if (!this.canvas?.contains(svgObj)) {
                this.canvas?.add(svgObj);
              }
            } else {
              this.canvas?.remove(svgObj);
            }
          } else if (svgItem.fabricObject) {
            scene.fabricObjects.sceneSvgs[i] = svgItem.fabricObject;
            svgItem.fabricObject.set({ visible: inRange });
            if (inRange) {
              this.canvas?.add(svgItem.fabricObject);
            }
          }
        });
      }
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
    this.updateVideoElements();
    this.updateSvgElements();
    if (this.canvas) {
      this.canvas.discardActiveObject();
      this.canvas.renderAll();
    }
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
    console.log('Adding SVG:', index);

    const svgElement = document.getElementById(`svg-${index}`) as HTMLImageElement | null;
    if (!svgElement) {
      console.error('SVG Element not found:', `svg-${index}`);
      return;
    }

    const id = getUid();
    const parser = new DOMParser();
    const serializer = new XMLSerializer();

    fetch(svgElement.src)
      .then(res => res.text())
      .then(svgText => {
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
        const svgRoot = svgDoc.documentElement;
        if (!svgRoot.hasAttribute('xmlns')) {
          svgRoot.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        }

        fabric.loadSVGFromString(
          serializer.serializeToString(svgRoot),
          (objects, options) => {
            if (!objects?.length) {
              console.error('🚨 Failed to load SVG objects');
              return;
            }

            // --- rebuild logic unchanged ---
            const objectMap = new Map<string, fabric.Object>();
            objects.forEach((obj: any) => {
              if (obj.id) objectMap.set(obj.id, obj);
            });

            const allParts: { id: string; obj: fabric.Object }[] = [];
            const rebuild = (el: Element): fabric.Object | null => {
              const node = el.nodeName.toLowerCase();
              let out: fabric.Object | null = null;

              if (node === 'g') {
                const children = Array.from(el.children)
                  .map(child => rebuild(child))
                  .filter((o): o is fabric.Object => !!o);
                const rawId = el.getAttribute('id') || `group-${getUid()}`;
                out = new fabric.Group(children, { name: rawId, selectable: true });
                // override toSVG...
              } else if (node === 'path') {
                const rawId = el.getAttribute('id');
                if (rawId && objectMap.has(rawId)) {
                  out = objectMap.get(rawId)!;
                  out.set('name', rawId);
                } else {
                  out = new fabric.Path('', { name: rawId || `unnamed-path-${getUid()}`, selectable: true });
                }
              }
              if (out) {
                if (!out.name?.trim()) out.set('name', node);
                allParts.push({ id: (out as any).id, obj: out });
              }
              return out;
            };

            const topLevel = Array.from(svgRoot.children)
              .map(child => rebuild(child))
              .filter((o): o is fabric.Object => !!o);

            const fullGroup = new fabric.Group(topLevel, { name: 'full-svg', selectable: true });
            const scale = 0.3;
            const cw = this.canvas?.width ?? 800;
            const ch = this.canvas?.height ?? 600;
            fullGroup.set({
              left: cw / 2 - (fullGroup.width! * scale) / 2,
              top: ch / 2 - (fullGroup.height! * scale) / 2,
              scaleX: scale,
              scaleY: scale,
              hasControls: true,
              padding: 50,
              objectCaching: false,
            });

            // --- build your editor element ---
            const editorElement: SvgEditorElement = {
              id,
              name: `SVG ${index + 1}`,
              type: 'svg',
              placement: {
                x: fullGroup.left!,
                y: fullGroup.top!,
                width: fullGroup.width! * scale,
                height: fullGroup.height! * scale,
                rotation: 0,
                scaleX: scale,
                scaleY: scale,
              },
              timeFrame: this.getCurrentTimeFrame(),
              properties: {
                elementId: `svg-${id}`,
                src: svgElement.src,
                animationType: undefined,
              },
              fabricObject: fullGroup,
            };

            // --- 1) add to canvas as before ---
            this.canvas?.add(fullGroup);
            this.canvas?.renderAll();

            // --- 2) conditionally append to sceneSvgs or globally ---
            const active = this.activeSceneIndex;
            if (active != null && active >= 0 && active < this.scenes.length) {
              // ensure sceneSvgs array exists
              if (!Array.isArray(this.scenes[active].sceneSvgs)) {
                this.scenes[active].sceneSvgs = [];
              }
              this.scenes[active].sceneSvgs.push(editorElement);
              console.log(`Appended SVG to scene ${active}:`, editorElement);
            } else {
              // fallback: global layer
              this.addEditorElement(editorElement);
              console.log('Appended SVG as global layer:', editorElement);
            }


            this.setSelectedElement(editorElement);
          }
        );
      })
      .catch(err => console.error('⚠️ Error fetching SVG:', err));
  }


  addAudio(index: number) {
    const audioElement = document.getElementById(`audio-${index}`)
    if (!isHtmlAudioElement(audioElement)) {
      return
    }
    const audioDurationMs = audioElement.duration * 1000
    const id = getUid()
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
        elementId: `audio-${id}`,
        src: audioElement.src,
      },
    })
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
    const currentTimeMs = this.currentTimeInMs;

    // First find the currently active scene based on time
    let activeSceneIndex = -1;
    this.scenes.forEach((scene, index) => {
      if (currentTimeMs >= scene.timeFrame.start && currentTimeMs <= scene.timeFrame.end) {
        activeSceneIndex = index;
      }
    });

    // Pause all videos not in the active scene
    this.scenes.forEach((scene, index) => {
      if (index !== activeSceneIndex) {
        scene.fabricObjects?.elements?.forEach((element: any) => {
          if (element.type === 'video' && element._element) {
            const videoElement = element._element as HTMLVideoElement;
            if (element.data.isPlaying) {
              videoElement.pause();
              element.set('data', { ...element.data, isPlaying: false });
              element.set('dirty', true);
            }
          }
        });
      }
    });

    // Handle videos in the active scene (original functionality)
    if (activeSceneIndex !== -1 && this.scenes[activeSceneIndex]) {
      const activeScene = this.scenes[activeSceneIndex];
      const sceneTimeFrame = activeScene.timeFrame;

      activeScene.fabricObjects?.elements?.forEach((element: any) => {
        if (element.type === 'video' && element._element && element.data) {
          const videoElement = element._element as HTMLVideoElement;
          const elementTimeFrame = element.data.timeFrame;

          if (!elementTimeFrame) {
            console.warn('Video element missing timeFrame data', element);
            return;
          }

          // Check if video should play based on both scene and element timeframes
          const isElementActive = currentTimeMs >= elementTimeFrame.start &&
            currentTimeMs <= elementTimeFrame.end &&
            currentTimeMs >= sceneTimeFrame.start &&
            currentTimeMs <= sceneTimeFrame.end;

          if (this.playing && isElementActive) {
            if (!element.data.isPlaying) {
              const videoTime = (currentTimeMs - elementTimeFrame.start) / 1000;
              videoElement.currentTime = Math.max(0, videoTime);
              videoElement.muted = false;
              videoElement.play()
                .then(() => {
                  element.set('data', { ...element.data, isPlaying: true });
                  element.set('dirty', true);
                })
                .catch(err => console.warn('Video play error:', err));
            }
          } else {
            if (element.data.isPlaying) {
              videoElement.pause();
              element.set('data', { ...element.data, isPlaying: false });
              element.set('dirty', true);
            }
          }
        }
      });
    }

    // Handle global video elements with scrubbing support
    this.editorElements
      .filter((element): element is VideoEditorElement => element.type === 'video')
      .forEach((element) => {
        const video = document.getElementById(element.properties.elementId) as HTMLVideoElement | null;
        if (!video || !isHtmlVideoElement(video)) return;

        const { start, end } = element.timeFrame;

        // Always update video time when playhead moves (even when not playing)
        if (currentTimeMs >= start && currentTimeMs <= end) {
          const desiredTime = (currentTimeMs - start) / 1000;
          const clampedTime = Math.max(0, Math.min(desiredTime, video.duration));

          if (!video.seeking && Math.abs(video.currentTime - clampedTime) > 0.1) {
            video.currentTime = clampedTime;
          }
        }

        // Handle play/pause state
        const inRange = currentTimeMs >= start && currentTimeMs < end;
        if (!inRange) {
          if (!video.paused) {
            video.pause();
            element.properties.isPlaying = false;
          }
          return;
        }

        if (this.playing) {
          if (video.paused) {
            video.muted = false;
            video.play()
              .then(() => {
                element.properties.isPlaying = true;
              })
              .catch(err => console.warn('Video play error:', err));
          }
        } else {
          if (!video.paused) {
            video.pause();
            element.properties.isPlaying = false;
          }
        }
      });
  }



  updateAudioElements() {
    const now = this.currentTimeInMs;
    const scene = this.scenes[this.activeSceneIndex];
    scene?.fabricObjects?.elements.forEach((el: any) => {
      if (el.data?.mediaType !== 'audio') return;
      const audio = el.data.mediaElement as HTMLAudioElement;
      const { start, end } = el.data.timeFrame;
      const inRange = now >= start && now <= end;
      if (this.playing && inRange) {
        if (!el.data.isPlaying) {
          audio.currentTime = Math.max(0, (now - start) / 1000);
          audio.play().catch(e => console.warn('Audio play error', e));
          el.set('data', { ...el.data, isPlaying: true });
        }
      } else if (el.data.isPlaying) {
        audio.pause();
        audio.currentTime = 0;
        el.set('data', { ...el.data, isPlaying: false });
      }

      el.set('dirty', true);
    });
    this.editorElements
      .filter((e): e is AudioEditorElement => e.type === 'audio')
      .forEach(element => {
        const audio = document.getElementById(
          element.properties.elementId
        ) as HTMLAudioElement | null;
        if (!audio) return;
        const { start, end } = element.timeFrame;
        const inRange = now >= start && now <= end;
        if (this.playing && inRange) {
          if (!(element.properties as any).isAudioPlaying) {
            audio.currentTime = Math.max(0, (now - start) / 1000);
            audio.play().catch(() => { });
            (element.properties as any).isAudioPlaying = true;
          }
        } else if ((element.properties as any).isAudioPlaying) {
          audio.pause();
          audio.currentTime = 0;
          (element.properties as any).isAudioPlaying = false;
        }
      });
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
                  `⚠️ Missing SVG part: ${partId}, skipping walking angle update.`
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

  async saveCanvasToVideoWithAudioWebmMp4() {
    console.log('Modified to capture video & standalone audio at correct timeline positions');

    const mp4 = this.selectedVideoFormat === 'mp4';
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const stream = canvas.captureStream(30);

    // 1) Gather global clips
    const videoElements = this.editorElements.filter(isEditorVideoElement);
    const audioElements = this.editorElements.filter(isEditorAudioElement);

    // 2) Gather scene clips (video & audio) from fabricObjects.elements
    type ClipInfo = { element: HTMLMediaElement, start: number };
    const sceneClips: ClipInfo[] = [];

    for (const scene of this.scenes) {
      (scene.fabricObjects?.elements || []).forEach((obj: any) => {
        const tf = obj.data?.timeFrame;
        const el = obj.data?.mediaElement as HTMLMediaElement | undefined;
        if (tf && el && (obj.data.mediaType === 'video' || obj.data.mediaType === 'audio')) {
          sceneClips.push({ element: el, start: tf.start });
        }
      });
    }

    // 3) Gather TTS clips
    const ttsClips: ClipInfo[] = this.scenes
      .flatMap(scene => scene.tts ?? [])
      .map(tts => ({ element: tts.audioElement!, start: tts.timeFrame.start }));

    const allClips: ClipInfo[] = [];

    // A) Global video
    videoElements.forEach(v => {
      const el = document.getElementById(v.properties.elementId) as HTMLVideoElement | null;
      if (el) allClips.push({ element: el, start: v.timeFrame.start });
    });

    // B) Global audio
    audioElements.forEach(a => {
      const el = document.getElementById(a.properties.elementId) as HTMLAudioElement | null;
      if (el) allClips.push({ element: el, start: a.timeFrame.start });
    });

    // C) Scene video/audio
    allClips.push(...sceneClips);

    // D) TTS
    allClips.push(...ttsClips);

    const hasMedia = allClips.length > 0;
    if (hasMedia) {
      if (!this.audioContext) this.audioContext = new AudioContext();
      const audioContext = this.audioContext;
      const mixedAudioDestination = audioContext.createMediaStreamDestination();

      // Wire every clip into the mixer and schedule its play()
      allClips.forEach(({ element, start }) => {
        // prime buffering
        element.crossOrigin = 'anonymous';
        element.preload = 'auto';
        element.load();

        // reuse or create a source node
        let srcNode = this.audioSourceNodes.get(element);
        if (!srcNode) {
          srcNode = audioContext.createMediaElementSource(element);
          this.audioSourceNodes.set(element, srcNode);
        }
        srcNode.connect(mixedAudioDestination);

        // schedule playback
        setTimeout(() => {
          element.currentTime = 0;
          element.play().catch(err => console.error('Playback error:', err));
        }, start);
      });

      // merge audio into our canvas stream
      mixedAudioDestination.stream.getAudioTracks().forEach(track => {
        stream.addTrack(track);
      });

      // Now start recording
      const recorderVideo = document.createElement('video');
      recorderVideo.srcObject = stream;
      recorderVideo.width = canvas.width;
      recorderVideo.height = canvas.height;

      recorderVideo.play().then(() => {
        console.log('Recording started with all media scheduled');

        const recorder = new MediaRecorder(stream);
        const chunks: Blob[] = [];

        recorder.ondataavailable = e => chunks.push(e.data);
        recorder.onstop = async () => {
          const webmBlob = new Blob(chunks, { type: 'video/webm' });

          if (mp4) {
            showLoading();
            try {
              const data = new Uint8Array(await webmBlob.arrayBuffer());
              const ffmpeg = new FFmpeg();
              const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.2/dist/umd';

              await ffmpeg.load({
                coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
              });

              await ffmpeg.writeFile('video.webm', data);
              await ffmpeg.exec([
                '-y', '-i', 'video.webm',
                '-c:v', 'libx264',
                ...(hasMedia ? ['-c:a', 'aac', '-b:a', '192k'] : []),
                '-strict', 'experimental',
                'video.mp4'
              ]);

              const out = await ffmpeg.readFile('video.mp4');
              const mp4Blob = new Blob([out], { type: 'video/mp4' });
              const url = URL.createObjectURL(mp4Blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'video.mp4';
              a.click();
            } catch (err) {
              console.error('MP4 conversion failed:', err);
              const url = URL.createObjectURL(webmBlob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'video.webm';
              a.click();
            } finally {
              hideLoading();
            }
          } else {
            const url = URL.createObjectURL(webmBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'video.webm';
            a.click();
          }
        };

        recorder.start();
        setTimeout(() => recorder.stop(), this.maxTime);
      }).catch(err => {
        console.error('Recorder video play error:', err);
      });
    } else {
      // fallback: no media, just record canvas
      const fallbackVideo = document.createElement('video');
      fallbackVideo.srcObject = stream;
      fallbackVideo.width = canvas.width;
      fallbackVideo.height = canvas.height;
      fallbackVideo.play().then(() => {
        const recorder = new MediaRecorder(stream);
        const chunks: Blob[] = [];
        recorder.ondataavailable = e => chunks.push(e.data);
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'video.webm';
          a.click();
        };
        recorder.start();
        setTimeout(() => recorder.stop(), this.maxTime);
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


          if (!document.getElementById(element.properties.elementId)) {
            const audioEl = document.createElement('audio');
            audioEl.id = element.properties.elementId;
            audioEl.src = element.properties.src;
            audioEl.style.display = 'none';
            document.body.appendChild(audioEl);
          }

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

                // Add modification listener
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

          const sceneId = `scene-${element.properties.sceneIndex}`;
          const sceneData = this.scenes[element.properties.sceneIndex];


          const initialLayerPositions = this.sceneModifiedStates?.has(element.properties.sceneIndex)
            ? {}
            : this.getSceneLayerPositions(sceneId);

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
              tts: [],
              sceneSvgs: [],

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
            const editedTextProps = data.source.type === 'text'
              //@ts-ignore
              ? this.editedScene?.textProperties?.[data.elementId]
              : null;

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
              lockRotation: data.zIndex === -1,
              left: initialLayerPositions[data.elementId]?.x ?? obj.left,
              top: initialLayerPositions[data.elementId]?.y ?? obj.top,
              scaleX: initialLayerPositions[data.elementId]?.scaleX ?? obj.scaleX ?? 1,
              scaleY: initialLayerPositions[data.elementId]?.scaleY ?? obj.scaleY ?? 1,
              angle: initialLayerPositions[data.elementId]?.angle ?? obj.angle ?? 0,
              ...(editedTextProps && {
                text: editedTextProps.text,
                fontSize: editedTextProps.fontSize,
                fontFamily: editedTextProps.fontFamily,
                fill: editedTextProps.fill
              })
            });
            sceneObjectsMap[data.elementId] = obj;
            obj.on('modified', () => {
              if (!this.sceneModifiedStates) {
                this.sceneModifiedStates = new Set();
              }
              this.sceneModifiedStates.add(element.properties.sceneIndex);
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
              } else {
                //@ts-ignore
                const bgImg = sceneData.fabricObjects.backgrounds[index];
                bgImg.set({ visible: true });
                addObjectToScene(bgImg, {
                  zIndex: 0,
                  elementId: bg.id,
                  source: bg,
                  timeFrame: bg.timeFrame
                });
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
              case 'video': {
                const src = childElement.properties.src;
                if (!src) return;
                const videoElement = document.createElement('video');
                videoElement.src = src;
                videoElement.crossOrigin = 'anonymous';
                videoElement.preload = 'auto';
                videoElement.id = childElement.id;
                videoElement.style.display = 'none';
                videoElement.muted = false;
                videoElement.loop = childElement.properties.loop || false;
                videoElement.playsInline = true;
                let videoObj: fabric.Image;
                const handleLoadedMetadata = () => {
                  document.body.appendChild(videoElement);

                  const VideoObject = fabric.util.createClass(fabric.Image, {
                    type: 'video',
                    initialize: function (element: HTMLVideoElement, options: any) {
                      this.callSuper('initialize', element, options);
                      this.set({ objectCaching: false });
                    },
                    _render: function (ctx: CanvasRenderingContext2D) {
                      // Ensure video is ready and playing
                      if (this._element.readyState > 2) {
                        ctx.drawImage(
                          this._element,
                          -this.width / 2,
                          -this.height / 2,
                          this.width,
                          this.height
                        );
                      }
                    }
                  });

                  videoObj = new VideoObject(videoElement, {
                    left: pos.x,
                    top: pos.y,
                    width: pos.width,
                    height: pos.height,
                    angle: pos.rotation || 0,
                    scaleX: pos.scaleX || 1,
                    scaleY: pos.scaleY || 1,
                    selectable: true,
                    name: childElement.id,
                    data: {
                      type: 'video',
                      elementId: childElement.id,
                      source: childElement,
                      timeFrame: childElement.timeFrame,
                      mediaType: 'video',
                      mediaElement: videoElement,
                      isPlaying: false
                    }
                  });


                  videoElement.addEventListener('play', () => {
                    videoObj.set('data', { ...videoObj.data, isPlaying: true });
                    videoObj.set('dirty', true);
                  });

                  videoElement.addEventListener('pause', () => {
                    videoObj.set('data', { ...videoObj.data, isPlaying: false });
                    videoObj.set('dirty', true);
                  });


                  const renderVideo = () => {
                    if (videoElement.readyState > 2) {
                      videoObj.set('dirty', true);
                      canvas.requestRenderAll();
                    }
                    requestAnimationFrame(renderVideo);
                  };
                  renderVideo();

                  sceneData.fabricObjects.elements.push(videoObj);
                  addObjectToScene(videoObj, {
                    zIndex: 3,
                    elementId: childElement.id,
                    source: childElement,
                    timeFrame: childElement.timeFrame,
                    type: 'video'
                  });
                };
                videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
                videoElement.addEventListener('error', (e) => {
                  console.error('Video error:', e);

                });
                break;
              }
              case 'svg': {
                const savedPos = initialLayerPositions[childElement.id] || {};
                console.log(`savedPos`)
                console.log(savedPos)
                const basePos = {
                  x: savedPos.x || childElement.placement?.x || x + width * 0.35,
                  y: savedPos.y || childElement.placement?.y || y + height * 0.35,
                  scaleX: savedPos.scaleX || childElement.placement?.scaleX || 0.3,
                  scaleY: savedPos.scaleY || childElement.placement?.scaleY || 0.3,
                  angle: savedPos.angle || childElement.placement?.rotation || 0,
                  originX: savedPos.originX || 'center',
                  originY: savedPos.originY || 'center',
                  width: savedPos.width || childElement.placement?.width,
                  height: savedPos.height || childElement.placement?.height
                };
                const existingObj = sceneData.fabricObjects?.elements?.find(
                  (el: any) => el?.data?.elementId === childElement.id
                );

                if (existingObj) {

                  existingObj.set({
                    left: basePos.x,
                    top: basePos.y,
                    scaleX: basePos.scaleX,
                    scaleY: basePos.scaleY,
                    angle: basePos.angle,
                    originX: basePos.originX,
                    originY: basePos.originY,
                    visible: true,
                    selectable: true
                  });


                  if (childElement.properties.parts && existingObj instanceof fabric.Group) {
                    existingObj.getObjects().forEach((obj: fabric.Object) => {
                      if (obj instanceof fabric.Path) {
                        const part = childElement.properties.parts.find((p: any) => p.name === obj.name);
                        if (part) {
                          obj.set({
                            fill: part.fill,
                            stroke: part.stroke,
                            strokeWidth: part.strokeWidth || 1
                          });
                        }
                      }
                    });
                  }

                  existingObj.setCoords();
                  addObjectToScene(existingObj, {
                    zIndex: 3,
                    elementId: childElement.id,
                    source: childElement,
                    timeFrame: childElement.timeFrame
                  });
                }
                else if (childElement.properties.parts) {

                  const recreatedPaths = childElement.properties.parts.map((part: any) =>
                    new fabric.Path(part.path, {
                      name: part.name,
                      fill: part.fill,
                      stroke: part.stroke,
                      strokeWidth: part.strokeWidth || 1
                    })
                  );

                  const group = new fabric.Group(recreatedPaths, {
                    name: childElement.id,
                    left: basePos.x,
                    top: basePos.y,
                    scaleX: basePos.scaleX,
                    scaleY: basePos.scaleY,
                    angle: basePos.angle,
                    originX: basePos.originX,
                    originY: basePos.originY,
                    data: {
                      elementId: childElement.id,
                      isSvg: true,
                      zIndex: 3,
                      source: childElement,
                      timeFrame: childElement.timeFrame,
                      parts: childElement.properties.parts
                    },
                    hasControls: true,
                    hasBorders: true,
                    selectable: true,
                    evented: true,
                    visible: true,
                    padding: 10,
                    borderColor: '#0099ff',
                    cornerColor: '#0099ff',
                    cornerSize: 8,
                    transparentCorners: false
                  });


                  if (basePos.width && basePos.height) {
                    const bounds = group.getBoundingRect();
                    const scaleX = basePos.width / bounds.width;
                    const scaleY = basePos.height / bounds.height;
                    group.scaleX = scaleX;
                    group.scaleY = scaleY;
                  }

                  group.setCoords();


                  childElement.fabricObject = group;
                  sceneData.fabricObjects.elements.push(group);

                  group.on('modified', () => {
                    if (!this.sceneModifiedStates) {
                      this.sceneModifiedStates = new Set();
                    }
                    this.sceneModifiedStates.add(element.properties.sceneIndex);


                    this.updateEditorElement({
                      ...childElement,
                      placement: {
                        ...childElement.placement,
                        x: group.left,
                        y: group.top,
                        rotation: group.angle,
                        width: (group.width || 0) * group.scaleX,
                        height: (group.height || 0) * group.scaleY,
                        scaleX: group.scaleX,
                        scaleY: group.scaleY
                      }
                    });


                    if (group.data.parts) {
                      group.getObjects().forEach((obj: fabric.Object) => {
                        if (obj instanceof fabric.Path) {
                          const part = group.data.parts.find((p: any) => p.name === obj.name);
                          if (part) {
                            part.fill = obj.fill;
                            part.stroke = obj.stroke;
                            part.strokeWidth = obj.strokeWidth;
                          }
                        }
                      });
                    }
                  });

                  addObjectToScene(group, {
                    zIndex: 3,
                    elementId: childElement.id,
                    source: childElement,
                    timeFrame: childElement.timeFrame
                  });
                }
                else {

                  fabric.loadSVGFromURL(
                    childElement.properties.src,
                    (objects, options) => {
                      if (!objects.length) return;


                      const origW = options.width || 1;
                      const origH = options.height || 1;
                      const targetW = basePos.width || origW * basePos.scaleX;
                      const targetH = basePos.height || origH * basePos.scaleY;
                      const scaleX = targetW / origW;
                      const scaleY = targetH / origH;


                      const group = new fabric.Group(objects, {
                        name: childElement.id,
                        left: basePos.x,
                        top: basePos.y,
                        scaleX: scaleX,
                        scaleY: scaleY,
                        angle: basePos.angle,
                        originX: basePos.originX,
                        originY: basePos.originY,
                        data: {
                          elementId: childElement.id,
                          isSvg: true,
                          zIndex: 3,
                          source: childElement,
                          timeFrame: childElement.timeFrame,
                          originalWidth: origW,
                          originalHeight: origH
                        },
                        hasControls: true,
                        hasBorders: true,
                        selectable: true,
                        evented: true,
                        visible: true
                      });


                      const parts = objects.map((obj, i) => {
                        if (obj instanceof fabric.Path) {
                          return {
                            type: 'path',
                            name: obj.name || `path-${i}`,
                            fill: obj.fill,
                            stroke: obj.stroke,
                            strokeWidth: obj.strokeWidth || 1,
                            path: (obj as any).path
                          };
                        }
                        return null;
                      }).filter(Boolean);

                      group.data.parts = parts;
                      group.setCoords();


                      childElement.fabricObject = group;
                      sceneData.fabricObjects.elements.push(group);

                      group.on('modified', () => {
                        if (!this.sceneModifiedStates) {
                          this.sceneModifiedStates = new Set();
                        }
                        this.sceneModifiedStates.add(element.properties.sceneIndex);

                        this.updateEditorElement({
                          ...childElement,
                          placement: {
                            ...childElement.placement,
                            x: group.left,
                            y: group.top,
                            rotation: group.angle,
                            width: (group.width || 0) * group.scaleX,
                            height: (group.height || 0) * group.scaleY,
                            scaleX: group.scaleX,
                            scaleY: group.scaleY
                          },
                          properties: {
                            ...childElement.properties,
                            parts: group.getObjects().map(obj => {
                              if (obj instanceof fabric.Path) {
                                return {
                                  type: 'path',
                                  name: obj.name,
                                  fill: obj.fill,
                                  stroke: obj.stroke,
                                  strokeWidth: obj.strokeWidth,
                                  path: (obj as any).path
                                };
                              }
                              return null;
                            }).filter(Boolean)
                          }
                        });
                      });

                      addObjectToScene(group, {
                        zIndex: 3,
                        elementId: childElement.id,
                        source: childElement,
                        timeFrame: childElement.timeFrame
                      });
                    },
                    undefined,
                    { crossOrigin: 'anonymous' }
                  );
                }
                break;
              }
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
                const audioEl = document.createElement('audio');
                audioEl.src = childElement.properties.src!;
                audioEl.preload = 'auto';
                audioEl.loop = true;
                audioEl.id = childElement.id;
                audioEl.style.display = 'none';
                document.body.appendChild(audioEl);

                const rect = new fabric.Rect({
                  left: pos.x,
                  top: pos.y,
                  width: pos.width,
                  height: pos.height,
                  fill: 'transparent',
                  stroke: '#00f',
                  strokeWidth: 1,
                  selectable: true,
                });
                const audioGroup = new fabric.Group([rect], {
                  left: pos.x,
                  top: pos.y,
                  width: pos.width,
                  height: pos.height,
                  selectable: true,
                  type: 'audio',
                  data: {
                    type: 'audio',
                    elementId: childElement.id,
                    timeFrame: childElement.timeFrame,
                    mediaType: 'audio',
                    mediaElement: audioEl,
                    isPlaying: false,
                  }
                });
                canvas.add(audioGroup);
                sceneData.fabricObjects.elements.push(audioGroup);
                addObjectToScene(audioGroup, {
                  ...audioGroup.data,
                  type: 'audio',
                  source: childElement,
                  elementId: childElement.id,
                  timeFrame: childElement.timeFrame,
                  type: 'audio'
                });
                break;
              }







            }
          });
          sceneData.sceneSvgs?.forEach((svgItem, i) => {
            const now = this.currentTimeInMs;
            const { start, end } = svgItem.timeFrame;

            // Explicit visibility control based on time frame
            if (now < start || now > end) {
              if (svgItem.fabricObject) {
                svgItem.fabricObject.visible = false;
                this.canvas?.remove(svgItem.fabricObject);
              }
              return;
            }

            // load it once…
            if (!svgItem.fabricObject) {
              fabric.loadSVGFromURL(
                svgItem.properties.src,
                (objects, options) => {
                  const group = fabric.util.groupSVGElements(objects, {
                    ...options,
                    name: svgItem.id,
                    left: svgItem.placement.x,
                    top: svgItem.placement.y,
                    scaleX: svgItem.placement.scaleX,
                    scaleY: svgItem.placement.scaleY,
                    angle: svgItem.placement.rotation,
                    selectable: true,
                    objectCaching: false,
                    visible: true // Ensure visible when loaded in timeframe
                  });

                  svgItem.fabricObject = group;
                  sceneData.fabricObjects.sceneSvgs![i] = group;

                  addObjectToScene(group, {
                    zIndex: 4,
                    elementId: svgItem.id,
                    source: svgItem,
                    timeFrame: svgItem.timeFrame,
                  });

                  group.on('selected', () => {
                    this.setSelectedElement(svgItem);
                  });

                  this.canvas?.on('object:modified', e => {
                    if (e.target !== group) return;
                    const p = svgItem.placement;
                    const updated = {
                      ...p,
                      x: group.left ?? p.x,
                      y: group.top ?? p.y,
                      rotation: group.angle ?? p.rotation,
                      scaleX: group.scaleX ?? p.scaleX,
                      scaleY: group.scaleY ?? p.scaleY,
                    };
                    this.updateEditorElement({ ...svgItem, placement: updated });
                  });
                },
                (item, error) => console.error('SVG load error', error)
              );
            }
            else {
              // already loaded: just re-position & re-add if in timeframe
              const obj = svgItem.fabricObject!;
              obj.set({
                visible: true,
                left: svgItem.placement.x,
                top: svgItem.placement.y,
                scaleX: svgItem.placement.scaleX,
                scaleY: svgItem.placement.scaleY,
                angle: svgItem.placement.rotation,
              });
              addObjectToScene(obj, {
                zIndex: 4,
                elementId: svgItem.id,
                source: svgItem,
                timeFrame: svgItem.timeFrame,
              });
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