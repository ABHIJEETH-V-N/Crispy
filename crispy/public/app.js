document.addEventListener('DOMContentLoaded', () => {
    const htmlCode = document.getElementById('html-code');
    const cssCode = document.getElementById('css-code');
    const jsCode = document.getElementById('js-code');
    const previewFrame = document.getElementById('preview-frame');

    const optWidth = document.getElementById('opt-width');
    const optHeight = document.getElementById('opt-height');
    const optDuration = document.getElementById('opt-duration');
    const optFps = document.getElementById('opt-fps');
    const optFormat = document.getElementById('opt-format');
    const optLoop = document.getElementById('opt-loop');
    const optTransparent = document.getElementById('opt-transparent');

    const aiApiKey = document.getElementById('api-key');
    const aiPrompt = document.getElementById('ai-prompt');
    const aiBtn = document.getElementById('ai-generate-btn');

    const renderBtn = document.getElementById('render-btn');
    const statusMsg = document.getElementById('render-status');
    const resultContainer = document.getElementById('result-container');
    const downloadLink = document.getElementById('download-link');
    const mediaPreview = document.getElementById('media-preview');

    // Update Iframe preview
    function updatePreview() {
        const isTransparent = optTransparent.checked;
        const html = htmlCode.value;
        const css = cssCode.value;
        const js = jsCode.value;

        const docContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body, html { margin: 0; padding: 0; overflow: hidden; width: 100%; height: 100%; ${isTransparent ? 'background: transparent;' : 'background: white;'} }
                    ${css}
                </style>
            </head>
            <body>
                ${html}
                <script>
                    ${js}
                </script>
            </body>
            </html>
        `;

        previewFrame.srcdoc = docContent;

        // Adjust iframe size for visual representation (scaled down)
        const w = parseInt(optWidth.value);
        const h = parseInt(optHeight.value);
        const container = previewFrame.parentElement;

        const scaleX = container.clientWidth / w;
        const scaleY = container.clientHeight / h;
        const scale = Math.min(scaleX, scaleY, 1); // Don't scale up past 100%

        previewFrame.style.width = `${w}px`;
        previewFrame.style.height = `${h}px`;
        previewFrame.style.transform = `scale(${scale})`;
        previewFrame.style.transformOrigin = 'center center';

        // Setup wrapper flex centering
        previewFrame.style.margin = "auto";
    }

    [htmlCode, cssCode, jsCode, optWidth, optHeight, optTransparent].forEach(el => {
        el.addEventListener('input', updatePreview);
    });

    window.addEventListener('resize', updatePreview);

    // Initial Preview
    updatePreview();

    // AI Generation
    aiBtn.addEventListener('click', async () => {
        const apiKey = aiApiKey.value.trim();
        const prompt = aiPrompt.value.trim();

        if (!prompt) {
            alert("Please enter a prompt.");
            return;
        }

        aiBtn.disabled = true;
        aiBtn.textContent = "Tweaking...";

        try {
            const res = await fetch('/api/generate-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apiKey,
                    prompt,
                    htmlCode: htmlCode.value,
                    cssCode: cssCode.value,
                    jsCode: jsCode.value
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to generate code.');
            }

            if (data.html !== undefined) htmlCode.value = data.html;
            if (data.css !== undefined) cssCode.value = data.css;
            if (data.js !== undefined) jsCode.value = data.js;

            updatePreview();
            aiPrompt.value = ""; // Clear prompt after success

        } catch (error) {
            alert(error.message);
        } finally {
            aiBtn.disabled = false;
            aiBtn.textContent = "Tweak/Generate with AI";
        }
    });

    // Render Logic
    renderBtn.addEventListener('click', async () => {
        renderBtn.disabled = true;
        statusMsg.textContent = "Rendering... (this may take a while)";
        resultContainer.style.display = 'none';

        try {
            const payload = {
                html: htmlCode.value,
                css: cssCode.value,
                js: jsCode.value,
                width: optWidth.value,
                height: optHeight.value,
                duration: optDuration.value,
                fps: optFps.value,
                format: optFormat.value,
                loop: optLoop.checked,
                transparent: optTransparent.checked
            };

            const res = await fetch('/api/render', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Rendering failed.');
            }

            statusMsg.textContent = "Render complete!";

            const fileUrl = data.url;
            downloadLink.href = fileUrl;
            downloadLink.download = `rendered-animation.${optFormat.value}`;

            // Show preview
            mediaPreview.innerHTML = '';
            if (['gif', 'webp'].includes(optFormat.value)) {
                const img = document.createElement('img');
                img.src = fileUrl + '?t=' + new Date().getTime(); // cache busting
                mediaPreview.appendChild(img);
            } else {
                const video = document.createElement('video');
                video.src = fileUrl;
                video.controls = true;
                video.autoplay = true;
                video.loop = optLoop.checked;
                mediaPreview.appendChild(video);
            }

            resultContainer.style.display = 'block';

        } catch (error) {
            statusMsg.textContent = `Error: ${error.message}`;
        } finally {
            renderBtn.disabled = false;
        }
    });
});