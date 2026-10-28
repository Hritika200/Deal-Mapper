// Characters a visitor can walk Galway as. The choice is remembered in this browser only.
export const AVATARS = [
  { id: 'curly', src: '/avatar.png', label: 'Dark curly hair and blazer' },
  { id: 'beard', src: '/avatar-beard.png', label: 'Beard and navy suit' },
  { id: 'glasses', src: '/avatar-glasses.png', label: 'Glasses and tie' },
];

const STORAGE_KEY = 'passing-by.avatar.v1';

export function loadAvatar() {
  try {
    const id = window.localStorage.getItem(STORAGE_KEY);
    return AVATARS.find((a) => a.id === id) ?? AVATARS[0];
  } catch {
    return AVATARS[0];
  }
}

export function saveAvatar(avatar) {
  try {
    window.localStorage.setItem(STORAGE_KEY, avatar.id);
  } catch {
    // storage blocked: the choice still applies for this visit
  }
}
