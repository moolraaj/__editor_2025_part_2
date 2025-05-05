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

export type TimeFrame = {
  start: number;
  end: number;
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
  animation_type_id: string;
  background_id: string;
  gif_url: string;

  similarity?: number;

}

export interface AnimationTypes {
  id: string;
  name: string;
  gif_url?: string;
}

interface Background {
  id: string;
  name: string;
  background_url: string;
}

export interface StoryLinePayload {
  is_default: boolean;
  keywords: string[];
  animations: AnimationTypes[];
  backgrounds: Background[];
  gifs: GifResult[];
}

export interface Scene {
  backgrounds: { background_url: string }[];
  gifs: { svg_url: string }[];
  animations: { name: string }[];
  elements: EditorElement[];
}




