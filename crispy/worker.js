export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    if (url.pathname === '/api/generate-ai' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { apiKey, prompt, htmlCode, cssCode, jsCode } = body;

        const effectiveKey = apiKey || env.OPENAI_API_KEY;

        if (!effectiveKey) {
          return new Response(JSON.stringify({ error: 'OpenAI API Key is required.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (!prompt) {
          return new Response(JSON.stringify({ error: 'Prompt is required.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const systemMessage = `You are an expert HTML, CSS, and JavaScript developer.
The user will provide their current HTML, CSS, and JS code.
The user will also provide a prompt asking for a change to this code, often to create or modify an animation.
You MUST output ONLY valid JSON in the following exact format with no additional text, markdown formatting, or code blocks outside the JSON:

{
  "html": "the new html code",
  "css": "the new css code",
  "js": "the new js code"
}

Ensure the code works seamlessly together. Do not include \`\`\`json or any other wrappers.`;

        const userMessage = `Here is my current code:
HTML:
${htmlCode || ''}

CSS:
${cssCode || ''}

JS:
${jsCode || ''}

Prompt: ${prompt}`;

        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${effectiveKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemMessage },
              { role: 'user', content: userMessage },
            ],
            response_format: { type: 'json_object' },
          }),
        });

        if (!openaiRes.ok) {
          const errText = await openaiRes.text();
          let errJson;
          try { errJson = JSON.parse(errText); } catch (e) {}
          const errMsg = errJson?.error?.message || errText || 'OpenAI request failed.';
          return new Response(JSON.stringify({ error: errMsg }), {
            status: openaiRes.status,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const completion = await openaiRes.json();
        const responseContent = completion.choices[0].message.content;

        try {
          const jsonResponse = JSON.parse(responseContent);
          return new Response(JSON.stringify(jsonResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (parseError) {
          return new Response(JSON.stringify({ error: 'Failed to parse AI response.', raw: responseContent }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message || 'Error processing request.' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (url.pathname === '/api/render' && request.method === 'POST') {
      return new Response(
        JSON.stringify({
          error: 'Video and GIF rendering using Puppeteer/FFmpeg requires Node.js server execution. Run the local server (`npm start`) for media exports.',
        }),
        {
          status: 501,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Static assets fallback when env.ASSETS is bound or handled by Wrangler Assets
    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
};
