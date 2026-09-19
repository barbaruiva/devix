/*
 * Clipboard write with a fallback: the packaged app is loaded from file://, which is
 * not a secure context, so navigator.clipboard is unavailable there.
 */

export async function copyText(text) {
  if (!text) {
    return false;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_error) {
    // falls through to the execCommand path below
  }

  const holder = document.createElement('textarea');
  holder.value = text;
  holder.setAttribute('readonly', '');
  holder.style.position = 'fixed';
  holder.style.opacity = '0';
  document.body.appendChild(holder);
  holder.select();
  try {
    document.execCommand('copy');
    return true;
  } catch (_error) {
    // clipboard unavailable; nothing useful to surface here
    return false;
  } finally {
    document.body.removeChild(holder);
  }
}
