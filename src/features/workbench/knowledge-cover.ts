const acceptedCoverTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxFileBytes = 10 * 1024 * 1024;
const maxEdge = 720;
const targetDataUrlLength = 350_000;

export function validateKnowledgeCover(input: { type: string; size: number }) {
  if (!acceptedCoverTypes.has(input.type)) {
    return "请选择 JPG、PNG 或 WebP 图片。";
  }
  if (input.size > maxFileBytes) {
    return "封面图片不能超过 10MB。";
  }
  return undefined;
}

export function fitKnowledgeCoverDimensions(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("无法读取封面图片尺寸。");
  }
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

export async function compressKnowledgeCover(file: File) {
  const validationError = validateKnowledgeCover(file);
  if (validationError) throw new Error(validationError);

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const fitted = fitKnowledgeCoverDimensions(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("当前浏览器无法处理封面图片。");

    const attempts = [
      { scale: 1, quality: 0.82 },
      { scale: 0.85, quality: 0.72 },
      { scale: 0.7, quality: 0.62 },
      { scale: 0.55, quality: 0.55 }
    ];
    let result = "";

    for (const attempt of attempts) {
      canvas.width = Math.max(1, Math.round(fitted.width * attempt.scale));
      canvas.height = Math.max(1, Math.round(fitted.height * attempt.scale));
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      result = canvas.toDataURL("image/webp", attempt.quality);
      if (result.length <= targetDataUrlLength) return result;
    }

    if (!result) throw new Error("封面图片压缩失败，请更换图片后重试。");
    return result;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error("无法读取封面图片，请更换图片后重试。");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("无法读取封面图片，请更换图片后重试。"));
    image.src = source;
  });
}
