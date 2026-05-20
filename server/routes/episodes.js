const express = require('express');
const { all, get } = require('../db');

const router = express.Router();

// GET /api/episodes — список опубликованных эпизодов
router.get('/', async (req, res) => {
  try {
    const episodes = await all(
      'SELECT id, title, description, cover_image, "order" FROM episodes WHERE is_published = 1 ORDER BY "order" ASC'
    );
    res.json({ success: true, episodes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/episodes/:id — эпизод со всеми кадрами
router.get('/:id', async (req, res) => {
  try {
    const episode = await get(
      'SELECT id, title, description, cover_image, "order" FROM episodes WHERE id = ? AND is_published = 1',
      [req.params.id]
    );
    if (!episode) {
      return res.status(404).json({ error: 'Episode not found' });
    }
    const frames = await all(
      'SELECT id, "order", title, narration, dialogue_json, background_image, background_video, audio_src, mood, game_type, choices_json, transition_text, dialogue_audio_json FROM frames WHERE episode_id = ? ORDER BY "order" ASC',
      [req.params.id]
    );
    episode.frames = frames.map(f => ({
      ...f,
      dialogue: f.dialogue_json ? JSON.parse(f.dialogue_json) : [],
      choices: f.choices_json ? JSON.parse(f.choices_json) : []
    }));
    res.json({ success: true, episode });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
