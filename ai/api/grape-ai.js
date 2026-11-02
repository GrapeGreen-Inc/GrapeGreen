// grape-ai.js (Service Worker Core Engine)
self.addEventListener('install', (event) => {
    // Forces the waiting service worker to become the active service worker immediately
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // Allows an active service worker to set itself as the controller for all clients within its scope
    event.waitUntil(self.clients.claim());
});

// 🧠 Network Interceptor Loop
self.addEventListener('fetch', (event) => {
    // Intercepts any POST network request heading toward your static AI file path
    if (event.request.method === 'POST' && event.request.url.includes('/ai/api/grape-ai.js')) {
        
        event.respondWith(
            (async () => {
                try {
                    // Clone the request stream to read the incoming JSON safely
                    const clonedRequest = event.request.clone();
                    
                    // 1. Sets "query" to the exact JSON payload object received
                    const query = await clonedRequest.json(); 
                    let output = "";

                    // 📄 Read your parameters out of params.txt located in the same folder
                    let paramsData = "";
                    try {
                        const paramsResponse = await fetch('params.txt');
                        if (paramsResponse.ok) {
                            paramsData = await paramsResponse.text();
                        } else {
                            paramsData = "[Warning: params.txt file found but unreachable]";
                        }
                    } catch (fileErr) {
                        paramsData = "[Warning: Failed to fetch local params.txt source resource]";
                    }

                    if (query && query.prompt) {
                        // 2. Extracts exactly what you said out of your structured template text block
                        const match = query.prompt.match(/the user said:\s*"([^"]+)"/);
                        
                        if (match && match[1]) {
                            // 3. Assigns your exact words to your output variable and appends the params file context
                            output = match[1] + "\n\n[SYSTEM PARAMS CONTEXT]:\n" + paramsData.trim(); 
                        } else {
                            output = "Could not parse your words out of the prompt format.";
                        }
                    } else {
                        output = "Payload error: Missing prompt string data.";
                    }

                    // 4. Safely returns the clean string variable back into the frontend await response.text()
                    return new Response(output, {
                        status: 200,
                        headers: { 
                            'Content-Type': 'text/plain',
                            'Access-Control-Allow-Origin': '*' // Prevents any CORS issues during dashboard lookups
                        }
                    });

                } catch (error) {
                    console.error("Worker stream dropped:", error);
                    return new Response("[WORKER ERROR]: Failed to process frontend request stream.", { status: 500 });
                }
            })()
        );
    }
});
