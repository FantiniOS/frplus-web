
async function getBase64Image(url: string): Promise<{ data: string; width: number; height: number } | null> {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    let finalUrl = url;
    if (url.startsWith('/')) {
      finalUrl = window.location.origin + url;
    }
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve({ data: canvas.toDataURL('image/png'), width: img.width, height: img.height });
      } else {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = finalUrl;
  });
}

function toTitleCase(str: string) {
  return str.toLowerCase().replace(/(?:^|\s)\w/g, function(match) {
    return match.toUpperCase();
  });
}
