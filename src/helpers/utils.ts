import type { EditorMessage, MessageFromSDK } from '../types';
import { debug } from './debug';

/**
 * Sends the given message to the editor
 * enhances it with the information necessary to be accepted
 */
export function sendMessageToEditor(data: EditorMessage): void {
  const message: MessageFromSDK = {
    ...data,
    from: 'live-preview',
    location: window.location.href,
  };

  window.top?.postMessage(
    message,
    '*' // TODO: check if there is any security risk with this
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Callback = (...args: any[]) => void;
type DebouncedFunction<T extends Callback> = (...args: Parameters<T>) => void;

export function debounce<T extends Callback>(func: T, timeout = 100): DebouncedFunction<T> {
  let timer: NodeJS.Timeout;

  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      // @ts-expect-error `this` is untyped
      func.apply(this, args);
    }, timeout);
  };
}

/**
 * Map with integrated persistence layer to save/restore data during the session
 */
export class StorageMap<T extends unknown> {
  private storageKey: string;
  private value: Map<string, T>;
  // TODO: https://contentful.atlassian.net/browse/TOL-1080
  private persistence = false;

  constructor(key: string, defaultValue: Map<string, T>, persistence = false) {
    this.storageKey = key;
    this.persistence = persistence;
    this.value = this.restoreSessionData() || defaultValue;
  }

  private restoreSessionData() {
    if (!this.persistence) {
      return null;
    }

    try {
      const item = window.sessionStorage.getItem(this.storageKey);
      const parsed = item ? (JSON.parse(item) as T) : null;
      return Array.isArray(parsed) ? new Map<string, T>(parsed) : null;
    } catch (err) {
      return null;
    }
  }

  public get(key: string): T | undefined {
    return this.value.get(key);
  }

  public set(key: string, data: T): void {
    this.value.set(key, data);

    if (this.persistence) {
      try {
        // Attention: Map can not be `JSON.stringify`ed directly
        window.sessionStorage.setItem(
          this.storageKey,
          JSON.stringify(Array.from(this.value.entries()))
        );
      } catch (err) {
        // ignored
      }
    }
  }
}

/**
 * GraphQL returns the URL with protocol and the CMA without it,
 * so we need to add the information in there manually.
 */
export function setProtocolToHttps(url: string | undefined): string | undefined {
  if (!url) {
    return url;
  }

  try {
    // new URL('//images.ctfassets.net') is invalid, therefore we add it with protocol as `base`.
    // This will merge it then correct together
    const parsed = new URL(url, 'https://images.ctfassets.net');
    parsed.protocol = 'https:';
    return parsed.href;
  } catch (err) {
    debug.error(`Recevied invalid asset url "${url}"`, err);
    return url;
  }
}

/**
 * Clones the incoming element into a new one, to prevent modification on the original object
 * Hint: It uses the structuredClone which is only available in modern browsers,
 * for older one it uses the JSON.parse(JSON.strinfify) hack.
 */
export function clone<T extends Record<string, unknown> | Array<unknown>>(incoming: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(incoming);
  }

  try {
    return JSON.parse(JSON.stringify(incoming));
  } catch (err) {
    debug.warn('Failed to clone data, updates are done on the original one', incoming, err);
    return incoming;
  }
}