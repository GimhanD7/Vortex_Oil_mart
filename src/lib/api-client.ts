function withAuthHeaders(headers?: HeadersInit) {
  const nextHeaders = new Headers(headers);

  if (typeof window !== "undefined" && !nextHeaders.has("Authorization")) {
    const token = window.localStorage.getItem("oil-mart-auth-token");
    if (token) nextHeaders.set("Authorization", `Bearer ${token}`);
  }

  return nextHeaders;
}

export function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...options,
    credentials: options.credentials ?? "include",
    headers: withAuthHeaders(options.headers),
  });
}

export async function cachedFetch(url: string, options?: RequestInit): Promise<Response> {
  const isGET = !options?.method || options.method === "GET";
  
  if (!isGET) {
    // We only cache GET requests. For mutations, pass through directly.
    return apiFetch(url, options);
  }

  try {
    // 1. Try fetching from network first
    const response = await apiFetch(url, options);
    
    // If successful and ok, save to Local Storage
    if (response.ok) {
      const clonedResponse = response.clone();
      const textData = await clonedResponse.text();
      
      try {
        localStorage.setItem(`cache:${url}`, textData);
      } catch (storageError) {
        console.warn("Failed to save to localStorage (quota exceeded?)", storageError);
      }
    }
    
    return response;
  } catch (error) {
    // 2. If network fails (offline), try retrieving from Local Storage
    console.warn(`Network fetch failed for ${url}, attempting offline cache...`);
    
    if (typeof window !== "undefined") {
      const cachedData = localStorage.getItem(`cache:${url}`);
      
      if (cachedData) {
        console.log(`Served ${url} from offline cache`);
        // Construct a synthetic Response object
        return new Response(cachedData, {
          status: 200,
          statusText: "OK (Offline Cache)",
          headers: { "Content-Type": "application/json" }
        });
      }
    }
    
    // If no cache exists, throw original error
    throw error;
  }
}
