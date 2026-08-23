const express = require('express');
const cors = require('cors');
const path = require('path');
const { OpenAI } = require('openai');
const puppeteer = require('puppeteer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

ffmpeg.setFfmpegPath(ffmpegStatic);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/output', express.static(path.join(__dirname, 'temp')));
// Increase payload limit for large HTML files
app.use(express.json({ limit: '50mb' }));

app.post('/api/generate-ai', async (req, res) => {
    const { apiKey, prompt, htmlCode, cssCode, jsCode } = req.body;

    if (!apiKey) {
        return res.status(400).json({ error: 'OpenAI API Key is required.' });
    }
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required.' });
    }

    try {
        const openai = new OpenAI({ apiKey: apiKey });

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

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini", // or another suitable model
            messages: [
                { role: "system", content: systemMessage },
                { role: "user", content: userMessage }
            ],
            response_format: { type: "json_object" }
        });

        const responseContent = completion.choices[0].message.content;
        try {
            const jsonResponse = JSON.parse(responseContent);
            res.json(jsonResponse);
        } catch (parseError) {
            console.error("Error parsing JSON from OpenAI:", parseError, "Raw Response:", responseContent);
            res.status(500).json({ error: 'Failed to parse AI response.', raw: responseContent });
        }

    } catch (error) {
        console.error("OpenAI API Error:", error);
        res.status(500).json({ error: error.message || 'Error communicating with AI.' });
    }
});

app.post('/api/render', async (req, res) => {
    const { html, css, js, width, height, duration, fps, format, loop, transparent } = req.body;

    if (!html) return res.status(400).json({ error: 'HTML code is required.' });

    const renderWidth = parseInt(width) || 800;
    const renderHeight = parseInt(height) || 600;
    const renderDuration = parseFloat(duration) || 5; // seconds
    const renderFps = parseInt(fps) || 30;
    const renderFormat = format || 'mp4';
    const isLoop = loop === true;
    const isTransparent = transparent === true;

    const totalFrames = Math.ceil(renderDuration * renderFps);
    const frameDelayMs = 1000 / renderFps;

    const jobId = uuidv4();
    const tempDir = path.join(__dirname, 'temp', jobId);

    try {
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const fullHtml = `
<!DOCTYPE html>
<html>
<head>
<style>
    body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; ${isTransparent ? 'background: transparent;' : 'background: white;'} }
    ${css || ''}
</style>
</head>
<body>
    ${html}
    <script>
        ${js || ''}
    </script>
</body>
</html>
        `;

        const htmlFilePath = path.join(tempDir, 'index.html');
        fs.writeFileSync(htmlFilePath, fullHtml);

        const browser = await puppeteer.launch({
            headless: 'new', // Or true in older/newer versions, 'new' is often recommended
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setViewport({ width: renderWidth, height: renderHeight, deviceScaleFactor: 1 });

        await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

        // Connect to CDP for time control
        const client = await page.target().createCDPSession();
        await client.send('Animation.enable');

        // Evaluate to ensure CSS animations are also paused initially if needed, though VirtualTime handles JS timers and CSS animations (usually).

        console.log(`Starting capture for job ${jobId}. Total frames: ${totalFrames}`);

        for (let i = 0; i < totalFrames; i++) {
            const frameNumber = String(i + 1).padStart(5, '0');
            const framePath = path.join(tempDir, `frame-${frameNumber}.png`);

            // Advance time
            await client.send('Emulation.setVirtualTimePolicy', {
                policy: 'advance',
                budget: frameDelayMs
            });

            // Wait for virtual time to advance
            await new Promise(resolve => {
                client.once('Emulation.virtualTimeBudgetExpired', resolve);
            });

            await page.screenshot({
                path: framePath,
                omitBackground: isTransparent
            });
        }

        await browser.close();

        // Compile frames with FFmpeg
        const outputFile = path.join(__dirname, 'temp', `${jobId}.${renderFormat}`);
        const inputPattern = path.join(tempDir, 'frame-%05d.png');

        const command = ffmpeg()
            .input(inputPattern)
            .inputOptions([
                `-framerate ${renderFps}`
            ]);

        if (renderFormat === 'gif') {
            command
                .complexFilter(`[0:v] split [a][b];[a] palettegen=reserve_transparent=${isTransparent ? 'on' : 'off'} [p];[b][p] paletteuse`)
                .outputOptions(isLoop ? ['-loop 0'] : ['-loop -1']);
        } else if (renderFormat === 'webp') {
             command
                .outputOptions([
                    '-vcodec libwebp',
                    '-lossless 0',
                    isLoop ? '-loop 0' : '-loop 1'
                ]);
        } else if (renderFormat === 'webm') {
            command
                .outputOptions([
                    '-c:v libvpx-vp9',
                    '-pix_fmt yuva420p',
                    '-auto-alt-ref 0'
                ]);
        } else if (renderFormat === 'mp4') {
            command
                .outputOptions([
                    '-c:v libx264',
                    '-pix_fmt yuv420p'
                ]);
        }

        command
            .save(outputFile)
            .on('end', () => {
                console.log(`Finished rendering job ${jobId}`);
                // Clean up frames
                fs.rmSync(tempDir, { recursive: true, force: true });
                res.json({ success: true, url: `/output/${jobId}.${renderFormat}` });
            })
            .on('error', (err) => {
                console.error(`Error rendering job ${jobId}:`, err);
                fs.rmSync(tempDir, { recursive: true, force: true });
                res.status(500).json({ error: 'Rendering failed' });
            });

    } catch (error) {
        console.error("Rendering error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
