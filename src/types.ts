import { fabric } from "fabric";

export type EditorElementBase<T extends string, P> = {
  readonly id: string;
  fabricObject?: fabric.Object | undefined;
  name: string;
  readonly type: T;
  placement: Placement;
  timeFrame: TimeFrame;
  properties: P;
};
export type VideoEditorElement = EditorElementBase<
  "video",
  { src: string; elementId: string; imageObject?: fabric.Image, effect: Effect }
>;
export type ImageEditorElement = EditorElementBase<
  "image",
  { src: string; elementId: string; imageObject?: fabric.Object, effect: Effect }
>;

export type AudioEditorElement = EditorElementBase<
  "audio",
  { src: string; elementId: string, isAudioPlaying?: boolean; }
>;
export type TextEditorElement = EditorElementBase<
  "text",
  {
    text: string;
    fontSize: number;
    fontWeight: number | string;
    fontStyle?: "normal" | "italic";
    textColor?: string;
    fontFamily?: string;
    splittedTexts: fabric.Text[];
  }
>;
export type SvgEditorElement = EditorElementBase<
  "svg",
  { src: string; elementId: string; animationType?: string }
>;

export interface SceneBackground {
  background_url: string;
  


}

export interface SceneGif {
  svg_url: string;
  calculatedPosition?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface SceneAnimation {
  name: string;
}



export type SceneEditorElement = EditorElementBase<'scene', {
  sceneIndex: number;
  backgrounds: SceneBackground[];
  gifs: SceneGif[];
  animations: SceneAnimation[];
  elements: EditorElement[];
  tts: TtsEditorElement[];
  text?: string;
  
  
}>;


export type EditorElement =
  | VideoEditorElement
  | ImageEditorElement
  | AudioEditorElement
  | TextEditorElement
  | SvgEditorElement
  | SceneEditorElement

export type Placement = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
};



export type EffectBase<T extends string> = {
  type: T;
}

export type BlackAndWhiteEffect = EffectBase<"none"> |
  EffectBase<"blackAndWhite"> |
  EffectBase<"sepia"> |
  EffectBase<"invert"> |
  EffectBase<"saturate">;
export type Effect = BlackAndWhiteEffect;
export type EffecType = Effect["type"];

export type AnimationBase<T, P = {}> = {
  id: string;
  targetId: string;
  duration: number;
  type: T;
  properties: P;
}

export type FadeInAnimation = AnimationBase<"fadeIn">;
export type FadeOutAnimation = AnimationBase<"fadeOut">;

export type BreatheAnimation = AnimationBase<"breathe">

export type SlideDirection = "left" | "right" | "top" | "bottom";
export type SlideTextType = 'none' | 'character';
export type SlideInAnimation = AnimationBase<"slideIn", {
  direction: SlideDirection,
  useClipPath: boolean,
  textType: 'none' | 'character'
}>;

export type SlideOutAnimation = AnimationBase<"slideOut", {
  direction: SlideDirection,
  useClipPath: boolean,
  textType: SlideTextType,
}>;

export type Animation =
  FadeInAnimation
  | FadeOutAnimation
  | SlideInAnimation
  | SlideOutAnimation
  | BreatheAnimation;

export type MenuOption =
  | "Video"
  | "Audio"
  | "Text"
  | "Image"
  | "Export"
  | "Fill"
  | "STORYLINE"
  | "SVG";


export interface GifResult {
  id: string;
  tags: string[];
  gif_url: string


}


export interface TtsEditorElement {
  id: string;
  audioUrl: string;
  layerType: 'tts';
  timeFrame: TimeFrame;
  played: boolean;
  audioElement: HTMLAudioElement;
}


export interface TimeFrame {
  start: number;
  end: number;
}

export interface AnimationTypes {
  id: string;
  name: string;
  gif_url?: string;
  timeFrame: TimeFrame;

}

interface Background {
  id: string;
  name: string;
  background_url: string;
  timeFrame: TimeFrame;
}
interface Gif {
  id: string;
  name: string;
  svg_url: string;
  timeFrame: TimeFrame;
}
interface Text {
  id: string;
  name: string;
  timeFrame: TimeFrame;
}


export interface StoryLinePayload {
  is_default: boolean;
  keywords: string[];
  animations: AnimationTypes[];
  backgrounds: Background[];
  gifs: GifResult[];
}
export interface FabricObjects {
  background: fabric.Object | null;
  backgrounds: fabric.Object[];
  texts: fabric.Textbox[];
  gifs: fabric.Image[];
  elements: fabric.Object[];
  animations: fabric.Object[];
  tts: fabric.Object[]
}

export interface Scene {
  id: string,
  backgrounds: Background[];
  gifs: Gif[];
  animations: AnimationTypes[];
  elements: EditorElement[];
  text?: Text[],
  tts?: TtsEditorElement[]
  timeFrame: TimeFrame;
  bgImage?: string
  fabricObjects?: FabricObjects;
  tts_audio_url: string
}

export interface SceneLayer {
  id: string;
  layerType: 'background' | 'svg' | 'animation' | 'element' | 'text' | 'tts';
  name?: string;
  timeFrame: TimeFrame;
  fabricObject?: fabric.Object | fabric.Object[];
  [key: string]: any;

}



export interface SceneGif extends SceneLayer {
  svg_url: string;
  tags?: string[];
}

export interface SceneBackground extends SceneLayer {
  background_url: string;
  name?: string;
 
  
}

export interface SceneAnimation extends SceneLayer {
  name: string;
  gif_url?: string;
}

export interface SceneElement extends SceneLayer {
  name: string;
}


export interface GifItem {
  svg_url: string;
  calculatedPosition?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}



interface SceneResource {
  id: string;
  layerType: string;
  timeFrame: TimeFrame;
  [key: string]: any;
}



export interface TextResource {
  id: string;
  layerType: 'text';
  [key: string]: any;
  placement: Placement;
  timeFrame: TimeFrame;
  properties: {
    fontSize: number;
    fontFamily: string;
    fill: string;
  };
}



export interface SceneElements {
  id: string;
  name: string;
  type: string;
  placement: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  timeFrame: TimeFrame;
  properties: {
    sceneIndex: number;
    backgrounds: SceneResource[];
    gifs: SceneResource[];
    animations: SceneResource[];
    elements: SceneResource[];
    text: TextResource[]
  };
  fabricObject?: fabric.Object;
}


export interface GifElement {
  svg_url: string;
  calculatedPosition?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}


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

 

interface ScenePayload {
  svgs?: SvgAsset[];
  backgrounds?: BackgroundAsset[];
  animations?: AnimationAsset[];
  text?: string[];
  tts_audio_url?: string[];
}

export interface ScenePayloadWithEdits extends ScenePayload {
  editedBackgrounds: BackgroundAsset[];
  editedSvgs: SvgAsset[];
  editedText: string[];
  elementPositions: Record<string, {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    angle: number;
  }>;
  textProperties: Record<string, {
    fontSize: number;
    fontFamily: string;
    fill: string;
  }>;
  elements?: Array<{
    id: string;
    type: 'svg' | 'text' | 'tts';
    content?: string;
    tags?: string[];
  }>;
}

export interface LayerProperties {
  name?: string;
  type?: 'text' | 'svg' | 'background' | 'tts';
  left?: number;
  top?: number;
  angle?: number;
  scaleX?: number;
  scaleY?: number;
  fill?: string;
  fontSize?: number;
  fontFamily?: string;
  text?: string;
}


