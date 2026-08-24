// Tiny shared store so the AI chat button and the WhatsApp button coordinate:
// when the chat panel is open, the WhatsApp button hides to avoid overlap.
let open = false;
const listeners = new Set();

export function getChatOpen() {
  return open;
}

export function setChatOpen(value) {
  open = value;
  listeners.forEach((l) => l(open));
}

export function subscribeChatOpen(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}