/**
 * Background Music — Web Audio API-based ambient music player.
 * Crossfades between tracks based on mood.
 * Falls back to synthesized ambient drones when no MP3 files are available.
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
  let currentSynthNodes = null; // { oscillators[], gain, lfoNodes[] }
  let nextSynthNodes = null;

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

  const MOOD_SYNTH_PARAMS = {
    cosmic:     { freqs: [220, 329.63, 440],   type: 'sine',     filter: 2000, detune: 5 },
    joyful:     { freqs: [261.63, 329.63, 392], type: 'triangle', filter: 3000, detune: 3 },
    tension:    { freqs: [110, 146.83, 207.65], type: 'sawtooth', filter: 800,  detune: 8 },
    peaceful:   { freqs: [174.61, 220, 261.63], type: 'sine',     filter: 1500, detune: 2 },
    magical:    { freqs: [293.66, 369.99, 493.88], type: 'sine',  filter: 2500, detune: 4 },
    triumphant: { freqs: [196, 246.94, 293.66], type: 'triangle', filter: 2000, detune: 3 },
    warm:       { freqs: [130.81, 164.81, 196], type: 'sine',     filter: 1200, detune: 2 },
    mystery:    { freqs: [155.56, 196, 233.08], type: 'sine',     filter: 1800, detune: 6 }
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

  function buildSynth(mood) {
    const context = getAudioContext();
    if (!context) return null;
    const params = MOOD_SYNTH_PARAMS[mood];
    if (!params) return null;

    const masterGain = context.createGain();
    masterGain.gain.value = 0;

    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = params.filter;
    filter.Q.value = 0.5;

    const oscillators = [];
    params.freqs.forEach((freq, i) => {
      const osc = context.createOscillator();
      osc.type = params.type;
      osc.frequency.value = freq;
      osc.detune.value = (i % 2 === 0 ? 1 : -1) * params.detune;

      const oscGain = context.createGain();
      oscGain.gain.value = 0.25; // divide among oscillators

      osc.connect(oscGain);
      oscGain.connect(filter);
      osc.start();
      oscillators.push({ osc, oscGain });
    });

    // Subtle LFO on filter frequency for movement
    const lfo = context.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.1 + Math.random() * 0.15;
    const lfoGain = context.createGain();
    lfoGain.gain.value = params.filter * 0.3;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    filter.connect(masterGain);
    masterGain.connect(context.destination);

    return { oscillators, gain: masterGain, lfoNodes: [lfo, lfoGain], filter };
  }

  function disposeSynth(synth) {
    if (!synth) return;
    try {
      synth.oscillators.forEach(o => {
        o.osc.stop();
        o.osc.disconnect();
        o.oscGain.disconnect();
      });
      synth.lfoNodes.forEach(n => {
        if (n.stop) n.stop();
        n.disconnect();
      });
      synth.filter.disconnect();
      synth.gain.disconnect();
    } catch (e) {}
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
  let fallbackInProgress = false;

  function play(mood) {
    if (!enabled) return;
    const context = getAudioContext();
    if (!context) return;

    // Resume AudioContext if suspended (browser policy)
    if (context.state === 'suspended') {
      context.resume();
    }

    if (currentMood === mood && isPlaying) return;
    currentMood = mood;

    const src = pickTrack(mood);
    if (src) {
      // Try MP3 first; if it fails, fall back to synthesized
      const audio = createAudioElement(src);
      const connected = connectTrack(audio);
      if (connected) {
        let hasFallback = false;
        function doFallback() {
          if (hasFallback) return;
          hasFallback = true;
          if (currentNode === audio || nextNode === audio) {
            stop(true);
            playSynthesized(mood);
          }
        }
        audio.addEventListener('error', function onError() {
          audio.removeEventListener('error', onError);
          doFallback();
        });

        if (!isPlaying) {
          currentTrack = connected;
          currentGain = connected.gain;
          currentNode = connected.audio;
          currentNode.play().catch(() => doFallback());
          fadeGain(currentGain, 0, volume, CROSSFADE_DURATION);
          isPlaying = true;
          // Safety fallback if error doesn't fire quickly
          setTimeout(() => {
            if (audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE && !hasFallback) {
              doFallback();
            }
          }, 2000);
        } else {
          nextTrack = connected;
          nextGain = connected.gain;
          nextNode = connected.audio;
          nextNode.play().catch(() => doFallback());
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
          setTimeout(() => {
            if (audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE && !hasFallback) {
              doFallback();
            }
          }, 2000);
        }
        return;
      }
    }

    // No MP3 available — use synthesized ambient
    playSynthesized(mood);
  }

  function playSynthesized(mood) {
    const context = getAudioContext();
    if (!context) return;

    const synth = buildSynth(mood);
    if (!synth) return;

    if (!isPlaying) {
      currentSynthNodes = synth;
      currentGain = synth.gain;
      currentNode = null; // mark as synth
      fadeGain(currentGain, 0, volume, CROSSFADE_DURATION);
      isPlaying = true;
    } else {
      nextSynthNodes = synth;
      nextGain = synth.gain;
      fadeGain(currentGain, volume, 0, CROSSFADE_DURATION, function() {
        disposeSynth(currentSynthNodes);
        currentSynthNodes = nextSynthNodes;
        currentGain = nextGain;
        currentNode = null;
        nextSynthNodes = null;
        nextGain = null;
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

  /** Stop all background music.
   * @param {boolean} [fast=false] — skip fade-out
   */
  function stop(fast) {
    if (!isPlaying) return;
    const context = getAudioContext();
    if (currentGain && context) {
      currentGain.gain.cancelScheduledValues(context.currentTime);
      if (fast) {
        currentGain.gain.setValueAtTime(0, context.currentTime);
      } else {
        currentGain.gain.linearRampToValueAtTime(0, context.currentTime + 0.5);
      }
    }
    setTimeout(() => {
      if (currentNode) { currentNode.pause(); currentNode.src = ''; }
      if (nextNode) { nextNode.pause(); nextNode.src = ''; }
      disposeSynth(currentSynthNodes);
      disposeSynth(nextSynthNodes);
      currentTrack = null;
      currentGain = null;
      currentNode = null;
      currentSynthNodes = null;
      nextTrack = null;
      nextGain = null;
      nextNode = null;
      nextSynthNodes = null;
      isPlaying = false;
      currentMood = null;
    }, fast ? 50 : 600);
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
