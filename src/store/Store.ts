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
import { GLOBAL_ELEMENTS_TIME, HANDSTAND, hideLoading, SCENE_ELEMENTS_TIME, showLoading, WALKING } from '@/utils/constants'
export class Store {
  canvas: fabric.Canvas | null
  backgroundColor: string
  selectedMenuOption: MenuOption
  audios: string[]
  videos: string[]
  images: string[]
  svgs: string[]
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
  scenes: Scene[] = [];
  activeSceneIndex: number = 0;

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
  getMaxTime() {
    if (this.scenes.length > 0) {
      return this.scenes.length * SCENE_ELEMENTS_TIME * 1000;
    }
    return GLOBAL_ELEMENTS_TIME * 1000;
  }
 

  setActiveScene(index: number) {
    this.activeSceneIndex = index;
    this.refreshElements();
  }
  addSceneResource(scene: Scene) {
    console.log("[store] before:", this.scenes.length);
    this.scenes.push(scene);
    console.log("[store] after:", this.scenes.length);
    this.maxTime = this.getMaxTime();
    const idx = this.scenes.length - 1;
    const sceneStart = idx * 10 * 1000;
    const sceneEnd = (idx + 1) * 10 * 1000;
    const sceneElem: SceneEditorElement = {
      id: `scene-${idx}`,
      name: `Scene ${idx + 1}`,
      type: 'scene',
      placement: { x: 0, y: 0, width: this.canvas?.width || 800, height: this.canvas?.height || 600, rotation: 0, scaleX: 1, scaleY: 1 },
      timeFrame: {
        start: sceneStart,
        end: sceneEnd
      },
      properties: {
        sceneIndex: idx,
        backgrounds: scene.backgrounds,
        gifs: scene.gifs,
        animations: scene.animations,
        elements: scene.elements
      },
      fabricObject: undefined,
    };
    this.editorElements.push(sceneElem);
    this.refreshAnimations();
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

  addEditorElement(editorElement: EditorElement) {
    console.log('Adding new element:', editorElement); 
    const activeScene = this.editorElements.find(
      el => el.type === 'scene' &&
        (el as SceneEditorElement).properties.sceneIndex === this.activeSceneIndex
    ) as SceneEditorElement | undefined;

    if (activeScene) {
      console.log('Active scene found - adding to scene:', activeScene.id);
      if (!activeScene.properties.elements) {
        activeScene.properties.elements = [];
        console.log('Created new elements array for scene');
      }
      activeScene.properties.elements.push(editorElement);
      console.log('Element added to scene. Scene elements count:',
        activeScene.properties.elements.length);
      this.updateEditorElement(activeScene);
    } else {
      console.log('No active scene - adding to main editor elements');
      this.setEditorElements([...this.editorElements, editorElement]);
      console.log('Main elements count:', this.editorElements.length);
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
    if (this.scenes.length > 0) {
      this.maxTime = this.getMaxTime();
    } else {
      this.maxTime = maxTime;
    }
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

 
  let cursor = 0;
  const sceneSegments = this.editorElements
    .filter((e) => e.type === "scene")
    .sort(
      (a, b) =>
        (a as SceneEditorElement).properties.sceneIndex -
        (b as SceneEditorElement).properties.sceneIndex
    )
    .map((e) => {
      const sc = e as SceneEditorElement;
      const dur = sc.timeFrame.end - sc.timeFrame.start;
      const seg = { sc, start: cursor, end: cursor + dur };
      cursor += dur;
      return seg;
    });

 
  sceneSegments.forEach(({ sc, start, end }) => {
    const idx = sc.properties.sceneIndex;
    const inPlayhead = newTime >= start && newTime <= end;
    const isActive = idx === this.activeSceneIndex;
    const sceneVisible = inPlayhead || isActive;

 
    if (Array.isArray(sc.fabricObject)) {
      sc.fabricObject.forEach((o) => (o.visible = sceneVisible));
    }

 
    sc.properties.elements?.forEach((child) => {
      if (!child.fabricObject) return;
      const relStart = child.timeFrame.start - sc.timeFrame.start;
      const relEnd = child.timeFrame.end - sc.timeFrame.start;
      const childGlobalStart = start + relStart;
      const childGlobalEnd = start + relEnd;
      const childVisible =
        newTime >= childGlobalStart && newTime <= childGlobalEnd;

      if (Array.isArray(child.fabricObject)) {
        child.fabricObject.forEach((o) => (o.visible = childVisible));
      } else {
        child.fabricObject.visible = childVisible;
      }
    });
  });

 
  this.editorElements.forEach((el) => {
    if (el.type !== "scene") {
      if (!el.fabricObject) return;
      const inRange =
        newTime >= el.timeFrame.start && newTime <= el.timeFrame.end;
      if (Array.isArray(el.fabricObject)) {
        el.fabricObject.forEach((o) => (o.visible = inRange));
      } else {
        el.fabricObject.visible = inRange;
      }
    }
  });

 
  this.updateAudioElements();
  this.updateVideoElements();
  this.updateSvgElements();

 
  this.canvas?.requestRenderAll();
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
      timeFrame: {
        start: 0,
        end: videoDurationMs,
      },
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
      timeFrame: {
        start: 0,
        end: this.maxTime,
      },
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
              timeFrame: {
                start: 0,
                end: this.maxTime,
              },
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
      timeFrame: {
        start: 0,
        end: audioDurationMs,
      },
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
      timeFrame: {
        start: 0,
        end: this.maxTime,
      },
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
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    const audioContext = this.audioContext!;
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
      if (!sourceNode) {
        console.error('Error: sourceNode is undefined for', video.properties.elementId);
        return;
      }

      sourceNode.connect(mixedAudioDestination);
    });

    audioElements.forEach((audio) => {
      const audioElement = document.getElementById(audio.properties.elementId) as HTMLAudioElement;
      if (!audioElement) {
        console.warn('Skipping missing audio element:', audio.properties.elementId);
        return;
      }
      const audioStartTime = audio.timeFrame.start / 1000;
      setTimeout(() => {
        console.log(`Starting standalone audio at ${audioStartTime}s`);
        audioElement.play().catch((err) => console.error('Audio play error:', err));
      }, audio.timeFrame.start);
      let sourceNode = this.audioSourceNodes.get(audio.properties.elementId);
      if (!sourceNode) {
        sourceNode = audioContext.createMediaElementSource(audioElement);
        this.audioSourceNodes.set(audio.properties.elementId, sourceNode);
      }
      if (!sourceNode) {
        console.error('Error: sourceNode is undefined for', audio.properties.elementId);
        return;
      }
      sourceNode.connect(mixedAudioDestination);
    });
    const mixedAudioStream = mixedAudioDestination.stream;
    mixedAudioStream.getAudioTracks().forEach((track) => {
      stream.addTrack(track);
    });
    const video = document.createElement('video');
    video.srcObject = stream;
    video.height = canvas.height;
    video.width = canvas.width;
    video.play().then(() => {
      console.log('Video is playing with correctly timed audio.');
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = function (e) {
        chunks.push(e.data);
        console.log('Data available:', e.data);
      };
      mediaRecorder.onstop = async function () {
        const blob = new Blob(chunks, { type: 'video/webm' });
        if (mp4) {
          showLoading();
          const data = new Uint8Array(await blob.arrayBuffer());
          const ffmpeg = new FFmpeg();
          const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.2/dist/umd';
          await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
          })
          await ffmpeg.writeFile('video.webm', data);
          await ffmpeg.exec([
            '-y',
            '-i',
            'video.webm',
            '-c:v',
            'libx264',
            '-c:a',
            'aac',
            '-b:a',
            '192k',
            '-strict',
            'experimental',
            'video.mp4',
          ]);
          const output = await ffmpeg.readFile('video.mp4');
          const outputBlob = new Blob([output], { type: 'video/mp4' });
          const outputUrl = URL.createObjectURL(outputBlob);
          hideLoading();
          const a = document.createElement('a');
          a.download = 'video.mp4';
          a.href = outputUrl;
          a.click();
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
      }, this.getMaxTime());
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
          if (element.fabricObject && Array.isArray(element.fabricObject)) {
            canvas.add(...element.fabricObject);
          } else {
            const sceneData = this.scenes[element.properties.sceneIndex];
            const parts: fabric.Object[] = [];
            let loaded = 0;
            const total = sceneData.backgrounds.length + sceneData.gifs.length;
            const { x, y, width, height } = element.placement;
            const onPartLoaded = () => {
              if (++loaded === total) {
                // @ts-ignore
                element.fabricObject = parts;
                canvas.requestRenderAll();
              }
            };
            sceneData.backgrounds.forEach((bg, i) => {
              fabric.Image.fromURL(bg.background_url, img => {
                img.set({
                  left: x,
                  top: y,
                  selectable: true,
                  name: `BG ${i + 1}`,
                });
                if (i === 0) {
                  img.scaleToWidth(width);
                  img.scaleToHeight(height);
                } else {
                  img.scaleToWidth(width * 0.3);
                  img.scaleToHeight(height * 0.3);
                }
                parts.push(img);
                canvas.add(img);
                onPartLoaded();
              });
            });
            sceneData.gifs.forEach((gif, i) => {
              const url = gif.svg_url.toLowerCase();
              const handle = (obj: fabric.Object) => {
                obj.set({
                  left: x,
                  top: y,
                  selectable: true,
                  name: `GIF ${i + 1}`,
                });
                obj.scaleToWidth(width * 0.3);
                obj.scaleToHeight(height * 0.3);
                parts.push(obj);
                canvas.add(obj);
                onPartLoaded();
              };

              if (url.endsWith('.svg')) {
                fabric.loadSVGFromURL(url, (objs, opts) =>
                  handle(fabric.util.groupSVGElements(objs, opts)));
              } else {
                fabric.Image.fromURL(url, img => handle(img));
              }
            });
          }
          if (element.properties.elements?.length) {
            element.properties.elements.forEach(childElement => {

              if (this.currentTimeInMs >= childElement.timeFrame.start &&
                this.currentTimeInMs <= childElement.timeFrame.end) {

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
                      });
                      childElement.fabricObject = textObject;
                    }
                    canvas.add(childElement.fabricObject);
                    break;
                  case 'image': {
                   
                    if (childElement.fabricObject) {
                      canvas.add(childElement.fabricObject);
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
                        objectCaching: false
                      });

                      childElement.fabricObject = imgObj;
                      canvas.add(imgObj);
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
                        });
                        childElement.fabricObject = vidObj;
                        canvas.add(vidObj);
                        canvas.requestRenderAll();
                        videoEl.removeEventListener('loadedmetadata', onMeta);
                      };
                  
                      videoEl.addEventListener('loadedmetadata', onMeta);
                 
                      if (videoEl.readyState >= 1) onMeta();
                  
                      break;  
                    }
                  
 
                    canvas.add(childElement.fabricObject as fabric.Image);
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
                      });
                      childElement.fabricObject = audioRect;
                    }
                    if (childElement.fabricObject) {
                      canvas.add(childElement.fabricObject);
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
                        });
                        childElement.fabricObject = group;
                        canvas.add(group);
                        canvas.requestRenderAll();
                      });
                    } else if (childElement.fabricObject) {
                      canvas.add(childElement.fabricObject);
                    }
                    break;
                  }
                }
              }
            });
          }
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
