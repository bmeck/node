
import worker from 'worker_threads';
import { setupWorkerGlobals } from './helper.mjs';
setupWorkerGlobals(global, worker);
