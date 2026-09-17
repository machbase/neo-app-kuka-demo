'use strict';

const http = require('http');
const path = require('path');
const process = require('process');
const ROOT = path.dirname(path.dirname(path.resolve(process.argv[1])));
const { dbConfig, integer, options } = require(path.join(ROOT, 'lib/config.js'));
const { datasets, lerobotEpisodes, lerobotFull, lerobotTrajectory, robots, scenarios, trajectory } = require(path.join(ROOT, 'lib/api.js'));
const manifest = require(path.join(ROOT, 'package.json'));

function route(handler) {
  return (ctx) => {
    ctx.setHeader('cache-control', 'no-store');
    try {
      ctx.json(200, { ok: true, data: handler(ctx) });
    } catch (error) {
      // Responses never serialize raw driver errors or connection configuration.
      console.println('API error:', error.code || 'INTERNAL_ERROR');
      ctx.json(error.status || 500, {
        ok: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.code ? error.message : 'An internal server error occurred. Check the server logs.'
        }
      });
    }
  };
}

function main() {
  const args = options({ host: { type: 'string' }, port: { type: 'string' } });
  if (args.help) {
    console.println('Usage: ./server.js [--host 127.0.0.1] [--port 56802]');
    return;
  }
  const host = args.host == null ? '127.0.0.1' : args.host;
  if (!host || /[\s/]/.test(host)) throw new Error('--host must be a hostname or IP address');
  const port = integer(args.port == null ? 56802 : args.port, '--port', 1, 65535);
  const address = (host.includes(':') && !host.startsWith('[') ? '[' + host + ']' : host) + ':' + port;
  const config = dbConfig();
  const server = new http.Server({ network: 'tcp', address, env: process.env });
  const publicDir = path.join(ROOT, 'public');

  // Only public assets are exposed; application sources and config stay outside the web root.
  server.staticFile('/', path.join(publicDir, 'index.html'));
  server.staticFile('/index.html', path.join(publicDir, 'index.html'));
  server.staticFile('/third-party.html', path.join(publicDir, 'third-party.html'));
  server.staticFile('/app.js', path.join(publicDir, 'app.js'));
  server.staticFile('/robot-models.js', path.join(publicDir, 'robot-models.js'));
  server.staticFile('/styles.css', path.join(publicDir, 'styles.css'));
  server.static('/assets', path.join(publicDir, 'assets'));
  server.static('/vendor', path.join(publicDir, 'vendor'));
  server.get('/api/health', route(() => ({ app: manifest.name, version: manifest.version })));
  server.get('/api/datasets', route(() => datasets(config)));
  server.get('/api/robots', route(() => robots()));
  server.get('/api/scenarios', route(() => scenarios(config)));
  server.get('/api/lerobot/episodes', route(() => lerobotEpisodes(config)));
  server.get('/api/lerobot/trajectory', route((ctx) => {
    const query = new URLSearchParams(ctx.request.query);
    if (query.get('mode') === 'full') return lerobotFull(config);
    const episode = Number(query.get('episode'));
    if (!Number.isInteger(episode) || episode < 0 || episode > 2999) throw Object.assign(new Error('episode must be an integer between 0 and 2999.'), { status: 400, code: 'INVALID_EPISODE' });
    return lerobotTrajectory(config, episode);
  }));
  server.get('/api/trajectory', route((ctx) => {
    const query = new URLSearchParams(ctx.request.query);
    return trajectory(config, query);
  }));

  process.addShutdownHook(() => server.close());
  server.serve((result) => console.println(manifest.name + ' listening at http://' + result.address));
}

try {
  main();
} catch (error) {
  console.println('Server failed:', error.message);
  process.exit(1);
}
