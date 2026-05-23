/**
 * Background Music — Web Audio API + Tone.js procedural ambient music player.
 * Crossfades between tracks based on mood.
 * Falls back to synthesized ambient drones when Tone.js or MP3 files are unavailable.
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

  // ─── Tone.js Procedural Engine ───
  let toneReady = false;
  let masterGainNode = null;
  let reverbNode = null;
  let activeLoops = [];
  let activeSynths = [];
  let currentProceduralGain = null;
  let nextProceduralGain = null;

  const MOOD_CONFIG = {
    cosmic: {
      bpm: 60,
      scale: ['A3','C4','E4','G4','A4'],
      pad: { type: 'sine', attack: 2, release: 3, filter: 1200 },
      arp: { interval: '8n', notes: ['A3','E4','C4','G4'] },
      reverb: 5,
      delay: 0,
      drums: false
    },
    joyful: {
      bpm: 110,
      scale: ['C4','D4','E4','G4','A4','C5'],
      chords: [['C4','E4','G4'], ['G3','B3','D4'], ['A3','C4','E4'], ['F3','A3','C4']],
      pad: { type: 'triangle', attack: 0.5, release: 1.5, filter: 2500 },
      melody: { type: 'triangle', attack: 0.02, release: 0.3 },
      reverb: 2,
      delay: 0.2,
      drums: { kick: '4n', hat: '8n' }
    },
    tension: {
      bpm: 80,
      scale: ['C3','C#3','F3','G#3'],
      pad: { type: 'sawtooth', attack: 1.5, release: 2, filter: 600 },
      drone: { note: 'C2', type: 'sawtooth', filter: 400 },
      reverb: 4,
      delay: 0,
      drums: { kick: '2n.', noise: '1m' }
    },
    peaceful: {
      bpm: 55,
      scale: ['F3','A3','C4','D4','F4'],
      pad: { type: 'sine', attack: 1, release: 3, filter: 1000 },
      pluck: { type: 'triangle', attack: 0.01, release: 1.2 },
      reverb: 6,
      delay: 0.3,
      drums: false
    },
    magical: {
      bpm: 75,
      scale: ['D4','F4','A4','B4','D5'],
      pad: { type: 'sine', attack: 0.8, release: 2, filter: 2000 },
      bell: { type: 'sine', attack: 0.01, release: 1.5, mod: 5 },
      reverb: 4,
      delay: 0.4,
      drums: { hat: '16n' }
    },
    triumphant: {
      bpm: 100,
      scale: ['C3','E3','G3','C4','E4','G4'],
      chords: [['C3','E3','G3','C4'], ['G2','B2','D3','G3'], ['F2','A2','C3','F3']],
      pad: { type: 'sawtooth', attack: 0.3, release: 1.2, filter: 2200 },
      reverb: 2.5,
      delay: 0.15,
      drums: { kick: '4n', snare: '2n' }
    },
    warm: {
      bpm: 65,
      scale: ['G3','B3','D4','E4','G4'],
      pad: { type: 'triangle', attack: 1.2, release: 2.5, filter: 1100 },
      pluck: { type: 'triangle', attack: 0.02, release: 0.8 },
      reverb: 3,
      delay: 0.25,
      drums: false
    },
    mystery: {
      bpm: 70,
      scale: ['E3','G3','A3','B3','D4'],
      pad: { type: 'sine', attack: 0.6, release: 2, filter: 1400 },
      melody: { type: 'sine', attack: 0.03, release: 0.6 },
      reverb: 5,
      delay: 0.35,
      drums: { hat: '8n' }
    }
  };

  function initTone() {
    if (toneReady) return Promise.resolve(true);
    if (typeof Tone === 'undefined') return Promise.resolve(false);
    return new Promise(function(resolve) {
      try {
        masterGainNode = new Tone.Gain(volume).toDestination();
        reverbNode = new Tone.Reverb({ decay: 3, wet: 0.35 }).connect(masterGainNode);
        reverbNode.generate().then(function() {
          toneReady = true;
          resolve(true);
        }).catch(function() {
          resolve(false);
        });
      } catch (e) {
        console.warn('Tone.js init failed:', e);
        resolve(false);
      }
    });
  }

  function disposeActive() {
    activeLoops.forEach(l => {
      try { l.stop(); l.dispose(); } catch (e) {}
    });
    activeLoops = [];
    activeSynths.forEach(s => {
      try { s.dispose(); } catch (e) {}
    });
    activeSynths = [];
  }

  function buildToneMood(mood) {
    const cfg = MOOD_CONFIG[mood];
    if (!cfg) return null;

    Tone.Transport.bpm.value = cfg.bpm;

    const groupGain = new Tone.Gain(0).connect(reverbNode || masterGainNode);
    const localLoops = [];
    const localSynths = [];

    // Shared effects
    const delay = cfg.delay ? new Tone.FeedbackDelay('8n', cfg.delay).connect(groupGain) : groupGain;

    // Pad / Chords
    if (cfg.pad) {
      const pad = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: cfg.pad.type },
        envelope: { attack: cfg.pad.attack, decay: 0.5, sustain: 0.6, release: cfg.pad.release },
      }).connect(delay);
      pad.volume.value = -8;
      localSynths.push(pad);

      if (cfg.chords) {
        const chordSeq = new Tone.Sequence((time, chord) => {
          pad.triggerAttackRelease(chord, '1m', time);
        }, cfg.chords, '1m').start(0);
        localLoops.push(chordSeq);
      } else {
        // Slow drone pad
        const droneNotes = cfg.scale.slice(0, 3);
        const droneLoop = new Tone.Loop(time => {
          pad.triggerAttackRelease(droneNotes, '2m', time);
        }, '2m').start(0);
        localLoops.push(droneLoop);
      }
    }

    // Pluck / Melody / Bell
    if (cfg.pluck) {
      const pluck = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: cfg.pluck.type },
        envelope: { attack: cfg.pluck.attack, decay: 0.4, sustain: 0.1, release: cfg.pluck.release },
      }).connect(delay);
      pluck.volume.value = -6;
      localSynths.push(pluck);
      const pluckLoop = new Tone.Loop(time => {
        const note = cfg.scale[Math.floor(Math.random() * cfg.scale.length)];
        if (Math.random() > 0.3) pluck.triggerAttackRelease(note, '8n', time);
      }, '4n').start(0);
      localLoops.push(pluckLoop);
    }

    if (cfg.melody) {
      const mel = new Tone.Synth({
        oscillator: { type: cfg.melody.type },
        envelope: { attack: cfg.melody.attack, decay: 0.3, sustain: 0.3, release: cfg.melody.release },
      }).connect(delay);
      mel.volume.value = -10;
      localSynths.push(mel);
      const melLoop = new Tone.Loop(time => {
        const note = cfg.scale[Math.floor(Math.random() * cfg.scale.length)];
        if (Math.random() > 0.5) mel.triggerAttackRelease(note, '8n', time);
      }, '4n').start(0);
      localLoops.push(melLoop);
    }

    if (cfg.bell) {
      const bell = new Tone.FMSynth({
        harmonicity: cfg.bell.mod || 3,
        modulationIndex: 10,
        oscillator: { type: 'sine' },
        envelope: { attack: cfg.bell.attack, decay: 0.5, sustain: 0, release: cfg.bell.release },
        modulation: { type: 'square' },
        modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.2 }
      }).connect(delay);
      bell.volume.value = -14;
      localSynths.push(bell);
      const bellLoop = new Tone.Loop(time => {
        const note = cfg.scale[Math.floor(Math.random() * cfg.scale.length)];
        if (Math.random() > 0.4) bell.triggerAttackRelease(note, '16n', time);
      }, '8n').start(0);
      localLoops.push(bellLoop);
    }

    // Arp
    if (cfg.arp) {
      const arp = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.02, decay: 0.2, sustain: 0.1, release: 0.5 },
      }).connect(delay);
      arp.volume.value = -16;
      localSynths.push(arp);
      const arpSeq = new Tone.Sequence((time, note) => {
        arp.triggerAttackRelease(note, cfg.arp.interval, time);
      }, cfg.arp.notes, cfg.arp.interval).start(0);
      localLoops.push(arpSeq);
    }

    // Drone for tension
    if (cfg.drone) {
      const drone = new Tone.Synth({
        oscillator: { type: cfg.drone.type },
        envelope: { attack: 2, decay: 0.1, sustain: 1, release: 3 },
      }).connect(groupGain);
      drone.volume.value = -12;
      localSynths.push(drone);
      const droneLoop = new Tone.Loop(time => {
        drone.triggerAttackRelease(cfg.drone.note, '1m', time);
      }, '1m').start(0);
      localLoops.push(droneLoop);
    }

    // Percussion
    if (cfg.drums) {
      if (cfg.drums.kick) {
        const kick = new Tone.MembraneSynth().connect(groupGain);
        kick.volume.value = -10;
        localSynths.push(kick);
        const kickLoop = new Tone.Loop(time => {
          kick.triggerAttackRelease('C1', '8n', time);
        }, cfg.drums.kick).start(0);
        localLoops.push(kickLoop);
      }
      if (cfg.drums.snare) {
        const snare = new Tone.NoiseSynth({
          noise: { type: 'white' },
          envelope: { attack: 0.001, decay: 0.2, sustain: 0 }
        }).connect(groupGain);
        snare.volume.value = -16;
        localSynths.push(snare);
        const snareLoop = new Tone.Loop(time => {
          snare.triggerAttackRelease('16n', time);
        }, cfg.drums.snare).start(0);
        localLoops.push(snareLoop);
      }
      if (cfg.drums.hat) {
        const hat = new Tone.MetalSynth({
          harmonicity: 5.1,
          modulationIndex: 32,
          resonance: 4000,
          octaves: 1.5,
          envelope: { attack: 0.001, decay: 0.1, release: 0.01 }
        }).connect(groupGain);
        hat.volume.value = -22;
        localSynths.push(hat);
        const hatLoop = new Tone.Loop(time => {
          hat.triggerAttackRelease('32n', time, 0.3);
        }, cfg.drums.hat).start(0);
        localLoops.push(hatLoop);
      }
      if (cfg.drums.noise) {
        const noise = new Tone.NoiseSynth({
          noise: { type: 'pink' },
          envelope: { attack: 0.5, decay: 1, sustain: 0.5, release: 2 }
        }).connect(groupGain);
        noise.volume.value = -20;
        localSynths.push(noise);
        const noiseLoop = new Tone.Loop(time => {
          noise.triggerAttackRelease('2m', time);
        }, cfg.drums.noise).start(0);
        localLoops.push(noiseLoop);
      }
    }

    return { groupGain, localLoops, localSynths };
  }

  function playProcedural(mood) {
    initTone().then(function(ready) {
      if (!ready) {
        playSynthesized(mood);
        return;
      }
      // Ensure AudioContext is running (requires user gesture on first use)
      if (Tone.context.state === 'suspended') {
        Tone.start().then(function() {
          _doPlayProcedural(mood);
        }).catch(function() {
          playSynthesized(mood);
        });
      } else {
        _doPlayProcedural(mood);
      }
    });
  }

  function _doPlayProcedural(mood) {
    const next = buildToneMood(mood);
    if (!next) return;

    // Crossfade
    if (isPlaying && currentProceduralGain) {
      nextProceduralGain = next.groupGain;
      fadeGainNode(currentProceduralGain, volume, 0, CROSSFADE_DURATION, function() {
        if (currentProceduralGain) currentProceduralGain.dispose();
        currentProceduralGain = null;
      });
      fadeGainNode(next.groupGain, 0, volume, CROSSFADE_DURATION);
      currentProceduralGain = next.groupGain;
    } else {
      currentProceduralGain = next.groupGain;
      fadeGainNode(currentProceduralGain, 0, volume, CROSSFADE_DURATION);
      isPlaying = true;
    }

    // Clean up old loops/synths after crossfade
    setTimeout(function() {
      disposeActive();
      activeLoops = next.localLoops;
      activeSynths = next.localSynths;
    }, CROSSFADE_DURATION * 1000 + 50);

    Tone.Transport.start();
  }

  function fadeGainNode(gainNode, from, to, duration, onDone) {
    try {
      gainNode.gain.cancelScheduledValues(Tone.now());
      gainNode.gain.setValueAtTime(from, Tone.now());
      gainNode.gain.linearRampToValueAtTime(to, Tone.now() + duration);
      if (onDone) setTimeout(onDone, duration * 1000);
    } catch (e) {}
  }

  function stopProcedural(fast) {
    if (!toneReady) return;
    try {
      if (currentProceduralGain) {
        fadeGainNode(currentProceduralGain, volume, 0, fast ? 0.05 : 0.5, () => {
          Tone.Transport.stop();
          disposeActive();
          if (currentProceduralGain) { currentProceduralGain.dispose(); currentProceduralGain = null; }
          if (nextProceduralGain) { nextProceduralGain.dispose(); nextProceduralGain = null; }
        });
      } else {
        Tone.Transport.stop();
        disposeActive();
      }
    } catch (e) {}
  }

  // ─── Legacy Simple Synth (fallback) ───

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
      oscGain.gain.value = 0.25;

      osc.connect(oscGain);
      oscGain.connect(filter);
      osc.start();
      oscillators.push({ osc, oscGain });
    });

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

  function setEnabled(val) {
    enabled = val;
    if (!enabled && isPlaying) stop();
  }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (currentGain) {
      const context = getAudioContext();
      if (context) {
        currentGain.gain.cancelScheduledValues(context.currentTime);
        currentGain.gain.setValueAtTime(volume, context.currentTime);
      }
    }
    if (masterGainNode && toneReady) {
      masterGainNode.gain.setTargetAtTime(volume, Tone.now(), 0.1);
    }
  }

  let fallbackInProgress = false;

  function play(mood) {
    if (!enabled) return;

    // Prefer Tone.js procedural if available
    if (typeof Tone !== 'undefined') {
      playProcedural(mood);
      currentMood = mood;
      return;
    }

    const context = getAudioContext();
    if (!context) return;

    if (context.state === 'suspended') {
      context.resume();
    }

    if (currentMood === mood && isPlaying) return;
    currentMood = mood;

    const src = pickTrack(mood);
    if (src) {
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
      currentNode = null;
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

  function crossfadeTo(mood) {
    play(mood);
  }

  function stop(fast) {
    if (!isPlaying) return;

    // Stop Tone.js procedural
    if (toneReady && typeof Tone !== 'undefined') {
      stopProcedural(fast);
    }

    // Stop legacy
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

  function resumeContext() {
    if (typeof Tone !== 'undefined' && Tone.context && Tone.context.state === 'suspended') {
      Tone.start();
    }
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
