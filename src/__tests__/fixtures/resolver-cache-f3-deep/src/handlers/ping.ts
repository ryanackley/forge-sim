// Depth-2 resolver — imports a helper from depth-3.
import { format } from './util/format.js';

export function ping() {
  return { message: format('hello') };
}
