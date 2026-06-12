import type { FeedItem } from "@/types/models";

export interface PosterData {
  dataUrl: string;
  blob?: Blob;
}

const POSTER_WIDTH = 750;
const POSTER_PADDING = 40;
const CONTENT_WIDTH = POSTER_WIDTH - POSTER_PADDING * 2;
const AVATAR_SIZE = 88;
const QRCODE_SIZE = 120;
const BRAND_NAME = "ASOLO 发现";
const SUMMARY_MAX_LINES = 6;
const SUMMARY_MAX_CHARS = 180;

function getDevicePixelRatio(): number {
  return Math.min(window.devicePixelRatio || 1, 3);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`图片加载失败: ${url}`));
    img.src = url;
  });
}

async function loadImageWithFallback(url: string | null | undefined, fallbackSvg: string): Promise<HTMLImageElement> {
  if (!url) {
    return loadImage(fallbackSvg);
  }
  try {
    return await loadImage(url);
  } catch {
    return loadImage(fallbackSvg);
  }
}

function createFallbackAvatar(name: string): string {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="176" height="176" viewBox="0 0 176 176">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#ff9041"/>
        <stop offset="100%" style="stop-color:#ff6f1a"/>
      </linearGradient>
    </defs>
    <rect width="176" height="176" rx="88" fill="url(#g)"/>
    <text x="88" y="108" font-family="PingFang SC, Microsoft YaHei, sans-serif" font-size="80" font-weight="bold" fill="#fff" text-anchor="middle">${initial}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function createPlaceholderImage(width: number, height: number, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="pg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#fef3c7"/>
        <stop offset="100%" style="stop-color:#ffedd5"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#pg)"/>
    <text x="${width / 2}" y="${height / 2 + 8}" font-family="PingFang SC, Microsoft YaHei, sans-serif" font-size="44" fill="#ea580c" text-anchor="middle" opacity="0.7">${label}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function createQrCodePlaceholder(): string {
  const cells = 21;
  const cellSize = Math.floor(QRCODE_SIZE / cells);
  const actualSize = cellSize * cells;
  let rects = "";
  const rand = mulberry32(12345);
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const isCorner =
        (x < 7 && y < 7) ||
        (x >= cells - 7 && y < 7) ||
        (x < 7 && y >= cells - 7);
      if (isCorner) {
        const inOuter = x === 0 || x === 6 || y === 0 || y === 6 ||
          (x >= cells - 7 && (x === cells - 7 || x === cells - 1 || y === 0 || y === 6)) ||
          (y >= cells - 7 && (x === 0 || x === 6 || y === cells - 7 || y === cells - 1));
        const inInner = !inOuter && !((x === 1 || x === 5 || y === 1 || y === 5) && x < 7 && y < 7);
        if (!inOuter && !inInner) continue;
        if (inOuter || (x >= 2 && x <= 4 && y >= 2 && y <= 4) ||
          (x >= cells - 5 && x <= cells - 3 && y >= 2 && y <= 4) ||
          (x >= 2 && x <= 4 && y >= cells - 5 && y <= cells - 3)) {
          rects += `<rect x="${x * cellSize}" y="${y * cellSize}" width="${cellSize}" height="${cellSize}" fill="#1e293b"/>`;
        }
      } else if (rand() > 0.5) {
        rects += `<rect x="${x * cellSize}" y="${y * cellSize}" width="${cellSize}" height="${cellSize}" fill="#1e293b"/>`;
      }
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${QRCODE_SIZE}" height="${QRCODE_SIZE}" viewBox="0 0 ${actualSize} ${actualSize}">
    <rect width="${actualSize}" height="${actualSize}" fill="#ffffff"/>
    ${rects}
    <rect x="${actualSize / 2 - cellSize * 2}" y="${actualSize / 2 - cellSize * 2}" width="${cellSize * 4}" height="${cellSize * 4}" fill="#ff6f1a" rx="4"/>
    <text x="${actualSize / 2}" y="${actualSize / 2 + 6}" font-family="PingFang SC, Microsoft YaHei, sans-serif" font-size="${cellSize * 3}" font-weight="bold" fill="#ffffff" text-anchor="middle">A</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number, maxChars: number): string[] {
  let trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length > maxChars) {
    trimmed = trimmed.slice(0, maxChars);
  }
  const lines: string[] = [];
  let current = "";
  const chars = Array.from(trimmed);
  for (let i = 0; i < chars.length; i++) {
    const test = current + chars[i];
    const metrics = ctx.measureText(test);
    if (metrics.width > maxWidth && current.length > 0) {
      lines.push(current);
      current = chars[i];
      if (lines.length >= maxLines - 1) {
        let rest = chars.slice(i).join("");
        while (ctx.measureText(rest + "…").width > maxWidth && rest.length > 0) {
          rest = Array.from(rest).slice(0, -1).join("");
        }
        lines.push(rest + "…");
        return lines;
      }
    } else {
      current = test;
    }
  }
  if (current.length > 0) {
    lines.push(current);
  }
  return lines.slice(0, maxLines);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const imgRatio = img.width / img.height;
  const targetRatio = width / height;
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;
  if (imgRatio > targetRatio) {
    sw = img.height * targetRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / targetRatio;
    sy = (img.height - sh) / 2;
  }
  ctx.save();
  roundRect(ctx, x, y, width, height, 16);
  ctx.clip();
  ctx.drawImage(img, sx, sy, sw, sh, x, y, width, height);
  ctx.restore();
}

function drawCircularImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number,
  cy: number,
  radius: number
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, cx - radius, cy - radius, radius * 2, radius * 2);
  ctx.restore();
}

export async function generatePoster(post: FeedItem, shareUrl: string): Promise<PosterData> {
  const dpr = getDevicePixelRatio();
  const firstImage = post.media.find((m) => m.type === "image");
  const hasImage = !!firstImage;

  let canvasHeight = POSTER_PADDING;
  canvasHeight += AVATAR_SIZE + 24;
  canvasHeight += 40;

  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d")!;
  tempCtx.font = "30px PingFang SC, Microsoft YaHei, sans-serif";
  const summaryLines = wrapText(tempCtx, post.content || "分享一条精彩动态", CONTENT_WIDTH, SUMMARY_MAX_LINES, SUMMARY_MAX_CHARS);
  const summaryHeight = summaryLines.length * 48;
  canvasHeight += summaryHeight + 32;

  const coverHeight = hasImage ? 420 : 0;
  if (hasImage) {
    canvasHeight += coverHeight + 32;
  }

  canvasHeight += QRCODE_SIZE + 40;
  canvasHeight += POSTER_PADDING;

  const canvas = document.createElement("canvas");
  canvas.width = POSTER_WIDTH * dpr;
  canvas.height = canvasHeight * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  const bgGradient = ctx.createLinearGradient(0, 0, POSTER_WIDTH, canvasHeight);
  bgGradient.addColorStop(0, "#fff7ed");
  bgGradient.addColorStop(0.5, "#ffffff");
  bgGradient.addColorStop(1, "#eff6ff");
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, POSTER_WIDTH, canvasHeight);

  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = "#ff6f1a";
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.arc(
      (i * 137) % POSTER_WIDTH,
      (i * 189) % canvasHeight,
      60 + (i % 3) * 30,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  ctx.restore();

  let y = POSTER_PADDING;

  const avatarY = y + AVATAR_SIZE / 2;
  const avatarData = createFallbackAvatar(post.author.nickname);
  const avatarImg = await loadImageWithFallback(post.author.avatarUrl, avatarData);
  drawCircularImage(ctx, avatarImg, POSTER_PADDING + AVATAR_SIZE / 2, avatarY, AVATAR_SIZE / 2);

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(POSTER_PADDING + AVATAR_SIZE / 2, avatarY, AVATAR_SIZE / 2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 34px PingFang SC, Microsoft YaHei, sans-serif";
  ctx.textBaseline = "middle";
  const nameX = POSTER_PADDING + AVATAR_SIZE + 24;
  ctx.fillText(post.author.nickname.slice(0, 12), nameX, avatarY - 14);

  ctx.fillStyle = "#64748b";
  ctx.font = "24px PingFang SC, Microsoft YaHei, sans-serif";
  const levelText = `Lv.${post.author.level}`;
  ctx.fillText(levelText, nameX, avatarY + 24);

  y += AVATAR_SIZE + 24;
  y += 40;

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 36px PingFang SC, Microsoft YaHei, sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText("动态分享", POSTER_PADDING, y);
  y += 60;

  ctx.fillStyle = "#334155";
  ctx.font = "30px PingFang SC, Microsoft YaHei, sans-serif";
  summaryLines.forEach((line, i) => {
    ctx.fillText(line, POSTER_PADDING, y + i * 48);
  });
  y += summaryHeight + 32;

  if (hasImage && firstImage) {
    try {
      const coverData = createPlaceholderImage(CONTENT_WIDTH, coverHeight, "图片加载失败");
      const coverImg = await loadImageWithFallback(firstImage.url, coverData);
      drawCoverImage(ctx, coverImg, POSTER_PADDING, y, CONTENT_WIDTH, coverHeight);
    } catch {
      ctx.fillStyle = "#fef3c7";
      roundRect(ctx, POSTER_PADDING, y, CONTENT_WIDTH, coverHeight, 16);
      ctx.fill();
      ctx.fillStyle = "#ea580c";
      ctx.font = "32px PingFang SC, Microsoft YaHei, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("配图加载失败", POSTER_WIDTH / 2, y + coverHeight / 2 - 16);
      ctx.textAlign = "start";
    }
    y += coverHeight + 32;
  }

  const qrY = y;
  const qrData = createQrCodePlaceholder();
  const qrImg = await loadImage(qrData);
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, POSTER_PADDING - 8, qrY - 8, QRCODE_SIZE + 16, QRCODE_SIZE + 16, 12);
  ctx.fill();
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.drawImage(qrImg, POSTER_PADDING, qrY, QRCODE_SIZE, QRCODE_SIZE);

  const textX = POSTER_PADDING + QRCODE_SIZE + 32;
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 32px PingFang SC, Microsoft YaHei, sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText(BRAND_NAME, textX, qrY + 8);

  ctx.fillStyle = "#64748b";
  ctx.font = "24px PingFang SC, Microsoft YaHei, sans-serif";
  const tipLines = ["扫码或长按识别", "查看完整动态"];
  tipLines.forEach((line, i) => {
    ctx.fillText(line, textX, qrY + 52 + i * 36);
  });

  y += QRCODE_SIZE + 24;

  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(POSTER_PADDING, y);
  ctx.lineTo(POSTER_WIDTH - POSTER_PADDING, y);
  ctx.stroke();
  y += 24;

  ctx.fillStyle = "#94a3b8";
  ctx.font = "20px PingFang SC, Microsoft YaHei, sans-serif";
  const urlText = shareUrl.length > 50 ? shareUrl.slice(0, 47) + "..." : shareUrl;
  ctx.fillText(urlText, POSTER_PADDING, y);

  const dataUrl = canvas.toDataURL("image/png", 0.92);
  let blob: Blob | undefined;
  try {
    const base64 = dataUrl.split(",")[1];
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    blob = new Blob([bytes], { type: "image/png" });
  } catch {
    blob = undefined;
  }

  return { dataUrl, blob };
}

export function downloadPoster(dataUrl: string, filename?: string) {
  const name = filename || `asolo-share-${Date.now()}.png`;
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
