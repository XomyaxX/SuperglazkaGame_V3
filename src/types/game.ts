export interface GameStats {
  played: number;
  bestScore: number;
}

export interface GameResult {
  score: number;
  stars: number;
  coinsEarned: number;
}

export interface GameModule {
  init(container: HTMLElement): void;
  destroy(): void;
  onComplete?: (result: GameResult) => void;
}

export type GameName = 'blink' | 'tracker' | 'runner' | 'gym';
