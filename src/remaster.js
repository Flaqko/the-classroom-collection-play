const xlink = 'http://www.w3.org/1999/xlink';

export async function setupRemaster(defs, game) {
  const images = [...defs.querySelectorAll('image')];
  if (!images.length) return;

  async function loadArtwork() {
    const response = await fetch('assets/remaster/manifest.json');
    if (!response.ok) throw new Error('Remaster manifest unavailable');
    const files = (await response.json())[game];
    if (files?.length !== images.length) throw new Error('Remaster assets do not match the game');

    const urls = new Map();
    try {
      for (const file of new Set(files)) {
        const asset = await fetch('assets/remaster/' + file);
        if (!asset.ok) throw new Error('Remaster image unavailable');
        const type = file.endsWith('.svg') ? 'image/svg+xml' : 'image/png';
        const url = URL.createObjectURL(new Blob([await asset.arrayBuffer()], {type}));
        urls.set(file, url);
        const image = new Image();
        image.src = url;
        await image.decode();
      }
      return files.map(file => urls.get(file));
    } catch (error) {
      for (const url of urls.values()) URL.revokeObjectURL(url);
      throw error;
    }
  }

  try {
    const sources = await loadArtwork();
    images.forEach((image, index) => image.setAttributeNS(xlink, 'xlink:href', sources[index]));
  } catch (error) {
    console.warn('Could not load remastered artwork:', error);
  }
}
