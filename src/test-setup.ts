// Vitest setup: mirror the app's startup by resolving ingredients from the committed
// seed (ingredients-seed.ts) rather than the parser's unknown default. See main.ts.
import { setClassifier } from './parser/parser';
import { seedClassify } from './ingredients/catalog';

setClassifier(seedClassify);
