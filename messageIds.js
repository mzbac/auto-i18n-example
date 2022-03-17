
import { resource } from './en-US.js'
function createProxy(obj) {
  const handler = {
    get: function(_, prop) {
      return prop;
    }
  };
  return new Proxy(obj, handler);
}
export const messageIds = createProxy(resource);
