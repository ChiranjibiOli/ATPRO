import { createApp } from './app.js';
import { JsonStore } from './store.js';
import { fileURLToPath } from 'node:url';
const port = Number(process.env.PORT ?? 4100);
const host = process.env.HOST ?? '127.0.0.1';
const store = new JsonStore(process.env.ATPRO_DATA_FILE ?? fileURLToPath(new URL('../data/auth.json', import.meta.url)));
createApp({ store }).listen(port, host, () => {
  console.log('ATPRO API listening on http://' + host + ':' + port);
});
