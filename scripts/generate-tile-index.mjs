import { readdirSync, statSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

const TILES_DIR = resolve('site/public/data/geography/tiles');

/**
 * Recursively count .pbf files in a directory.
 */
function countPbfFiles(dir) {
  let count = 0;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        count += countPbfFiles(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.pbf')) {
        count++;
      }
    }
  } catch {
    // Directory doesn't exist or can't be read, count stays 0
  }
  return count;
}

/**
 * Walk all layer directories and generate index.json for period directories
 * that don't already have one.
 */
function main() {
  const layers = readdirSync(TILES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== '..')
    .map((entry) => entry.name);

  let generated = 0;
  let skipped = 0;

  for (const layerId of layers) {
    const layerDir = join(TILES_DIR, layerId);

    const periods = readdirSync(layerDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    for (const periodId of periods) {
      const periodDir = join(layerDir, periodId);
      const indexPath = join(periodDir, 'index.json');

      if (existsSync(indexPath)) {
        skipped++;
        continue;
      }

      const pbfCount = countPbfFiles(periodDir);

      const index = {
        total: { pbf: pbfCount },
        period: periodId,
        layer: layerId,
      };

      writeFileSync(indexPath, JSON.stringify(index), 'utf-8');
      generated++;
    }
  }

  console.log(`Done. Generated ${generated} index.json file(s), skipped ${skipped} existing.`);
}

main();