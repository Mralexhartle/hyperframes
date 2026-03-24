import { SFX_BASE_URL } from './constants.js';
import type { SfxEntry } from './types.js';

export const click: SfxEntry = {
  name: 'click',
  category: 'ui',
  url: `${SFX_BASE_URL}/ui/click.mp3`,
  duration: 0.2,
  format: 'mp3',
  license: 'CC0-1.0',
  tags: ['button', 'press', 'interface'],
};

export const tap: SfxEntry = {
  name: 'tap',
  category: 'ui',
  url: `${SFX_BASE_URL}/ui/tap.mp3`,
  duration: 0.15,
  format: 'mp3',
  license: 'CC0-1.0',
  tags: ['touch', 'mobile', 'light'],
};

export const success: SfxEntry = {
  name: 'success',
  category: 'ui',
  url: `${SFX_BASE_URL}/ui/success.mp3`,
  duration: 0.8,
  format: 'mp3',
  license: 'CC0-1.0',
  tags: ['complete', 'positive', 'achievement'],
};

export const error: SfxEntry = {
  name: 'error',
  category: 'ui',
  url: `${SFX_BASE_URL}/ui/error.mp3`,
  duration: 0.5,
  format: 'mp3',
  license: 'CC0-1.0',
  tags: ['fail', 'negative', 'warning'],
};

export const notification: SfxEntry = {
  name: 'notification',
  category: 'ui',
  url: `${SFX_BASE_URL}/ui/notification.mp3`,
  duration: 0.6,
  format: 'mp3',
  license: 'CC0-1.0',
  tags: ['alert', 'message', 'ping'],
};

export const pop: SfxEntry = {
  name: 'pop',
  category: 'ui',
  url: `${SFX_BASE_URL}/ui/pop.mp3`,
  duration: 0.3,
  format: 'mp3',
  license: 'CC0-1.0',
  tags: ['bubble', 'playful', 'light'],
};

export const toggle: SfxEntry = {
  name: 'toggle',
  category: 'ui',
  url: `${SFX_BASE_URL}/ui/toggle.mp3`,
  duration: 0.2,
  format: 'mp3',
  license: 'CC0-1.0',
  tags: ['switch', 'on-off', 'flip'],
};

export const confirm: SfxEntry = {
  name: 'confirm',
  category: 'ui',
  url: `${SFX_BASE_URL}/ui/confirm.mp3`,
  duration: 0.5,
  format: 'mp3',
  license: 'CC0-1.0',
  tags: ['approve', 'accept', 'done'],
};

export const cancel: SfxEntry = {
  name: 'cancel',
  category: 'ui',
  url: `${SFX_BASE_URL}/ui/cancel.mp3`,
  duration: 0.4,
  format: 'mp3',
  license: 'CC0-1.0',
  tags: ['dismiss', 'close', 'reject'],
};

export const hover: SfxEntry = {
  name: 'hover',
  category: 'ui',
  url: `${SFX_BASE_URL}/ui/hover.mp3`,
  duration: 0.15,
  format: 'mp3',
  license: 'CC0-1.0',
  tags: ['mouse', 'focus', 'subtle'],
};

export const select: SfxEntry = {
  name: 'select',
  category: 'ui',
  url: `${SFX_BASE_URL}/ui/select.mp3`,
  duration: 0.25,
  format: 'mp3',
  license: 'CC0-1.0',
  tags: ['choose', 'pick', 'highlight'],
};

export const typing: SfxEntry = {
  name: 'typing',
  category: 'ui',
  url: `${SFX_BASE_URL}/ui/typing.mp3`,
  duration: 0.1,
  format: 'mp3',
  license: 'CC0-1.0',
  tags: ['keyboard', 'input', 'keystroke'],
};
