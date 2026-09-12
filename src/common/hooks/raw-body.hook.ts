import { Readable } from 'stream';

export interface FastifyRawBodyHookTarget {
  addHook(
    name: string,
    hook: (request: any, reply: any, payload: any, done: (err: any, res?: any) => void) => void,
  ): any;
}

/**
 * Registers a preParsing hook that preserves the raw request body
 * for webhook signature verification.
 *
 * Fastify's default JSON parser discards the original byte sequence,
 * and JSON.stringify(parsed) may produce a different output (key
 * ordering, whitespace). This hook buffers the raw bytes and exposes
 * them as `req.rawBody` while still allowing the JSON parser to work.
 */
export function registerRawBodyHook(fastify: FastifyRawBodyHookTarget): void {
  fastify.addHook('preParsing', (request, _reply, payload, done) => {
    const chunks: Buffer[] = [];
    payload.on('data', (chunk: Buffer) => chunks.push(chunk));
    payload.on('end', () => {
      const raw = Buffer.concat(chunks);
      request.rawBody = raw.toString('utf-8');

      // Return a new readable stream with the same data for the JSON parser
      const stream = new Readable();
      stream.push(raw);
      stream.push(null);
      // Preserve content-encoding header for the new stream
      (stream as any).headers = payload.headers;
      done(null, stream);
    });
    payload.on('error', done);
  });
}
