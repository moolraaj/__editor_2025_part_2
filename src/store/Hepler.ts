
import type { Canvas } from 'fabric/fabric-impl';
import type { Object as FabricObject } from 'fabric/fabric-impl';
import { fabric } from 'fabric';
import { Scene, SceneEditorElement } from '@/types';





export function initializeSceneObjectsIfMissing(
  scene: Scene,
  idx: number,
  editorElements: SceneEditorElement[],
  playing: boolean,
  forward: boolean,
  currentTime: number,
  maybeStartTts: (ttsItem: any, time: number) => void
) {
  const placement = editorElements
    .find(e => e.type === 'scene' && e.properties.sceneIndex === idx)
    ?.placement;

  if (!scene.fabricObjects) {
    scene.fabricObjects = {
      background: null,
      backgrounds: [],
      gifs: [],
      texts: [],
      elements: [],
      animations: [],
      tts: []
    };
  }
  
  scene.gifs?.forEach((gif, i) => {
    if (!scene.fabricObjects!.gifs[i]) {
      const url = gif.svg_url;
      //@ts-ignore
      const pos = gif.calculatedPosition ?? { x: 100, y: 100, width: 200, height: 200 };
      const scaleObj = (img: FabricObject) => {
        const scale = Math.min(pos.width / (img.width || 1), pos.height / (img.height || 1));
        img.set({ left: pos.x, top: pos.y, scaleX: scale, scaleY: scale, visible: false });
        //@ts-ignore
        scene.fabricObjects!.gifs[i] = img;
      };
      if (url.toLowerCase().endsWith('.svg')) {
        fabric.loadSVGFromURL(url, (objs, opts) => {
          const grp = fabric.util.groupSVGElements(objs, opts);
          scaleObj(grp);
        });
      } else {
        fabric.Image.fromURL(url, scaleObj, { crossOrigin: 'anonymous' });
      }
    }
  });
  scene.text?.forEach((txt, i) => {
    if (!scene.fabricObjects!.texts[i]) {
      const bottom =
        (placement?.y ?? 0) +
        (placement?.height ?? 300) -
        //@ts-ignore
        (txt.properties.fontSize ?? 24) -
        20;
      //@ts-ignore
      const t = new fabric.Textbox(txt.value, {
        //@ts-ignore
        left: txt.placement.x,
        top: bottom,
        //@ts-ignore
        width: txt.placement.width,
        //@ts-ignore
        fontSize: txt.properties.fontSize,
        //@ts-ignore
        fontFamily: txt.properties.fontFamily,
        //@ts-ignore
        fill: txt.properties.fill,
        textAlign: 'center',
        visible: false
      });
      scene.fabricObjects!.texts[i] = t;
    }
  });
  scene.backgrounds?.forEach((bg, i) => {
    if (!scene.fabricObjects!.backgrounds[i]) {
      //@ts-ignore
      const pos = bg.calculatedPosition ?? { x: 0, y: 0, width: 800, height: 400 };
      fabric.Image.fromURL(bg.background_url, img => {
        const scaleX = pos.width / (img.width || 1);
        const scaleY = pos.height / (img.height || 1);
        img.crossOrigin = 'anonymous';
        img.set({ left: pos.x, top: pos.y, scaleX, scaleY, visible: false });
        scene.fabricObjects!.backgrounds[i] = img;
      });
    }
  });
  scene.tts?.forEach((ttsItem) => {
    const { start, end } = ttsItem.timeFrame;
    if (
      playing &&
      forward &&
      !ttsItem.played &&
      currentTime >= start &&
      currentTime <= end
    ) {
      maybeStartTts(ttsItem, currentTime);
    }
    if (currentTime > end && ttsItem.played) {
      ttsItem.played = false;
      ttsItem.audioElement?.pause();
    }
  });
}

export function popAnimate(obj: FabricObject, canvas: Canvas | null) {
  const origTop = obj.top as number;
  const origSX = obj.scaleX as number;
  const origSY = obj.scaleY as number;
  const popOff = 20, factor = 1.2;

  obj.set({ scaleX: 0, scaleY: 0 });
  obj.animate(
    { top: origTop - popOff, scaleX: origSX * factor, scaleY: origSY * factor },
    {
      duration: 1000,
      onChange: () => canvas?.requestRenderAll(),
      onComplete: () => {
        obj.animate(
          { top: origTop, scaleX: origSX, scaleY: origSY },
          { duration: 1000, onChange: () => canvas?.requestRenderAll() }
        );
      },
    }
  );
}

export function loopAnimate(obj: FabricObject, canvas: Canvas | null) {
  const origTop = obj.top as number;
  const origSX = obj.scaleX as number;
  const origSY = obj.scaleY as number;
  const popOff = 20;
  const factor = 1.2;

  const step1 = () => {
    obj.animate(
      { top: origTop - popOff, scaleX: origSX * factor, scaleY: origSY * factor },
      {
        duration: 1000,
        onChange: () => canvas?.requestRenderAll(),
        onComplete: step2,
      }
    );
  };

  const step2 = () => {
    obj.animate(
      { top: origTop, scaleX: origSX, scaleY: origSY },
      {
        duration: 1000,
        onChange: () => canvas?.requestRenderAll(),
        onComplete: () => {
          if ((obj as any).__isLooping) step1();
        },
      }
    );
  };

  obj.set({ scaleX: 0, scaleY: 0 });
  canvas?.requestRenderAll();
  step1();
}


