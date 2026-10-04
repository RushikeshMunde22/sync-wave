const BASE_API = '/api';

export const api = {
  async get(url: string, options?: { params?: Record<string, any> }) {
    let fullUrl = url.startsWith('/api') ? url : `${BASE_API}${url.startsWith('/') ? url : `/${url}`}`;
    if (options?.params) {
      const searchParams = new URLSearchParams();
      for (const [k, v] of Object.entries(options.params)) {
        if (v !== undefined && v !== null && v !== '') {
          searchParams.set(k, String(v));
        }
      }
      const qs = searchParams.toString();
      if (qs) {
        fullUrl += fullUrl.includes('?') ? `&${qs}` : `?${qs}`;
      }
    }
    const res = await fetch(fullUrl, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return { data };
  },

  async post(url: string, body?: any) {
    const fullUrl = url.startsWith('/api') ? url : `${BASE_API}${url.startsWith('/') ? url : `/${url}`}`;
    const res = await fetch(fullUrl, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return { data };
  },

  async put(url: string, body?: any) {
    const fullUrl = url.startsWith('/api') ? url : `${BASE_API}${url.startsWith('/') ? url : `/${url}`}`;
    const res = await fetch(fullUrl, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return { data };
  },

  async delete(url: string) {
    const fullUrl = url.startsWith('/api') ? url : `${BASE_API}${url.startsWith('/') ? url : `/${url}`}`;
    const res = await fetch(fullUrl, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return { data };
  }
};
