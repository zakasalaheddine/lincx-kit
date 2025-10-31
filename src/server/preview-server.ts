import type { Server } from 'bun';

export interface ServerOptions {
  port: number;
  html: string;
}

export interface PreviewServerHandle {
  close: () => void;
  reload: (nextHtml?: string) => void;
}

interface SseClient {
  send: (message: string) => void;
  close: () => void;
}

const textEncoder = new TextEncoder();

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

  const server: Server = Bun.serve({
    port,
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

  return {
    close: () => {
      for (const client of clients) {
        client.close();
      }
      clients.clear();
      server.stop();
    },
    reload: (nextHtml?: string) => {
      if (typeof nextHtml === 'string') {
        currentHtml = nextHtml;
      }
      broadcast('reload');
    },
  };
}


