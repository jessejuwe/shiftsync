type Listener = (error: Error) => void;

const listeners: Listener[] = [];

export const errorEmitter = {
  on(_event: string, listener: Listener) {
    listeners.push(listener);
  },
  off(_event: string, listener: Listener) {
    const i = listeners.indexOf(listener);
    if (i >= 0) listeners.splice(i, 1);
  },
  emit(event: string, error: Error) {
    if (event === "error") listeners.forEach((l) => l(error));
  },
};
