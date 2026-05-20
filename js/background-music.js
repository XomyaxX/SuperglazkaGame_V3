/**
 * Background Music — Web Audio API-based ambient music player.
 * Crossfades between tracks based on mood. Replaces video audio.
 * @namespace BackgroundMusic
 */
const BackgroundMusic = (function() {
  'use strict';

  let ctx = null;
  let currentTrack = null;
  let nextTrack = null;
  let currentGain = null;
  let nextGain = null;
  let currentNode = null;
  let nextNode = null;
  let volume = 0.5;
  let enabled = true;
  let isPlaying = false;
  let currentMood = null;

  const CROSSFADE_DURATION = 1.5; // seconds
  const MOOD_TRACKS = {
    cosmic:     ['assets/audio/moods/cosmic/track01.mp3'],
    joyful:     ['assets/audio/moods/joyful/track01.mp3'],
    tension:    ['assets/audio/moods/tension/track01.mp3'],
    peaceful:   ['assets/audio/moods/peaceful/track01.mp3'],
    magical:    ['assets/audio/moods/magical/track01.mp3'],
    triumphant: ['assets/audio/moods/triumphant/track01.mp3'],
    warm:       ['assets/audio/moods/warm/track01.mp3'],
    mystery:    ['assets/audio/moods/mystery/track01.mp3']
  };

  function getAudioContext() {
    if (!ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) ctx = new AudioContext();
    }
    return ctx;
  }

  function pickTrack(mood) {
    const list = MOOD_TRACKS[mood];
    if (!list || list.length === 0) return null;
    return list[Math.floor(Math.random() * list.length)];
  }

  function createAudioElement(src) {
    const audio = new Audio(src);
    audio.loop = true;
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    return audio;
  }

  function connectTrack(audio) {
    const context = getAudioContext();
    if (!context) return null;
    const source = context.createMediaElementSource(audio);
    const gain = context.createGain();
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(context.destination);
    return { source, gain, audio };
  }

  function fadeGain(gainNode, from, to, duration, onDone) {
    const context = getAudioContext();
    if (!context) return;
    const now = context.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(from, now);
    gainNode.gain.linearRampToValueAtTime(to, now + duration);
    if (onDone) {
      setTimeout(onDone, duration * 1000);
    }
  }

  /**
   * Enable or disable background music.
   * @param {boolean} val
   */
  function setEnabled(val) {
    enabled = val;
    if (!enabled && isPlaying) stop();
  }

  /**
   * Set volume (0–1).
   * @param {number} v
   */
  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (currentGain) {
      const context = getAudioContext();
      if (context) {
        currentGain.gain.cancelScheduledValues(context.currentTime);
        currentGain.gain.setValueAtTime(volume, context.currentTime);
      }
    }
  }

  /**
   * Start playing music for a mood.
   * @param {string} mood
   */
  function play(mood) {
    if (!enabled) return;
    const context = getAudioContext();
    if (!context) return;

    // Resume AudioContext if suspended (browser policy)
    if (context.state === 'suspended') {
      context.resume();
    }

    const src = pickTrack(mood);
    if (!src) {
      stop();
      return;
    }

    if (currentMood === mood && isPlaying) return;
    currentMood = mood;

    const audio = createAudioElement(src);
    const connected = connectTrack(audio);
    if (!connected) return;

    if (!isPlaying) {
      // First play — simple fade in
      currentTrack = connected;
      currentGain = connected.gain;
      currentNode = connected.audio;
      currentNode.play().catch(() => {});
      fadeGain(currentGain, 0, volume, CROSSFADE_DURATION);
      isPlaying = true;
    } else {
      // Crossfade
      nextTrack = connected;
      nextGain = connected.gain;
      nextNode = connected.audio;
      nextNode.play().catch(() => {});
      fadeGain(currentGain, volume, 0, CROSSFADE_DURATION, function() {
        if (currentNode) {
          currentNode.pause();
          currentNode.src = '';
        }
        currentTrack = nextTrack;
        currentGain = nextGain;
        currentNode = nextNode;
        nextTrack = null;
        nextGain = null;
        nextNode = null;
      });
      fadeGain(nextGain, 0, volume, CROSSFADE_DURATION);
    }
  }

  /**
   * Smoothly crossfade to a new mood.
   * @param {string} mood
   */
  function crossfadeTo(mood) {
    play(mood);
  }

  /** Stop all background music. */
  function stop() {
    if (!isPlaying) return;
    const context = getAudioContext();
    if (currentGain && context) {
      currentGain.gain.cancelScheduledValues(context.currentTime);
      currentGain.gain.linearRampToValueAtTime(0, context.currentTime + 0.5);
    }
    setTimeout(() => {
      if (currentNode) { currentNode.pause(); currentNode.src = ''; }
      if (nextNode) { nextNode.pause(); nextNode.src = ''; }
      currentTrack = null;
      currentGain = null;
      currentNode = null;
      nextTrack = null;
      nextGain = null;
      nextNode = null;
      isPlaying = false;
      currentMood = null;
    }, 600);
  }

  /** Resume AudioContext after user interaction. */
  function resumeContext() {
    const context = getAudioContext();
    if (context && context.state === 'suspended') {
      context.resume();
    }
  }

  return {
    play,
    crossfadeTo,
    stop,
    setEnabled,
    setVolume,
    resumeContext
  };
})();
