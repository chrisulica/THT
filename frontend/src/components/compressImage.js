function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Poza nu a putut fi citită')); };
    img.src = url;
  });
}

export async function compressImage(file, maxSide = 1080, quality = 0.8) {
  // 'from-image' corectează orientarea EXIF (pozele de pe iPhone rotite)
  let source;
  try {
    source = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    source = await loadImage(file); // rezervă pentru browsere mai vechi
  }

  const w = source.width;
  const h = source.height;
  const scale = Math.min(1, maxSide / Math.max(w, h));

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  if (source.close) source.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Comprimarea a eșuat'))),
      'image/jpeg',
      quality
    );
  });
}