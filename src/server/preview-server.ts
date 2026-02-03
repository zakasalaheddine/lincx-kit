import type { Server } from 'bun';

export interface ServerOptions {
  port: number;
  html: string;
}

export interface PreviewServerHandle {
  close: () => void;
  reload: (nextHtml?: string) => void;
  port: number;
}

interface SseClient {
  send: (message: string) => void;
  close: () => void;
}

const textEncoder = new TextEncoder();
const MAX_PORT_ATTEMPTS = 100;

function isPortInUseError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: string })?.code;
  return code === 'EADDRINUSE' || /address already in use|port.*in use/i.test(msg);
}

export function createServer({ port, html }: ServerOptions): PreviewServerHandle {
  let currentHtml = html;
  const clients = new Set<SseClient>();

  const broadcast = (message: string) => {
    for (const client of clients) {
      client.send(message);
    }
  };

  const handleSse = () => {
    let client: SseClient | null = null;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        client = {
          send(message: string) {
            controller.enqueue(textEncoder.encode(`data: ${message}\n\n`));
          },
          close() {
            controller.close();
          },
        };

        clients.add(client);
        client.send('connected');
      },
      cancel() {
        if (client) {
          clients.delete(client);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  };

  let server: Server | null = null;
  let actualPort = port;

  for (let attempt = 0; attempt < MAX_PORT_ATTEMPTS; attempt++) {
    const tryPort = port + attempt;
    try {
      server = Bun.serve({
        port: tryPort,
        fetch(request) {
          const url = new URL(request.url);

          if (url.pathname === '/sse') {
            return handleSse();
          }

          return new Response(currentHtml, {
            headers: { 'Content-Type': 'text/html' },
          });
        },
      });
      actualPort = tryPort;
      break;
    } catch (err) {
      if (isPortInUseError(err)) {
        continue;
      }
      throw err;
    }
  }

  if (!server) {
    throw new Error(`Could not find an available port between ${port} and ${port + MAX_PORT_ATTEMPTS - 1}`);
  }

  return {
    port: actualPort,
    close: () => {
      for (const client of clients) {
        client.close();
      }
      clients.clear();
      server!.stop();
    },
    reload: (nextHtml?: string) => {
      if (typeof nextHtml === 'string') {
        currentHtml = nextHtml;
      }
      broadcast('reload');
    },
  };
}




