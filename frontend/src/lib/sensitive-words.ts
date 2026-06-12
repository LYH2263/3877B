export type SensitiveWordLevel = "forbidden" | "warning";

export interface SensitiveWordMatch {
  word: string;
  level: SensitiveWordLevel;
  start: number;
  end: number;
}

export interface SensitiveWordCheckResult {
  hasForbidden: boolean;
  hasWarning: boolean;
  forbiddenMatches: SensitiveWordMatch[];
  warningMatches: SensitiveWordMatch[];
}

interface AhoNode {
  children: Map<string, AhoNode>;
  fail: AhoNode | null;
  outputs: { word: string; level: SensitiveWordLevel }[];
}

function createNode(): AhoNode {
  return {
    children: new Map(),
    fail: null,
    outputs: []
  };
}

function normalizeChar(ch: string): string {
  const code = ch.charCodeAt(0);

  if (code >= 0xff01 && code <= 0xff5e) {
    return String.fromCharCode(code - 0xfee0);
  }

  if (code === 0x3000) {
    return " ";
  }

  if (ch >= "A" && ch <= "Z") {
    return ch.toLowerCase();
  }

  return ch;
}

function shouldSkipChar(ch: string): boolean {
  const code = ch.charCodeAt(0);
  if (code >= 0x20 && code <= 0x2f) return true;
  if (code >= 0x3a && code <= 0x40) return true;
  if (code >= 0x5b && code <= 0x60) return true;
  if (code >= 0x7b && code <= 0x7e) return true;
  if (code >= 0xff00 && code <= 0xff20) return true;
  if (code >= 0xff3b && code <= 0xff40) return true;
  if (code >= 0xff5b && code <= 0xff65) return true;
  if (code === 0x3000) return true;
  if (code >= 0x2000 && code <= 0x206f) return true;
  if (code >= 0x3001 && code <= 0x303f) return true;
  if (code >= 0xfe50 && code <= 0xfe6f) return true;
  return false;
}

function buildTrie(words: { word: string; level: SensitiveWordLevel }[]): AhoNode {
  const root = createNode();

  for (const item of words) {
    let current = root;
    const normalizedWord = item.word.toLowerCase();

    for (let i = 0; i < normalizedWord.length; i++) {
      const ch = normalizeChar(normalizedWord[i]);
      if (!current.children.has(ch)) {
        current.children.set(ch, createNode());
      }
      current = current.children.get(ch)!;
    }

    current.outputs.push({ word: item.word, level: item.level });
  }

  return root;
}

function buildFailureLinks(root: AhoNode): void {
  const queue: AhoNode[] = [];

  for (const child of root.children.values()) {
    child.fail = root;
    queue.push(child);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const [char, child] of current.children) {
      let failNode = current.fail;

      while (failNode !== null && !failNode.children.has(char)) {
        failNode = failNode.fail;
      }

      child.fail = failNode ? failNode.children.get(char) ?? root : root;

      if (child.fail && child.fail.outputs.length > 0) {
        child.outputs.push(...child.fail.outputs);
      }

      queue.push(child);
    }
  }
}

export class SensitiveWordFilter {
  private root: AhoNode;
  private wordList: { word: string; level: SensitiveWordLevel }[];

  constructor(words: { word: string; level: SensitiveWordLevel }[]) {
    this.wordList = [...words];
    this.root = buildTrie(this.wordList);
    buildFailureLinks(this.root);
  }

  check(text: string): SensitiveWordCheckResult {
    const forbiddenMatches: SensitiveWordMatch[] = [];
    const warningMatches: SensitiveWordMatch[] = [];

    let current = this.root;
    let i = 0;
    const effectiveCharIndices: number[] = [];

    while (i < text.length) {
      const ch = text[i];
      const normalized = normalizeChar(ch);

      if (shouldSkipChar(ch)) {
        i++;
        continue;
      }

      effectiveCharIndices.push(i);

      while (current !== null && !current.children.has(normalized)) {
        current = current.fail ?? this.root;
        if (current === this.root) {
          break;
        }
      }

      const next = current.children.get(normalized);
      if (next) {
        current = next;

        if (current.outputs.length > 0) {
          for (const output of current.outputs) {
            const wordLen = output.word.length;
            let startIdx = -1;
            if (effectiveCharIndices.length >= wordLen) {
              startIdx = effectiveCharIndices[effectiveCharIndices.length - wordLen];
            } else {
              let remaining = wordLen;
              for (let j = i; j >= 0 && remaining > 0; j--) {
                if (!shouldSkipChar(text[j])) {
                  remaining--;
                  if (remaining === 0) {
                    startIdx = j;
                  }
                }
              }
              if (startIdx === -1) {
                startIdx = Math.max(0, i - output.word.length + 1);
              }
            }

            const match: SensitiveWordMatch = {
              word: output.word,
              level: output.level,
              start: startIdx,
              end: i + 1
            };

            if (output.level === "forbidden") {
              const exists = forbiddenMatches.some(
                (m) => m.word === output.word && m.start === match.start
              );
              if (!exists) {
                forbiddenMatches.push(match);
              }
            } else {
              const exists = warningMatches.some(
                (m) => m.word === output.word && m.start === match.start
              );
              if (!exists) {
                warningMatches.push(match);
              }
            }
          }
        }
      } else {
        current = this.root;
      }

      i++;
    }

    return {
      hasForbidden: forbiddenMatches.length > 0,
      hasWarning: warningMatches.length > 0,
      forbiddenMatches,
      warningMatches
    };
  }

  getWords(): { word: string; level: SensitiveWordLevel }[] {
    return [...this.wordList];
  }
}

let globalFilter: SensitiveWordFilter | null = null;

export function setGlobalSensitiveFilter(filter: SensitiveWordFilter): void {
  globalFilter = filter;
}

export function getSensitiveFilter(): SensitiveWordFilter | null {
  return globalFilter;
}

export function initSensitiveFilter(words: { word: string; level: SensitiveWordLevel }[]): void {
  const filter = new SensitiveWordFilter(words);
  setGlobalSensitiveFilter(filter);
}
