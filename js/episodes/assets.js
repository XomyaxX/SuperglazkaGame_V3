/**
 * Build a path to an episode asset.
 * @param {string|number} episodeNum - Episode number (e.g. '01', 1)
 * @param {string} frameDir - Frame folder name (e.g. '01-planet-videal')
 * @param {string} fileName - Asset file name (e.g. 'narration.mp3')
 * @returns {string} Full asset path
 */
function episodeAsset(episodeNum, frameDir, fileName) {
  const num = String(episodeNum).padStart(2, '0');
  return 'assets/episodes/episode-' + num + '/frames/' + frameDir + '/' + fileName;
}
