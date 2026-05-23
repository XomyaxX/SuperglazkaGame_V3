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

  // ─── Richer MOOD_CONFIG with bass, structured melodies, fills, dynamics ───
  const MOOD_CONFIG = {
    cosmic: {
      bpm: 58,
      scale: ['A3','C4','E4','G4','A4','C5'],
      chords: [['A3','C4','E4','G4'], ['C4','E4','G4','B4'], ['E4','G4','B4','D5'], ['G4','B4','D5','F5']],
      pad: { type: 'sine', attack: 2.5, release: 4, filter: 1500 },
      bass: { type: 'sine', attack: 1, release: 3, pattern: ['A2','C2','E2','G2'], interval: '1m' },
      arp: { interval: '8n', notes: ['A3','E4','C4','G4','B4','D5'] },
      reverb: 6,
      delay: 0.5,
      drums: false,
      dynamics: { volumeCurve: [0.3, 0.5, 0.7, 0.5] }
    },
    joyful: {
      bpm: 115,
      scale: ['C4','D4','E4','G4','A4','B4','C5','D5'],
      chords: [['C4','E4','G4','B4'], ['G3','B3','D4','F4'], ['A3','C4','E4','G4'], ['F3','A3','C4','E4']],
      pad: { type: 'triangle', attack: 0.6, release: 1.5, filter: 2800 },
      bass: { type: 'triangle', attack: 0.05, release: 0.4, pattern: ['C3','G2','A2','F2'], interval: '2n' },
      melody: {
        type: 'triangle', attack: 0.02, release: 0.3,
        motifs: [
          ['C5','E5','D5','G5'], ['E5','G5','A5','B5'],
          ['G5','E5','D5','C5'], ['A5','G5','E5','D5']
        ],
        interval: '4n', variation: 0.3
      },
      reverb: 2,
      delay: 0.2,
      drums: { kick: '4n', snare: '2n', hat: '8n', shaker: '16n' }
    },
    tension: {
      bpm: 85,
      scale: ['C3','C#3','F3','G#3','A3','D4'],
      chords: [['C3','C#3','F3','G#3'], ['C#3','F3','G#3','B3'], ['F3','G#3','B3','D4']],
      pad: { type: 'sawtooth', attack: 1.5, release: 2.5, filter: 500 },
      bass: { type: 'sawtooth', attack: 0.5, release: 1.5, pattern: ['C1','C#1','F1','G#1'], interval: '2n' },
      drone: { note: 'C2', type: 'sawtooth', filter: 300 },
      reverb: 5,
      delay: 0,
      drums: { kick: '2n.', noise: '1m', hit: '4n' },
      dynamics: { volumeCurve: [0.4, 0.6, 0.8, 0.5] }
    },
    peaceful: {
      bpm: 52,
      scale: ['F3','A3','C4','D4','E4','F4','G4','A4'],
      chords: [['F3','A3','C4','E4'], ['C4','E4','G4','B4'], ['D4','F4','A4','C5'], ['A3','C4','E4','G4']],
      pad: { type: 'sine', attack: 1.5, release: 4, filter: 800 },
      bass: { type: 'sine', attack: 1, release: 3, pattern: ['F2','C2','D2','A1'], interval: '1m' },
      pluck: { type: 'triangle', attack: 0.01, release: 1.5 },
      melody: {
        type: 'sine', attack: 0.05, release: 1.2,
        motifs: [
          ['C4','A4','G4','F4'], ['A4','F4','E4','C4'],
          ['F4','G4','A4','C5'], ['E4','C4','A3','F3']
        ],
        interval: '2n', variation: 0.2
      },
      reverb: 7,
      delay: 0.4,
      drums: false
    },
    magical: {
      bpm: 78,
      scale: ['D4','F4','A4','B4','D5','F5','A5'],
      chords: [['D4','F4','A4','C5'], ['F4','A4','C5','E5'], ['A4','C5','E5','G5'], ['B4','D5','F5','A5']],
      pad: { type: 'sine', attack: 0.8, release: 2.5, filter: 2200 },
      bass: { type: 'sine', attack: 0.3, release: 1.5, pattern: ['D3','F3','A2','B2'], interval: '2n' },
      bell: { type: 'sine', attack: 0.01, release: 2, mod: 5 },
      melody: {
        type: 'sine', attack: 0.02, release: 0.8,
        motifs: [
          ['D5','F5','A5','D6'], ['F5','A5','D6','F6'],
          ['A5','F5','D5','B4'], ['D6','A5','F5','D5']
        ],
        interval: '8n', variation: 0.4
      },
      reverb: 5,
      delay: 0.5,
      drums: { hat: '16n', shaker: '8n' }
    },
    triumphant: {
      bpm: 105,
      scale: ['C3','E3','G3','A3','C4','E4','G4','C5'],
      chords: [['C3','E3','G3','C4'], ['G2','B2','D3','G3'], ['F2','A2','C3','F3'], ['C3','G3','C4','E4']],
      pad: { type: 'sawtooth', attack: 0.4, release: 1.5, filter: 2400 },
      bass: { type: 'sawtooth', attack: 0.05, release: 0.3, pattern: ['C2','G1','F1','C2'], interval: '2n' },
      melody: {
        type: 'triangle', attack: 0.03, release: 0.5,
        motifs: [
          ['C4','E4','G4','C5'], ['E4','G4','C5','E5'],
          ['G4','E4','C4','G3'], ['C5','G4','E4','C4']
        ],
        interval: '4n', variation: 0.25
      },
      reverb: 2.5,
      delay: 0.15,
      drums: { kick: '4n', snare: '2n', hat: '8n', crash: '1m' }
    },
    warm: {
      bpm: 62,
      scale: ['G3','B3','D4','E4','G4','A4','B4','D5'],
      chords: [['G3','B3','D4','F#4'], ['D4','F#4','A4','C5'], ['E4','G4','B4','D5'], ['B3','D4','F#4','A4']],
      pad: { type: 'triangle', attack: 1.5, release: 3, filter: 1000 },
      bass: { type: 'triangle', attack: 0.8, release: 2, pattern: ['G2','D2','E2','B1'], interval: '1m' },
      pluck: { type: 'triangle', attack: 0.02, release: 1 },
      melody: {
        type: 'triangle', attack: 0.04, release: 1,
        motifs: [
          ['D4','E4','G4','B4'], ['G4','B4','D5','E5'],
          ['B4','G4','E4','D4'], ['E5','D5','B4','G4']
        ],
        interval: '2n', variation: 0.2
      },
      reverb: 3.5,
      delay: 0.3,
      drums: false
    },
    mystery: {
      bpm: 68,
      scale: ['E3','G3','A3','B3','D4','E4','G4','B4'],
      chords: [['E3','G3','B3','D4'], ['G3','B3','D4','F4'], ['A3','C4','E4','G4'], ['B3','D4','F4','A4']],
      pad: { type: 'sine', attack: 0.8, release: 2.5, filter: 1200 },
      bass: { type: 'sine', attack: 0.5, release: 2, pattern: ['E2','G2','A2','B2'], interval: '2n' },
      melody: {
        type: 'sine', attack: 0.04, release: 0.8,
        motifs: [
          ['E4','G4','B4','E5'], ['G4','B4','E5','G5'],
          ['B4','G4','E4','B3'], ['E5','B4','G4','E4']
        ],
        interval: '4n', variation: 0.35
      },
      reverb: 6,
      delay: 0.4,
      drums: { hat: '8n', shaker: '4n' }
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

    // Shared effects chain: delay → reverb
    let fxChain = groupGain;
    if (cfg.delay) {
      const delayFx = new Tone.FeedbackDelay('8n', cfg.delay).connect(fxChain);
      fxChain = delayFx;
    }
    const filterFx = new Tone.Filter(cfg.pad ? cfg.pad.filter : 2000, 'lowpass').connect(fxChain);

    // ─── PAD / CHORDS ───
    if (cfg.pad) {
      const pad = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: cfg.pad.type },
        envelope: { attack: cfg.pad.attack, decay: 0.5, sustain: 0.6, release: cfg.pad.release },
      }).connect(filterFx);
      pad.volume.value = -10;
      localSynths.push(pad);

      if (cfg.chords) {
        const chordSeq = new Tone.Sequence(function(time, chord) {
          pad.triggerAttackRelease(chord, '1m', time);
        }, cfg.chords, '1m').start(0);
        localLoops.push(chordSeq);
      } else {
        const droneNotes = cfg.scale.slice(0, 3);
        const droneLoop = new Tone.Loop(function(time) {
          pad.triggerAttackRelease(droneNotes, '2m', time);
        }, '2m').start(0);
        localLoops.push(droneLoop);
      }
    }

    // ─── BASS ───
    if (cfg.bass) {
      const bass = new Tone.MonoSynth({
        oscillator: { type: cfg.bass.type },
        envelope: { attack: cfg.bass.attack, decay: 0.3, sustain: 0.7, release: cfg.bass.release },
        filter: { Q: 2, type: 'lowpass', rolloff: -24 },
        filterEnvelope: { attack: 0.06, decay: 0.2, sustain: 0.5, release: 0.5, baseFrequency: 200, octaves: 2.5 }
      }).connect(groupGain);
      bass.volume.value = -6;
      localSynths.push(bass);
      const bassSeq = new Tone.Sequence(function(time, note) {
        bass.triggerAttackRelease(note, cfg.bass.interval, time);
      }, cfg.bass.pattern, cfg.bass.interval).start(0);
      localLoops.push(bassSeq);
    }

    // ─── PLUCK (harp/guitar-like) ───
    if (cfg.pluck) {
      const pluck = new Tone.PluckSynth({
        attackNoise: 1,
        dampening: 4000,
        resonance: 0.9
      }).connect(filterFx);
      pluck.volume.value = -8;
      localSynths.push(pluck);

      // Structured pluck patterns instead of random
      const pluckPatterns = [
        cfg.scale.slice(0, 4),
        cfg.scale.slice(2, 6),
        cfg.scale.slice(1, 5),
        cfg.scale.slice(3, 7)
      ];
      let pluckPatIdx = 0;
      const pluckSeq = new Tone.Sequence(function(time, note) {
        if (note) pluck.triggerAttackRelease(note, '8n', time);
      }, pluckPatterns[0], '8n').start(0);
      localLoops.push(pluckSeq);

      // Rotate pattern every 2 bars
      const pluckRotate = new Tone.Loop(function(time) {
        pluckPatIdx = (pluckPatIdx + 1) % pluckPatterns.length;
        pluckSeq.set({ events: pluckPatterns[pluckPatIdx] });
      }, '2m').start(0);
      localLoops.push(pluckRotate);
    }

    // ─── STRUCTURED MELODY (motifs, not random) ───
    if (cfg.melody) {
      const mel = new Tone.Synth({
        oscillator: { type: cfg.melody.type },
        envelope: { attack: cfg.melody.attack, decay: 0.3, sustain: 0.3, release: cfg.melody.release },
      }).connect(filterFx);
      mel.volume.value = -9;
      localSynths.push(mel);

      const motifs = cfg.melody.motifs || [cfg.scale.slice(0, 4), cfg.scale.slice(2, 6)];
      let motifIdx = 0;
      let noteIdx = 0;
      const melLoop = new Tone.Loop(function(time) {
        const motif = motifs[motifIdx];
        const note = motif[noteIdx % motif.length];
        // Variation: sometimes skip or transpose
        if (Math.random() > (cfg.melody.variation || 0.3)) {
          mel.triggerAttackRelease(note, cfg.melody.interval, time);
        }
        noteIdx++;
        if (noteIdx >= motif.length) {
          noteIdx = 0;
          motifIdx = (motifIdx + 1) % motifs.length;
        }
      }, cfg.melody.interval).start(0);
      localLoops.push(melLoop);
    }

    // ─── BELL / FM SYNTH ───
    if (cfg.bell) {
      const bell = new Tone.FMSynth({
        harmonicity: cfg.bell.mod || 3,
        modulationIndex: 10,
        oscillator: { type: 'sine' },
        envelope: { attack: cfg.bell.attack, decay: 0.5, sustain: 0, release: cfg.bell.release },
        modulation: { type: 'square' },
        modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.2 }
      }).connect(filterFx);
      bell.volume.value = -14;
      localSynths.push(bell);

      // Bell pattern: sparse, accenting beat 1 and 3
      const bellPattern = [];
      for (let i = 0; i < 16; i++) {
        bellPattern.push((i === 0 || i === 8 || Math.random() > 0.7) ? cfg.scale[i % cfg.scale.length] : null);
      }
      const bellSeq = new Tone.Sequence(function(time, note) {
        if (note) bell.triggerAttackRelease(note, '16n', time);
      }, bellPattern, '16n').start(0);
      localLoops.push(bellSeq);
    }

    // ─── ARPEGGIO ───
    if (cfg.arp) {
      const arp = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.02, decay: 0.2, sustain: 0.1, release: 0.5 },
      }).connect(filterFx);
      arp.volume.value = -16;
      localSynths.push(arp);
      const arpSeq = new Tone.Sequence(function(time, note) {
        arp.triggerAttackRelease(note, cfg.arp.interval, time);
      }, cfg.arp.notes, cfg.arp.interval).start(0);
      localLoops.push(arpSeq);
    }

    // ─── DRONE ───
    if (cfg.drone) {
      const drone = new Tone.Synth({
        oscillator: { type: cfg.drone.type },
        envelope: { attack: 2, decay: 0.1, sustain: 1, release: 3 },
      }).connect(groupGain);
      drone.volume.value = -14;
      localSynths.push(drone);
      const droneLoop = new Tone.Loop(function(time) {
        drone.triggerAttackRelease(cfg.drone.note, '1m', time);
      }, '1m').start(0);
      localLoops.push(droneLoop);
    }

    // ─── RICH PERCUSSION ───
    if (cfg.drums) {
      // Kick
      if (cfg.drums.kick) {
        const kick = new Tone.MembraneSynth({
          pitchDecay: 0.05,
          octaves: 4,
          oscillator: { type: 'sine' },
          envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 }
        }).connect(groupGain);
        kick.volume.value = -8;
        localSynths.push(kick);
        const kickLoop = new Tone.Loop(function(time) {
          kick.triggerAttackRelease('C1', '8n', time);
        }, cfg.drums.kick).start(0);
        localLoops.push(kickLoop);
      }

      // Snare / Backbeat
      if (cfg.drums.snare) {
        const snare = new Tone.NoiseSynth({
          noise: { type: 'pink' },
          envelope: { attack: 0.001, decay: 0.2, sustain: 0 }
        }).connect(groupGain);
        snare.volume.value = -14;
        localSynths.push(snare);
        const snareLoop = new Tone.Loop(function(time) {
          snare.triggerAttackRelease('16n', time);
        }, cfg.drums.snare).start(0);
        localLoops.push(snareLoop);
      }

      // Hi-hat with pattern variation
      if (cfg.drums.hat) {
        const hat = new Tone.MetalSynth({
          harmonicity: 5.1,
          modulationIndex: 32,
          resonance: 4000,
          octaves: 1.5,
          envelope: { attack: 0.001, decay: 0.1, release: 0.01 }
        }).connect(groupGain);
        hat.volume.value = -20;
        localSynths.push(hat);

        // Varying hat pattern
        const hatPatterns = [
          ['16n', null, '16n', null, '16n', null, '16n', null],
          ['16n', '16n', null, '16n', '16n', null, '16n', null],
          ['16n', null, '16n', '16n', null, '16n', null, '16n']
        ];
        let hatPatIdx = 0;
        const hatSeq = new Tone.Sequence(function(time, dur) {
          if (dur) hat.triggerAttackRelease(dur, time, 0.3);
        }, hatPatterns[0], '16n').start(0);
        localLoops.push(hatSeq);
        const hatRotate = new Tone.Loop(function(time) {
          hatPatIdx = (hatPatIdx + 1) % hatPatterns.length;
          hatSeq.set({ events: hatPatterns[hatPatIdx] });
        }, '1m').start(0);
        localLoops.push(hatRotate);
      }

      // Shaker / tambourine
      if (cfg.drums.shaker) {
        const shaker = new Tone.NoiseSynth({
          noise: { type: 'white' },
          envelope: { attack: 0.001, decay: 0.05, sustain: 0 }
        }).connect(groupGain);
        shaker.volume.value = -26;
        localSynths.push(shaker);
        const shakerLoop = new Tone.Loop(function(time) {
          shaker.triggerAttackRelease('32n', time);
        }, cfg.drums.shaker).start(0);
        localLoops.push(shakerLoop);
      }

      // Cymbal crash on downbeat
      if (cfg.drums.crash) {
        const crash = new Tone.MetalSynth({
          harmonicity: 3,
          modulationIndex: 16,
          resonance: 2000,
          octaves: 2,
          envelope: { attack: 0.01, decay: 1.5, sustain: 0, release: 1.5 }
        }).connect(groupGain);
        crash.volume.value = -18;
        localSynths.push(crash);
        const crashLoop = new Tone.Loop(function(time) {
          crash.triggerAttackRelease('1n', time, 0.4);
        }, cfg.drums.crash).start(0);
        localLoops.push(crashLoop);
      }

      // Noise / ambient hits
      if (cfg.drums.noise) {
        const noise = new Tone.NoiseSynth({
          noise: { type: 'pink' },
          envelope: { attack: 0.5, decay: 1, sustain: 0.5, release: 2 }
        }).connect(groupGain);
        noise.volume.value = -22;
        localSynths.push(noise);
        const noiseLoop = new Tone.Loop(function(time) {
          noise.triggerAttackRelease('2m', time);
        }, cfg.drums.noise).start(0);
        localLoops.push(noiseLoop);
      }

      // Random accent hits
      if (cfg.drums.hit) {
        const hit = new Tone.MembraneSynth({
          pitchDecay: 0.02,
          octaves: 2,
          envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 }
        }).connect(groupGain);
        hit.volume.value = -16;
        localSynths.push(hit);
        const hitLoop = new Tone.Loop(function(time) {
          if (Math.random() > 0.6) hit.triggerAttackRelease('G2', '16n', time);
        }, cfg.drums.hit).start(0);
        localLoops.push(hitLoop);
      }
    }

    // ─── DYNAMICS: Volume automation ───
    if (cfg.dynamics && cfg.dynamics.volumeCurve) {
      const curve = cfg.dynamics.volumeCurve;
      let step = 0;
      const dynLoop = new Tone.Loop(function(time) {
        const targetVol = curve[step % curve.length] * volume;
        groupGain.gain.linearRampToValueAtTime(targetVol, time + 2);
        step++;
      }, '2m').start(0);
      localLoops.push(dynLoop);
    }

    // ─── FILTER SWEEP for movement ───
    if (cfg.pad && cfg.pad.filter) {
      const sweepLfo = new Tone.LFO('0.1hz', cfg.pad.filter * 0.5, cfg.pad.filter * 1.5);
      sweepLfo.connect(filterFx.frequency);
      sweepLfo.start();
      localSynths.push({ dispose: function() { sweepLfo.stop(); sweepLfo.dispose(); } });
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
