import path from 'node:path';
import { readdirSync } from 'node:fs';

function collectFiles(directory, relative = '') {
  return readdirSync(path.join(directory, relative), { withFileTypes: true }).flatMap((entry) => {
    const next = path.join(relative, entry.name);
    return entry.isDirectory() ? collectFiles(directory, next) : entry.isFile() && entry.name.endsWith('.html') ? [next] : [];
  });
}

function routeForFile(file) {
  const withoutExtension = file.slice(0, -'.html'.length).split(path.sep);
  const segments = withoutExtension.at(-1) === 'index' ? withoutExtension.slice(0, -1) : withoutExtension;
  const urlSegments = segments.filter(Boolean);
  const params = [];
  const pattern = urlSegments.map((segment) => {
    const dynamic = segment.match(/^\[([^\]]+)\]$/);
    if (!dynamic) return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    params.push(dynamic[1]);
    return '([^/]+)';
  });
  return {
    file,
    score: params.length,
    pattern: new RegExp(`^/${pattern.join('/')}\\/?$`),
    params,
  };
}

export function createRouter(pagesDirectory) {
  const routes = collectFiles(pagesDirectory).map(routeForFile).sort((left, right) => left.score - right.score || right.file.length - left.file.length);
  return {
    resolve(urlPath) {
      for (const route of routes) {
        const match = urlPath.match(route.pattern);
        if (match) {
          const routeParams = Object.fromEntries(route.params.map((name, index) => [name, decodeURIComponent(match[index + 1])]));
          if (route.file === 'docs.html') routeParams.title = 'Developer Portal';
          if (route.file === path.join('docs', 'guide.html')) routeParams.title = 'IntentOS Framework Guide';
          return { filePath: path.join(pagesDirectory, route.file), params: routeParams };
        }
      }
      return null;
    },
  };
}
