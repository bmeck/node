// Flags:  --experimental-loader ./test/fixtures/es-module-loaders/transform-source.mjs
import '../common/index.mjs';
import { message } from '../fixtures/es-modules/message.mjs';
console.log(message);
