// Local dev user — no auth required
const LOCAL_USER = {
  id: 'local-user',
  email: 'dev@localhost',
  name: 'Dev User',
}

export async function auth() {
  return { user: LOCAL_USER }
}
