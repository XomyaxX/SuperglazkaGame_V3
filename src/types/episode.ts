export interface EpisodeFrame {
  id: string;
  title: string;
  narration?: string;
  dialogue?: DialogueLine[];
  backgroundImage: string;
  backgroundVideo?: string;
  mood?: string;
  game?: string;
  choices?: FrameChoice[];
}

export interface DialogueLine {
  speaker: string;
  text: string;
  emotion?: string;
}

export interface FrameChoice {
  text: string;
  nextFrame?: number;
  action?: string;
}

export interface Episode {
  id: number;
  title: string;
  description: string;
  coverImage: string;
  frames: EpisodeFrame[];
  moodMusic?: string;
}

export interface EpisodeProgress {
  completed: boolean;
  framesSeen: number;
  maxFrame: number;
}
