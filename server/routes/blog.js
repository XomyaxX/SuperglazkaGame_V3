const express = require('express');
const { get, all } = require('../db');

const router = express.Router();

// GET /api/blog — list published posts
router.get('/', async (req, res) => {
  try {
    const posts = await all(
      'SELECT id, title, slug, excerpt, category, image, created_at FROM blog_posts WHERE published = 1 ORDER BY created_at DESC'
    );
    res.json({ success: true, posts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/blog/:slug — single post
router.get('/:slug', async (req, res) => {
  try {
    const post = await get(
      'SELECT * FROM blog_posts WHERE slug = ? AND published = 1',
      [req.params.slug]
    );
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json({ success: true, post });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
