import type { GameName, EpisodeProgress, GameStats } from '../types';

const STORAGE_KEY = 'superglazka_profile';

export interface Profile {
  nickname: string;
  coins: number;
  episodes: Record<string, EpisodeProgress>;
  games: Record<GameName, GameStats>;
}

function getDefaultProfile(): Profile {
  return {
    nickname: 'Игрок',
    coins: 0,
    episodes: {
      '1': { completed: false, framesSeen: 0, maxFrame: -1 },
      '2': { completed: false, framesSeen: 0, maxFrame: -1 },
      '3': { completed: false, framesSeen: 0, maxFrame: -1 },
    },
    games: {
      blink: { played: 0, bestScore: 0 },
      tracker: { played: 0, bestScore: 0 },
      runner: { played: 0, bestScore: 0 },
      gym: { played: 0, bestScore: 0 },
    },
  };
}

export class PlayerProfile {
  static load(): Profile {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return getDefaultProfile();
      const parsed = JSON.parse(raw) as Partial<Profile>;
      return { ...getDefaultProfile(), ...parsed };
    } catch {
      return getDefaultProfile();
    }
  }

  static save(profile: Profile): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {
      /* ignore */
    }
  }

  static addCoins(amount: number): number {
    const p = this.load();
    p.coins += Math.max(0, amount);
    this.save(p);
    return p.coins;
  }

  static spendCoins(amount: number): boolean {
    const p = this.load();
    if (p.coins < amount) return false;
    p.coins -= amount;
    this.save(p);
    return true;
  }

  static completeEpisode(epId: string): void {
    const p = this.load();
    if (!p.episodes[epId]) p.episodes[epId] = { completed: false, framesSeen: 0, maxFrame: -1 };
    p.episodes[epId].completed = true;
    this.save(p);
  }

  static markFrameSeen(epId: string, frameIdx: number): void {
    const p = this.load();
    if (!p.episodes[epId]) p.episodes[epId] = { completed: false, framesSeen: 0, maxFrame: -1 };
    if (frameIdx > p.episodes[epId].maxFrame) {
      p.episodes[epId].maxFrame = frameIdx;
    }
    this.save(p);
  }

  static completeGame(name: GameName, score: number): void {
    const p = this.load();
    if (!p.games[name]) p.games[name] = { played: 0, bestScore: 0 };
    p.games[name].played += 1;
    if (score > p.games[name].bestScore) {
      p.games[name].bestScore = score;
    }
    this.save(p);
  }

  static setNickname(name: string): void {
    const p = this.load();
    p.nickname = (name || 'Игрок').trim().substring(0, 20);
    this.save(p);
  }
}
