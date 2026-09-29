// The HTTP-facing rules of the function as a pure function, so Node can test them without Deno.
// route({method, bodyText}, store, now) -> {status, headers, body}; body is a string ('' on 204).
import {errorEnvelope, handle} from './core.mjs';

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

const json = (status, payload) => ({status, headers: {...CORS_HEADERS, 'Content-Type': 'application/json'}, body: JSON.stringify(payload)});

export const serverError = () => json(200, errorEnvelope('server_error', 'The request could not be completed'));

export async function route({method, bodyText}, store, now) {
  if (method === 'OPTIONS') return {status: 204, headers: {...CORS_HEADERS}, body: ''};
  // GET ignores the query string entirely: the entry never passes it in.
  return json(200, await handle({method, bodyText: method === 'POST' ? bodyText : ''}, store, now));
}
