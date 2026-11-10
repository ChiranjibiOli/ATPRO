import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
const empty = () => ({ users: [], sessions: [] });
export class JsonStore {
  constructor(path) { this.path = path; this.queue = Promise.resolve(); }
  async read() {
    try { return JSON.parse(await readFile(this.path, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return empty(); throw error; }
  }
  async transaction(action) {
    const next = this.queue.catch(() => {}).then(async () => {
      const data = await this.read();
      const result = await action(data);
      if (result?.write) {
        await mkdir(dirname(this.path), { recursive: true });
        const temp = this.path + '.' + randomUUID() + '.tmp';
        await writeFile(temp, JSON.stringify(data, null, 2), { mode: 0o600 });
        await rename(temp, this.path);
      }
      return result?.value;
    });
    this.queue = next.then(() => undefined, () => undefined);
    return next;
  }
}
