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
} from '../types'
import { FabricUitls } from '@/utils/fabric-utils'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'
import { handstandAnimation, walkingAnimations } from '@/utils/animations'
import { GLOBAL_ELEMENTS_TIME, HANDSTAND, hideLoading, SCENE_ELEMENTS_LAYERS_TIME, SCENE_ELEMENTS_TIME, showLoading, WALKING } from '@/utils/constants'
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
  getMaxTime(): number {
    // 1) compute furthest scene end
    const sceneMax = this.scenes.reduce(
      (maxEnd, scene) => Math.max(maxEnd, scene.timeFrame.end),
      0
    );

    // 2) convert constant to ms
    const globalMs = GLOBAL_ELEMENTS_TIME * 1000;

    // 3) return whichever is larger
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

    // Process all layer types
    const processLayers = <T extends { id?: string }>(
      items: T[] | undefined,
      type: string,
      defaultDuration = NESTED_DURATION_MS
    ) => {
      return (items || []).map((item, i) => ({
        ...item,
        id: item.id || `${type}-${idx}-${i}`,
        layerType: type as const,
        timeFrame: {
          start: sceneStart,
          end: sceneStart + (item.timeFrame?.duration || defaultDuration)
        },
      }));
    };

    // Create all layers
    const bgImage = scene.backgrounds?.[0]?.background_url || null;
    const nestedBgLayers = processLayers(scene.backgrounds?.slice(1), "background");
    const nestedGifLayers = processLayers(scene.gifs, "svg").map((gif, i) => ({
      ...gif,
      calculatedPosition: scene.gifs?.length ? this.calculateSvgPositions(scene.gifs.length)[i] : null
    }));
    const nestedAnimLayers = processLayers(scene.animations, "animation");
    const nestedElemLayers = processLayers(scene.elements, "element");

    // Text layer
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

    // TTS layer
    const ttsText = textArray[0] || null;
    const nestedTtsLayers = ttsText ? [{
      id: `tts-${idx}`,
      text: ttsText,
      layerType: "tts" as const,
      timeFrame: { start: sceneStart, end: sceneStart + NESTED_DURATION_MS },
      played: false
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

    this.scenes.push(sceneObj);

    // Create editor element
    const sceneElem: SceneEditorElement = {
      id: sceneObj.id,
      name: sceneObj.name,
      type: "scene",
      placement: {
        x: 0, y: 0,
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
      console.warn(' No layer selected to cut.')
      return
    }
    if (this.copiedElement) {
      console.warn(' Clipboard not empty—overwriting with new cut.')
    }
    this.copiedElement = this.selectedElement
    if (this.selectedElement.fabricObject) {
      this.canvas?.remove(this.selectedElement.fabricObject)
      this.canvas?.renderAll()
    }
    this.removeEditorElement(this.selectedElement.id)
    this.selectedElement = null
    console.log(' CUT element with ID:', this.copiedElement.id)
  }
  copyElement() {
    if (!this.selectedElement) {
      console.warn(' No layer selected for copying.')
      return
    }
    if (this.copiedElement) {
      console.warn(' Already copied a layer. Paste before copying again.')
      return
    }
    this.selectedElement.fabricObject?.clone((cloned: fabric.Object) => {
      if (!cloned) {
        console.error('Failed to clone fabric object!')
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
      console.log('Copied Layer:', this.copiedElement.name)
    })
  }
  pasteElement() {
    if (!this.copiedElement) {
      console.warn(' No copied layer! Copy one first.');
      return;
    }
    const elementToPaste = { ...this.copiedElement };
    this.copiedElement = null;
    if (elementToPaste) {
      elementToPaste.fabricObject?.clone((cloned: fabric.Object) => {
        if (!cloned) {
          console.error('Failed to clone Fabric.js object.');
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
        console.log('Pasted Full Layer', newElement.name);
      });
    } else {
      console.warn('Frame too small to paste!');
    }
  }
  deleteElement() {
    if (!this.selectedElement) {
      console.warn('No layer selected to delete.')
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
      console.warn('Cannot split audio layers.')
      return
    }
    const selectedElement = this.selectedElement
    const { start, end } = selectedElement.timeFrame
    const totalDuration = end - start

    if (totalDuration < 2000) {
      console.warn('Frame too small to split!')
      return
    }
    const midTime = Math.floor((start + end) / 2)
    this.updateEditorElementTimeFrame(selectedElement, { end: midTime })
    selectedElement.fabricObject?.clone((cloned: fabric.Object) => {
      if (!cloned) {
        console.error('Failed to clone Fabric.js object.')
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
    // this.refreshAnimations();
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

      // if this is a TTS (audio) layer, never let end move beyond original
      if (layer.layerType === "tts" && timeFrame.end != null) {
        newEnd = Math.min(newEnd, orig.end);
      }

      // commit the update
      arr[idx] = {
        ...layer,
        timeFrame: { start: newStart, end: newEnd },
      };
      return true;
    };

    // try every nested array (including tts now!)
    if (
      tryUpdate(scene.backgrounds) ||
      tryUpdate(scene.gifs) ||
      tryUpdate(scene.animations) ||
      tryUpdate(scene.elements) ||
      tryUpdate(scene.text) ||
      tryUpdate(scene.tts)         // ← include TTS
    ) {
      // also sync into your editorElements props
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

      // refresh any media or animations
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

    // Update scene and corresponding scene editor element
    scene.timeFrame = { start: newStart, end: newEnd };
    const sceneElem = this.editorElements.find(
      e => e.type === "scene" && e.properties.sceneIndex === sceneIndex
    ) as SceneEditorElement | undefined;
    if (sceneElem) {
      sceneElem.timeFrame = { start: newStart, end: newEnd };
    }

    // ✅ Clamp nested layers to be inside new scene timeFrame
    const clampNestedToScene = (arr?: SceneLayer[]) => {
      arr?.forEach(layer => {
        layer.timeFrame.start = Math.max(newStart, layer.timeFrame.start);
        layer.timeFrame.end = Math.min(newEnd, layer.timeFrame.end);

        // Prevent zero or negative duration
        if (layer.timeFrame.end <= layer.timeFrame.start) {
          layer.timeFrame.end = layer.timeFrame.start + 100; // 100ms minimum duration
        }
      });
    };

    clampNestedToScene(scene.backgrounds);
    clampNestedToScene(scene.gifs);
    clampNestedToScene(scene.animations);
    clampNestedToScene(scene.elements);  // ✅ elements
    clampNestedToScene(scene.text);
    clampNestedToScene(scene.tts);

    if (sceneElem) {
      const p = sceneElem.properties as any;
      clampNestedToScene(p.backgrounds);
      clampNestedToScene(p.gifs);
      clampNestedToScene(p.animations);
      clampNestedToScene(p.elements);  // ✅ elements
      clampNestedToScene(p.text);
      clampNestedToScene(p.tts);
    }

    // Shift nested layers if scene start has moved
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

    // Push forward subsequent scenes and their nested layers
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
  }



  // updateSceneTimeFrame(
  //   sceneIndex: number,
  //   tf: Partial<TimeFrame>
  // ) {
  //   const scene = this.scenes[sceneIndex];
  //   if (!scene) return;

  //   const oldStart = scene.timeFrame.start;
  //   const oldEnd = scene.timeFrame.end;
  //   const oldDuration = oldEnd - oldStart;


  //   const newStart = tf.start != null ? tf.start : oldStart;
  //   const newEnd = tf.end != null ? tf.end : oldEnd;
  //   const newDuration = newEnd - newStart;

  //   if (newStart < 0) throw new Error("Scene start must be ≥ 0");
  //   if (newEnd <= newStart) throw new Error("Scene end must be > start");

  //   // apply to scene & its editorElement
  //   scene.timeFrame = { start: newStart, end: newEnd };
  //   const sceneElem = this.editorElements.find(
  //     e => e.type === "scene" && e.properties.sceneIndex === sceneIndex
  //   ) as SceneEditorElement | undefined;
  //   if (sceneElem) {
  //     sceneElem.timeFrame = { start: newStart, end: newEnd };
  //   }


  //   const minNestedMs = SCENE_ELEMENTS_LAYERS_TIME * 1000;
  //   if (newDuration < minNestedMs) {
  //     const clampNested = (arr?: SceneLayer[]) => {
  //       arr?.forEach(layer => {
  //         layer.timeFrame.start = Math.max(layer.timeFrame.start, newStart);
  //         layer.timeFrame.end = Math.min(layer.timeFrame.end, newEnd);
  //       });
  //     };
  //     clampNested(scene.backgrounds);
  //     clampNested(scene.gifs);
  //     clampNested(scene.animations);
  //     clampNested(scene.elements);
  //     clampNested(scene.text);
  //     clampNested(scene.tts);

  //     if (sceneElem) {
  //       const p = (sceneElem as any).properties;
  //       clampNested(p.backgrounds);
  //       clampNested(p.gifs);
  //       clampNested(p.animations);
  //       clampNested(p.elements);
  //       clampNested(p.text);
  //       clampNested(p.tts);
  //     }
  //   }

  //   const startDelta = newStart - oldStart;
  //   if (startDelta !== 0) {
  //     const shiftNested = <T extends { timeFrame: TimeFrame }>(arr?: T[]) => {
  //       arr?.forEach(layer => {
  //         layer.timeFrame = {
  //           start: layer.timeFrame.start + startDelta,
  //           end: layer.timeFrame.end + startDelta,
  //         };
  //       });
  //     };
  //     shiftNested(scene.backgrounds);
  //     shiftNested(scene.gifs);
  //     shiftNested(scene.animations);
  //     shiftNested(scene.elements);
  //     shiftNested(scene.text);
  //     shiftNested(scene.tts);

  //     if (sceneElem) {
  //       const p = (sceneElem as any).properties;
  //       shiftNested(p.backgrounds);
  //       shiftNested(p.gifs);
  //       shiftNested(p.animations);
  //       shiftNested(p.elements);
  //       shiftNested(p.text);
  //       shiftNested(p.tts);
  //     }
  //   }
  //   const durationDelta = (newEnd - newStart) - oldDuration;
  //   if (durationDelta !== 0) {
  //     for (let i = sceneIndex + 1; i < this.scenes.length; i++) {
  //       const s = this.scenes[i];
  //       s.timeFrame = {
  //         start: s.timeFrame.start + durationDelta,
  //         end: s.timeFrame.end + durationDelta,
  //       };
  //       const ee = this.editorElements.find(
  //         e => e.type === "scene" && e.properties.sceneIndex === i
  //       ) as SceneEditorElement | undefined;
  //       if (ee) {
  //         ee.timeFrame = {
  //           start: ee.timeFrame.start + durationDelta,
  //           end: ee.timeFrame.end + durationDelta,
  //         };
  //       }
  //       const shiftNested = <T extends { timeFrame: TimeFrame }>(arr?: T[]) => {
  //         arr?.forEach(layer => {
  //           layer.timeFrame = {
  //             start: layer.timeFrame.start + durationDelta,
  //             end: layer.timeFrame.end + durationDelta,
  //           };
  //         });
  //       };
  //       shiftNested(s.backgrounds);
  //       shiftNested(s.gifs);
  //       shiftNested(s.animations);
  //       shiftNested(s.elements);
  //       shiftNested(s.text);
  //       shiftNested(s.tts);                   // ← bump TTS too

  //       if (ee) {
  //         const p = ee.properties as any;
  //         shiftNested(p.backgrounds);
  //         shiftNested(p.gifs);
  //         shiftNested(p.animations);
  //         shiftNested(p.elements);
  //         shiftNested(p.text);
  //         shiftNested(p.tts);
  //       }
  //     }
  //   }


  //   this.maxTime = this.getMaxTime();
  //   this.scenesTotalTime = this.getScenesTotalTime();
  //   this.refreshAnimations();
  // }



  // addEditorElement(editorElement: EditorElement) {
  //   console.log('Adding new element:', editorElement);
  //   const activeScene = this.editorElements.find(
  //     el => el.type === 'scene' &&
  //       (el as SceneEditorElement).properties.sceneIndex === this.activeSceneIndex
  //   ) as SceneEditorElement | undefined;

  //   if (activeScene) {
  //     console.log('Active scene found - adding to scene:', activeScene.id);
  //     if (!activeScene.properties.elements) {
  //       activeScene.properties.elements = [];
  //       console.log('Created new elements array for scene');
  //     }
  //     activeScene.properties.elements.push(editorElement);
  //     console.log('Element added to scene. Scene elements count:',
  //       activeScene.properties.elements.length);
  //     this.updateEditorElement(activeScene);
  //   } else {
  //     console.log('No active scene - adding to main editor elements');
  //     this.setEditorElements([...this.editorElements, editorElement]);
  //     console.log('Main elements count:', this.editorElements.length);
  //   }
  //   if (activeScene) {
  //     console.log('Active scene elements:', activeScene.properties.elements);
  //   }
  //   console.groupEnd();
  //   this.refreshElements();
  //   this.setSelectedElement(editorElement);
  // }


  addEditorElement(editorElement: EditorElement) {
    console.log('Adding new element:', editorElement);
    const activeScene = this.editorElements.find(
      el => el.type === 'scene' &&
        (el as SceneEditorElement).properties.sceneIndex === this.activeSceneIndex
    ) as SceneEditorElement | undefined;
    if (activeScene) {
      console.log('Active scene found - adding to scene:', activeScene.id);
      const sceneIndex = activeScene.properties.sceneIndex;
      const targetScene = this.scenes[sceneIndex];
      if (!targetScene.elements) {
        targetScene.elements = [];
        console.log('Created elements array in target scene object');
      }
      if (!activeScene.properties.elements) {
        activeScene.properties.elements = [];
        console.log('Created elements array in scene properties');
      }
      targetScene.elements.push(editorElement);
      activeScene.properties.elements.push(editorElement);
      console.log('Element added to scene. Scene elements count:',
        activeScene.properties.elements.length);
      this.updateEditorElement(activeScene);
    } else {
      console.log('No active scene - adding to main editor elements');
      this.setEditorElements([...this.editorElements, editorElement]);
      console.log('Main elements count:', this.editorElements.length);
    }
    if (!this.editorElements.find(e => e.id === editorElement.id)) {
      this.editorElements.push(editorElement);
    }

    if (activeScene) {
      console.log('Active scene elements:', activeScene.properties.elements);
    }

    console.groupEnd();

    this.refreshElements();
    this.setSelectedElement(editorElement);
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
      // compute each scene’s new span
      const durationPerScene = maxTime / sceneCount;

      this.scenes.forEach((scene, index) => {
        // 1) new main‐layer bounds
        const sceneStart = index * durationPerScene;
        const sceneEnd = sceneStart + durationPerScene;

        // 2) only update the scene’s own timeframe
        scene.timeFrame = { start: sceneStart, end: sceneEnd };

        // 3) find & update the matching SceneEditorElement
        const sceneEditorElement = this.editorElements.find(
          e =>
            e.type === "scene" &&
            (e as SceneEditorElement).properties.sceneIndex === index
        ) as SceneEditorElement | undefined;

        if (sceneEditorElement) {
          sceneEditorElement.timeFrame = { start: sceneStart, end: sceneEnd };
          // do NOT touch sceneEditorElement.properties.* nested layers
        }
      });
    }
    this.maxTime = maxTime;
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
      `🎬 Playing animation: ${animationType} for SVG ID: ${this.selectedElement.id}`
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
      this.playSelectedSvgAnimation();
      this.startedTime = Date.now();
      this.startedTimePlay = this.currentTimeInMs;
      requestAnimationFrame(() => {
        this.playFrames();
      });
    } else {
      this.currentAnimations.forEach((anim) => anim.pause());
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
    this.setCurrentTimeInMs(newTime);
    this.animationTimeLine.seek(newTime);

    if (this.canvas) {
      this.canvas.backgroundColor = this.backgroundColor;
    }

    const sceneSegments = this.editorElements
      .filter((e) => e.type === "scene")
      .sort((a, b) =>
        (a as SceneEditorElement).properties.sceneIndex -
        (b as SceneEditorElement).properties.sceneIndex
      )
      .map((sc) => {
        const sceneElement = sc as SceneEditorElement;
        return {
          sc: sceneElement,
          start: sceneElement.timeFrame.start,
          end: sceneElement.timeFrame.end
        };
      });



    const toggleVisibility = (objects: any[], sources: any[]) => {
      objects?.forEach((obj, index) => {
        const src = sources?.[index];
        if (!src || !obj || typeof obj.set !== 'function') return;
        const isVisible = newTime >= src.timeFrame.start && newTime <= src.timeFrame.end;
        obj.set({ visible: isVisible });
        if (isVisible) this.canvas?.add(obj);
      });
    };

    const initializeSceneObjectsIfMissing = (scene: any, idx: number) => {
      const placement = this.editorElements.find(
        e => e.type === 'scene' && (e as SceneEditorElement).properties.sceneIndex === idx
      )?.placement;

      if (!scene.fabricObjects) {
        scene.fabricObjects = {
          background: null,
          backgrounds: [],
          gifs: [],
          texts: [],
          elements: [],
          animations: []
        };
      }

      if (scene.gifs) {
        scene.gifs.forEach((gif, i) => {
          if (!scene.fabricObjects.gifs[i]) {
            const url = gif.svg_url;
            const pos = gif.calculatedPosition || { x: 100, y: 100, width: 200, height: 200 };
            const scaleObj = (img: fabric.Object) => {
              const scale = Math.min(
                pos.width / (img.width || 1),
                pos.height / (img.height || 1)
              );
              img.set({
                left: pos.x,
                top: pos.y,
                scaleX: scale,
                scaleY: scale,
                visible: false
              });
              scene.fabricObjects.gifs[i] = img;
            };

            if (url.toLowerCase().endsWith(".svg")) {
              fabric.loadSVGFromURL(url, (objs, opts) => {
                const grp = fabric.util.groupSVGElements(objs, opts);
                scaleObj(grp);
              });
            } else {
              fabric.Image.fromURL(url, scaleObj);
            }
          }
        });
      }

      if (scene.text) {
        scene.text.forEach((txt, i) => {
          if (!scene.fabricObjects.texts[i]) {
            const bottom = (placement?.y || 0) + (placement?.height || 300) - (txt.properties.fontSize || 24) - 20;
            const t = new fabric.Textbox(txt.value, {
              left: txt.placement.x,
              top: bottom,
              width: txt.placement.width,
              fontSize: txt.properties.fontSize,
              fontFamily: txt.properties.fontFamily,
              fill: txt.properties.fill,
              textAlign: 'center',
              visible: false
            });
            scene.fabricObjects.texts[i] = t;
          }
        });
      }

      if (scene.backgrounds) {
        scene.backgrounds.forEach((bg, i) => {
          if (!scene.fabricObjects.backgrounds[i]) {
            const pos = bg.calculatedPosition || { x: 0, y: 0, width: 800, height: 400 };
            fabric.Image.fromURL(bg.background_url, (img) => {
              const scaleX = pos.width / (img.width || 1);
              const scaleY = pos.height / (img.height || 1);
              img.set({
                left: pos.x,
                top: pos.y,
                scaleX,
                scaleY,
                visible: false
              });
              scene.fabricObjects.backgrounds[i] = img;
            });
          }
        });
      }
    };

    sceneSegments.forEach(({ sc }) => {
      const idx = sc.properties.sceneIndex;
      const scene = this.scenes[idx];

      initializeSceneObjectsIfMissing(scene, idx);

      if (!scene.fabricObjects) return;

      if (scene.fabricObjects.background) {
        const isVisible = newTime >= scene.timeFrame.start && newTime <= scene.timeFrame.end;
        scene.fabricObjects.background.set({ visible: isVisible });
        if (isVisible) this.canvas?.add(scene.fabricObjects.background);
      }

      toggleVisibility(scene.fabricObjects.backgrounds, scene.backgrounds);
      toggleVisibility(scene.fabricObjects.gifs, scene.gifs);
      toggleVisibility(scene.fabricObjects.texts, scene.text);
      toggleVisibility(scene.fabricObjects.elements, scene.elements);


      scene.tts?.forEach((ttsItem) => {
        const isVisible = newTime >= ttsItem.timeFrame.start && newTime <= ttsItem.timeFrame.end;
        if (!(ttsItem as any).played && isVisible && ttsItem.text) {
          const utter = new SpeechSynthesisUtterance(ttsItem.text);
          window.speechSynthesis.speak(utter);
          (ttsItem as any).played = true;
        }
      });
    });

    this.editorElements.forEach((el) => {
      if (el.type !== "scene") {
        if (!el.fabricObject) return;
        const inRange = newTime >= el.timeFrame.start && newTime <= el.timeFrame.end;
        if (Array.isArray(el.fabricObject)) {
          el.fabricObject.forEach((o) => {
            if (!o || typeof o.set !== 'function') return;
            o.set({ visible: inRange });
            if (inRange) this.canvas?.add(o);
          });
        } else {
          el.fabricObject.set({ visible: inRange });
          if (inRange) this.canvas?.add(el.fabricObject);
        }
      }
    });

    this.canvas?.requestRenderAll();
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

  saveCanvasToVideoWithAudioWebmMp4() {
    console.log('Modified to capture video & standalone audio at correct timeline positions');

    let mp4 = this.selectedVideoFormat === 'mp4';
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const stream = canvas.captureStream(30);

    const videoElements = this.editorElements.filter(isEditorVideoElement);
    const audioElements = this.editorElements.filter(isEditorAudioElement);
    const hasMediaElements = videoElements.length > 0 || audioElements.length > 0;

    if (hasMediaElements) {
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      const audioContext = this.audioContext;
      const mixedAudioDestination = audioContext.createMediaStreamDestination();

      // Process video elements
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

      // Process audio elements
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

      // Merge audio tracks if they exist
      mixedAudioDestination.stream.getAudioTracks().forEach((track) => {
        stream.addTrack(track);
      });
    }

    // Create and export video (works with or without audio)
    const video = document.createElement('video');
    video.srcObject = stream;
    video.height = canvas.height;
    video.width = canvas.width;

    video.play().then(() => {
      console.log('Video playback started');
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
              coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
              wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
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
            // Fallback to webm if conversion fails
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
              animations: []
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
              ...obj.toObject(), // Preserve existing properties
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

            // Store reference for layer panel selection
            sceneObjectsMap[data.elementId] = obj;

            // Update source data when modified
            obj.on('modified', () => {
              if (data.source.placement) {
                data.source.placement.x = obj.left ?? data.source.placement.x;
                data.source.placement.y = obj.top ?? data.source.placement.y;
                data.source.placement.width = (obj.width ?? 0) * (obj.scaleX ?? 1);
                data.source.placement.height = (obj.height ?? 0) * (obj.scaleY ?? 1);
                data.source.placement.rotation = obj.angle ?? 0;
              }
            });

            // Add click handler to bring to front when selected
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
                sceneData.fabricObjects.backgrounds[index].set({
                  visible: true,
                  selectable: true
                });
                addObjectToScene(sceneData.fabricObjects.backgrounds[index], {
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
              if (!sceneData.fabricObjects.texts[index]) {
                const txt = new fabric.Textbox(textItem.value, {
                  left: x + (width - (textItem.placement.width || width)) / 2,
                  top: y + height - (textItem.properties.fontSize || 24) - 20,
                  width: textItem.placement.width,
                  fontSize: textItem.properties.fontSize,
                  fontFamily: textItem.properties.fontFamily,
                  fill: textItem.properties.fill,
                  textAlign: 'center',
                  visible: true,
                  lockUniScaling: false,
                  selectable: true
                });
                sceneData.fabricObjects.texts[index] = txt;
                addObjectToScene(txt, {
                  zIndex: 5,
                  elementId: textItem.id,
                  source: textItem,
                  timeFrame: textItem.timeFrame
                });
              } else {
                const txt = sceneData.fabricObjects.texts[index];
                txt.set({
                  text: textItem.value,
                  fontSize: textItem.properties.fontSize,
                  fontFamily: textItem.properties.fontFamily,
                  fill: textItem.properties.fill,
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
            if (now >= start && now <= end) {
              const pos = gif.calculatedPosition ?? {
                x: x + width * 0.35,
                y: y + height * 0.35,
                width: width * 0.3,
                height: height * 0.3
              };

              if (!sceneData.fabricObjects.gifs[index]) {
                const onLoad = (obj: fabric.Object) => {
                  const scale = Math.min(
                    pos.width / (obj.width || 1),
                    pos.height / (obj.height || 1)
                  );
                  obj.set({
                    left: pos.x,
                    top: pos.y,
                    scaleX: scale,
                    scaleY: scale,
                    visible: true,
                    lockUniScaling: false,
                    selectable: true
                  });
                  sceneData.fabricObjects.gifs[index] = obj;
                  addObjectToScene(obj, {
                    zIndex: 2,
                    elementId: gif.id,
                    source: gif,
                    timeFrame: gif.timeFrame
                  });
                  renderAllParts();
                };

                const url = gif.svg_url.toLowerCase();
                if (url.endsWith('.svg')) {
                  fabric.loadSVGFromURL(url, (objs, opts) => {
                    const grp = fabric.util.groupSVGElements(objs, opts);
                    onLoad(grp);
                  });
                } else {
                  fabric.Image.fromURL(url, onLoad, { crossOrigin: 'anonymous' });
                }
              } else {
                const gifObj = sceneData.fabricObjects.gifs[index];
                gifObj.set({
                  visible: true,
                  selectable: true
                });
                addObjectToScene(gifObj, {
                  zIndex: 2,
                  elementId: gif.id,
                  source: gif,
                  timeFrame: gif.timeFrame
                });
              }
            }
          });
          sceneData.tts?.forEach(ttsItem => {
            const { start, end, played } = ttsItem as any;
            if (!played && now >= start && now <= end && ttsItem.text) {
              const utter = new SpeechSynthesisUtterance(ttsItem.text);
              window.speechSynthesis.speak(utter);
              (ttsItem as any).played = true;
            }
          });





          // scene global elements

          // ✅ Render global elements from sceneData.elements
          sceneData.elements?.forEach((childElement, index) => {
            if (now >= childElement.timeFrame.start && now <= childElement.timeFrame.end) {
              if (!sceneData.fabricObjects.elements[index]) {
                let newObj: fabric.Object | null = null;

                const pos = childElement.placement ?? {
                  x: x + width / 2 - 50,
                  y: y + height / 2 - 50,
                  width: 100,
                  height: 100,
                  rotation: 0
                };

                const commonSettings = {
                  left: pos.x,
                  top: pos.y,
                  angle: pos.rotation || 0,
                  visible: true,
                  selectable: true
                };

                switch (childElement.type) {
                  case 'text':
                    newObj = new fabric.Textbox(childElement.value || 'Text', {
                      ...commonSettings,
                      width: pos.width,
                      height: pos.height,
                      fontSize: childElement.properties?.fontSize || 24,
                      fontFamily: childElement.properties?.fontFamily || 'Arial',
                      fill: childElement.properties?.fill || '#ffffff',
                      fontWeight: childElement.properties?.fontWeight || 'normal',
                      fontStyle: childElement.properties?.fontStyle || 'normal',
                      textAlign: 'center'
                    });
                    break;

                  case 'image':
                    const img = new Image();
                    img.src = childElement.image_url;
                    img.crossOrigin = 'anonymous';
                    newObj = new fabric.Image(img, {
                      ...commonSettings,
                      width: pos.width,
                      height: pos.height
                    });
                    break;

                  case 'svg':
                    fabric.loadSVGFromURL(childElement.svg_url, (objects, options) => {
                      const group = fabric.util.groupSVGElements(objects, options);
                      group.set({
                        ...commonSettings,
                        scaleX: pos.width / (group.width || 1),
                        scaleY: pos.height / (group.height || 1)
                      });

                      sceneData.fabricObjects.elements[index] = group;
                      addObjectToScene(group, {
                        zIndex: 3,
                        elementId: childElement.id,
                        source: childElement,
                        timeFrame: childElement.timeFrame
                      });

                      renderAllParts();
                    });
                    return; // svg async handled above
                }

                if (newObj) {
                  sceneData.fabricObjects.elements[index] = newObj;
                  addObjectToScene(newObj, {
                    zIndex: 3,
                    elementId: childElement.id,
                    source: childElement,
                    timeFrame: childElement.timeFrame
                  });
                }
              } else {
                const existingObj = sceneData.fabricObjects.elements[index];
                existingObj.set({ visible: true, selectable: true });
                addObjectToScene(existingObj, {
                  zIndex: 3,
                  elementId: childElement.id,
                  source: childElement,
                  timeFrame: childElement.timeFrame
                });
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
} from '../types'
import { FabricUitls } from '@/utils/fabric-utils'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'
import { handstandAnimation, walkingAnimations } from '@/utils/animations'
import { GLOBAL_ELEMENTS_TIME, HANDSTAND, hideLoading, SCENE_ELEMENTS_LAYERS_TIME, SCENE_ELEMENTS_TIME, showLoading, WALKING } from '@/utils/constants'
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
  private currentUtterance: SpeechSynthesisUtterance | null = null;





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
  getMaxTime(): number {
    // 1) compute furthest scene end
    const sceneMax = this.scenes.reduce(
      (maxEnd, scene) => Math.max(maxEnd, scene.timeFrame.end),
      0
    );

    // 2) convert constant to ms
    const globalMs = GLOBAL_ELEMENTS_TIME * 1000;

    // 3) return whichever is larger
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

    // Process all layer types
    const processLayers = <T extends { id?: string }>(
      items: T[] | undefined,
      type: string,
      defaultDuration = NESTED_DURATION_MS
    ) => {
      return (items || []).map((item, i) => ({
        ...item,
        id: item.id || `${type}-${idx}-${i}`,
        layerType: type as const,
        timeFrame: {
          start: sceneStart,
          end: sceneStart + (item.timeFrame?.duration || defaultDuration)
        },
      }));
    };

    // Create all layers
    const bgImage = scene.backgrounds?.[0]?.background_url || null;
    const nestedBgLayers = processLayers(scene.backgrounds?.slice(1), "background");
    const nestedGifLayers = processLayers(scene.gifs, "svg").map((gif, i) => ({
      ...gif,
      calculatedPosition: scene.gifs?.length ? this.calculateSvgPositions(scene.gifs.length)[i] : null
    }));
    const nestedAnimLayers = processLayers(scene.animations, "animation");
    const nestedElemLayers = processLayers(scene.elements, "element");

    // Text layer
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

    // TTS layer
    const ttsText = textArray[0] || null;
    const nestedTtsLayers = ttsText ? [{
      id: `tts-${idx}`,
      text: ttsText,
      layerType: "tts" as const,
      timeFrame: { start: sceneStart, end: sceneStart + NESTED_DURATION_MS },
      played: false
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

    this.scenes.push(sceneObj);

    // Create editor element
    const sceneElem: SceneEditorElement = {
      id: sceneObj.id,
      name: sceneObj.name,
      type: "scene",
      placement: {
        x: 0, y: 0,
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
      console.warn(' No layer selected to cut.')
      return
    }
    if (this.copiedElement) {
      console.warn(' Clipboard not empty—overwriting with new cut.')
    }
    this.copiedElement = this.selectedElement
    if (this.selectedElement.fabricObject) {
      this.canvas?.remove(this.selectedElement.fabricObject)
      this.canvas?.renderAll()
    }
    this.removeEditorElement(this.selectedElement.id)
    this.selectedElement = null
    console.log(' CUT element with ID:', this.copiedElement.id)
  }
  copyElement() {
    if (!this.selectedElement) {
      console.warn(' No layer selected for copying.')
      return
    }
    if (this.copiedElement) {
      console.warn(' Already copied a layer. Paste before copying again.')
      return
    }
    this.selectedElement.fabricObject?.clone((cloned: fabric.Object) => {
      if (!cloned) {
        console.error('Failed to clone fabric object!')
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
        name: Layer(`${this.selectedElement?.id}`),
        fabricObject: cloned,
      } as EditorElement
      console.log('Copied Layer:', this.copiedElement.name)
    })
  }
  pasteElement() {
    if (!this.copiedElement) {
      console.warn(' No copied layer! Copy one first.');
      return;
    }
    const elementToPaste = { ...this.copiedElement };
    this.copiedElement = null;
    if (elementToPaste) {
      elementToPaste.fabricObject?.clone((cloned: fabric.Object) => {
        if (!cloned) {
          console.error('Failed to clone Fabric.js object.');
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
        console.log('Pasted Full Layer', newElement.name);
      });
    } else {
      console.warn('Frame too small to paste!');
    }
  }
  deleteElement() {
    if (!this.selectedElement) {
      console.warn('No layer selected to delete.')
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
      console.warn('Cannot split audio layers.')
      return
    }
    const selectedElement = this.selectedElement
    const { start, end } = selectedElement.timeFrame
    const totalDuration = end - start

    if (totalDuration < 2000) {
      console.warn('Frame too small to split!')
      return
    }
    const midTime = Math.floor((start + end) / 2)
    this.updateEditorElementTimeFrame(selectedElement, { end: midTime })
    selectedElement.fabricObject?.clone((cloned: fabric.Object) => {
      if (!cloned) {
        console.error('Failed to clone Fabric.js object.')
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

      // if this is a TTS (audio) layer, never let end move beyond original
      if (layer.layerType === "tts" && timeFrame.end != null) {
        newEnd = Math.min(newEnd, orig.end);
      }

      // commit the update
      arr[idx] = {
        ...layer,
        timeFrame: { start: newStart, end: newEnd },
      };
      return true;
    };

    // try every nested array (including tts now!)
    if (
      tryUpdate(scene.backgrounds) ||
      tryUpdate(scene.gifs) ||
      tryUpdate(scene.animations) ||
      tryUpdate(scene.elements) ||
      tryUpdate(scene.text) ||
      tryUpdate(scene.tts)         // ← include TTS
    ) {
      // also sync into your editorElements props
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

      // refresh any media or animations
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

    // Update scene and corresponding scene editor element
    scene.timeFrame = { start: newStart, end: newEnd };
    const sceneElem = this.editorElements.find(
      e => e.type === "scene" && e.properties.sceneIndex === sceneIndex
    ) as SceneEditorElement | undefined;
    if (sceneElem) {
      sceneElem.timeFrame = { start: newStart, end: newEnd };
    }

    // ✅ Clamp nested layers to be inside new scene timeFrame
    const clampNestedToScene = (arr?: SceneLayer[]) => {
      arr?.forEach(layer => {
        layer.timeFrame.start = Math.max(newStart, layer.timeFrame.start);
        layer.timeFrame.end = Math.min(newEnd, layer.timeFrame.end);

        // Prevent zero or negative duration
        if (layer.timeFrame.end <= layer.timeFrame.start) {
          layer.timeFrame.end = layer.timeFrame.start + 100; // 100ms minimum duration
        }
      });
    };

    clampNestedToScene(scene.backgrounds);
    clampNestedToScene(scene.gifs);
    clampNestedToScene(scene.animations);
    clampNestedToScene(scene.elements);  // ✅ elements
    clampNestedToScene(scene.text);
    clampNestedToScene(scene.tts);

    if (sceneElem) {
      const p = sceneElem.properties as any;
      clampNestedToScene(p.backgrounds);
      clampNestedToScene(p.gifs);
      clampNestedToScene(p.animations);
      clampNestedToScene(p.elements);  // ✅ elements
      clampNestedToScene(p.text);
      clampNestedToScene(p.tts);
    }

    // Shift nested layers if scene start has moved
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

    // Push forward subsequent scenes and their nested layers
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
  }

  addEditorElement(editorElement: EditorElement) {
    console.group('🟢 addEditorElement');

    const activeScene = this.editorElements.find(
      el => el.type === 'scene' &&
        (el as SceneEditorElement).properties.sceneIndex === this.activeSceneIndex
    ) as SceneEditorElement | undefined;

    if (activeScene) {
      if (!activeScene.properties.elements) {
        activeScene.properties.elements = [];
      }

      activeScene.properties.elements.push(editorElement);

      // ✅ Find actual scene object in this.scenes and sync
      const sceneObj = this.scenes[this.activeSceneIndex];
      if (!sceneObj.elements) {
        sceneObj.elements = [];
      }
      sceneObj.elements.push(editorElement); // <== THIS IS THE MISSING PART

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
      this.playSelectedSvgAnimation();
      this.startedTime = Date.now();
      this.startedTimePlay = this.currentTimeInMs;
      this.playTts();
      requestAnimationFrame(() => {
        this.playFrames();
      });
    } else {
      this.currentAnimations.forEach((anim) => anim.pause());
      this.pauseTts();
    }
  }

  playTts() {
    window.speechSynthesis.cancel();
    const scene = this.scenes[this.activeSceneIndex];
    const ttsItem = scene.tts?.[0];
    if (ttsItem?.text) {
      this.currentUtterance = new SpeechSynthesisUtterance(ttsItem.text);
      window.speechSynthesis.speak(this.currentUtterance);
    }
  }

  pauseTts() {
    window.speechSynthesis.pause();
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
    this.setCurrentTimeInMs(newTime);
    this.animationTimeLine.seek(newTime);

    if (this.canvas) {
      this.canvas.backgroundColor = this.backgroundColor;
    }

    const sceneSegments = this.editorElements
      .filter((e) => e.type === "scene")
      .sort((a, b) =>
        (a as SceneEditorElement).properties.sceneIndex -
        (b as SceneEditorElement).properties.sceneIndex
      )
      .map((sc) => {
        const sceneElement = sc as SceneEditorElement;
        return {
          sc: sceneElement,
          start: sceneElement.timeFrame.start,
          end: sceneElement.timeFrame.end
        };
      });



    const toggleVisibility = (objects: any[], sources: any[]) => {
      objects?.forEach((obj, index) => {
        const src = sources?.[index];
        if (!src || !obj || typeof obj.set !== 'function') return;
        const isVisible = newTime >= src.timeFrame.start && newTime <= src.timeFrame.end;
        obj.set({ visible: isVisible });
        if (isVisible) this.canvas?.add(obj);
      });
    };

    const initializeSceneObjectsIfMissing = (scene: any, idx: number) => {
      const placement = this.editorElements.find(
        e => e.type === 'scene' && (e as SceneEditorElement).properties.sceneIndex === idx
      )?.placement;

      if (!scene.fabricObjects) {
        scene.fabricObjects = {
          background: null,
          backgrounds: [],
          gifs: [],
          texts: [],
          elements: [],
          animations: []
        };
      }

      if (scene.gifs) {
        scene.gifs.forEach((gif, i) => {
          if (!scene.fabricObjects.gifs[i]) {
            const url = gif.svg_url;
            const pos = gif.calculatedPosition || { x: 100, y: 100, width: 200, height: 200 };
            const scaleObj = (img: fabric.Object) => {
              const scale = Math.min(
                pos.width / (img.width || 1),
                pos.height / (img.height || 1)
              );
              img.set({
                left: pos.x,
                top: pos.y,
                scaleX: scale,
                scaleY: scale,
                visible: false
              });
              scene.fabricObjects.gifs[i] = img;
            };

            if (url.toLowerCase().endsWith(".svg")) {
              fabric.loadSVGFromURL(url, (objs, opts) => {
                const grp = fabric.util.groupSVGElements(objs, opts);
                scaleObj(grp);
              });
            } else {
              fabric.Image.fromURL(url, scaleObj, { crossOrigin: 'anonymous' });
            }
          }
        });
      }

      if (scene.text) {
        scene.text.forEach((txt, i) => {
          if (!scene.fabricObjects.texts[i]) {
            const bottom = (placement?.y || 0) + (placement?.height || 300) - (txt.properties.fontSize || 24) - 20;
            const t = new fabric.Textbox(txt.value, {
              left: txt.placement.x,
              top: bottom,
              width: txt.placement.width,
              fontSize: txt.properties.fontSize,
              fontFamily: txt.properties.fontFamily,
              fill: txt.properties.fill,
              textAlign: 'center',
              visible: false
            });
            scene.fabricObjects.texts[i] = t;
          }
        });
      }

      if (scene.backgrounds) {
        scene.backgrounds.forEach((bg, i) => {
          if (!scene.fabricObjects.backgrounds[i]) {
            const pos = bg.calculatedPosition || { x: 0, y: 0, width: 800, height: 400 };
            fabric.Image.fromURL(bg.background_url, (img) => {
              const scaleX = pos.width / (img.width || 1);
              const scaleY = pos.height / (img.height || 1);
              img.crossOrigin = 'anonymous';
              img.set({
                left: pos.x,
                top: pos.y,
                scaleX,
                scaleY,
                visible: false
              });
              scene.fabricObjects.backgrounds[i] = img;
            });
          }
        });
      }
    };

    sceneSegments.forEach(({ sc }) => {
      const idx = sc.properties.sceneIndex;
      const scene = this.scenes[idx];

      initializeSceneObjectsIfMissing(scene, idx);

      if (!scene.fabricObjects) return;

      if (scene.fabricObjects.background) {
        const isVisible = newTime >= scene.timeFrame.start && newTime <= scene.timeFrame.end;
        scene.fabricObjects.background.set({ visible: isVisible });
        if (isVisible) this.canvas?.add(scene.fabricObjects.background);
      }

      toggleVisibility(scene.fabricObjects.backgrounds, scene.backgrounds);
      toggleVisibility(scene.fabricObjects.gifs, scene.gifs);
      toggleVisibility(scene.fabricObjects.texts, scene.text);
      toggleVisibility(scene.fabricObjects.elements, scene.elements);


      scene.tts?.forEach((ttsItem) => {
        const isVisible = newTime >= ttsItem.timeFrame.start && newTime <= ttsItem.timeFrame.end;
         
      });
    });

    this.editorElements.forEach((el) => {
      if (el.type !== "scene") {
        if (!el.fabricObject) return;
        const inRange = newTime >= el.timeFrame.start && newTime <= el.timeFrame.end;
        if (Array.isArray(el.fabricObject)) {
          el.fabricObject.forEach((o) => {
            if (!o || typeof o.set !== 'function') return;
            o.set({ visible: inRange });
            if (inRange) this.canvas?.add(o);
          });
        } else {
          el.fabricObject.set({ visible: inRange });
          if (inRange) this.canvas?.add(el.fabricObject);
        }
      }
    });
    this.updateAudioElements();
    this.canvas?.requestRenderAll();
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
    const currentTimeMs = this.currentTimeInMs;

    const processAudio = (
      audio: HTMLAudioElement,
      timeFrame: { start: number; end: number },
      elementData: { isAudioPlaying?: boolean },
      icon?: fabric.Text
    ) => {
      const { start, end } = timeFrame;
      const isInRange = currentTimeMs >= start && currentTimeMs <= end;

      if (this.playing && isInRange && !elementData.isAudioPlaying) {
        const offset = (currentTimeMs - start) / 1000;
        audio.currentTime = Math.max(0, offset);

        // ✅ Immediately mark playing to avoid re-triggering
        elementData.isAudioPlaying = true;

        audio.play()
          .then(() => {
            if (icon) {
              icon.set({ text: '🔊▶' });
              icon.canvas?.requestRenderAll();
            }
          })
          .catch((err) => {
            console.warn('❌ Audio play error:', err.message);
            elementData.isAudioPlaying = false;
          });

        audio.onended = () => {
          elementData.isAudioPlaying = false;
          if (icon) {
            icon.set({ text: '🔊' });
            icon.canvas?.requestRenderAll();
          }
        };
      } else if ((!this.playing || !isInRange) && elementData.isAudioPlaying) {
        audio.pause();
        audio.currentTime = 0;
        elementData.isAudioPlaying = false;
        if (icon) {
          icon.set({ text: '🔊' });
          icon.canvas?.requestRenderAll();
        }
      }
    };

    // 🔹 Global audio layers
    this.editorElements
      .filter((el): el is AudioEditorElement => el.type === 'audio')
      .forEach((el) => {
        const audio = this.audioRegistry.get(el.properties.elementId);
        if (!audio) return;
        processAudio(audio, el.timeFrame, el.properties as any);
      });

    // 🔸 Scene-specific audio layers
    const scene = this.scenes[this.activeSceneIndex];
    if (!scene?.fabricObjects?.elements) return;

    scene.fabricObjects.elements.forEach((group) => {
      const data = group.data;
      if (!data || data.mediaType !== 'audio') return;

      const audio = document.getElementById(data.elementId) as HTMLAudioElement | null;
      if (!audio) return;

      processAudio(audio, data.timeFrame, data, group.item(1) as fabric.Text);
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
    const hasMediaElements = videoElements.length > 0 || audioElements.length > 0;

    if (hasMediaElements) {
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      const audioContext = this.audioContext;
      const mixedAudioDestination = audioContext.createMediaStreamDestination();

      // Process video elements
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

      // Process audio elements
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

      // Merge audio tracks if they exist
      mixedAudioDestination.stream.getAudioTracks().forEach((track) => {
        stream.addTrack(track);
      });
    }

    // Create and export video (works with or without audio)
    const video = document.createElement('video');
    video.srcObject = stream;
    video.height = canvas.height;
    video.width = canvas.width;

    video.play().then(() => {
      console.log('Video playback started');
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
            // Fallback to webm if conversion fails
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
              animations: []
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
              if (!sceneData.fabricObjects.texts[index]) {
                const txt = new fabric.Textbox(textItem.value, {
                  left: x + (width - (textItem.placement.width || width)) / 2,
                  top: y + height - (textItem.properties.fontSize || 24) - 20,
                  width: textItem.placement.width,
                  fontSize: textItem.properties.fontSize,
                  fontFamily: textItem.properties.fontFamily,
                  fill: textItem.properties.fill,
                  textAlign: 'center',
                  visible: true,
                  lockUniScaling: false,
                  selectable: true
                });
                sceneData.fabricObjects.texts[index] = txt;
                addObjectToScene(txt, {
                  zIndex: 5,
                  elementId: textItem.id,
                  source: textItem,
                  timeFrame: textItem.timeFrame
                });
              } else {
                const txt = sceneData.fabricObjects.texts[index];
                txt.set({
                  text: textItem.value,
                  fontSize: textItem.properties.fontSize,
                  fontFamily: textItem.properties.fontFamily,
                  fill: textItem.properties.fill,
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
            if (now >= start && now <= end) {
              const pos = gif.calculatedPosition ?? {
                x: x + width * 0.35,
                y: y + height * 0.35,
                width: width * 0.3,
                height: height * 0.3
              };
              const url = gif.svg_url.toLowerCase();
              const existingObj = sceneData.fabricObjects.gifs[index];
              if (existingObj && existingObj.type) {
                existingObj.set({
                  visible: true,
                  selectable: true
                });
                addObjectToScene(existingObj, {
                  zIndex: 2,
                  elementId: gif.id,
                  source: gif,
                  timeFrame: gif.timeFrame
                });
              } else if (!existingObj) {
                sceneData.fabricObjects.gifs[index] = {} as any;
                const onLoad = (obj: fabric.Object) => {
                  const scale = Math.min(
                    pos.width / (obj.width || 1),
                    pos.height / (obj.height || 1)
                  );
                  obj.set({
                    left: pos.x,
                    top: pos.y,
                    scaleX: scale,
                    scaleY: scale,
                    visible: true,
                    lockUniScaling: false,
                    selectable: true
                  });
                  sceneData.fabricObjects.gifs[index] = obj;
                  addObjectToScene(obj, {
                    zIndex: 2,
                    elementId: gif.id,
                    source: gif,
                    timeFrame: gif.timeFrame
                  });
                  renderAllParts();
                };
                if (url.endsWith('.svg')) {
                  fabric.loadSVGFromURL(url, (objs, opts) => {
                    const grp = fabric.util.groupSVGElements(objs, opts);
                    onLoad(grp);
                  }, { crossOrigin: 'anonymous' });
                } else {
                  fabric.Image.fromURL(url, onLoad, { crossOrigin: 'anonymous' });
                }
              }
            }
          });
          sceneData.tts?.forEach(ttsItem => {
            const { start, end, played } = ttsItem as any;
            if (!played && now >= start && now <= end && ttsItem.text) {
              const utter = new SpeechSynthesisUtterance(ttsItem.text);
              window.speechSynthesis.speak(utter);
              (ttsItem as any).played = true;
            }
          });




          sceneData.elements?.forEach((childElement) => {
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
                if (childElement.properties.src) {
                  const isDuplicate = sceneData.fabricObjects.elements.some(
                    el => el?.data?.source?.properties?.src === childElement.properties.src
                  );
                  if (isDuplicate) {
                    console.warn('Duplicate image detected:', childElement.properties.src);
                    return;
                  }
                  fabric.Image.fromURL(childElement.properties.src, (img) => {
                    const displayWidth = pos.width || img.naturalWidth || 100;
                    const displayHeight = pos.height || img.naturalHeight || 100;

                    img.set({
                      left: pos.x,
                      top: pos.y,
                      width: displayWidth,
                      height: displayHeight,
                      scaleX: pos.scaleX || 1,
                      scaleY: pos.scaleY || 1,
                      angle: pos.rotation || 0,
                      visible: true,
                      selectable: true,
                      data: {
                        zIndex: 3,
                        elementId: childElement.id,
                        source: childElement,
                        timeFrame: childElement.timeFrame
                      },
                      name: childElement.id,
                      lockUniScaling: true
                    })
                    img.setSrc(childElement.properties.src, () => {
                      canvas.requestRenderAll();
                    }, {
                      crossOrigin: 'anonymous'
                    });
                    sceneData.fabricObjects.elements.push(img);
                    canvas.add(img);
                    canvas.requestRenderAll();
                  }, {
                    crossOrigin: 'anonymous'
                  });
                }
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
                    isAudioPlaying: false
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

                  // ✅ NEW: auto-trigger playback if playhead enters this timeFrame
                  if (this.playing) {
                    setTimeout(() => {
                      this.updateAudioElements(); // recheck newly added audio layer
                    }, 10);
                  }
                }

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
