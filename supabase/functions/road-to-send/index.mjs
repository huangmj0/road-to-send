// Deno entry for the Supabase Edge Function. All behavior lives in http.mjs and core.mjs;
// this file only adapts Request/Response and wires the store from the injected environment.
import {route, serverError} from './http.mjs';
import {createPostgrestStore} from './store.mjs';

const store = createPostgrestStore({url: Deno.env.get('SUPABASE_URL'), serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')});

export async function serve(request) {
  let result;
  try {
    // The client posts text/plain, so the body is always read as text, whatever its content type.
    const bodyText = request.method === 'POST' ? await request.text() : '';
    result = await route({method: request.method, bodyText}, store, () => new Date());
  } catch {
    result = serverError();
  }
  return new Response(result.status === 204 ? null : result.body, {status: result.status, headers: result.headers});
}

Deno.serve(serve);
