import { createServer } from 'node:http';
import { tevelHandler, cleanupHandler } from './http.js';
const port = Number(process.env.API_PORT ?? 3001);
createServer((req, res) => { if (req.url === '/api/tevel')
    void tevelHandler(req, res);
else if (req.url === '/api/cleanup')
    void cleanupHandler(req, res);
else {
    res.statusCode = 404;
    res.end('Not found');
} }).listen(port, '127.0.0.1', () => console.log(`Tevel API listening on http://127.0.0.1:${port}`));
