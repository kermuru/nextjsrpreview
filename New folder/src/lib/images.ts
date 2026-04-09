export type PixelCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

export async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to load image.'));
    image.src = src;
  });
}

export async function resizeImageFile(file: File, maxDimension: number): Promise<File> {
  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);
  const scale = Math.min(maxDimension / image.width, maxDimension / image.height, 1);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable.');
  ctx.drawImage(image, 0, 0, width, height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error('Unable to create image blob.'));
    }, file.type || 'image/jpeg', 0.9);
  });
  return new File([blob], file.name, { type: blob.type || file.type || 'image/jpeg' });
}

export async function previewFromFile(file: File, maxDimension = 500): Promise<string> {
  const resized = await resizeImageFile(file, maxDimension);
  return readFileAsDataUrl(resized);
}

export async function rotateDataUrl(dataUrl: string, angle: number): Promise<string> {
  const image = await loadImage(dataUrl);
  const radians = (angle * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const width = Math.round(image.width * cos + image.height * sin);
  const height = Math.round(image.width * sin + image.height * cos);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable.');
  ctx.translate(width / 2, height / 2);
  ctx.rotate(radians);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);
  return canvas.toDataURL('image/jpeg', 0.92);
}

export async function cropDataUrl(
  dataUrl: string,
  crop: PixelCrop,
  metrics?: { naturalWidth: number; naturalHeight: number; width: number; height: number }
): Promise<Blob> {
  const image = await loadImage(dataUrl);
  const scaleX = metrics ? metrics.naturalWidth / metrics.width : 1;
  const scaleY = metrics ? metrics.naturalHeight / metrics.height : 1;
  const sourceX = crop.x * scaleX;
  const sourceY = crop.y * scaleY;
  const sourceWidth = crop.width * scaleX;
  const sourceHeight = crop.height * scaleY;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sourceWidth));
  canvas.height = Math.max(1, Math.round(sourceHeight));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable.');
  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    sourceWidth,
    sourceHeight
  );
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error('Crop failed.'));
    }, 'image/jpeg', 0.92);
  });
}

export function fileFromBlob(blob: Blob, name: string, type = blob.type || 'image/jpeg'): File {
  return new File([blob], name, { type });
}

export function needsCrop(width: number, height: number): boolean {
  const ratio = width / height;
  const allowed = [1.25, 1.33, 1.5, 1.66, 1.75, 1.78, 0.8, 0.75, 0.67];
  return !allowed.some((target) => Math.abs(ratio - target) < 0.1);
}

export async function addPatternBorder(file: File, borderPath: string): Promise<File> {
  const fileDataUrl = await readFileAsDataUrl(file);
  const [mainImage, borderImage] = await Promise.all([loadImage(fileDataUrl), loadImage(borderPath)]);

  const maxWidth = 768;
  const maxHeight = 624;
  const scale = Math.min(maxWidth / mainImage.width, maxHeight / mainImage.height, 1);
  const targetWidth = Math.round(mainImage.width * scale);
  const targetHeight = Math.round(mainImage.height * scale);
  const borderThickness = 5;
  const gap = 5;
  const offset = borderThickness + gap;

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth + offset * 2;
  canvas.height = targetHeight + offset * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable.');

  ctx.fillStyle = '#EEDC82';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(mainImage, offset, offset, targetWidth, targetHeight);

  const pattern = ctx.createPattern(borderImage, 'repeat');
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, canvas.width, borderThickness);
    ctx.fillRect(0, canvas.height - borderThickness, canvas.width, borderThickness);
    ctx.fillRect(0, borderThickness, borderThickness, canvas.height - borderThickness * 2);
    ctx.fillRect(canvas.width - borderThickness, borderThickness, borderThickness, canvas.height - borderThickness * 2);
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error('Unable to finalize image.'));
    }, file.type || 'image/jpeg', 0.95);
  });

  return new File([blob], file.name, { type: blob.type || file.type || 'image/jpeg' });
}

export async function downloadRemoteFile(url: string, fallbackName: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Download failed.');
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = url.split('/').pop() || fallbackName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
