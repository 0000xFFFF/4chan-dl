// ==UserScript==
// @name         4chan-dl
// @namespace    0000xFFFF
// @version      3.1.0
// @description  Download media files from 4chan.org with their posted filenames.
// @author       0000xFFFF
// @license      MIT
// @match        *://boards.4chan.org/*/thread/*
// @match        *://boards.4channel.org/*/thread/*
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @connect      *
// @icon         data:image/ico;base64,AAABAAEAEBAAAAEAIAC+AAAAFgAAAIlQTkcNChoKAAAADUlIRFIAAAAQAAAAEAgGAAAAH/P/YQAAAIVJREFUeJxjYMAO/uPARIP/aWeMUTAxBqDYhsMAnK7BUIzNAEIuItoA2rmArDBQOWcoikWSGAP+a50ylcAwBF0jLoPgmrG5hGTNMMAsyELQCyzCrDgTFFhhIpJidM2JBFIlXEMilkBLICJZo8Q3sndAzkaWw2UAA5IEmNa7qCcGwtjkqAYAtUIYeAqEFoUAAAAASUVORK5CYII=
// @run-at       document-end
// @downloadURL  https://github.com/0000xFFFF/4chan-dl/raw/refs/heads/master/4chan-dl.user.js
// @updateURL    https://github.com/0000xFFFF/4chan-dl/raw/refs/heads/master/4chan-dl.user.js
// ==/UserScript==


(function() {
    'use strict';

    function GM_addStyle(css) {
        const style = document.createElement("style");
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
        return style;
    }

    const fcdl_css = `
    .fcdl_button_regular {
        padding: 12px 18px;
        display: flex;
        gap: 5px;
        background: #2d5016;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: bold;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        transition: all 0.3s ease;
        white-space: nowrap;
    }
    .fcdl_button_regular:hover {
        background: #4a7c21;
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0,0,0,0.4);
    }
    .fcdl_post_button {
        padding: 0 0 0 3px;
        margin: 0;
        background: transparent;
        color: white;
        border: none;
        cursor: pointer;
        opacity: 0.6;
        float: right;
    }
    .fcdl_main_container {
        display: flex;
        margin: 15px 0 15px 0;
        gap: 10px;
    }
    .fcdl_settings_container {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        align-items: center;
    }
    .fcdl_radio_label {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        overflow: hidden;
    }
    .fcdl_radio_input {
        cursor: pointer;
        accent-color: rgb(102, 204, 51);
        background-color black;
        display: none;
    }
    .fcdl_radio_span {
        height: 15px;
        width: 15px;
        border: 1px solid #555;
        border-radius: 50%;
        display: inline-block;
        position: relative;
        cursor: pointer;
    }
    .fcdl_radio_input:checked + .fcdl_radio_span {
        background-color: green;
        border-color: #4CAF50;
    }
    .fcdl_radio_input:checked + .fcdl_radio_span::after {
        content: "";
        position: absolute;
        top: 3px;
        left: 3px;
        width: 9px;
        height: 9px;
        background: lime;
        border-radius: 100%;
    }
    .fcdl_progress_container {
        padding-left: 15px;
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 15px;
        font-family: arial, helvetica, sans-serif;
        color: white;
        font-size: 14px;
    }
    .fcdl_progress_bar {
        width: 200px;
        height: 8px;
        background: #333;
        border-radius: 4px;
        overflow: hidden;
    }
    .fcdl_progress_fill {
        height: 100%;
        background: linear-gradient(90deg, #4CAF50, #45a049);
        width: 0%;
        transition: width 0.3s ease;
        border-radius: 4px;
    }
    .fcdl_progress_status {
        display: flex;
        align-items: center;
        padding-left: 3px;
    }
    `;

    GM_addStyle(fcdl_css);

    const userscript_icon = "data:image/ico;base64,AAABAAEADg8AAAEAIAC4AAAAFgAAAIlQTkcNChoKAAAADUlIRFIAAAAOAAAADwgGAAAA1BT+dAAAAH9JREFUeJxjYMAE/3FgguB/2hljFIxPI4rpODRi2I6hCJtGXC4gWiP1bCTLj2Ro/M+gcs5QFJcGXAZonTKVAFtJjGYMTTDALMhC0KkswqwYCQGsIBFJEbqmRBypCK4wEUtgJOBJfijxhexskPOQ5dA1MiAJgGm9i3piIIxNDgQAf5IV/0loTT0AAAAASUVORK5CYII=";

    function loadSetting(name, def) {
        const raw = localStorage.getItem(name);
        if (raw === null) {
            localStorage.setItem(name, JSON.stringify(def));
            return def;
        }
        return JSON.parse(raw);
    }
    function saveSetting(name, value) {
        localStorage.setItem(name, JSON.stringify(value));
    }

    const config = {
        saveMode: loadSetting("FCDL_SAVE_MODE", 0), // 1 == useOriginalNames, 2 == usePostIds, 3 == combineNames
        maxConcurrentDownloads: loadSetting("FCDL_MAX_CONCURRENT_DOWNLOADS", 1)
    };

    // ------------------------------------------------------------------
    // Minimal STORE-only ZIP writer (replaces JSZip).
    //
    // JSZip schedules its work through setImmediate/postMessage tricks that
    // can silently never fire inside MV3 userscript sandboxes, so
    // generateAsync() just hangs. This writer is fully synchronous, needs no
    // dependency, and moves each file into a Blob as soon as it is added so
    // the browser can keep the data outside the JS heap.
    // Limits: no ZIP64 (max 4 GB total / 65535 files) -- we throw if exceeded.
    // ------------------------------------------------------------------
    const CRC_TABLE = (function() {
        const t = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) {
                c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            }
            t[n] = c >>> 0;
        }
        return t;
    })();

    function crc32(bytes) {
        let c = 0xFFFFFFFF;
        for (let i = 0; i < bytes.length; i++) {
            c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
        }
        return (c ^ 0xFFFFFFFF) >>> 0;
    }

    class StoreZip {
        constructor() {
            this.parts = [];
            this.entries = [];
            this.offset = 0;
            this.encoder = new TextEncoder();
        }

        add(name, data) {
            const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
            const nameBytes = this.encoder.encode(name);
            const size = bytes.length;
            const crc = crc32(bytes);

            if (this.entries.length >= 0xFFFF) { throw new Error('ZIP too large (too many files)'); }
            if (this.offset + 30 + nameBytes.length + size > 0xFFFFFFFF) { throw new Error('ZIP too large (over 4 GB)'); }

            const d = new Date();
            const dosTime = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF;
            const dosDate = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;

            const h = new DataView(new ArrayBuffer(30));
            h.setUint32(0, 0x04034b50, true);   // local file header signature
            h.setUint16(4, 20, true);           // version needed
            h.setUint16(6, 0x0800, true);       // flags: UTF-8 names
            h.setUint16(8, 0, true);            // method: STORE
            h.setUint16(10, dosTime, true);
            h.setUint16(12, dosDate, true);
            h.setUint32(14, crc, true);
            h.setUint32(18, size, true);        // compressed size
            h.setUint32(22, size, true);        // uncompressed size
            h.setUint16(26, nameBytes.length, true);
            h.setUint16(28, 0, true);           // extra length

            // Wrap in a Blob right away so the browser can manage the memory.
            this.parts.push(new Blob([h.buffer, nameBytes, bytes]));

            this.entries.push({ nameBytes, crc, size, dosTime, dosDate, offset: this.offset });
            this.offset += 30 + nameBytes.length + size;
        }

        finish() {
            const cdStart = this.offset;
            let cdSize = 0;
            const cdParts = [];

            for (const e of this.entries) {
                const c = new DataView(new ArrayBuffer(46));
                c.setUint32(0, 0x02014b50, true);  // central directory signature
                c.setUint16(4, 20, true);          // version made by
                c.setUint16(6, 20, true);          // version needed
                c.setUint16(8, 0x0800, true);      // flags: UTF-8 names
                c.setUint16(10, 0, true);          // method: STORE
                c.setUint16(12, e.dosTime, true);
                c.setUint16(14, e.dosDate, true);
                c.setUint32(16, e.crc, true);
                c.setUint32(20, e.size, true);
                c.setUint32(24, e.size, true);
                c.setUint16(28, e.nameBytes.length, true);
                c.setUint16(30, 0, true);          // extra length
                c.setUint16(32, 0, true);          // comment length
                c.setUint16(34, 0, true);          // disk number
                c.setUint16(36, 0, true);          // internal attrs
                c.setUint32(38, 0, true);          // external attrs
                c.setUint32(42, e.offset, true);   // local header offset
                cdParts.push(c.buffer, e.nameBytes);
                cdSize += 46 + e.nameBytes.length;
            }

            const end = new DataView(new ArrayBuffer(22));
            end.setUint32(0, 0x06054b50, true);    // end of central directory
            end.setUint16(4, 0, true);
            end.setUint16(6, 0, true);
            end.setUint16(8, this.entries.length, true);
            end.setUint16(10, this.entries.length, true);
            end.setUint32(12, cdSize, true);
            end.setUint32(16, cdStart, true);
            end.setUint16(20, 0, true);

            return new Blob([...this.parts, ...cdParts, end.buffer], { type: 'application/zip' });
        }
    }

    function createDownloadButtons() {
        const postContainers = document.querySelectorAll(".postContainer");

        postContainers.forEach((postContainer, index) => {

            const post = postContainer.querySelector(".post");

            const postInfos = postContainer.querySelectorAll(".postInfo");
            postInfos.forEach((postInfo, index) => {

                const m = post.querySelectorAll('div.file');
                if (m.length == 0) { return; }

                const button = document.createElement("button");
                button.title = "Download All from this post down";
                button.className = "fcdl_post_button";

                const img = document.createElement("img")
                img.src = userscript_icon;
                button.appendChild(img);

                button.addEventListener('click', function(e) {
                    e.preventDefault();
                    downloadAllImagesAsZip(postContainer.id.replace("pc", ""));
                });

                postInfo.appendChild(button);
            });


        });
    }

    function createDownloadButton() {
        const button = document.createElement('button');
        button.id = "4chan_dl_button";
        button.className = "fcdl_button_regular";

        const img = document.createElement("img");
        img.src = userscript_icon;
        button.appendChild(img);

        const span = document.createElement("span");
        span.innerHTML = "Download All";
        button.appendChild(span);

        return button;
    }

    function createRadioButton({
        id,
        name,
        label,
        title,
        checked = false,
        onChange
    }) {
        // Create label wrapper
        const labelEl = document.createElement("label");
        labelEl.className = "fcdl_radio_label";
        labelEl.setAttribute("for", id);
        labelEl.title = title;

        // Create input
        const input = document.createElement("input");
        input.type = "radio";
        input.id = id;
        input.name = name;
        input.checked = checked;
        input.className = "fcdl_radio_input";
        input.title = title;

        // Hook event listener
        if (typeof onChange === "function") {
            input.addEventListener("change", () => {
                if (input.checked) {
                    onChange();
                }
            });
        }

        // Custom span for styling
        const span = document.createElement("span");
        span.className = "fcdl_radio_span";


        // Visible text
        const textNode = document.createTextNode(label);
        textNode.title = title;

        // Assemble
        labelEl.appendChild(input);
        labelEl.appendChild(span);
        labelEl.appendChild(textNode);

        return labelEl;
    }

    function createSettings() {
        const container = document.createElement("div");
        container.className = "fcdl_settings_container";

        container.appendChild(createRadioButton({
            id: "radioOriginalNames",
            name: "filenameOption",
            label: "Original Names",
            title: "Use the original filenames from the posts.",
            checked: config.saveMode == 0,
            onChange: () => {
                saveSetting("FCDL_SAVE_MODE", 0);
                config.saveMode = 0;
            }
        }));

        container.appendChild(createRadioButton({
            id: "radioPostIds",
            name: "filenameOption",
            label: "Post IDs",
            title: "Use post IDs as filenames.",
            checked: config.saveMode == 1,
            onChange: () => {
                saveSetting("FCDL_SAVE_MODE", 1);
                config.saveMode = 1;
            }
        }));

        container.appendChild(createRadioButton({
            id: "radioCombineNames",
            name: "filenameOption",
            label: "Combine",
            title: "Combine post IDs and original filenames. ({id}_{postname}.ext)",
            checked: config.saveMode == 2,
            onChange: () => {
                saveSetting("FCDL_SAVE_MODE", 2);
                config.saveMode = 2;
            }
        }));

        return container;
    }

    function createProgressIndicator() {

        document.querySelectorAll(".fcdl_progress_container").forEach((item, index) => { item.remove(); });

        const progressContainer = document.createElement('div');
        progressContainer.className = "fcdl_progress_container";

        const bodyColor = getComputedStyle(document.body).color;

        const progressText = document.createElement('div');
        progressText.id = 'zip-progress-text';
        progressText.textContent = 'Preparing download...';
        progressText.style.color = bodyColor;

        const progressBar = document.createElement('div');
        progressBar.className = "fcdl_progress_bar";

        const progressFill = document.createElement('div');
        progressFill.id = 'zip-progress-fill';
        progressFill.className = "fcdl_progress_fill";

        const progressPercent = document.createElement('div');
        progressPercent.id = 'zip-progress-percent';
        progressPercent.textContent = '0%';
        progressPercent.style.color = bodyColor;


        progressContainer.appendChild(progressPercent);
        progressBar.appendChild(progressFill);
        progressContainer.appendChild(progressBar);
        progressContainer.appendChild(progressText);

        return progressContainer;
    }

    function postFileTextToMediaLink(fileText, index) {

        const link = fileText.querySelector('a');
        if (link && link.href) {
            const url = link.href.startsWith('//') ? 'https:' + link.href : link.href;

            const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(url);
            const isVideo = /\.(mp4|webm|mkv|avi|mov)(\?|$)/i.test(url);
            if (isImage || isVideo) {
                const postId = url.split('/').pop().split('?')[0];
                let originalName = link.title.trim() || link.textContent.trim() || postId;

                // if 4chan-X is used fix the name fetching
                const fnfull = link.querySelector('.fnfull');
                if (fnfull) { originalName = fnfull.textContent.trim(); }

                return {
                    url: url,
                    originalName: originalName,
                    postId: postId,
                    index: index + 1
                };
            }
        }

        return null;
    }

    function findMediaLinks(startFromThisPostId = "") {

        const mediaLinks = [];

        if (startFromThisPostId != "") {

            let found = false;
            const fileTexts = document.querySelectorAll('div.fileText');
            fileTexts.forEach((fileText, index) => {

                if (fileText.id.replace("fT", "") == startFromThisPostId) { found = true; }

                if (found) {
                    const mediaLink = postFileTextToMediaLink(fileText, index);
                    if (mediaLink != null) {
                        mediaLinks.push(mediaLink);
                    }
                }
            });

        }
        else {
            const fileTexts = document.querySelectorAll('div.fileText');
            fileTexts.forEach((fileText, index) => {
                const mediaLink = postFileTextToMediaLink(fileText, index);
                if (mediaLink != null) {
                    mediaLinks.push(mediaLink);
                }
            });
        }

        return mediaLinks;
    }


    function findMediaLinksFromImgAndVideoElements() {
        const mediaLinks = [];
        const imgElements = document.querySelectorAll('img[src*="jpg"], img[src*="jpeg"], img[src*="png"], img[src*="gif"], img[src*="webp"], img[src*="bmp"]');
        const videoElements = document.querySelectorAll('video[src*="mp4"], video[src*="webm"], video[src*="mkv"], video[src*="avi"], video[src*="mov"]');
        const mediaElements = [...imgElements, ...videoElements];
        mediaElements.forEach((img_or_vid, index) => {
            const url = img_or_vid.src;
            const filename = url.split('/').pop().split('?')[0];
            mediaLinks.push({
                url: url,
                originalName: filename,
                postId: filename,
                index: index + 1
            });
        });
        return mediaLinks;
    }

    function generateFilename(imageData) {
        let filename;

        switch (config.saveMode) {
            default:
            case 0: filename = imageData.originalName; break;
            case 1: filename = imageData.postId; break;
            case 2: {
                const postIdBase = imageData.postId.split('.')[0];
                filename = `${postIdBase}_${imageData.originalName}`;
                break;
            }
        }

        // Comprehensive filename sanitization
        filename = filename.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');  // Remove illegal chars
        filename = filename.replace(/^\s+|\s+$/g, '');               // Trim whitespace
        filename = filename.replace(/\s+/g, '_');                    // Replace spaces with underscore
        filename = filename.replace(/\.+/g, '.');                    // Remove multiple dots

        // Ensure filename isn't empty
        if (!filename) {
            filename = 'download';
        }

        return filename;
    }

    function updateProgress(current, total, status = '', filename = '') {
        const progressText = document.getElementById('zip-progress-text');
        const progressFill = document.getElementById('zip-progress-fill');
        const progressPercent = document.getElementById('zip-progress-percent');

        if (progressText && progressFill && progressPercent) {
            const percentage = Math.round((current / total) * 100);

            let displayText = status;
            if (filename) {
                displayText += ` - ${filename}`;
            }
            if (current <= total) {
                displayText = `${status} (${current}/${total})` + (filename ? ` - ${filename}` : '');
            }

            progressText.textContent = displayText;
            progressFill.style.width = `${percentage}%`;
            progressPercent.textContent = `${percentage}%`;
        }
    }

    // Returns a Uint8Array. Userscript managers may hand back an ArrayBuffer,
    // a Blob or a typed array depending on the browser/manager version, and
    // instanceof checks can fail across sandbox realms, so check by tag.
    async function toUint8Array(r) {
        const tag = Object.prototype.toString.call(r);
        if (tag === '[object ArrayBuffer]') { return new Uint8Array(r); }
        if (tag === '[object Blob]' || tag === '[object File]') { return new Uint8Array(await r.arrayBuffer()); }
        if (ArrayBuffer.isView(r)) { return new Uint8Array(r.buffer, r.byteOffset, r.byteLength); }
        throw new Error('Empty or unsupported response body');
    }

    async function fetchBinary(url) {
        if (typeof GM_xmlhttpRequest === 'function') {
            return await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    responseType: 'arraybuffer',
                    timeout: 60000,
                    onload: (response) => {
                        if (response.status >= 200 && response.status < 300) {
                            toUint8Array(response.response).then(resolve, reject);
                            return;
                        }
                        reject(new Error(`HTTP ${response.status} - ${response.statusText}`));
                    },
                    onerror: () => reject(new Error('Network error while downloading media')),
                    ontimeout: () => reject(new Error('Download timed out')),
                    onabort: () => reject(new Error('Download aborted'))
                });
            });
        }

        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} - ${response.statusText}`);
        }

        return new Uint8Array(await response.arrayBuffer());
    }

    // Plain <a download> on a blob: URL. GM_download hands the URL to the
    // extension's service worker in MV3, which can't reliably read blob URLs
    // created in the page, so don't use it for the ZIP.
    function triggerZipDownload(zipBlob, zipFilename) {
        const zipUrl = URL.createObjectURL(zipBlob);

        const downloadLink = document.createElement('a');
        downloadLink.href = zipUrl;
        downloadLink.download = zipFilename;
        downloadLink.style.display = 'none';

        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        // Keep the URL alive long enough for big files to be written out.
        setTimeout(() => URL.revokeObjectURL(zipUrl), 60000);
    }

    async function downloadFilesIndividually(imageLinks) {
        let successful = 0;
        let failed = 0;

        for (const imageData of imageLinks) {
            const filename = generateFilename(imageData);
            const url = imageData.url;

            console.log(`[fcdl] Starting download: ${filename}`);

            if (typeof GM_download === 'function') {
                GM_download({
                    url: url,
                    name: filename,
                    saveAs: false,
                    onerror: (error) => {
                        failed++;
                        console.error(`[fcdl] ✗ Failed to download: ${filename}`);
                        console.error(`[fcdl]   URL: ${url}`);
                        console.error(`[fcdl]   Error: ${error}`);
                    },
                    onload: () => {
                        successful++;
                        console.log(`[fcdl] ✓ Successfully downloaded: ${filename}`);
                    },
                    ontimeout: () => {
                        failed++;
                        console.error(`[fcdl] ✗ Download timed out: ${filename} from ${url}`);
                    }
                });
                continue;
            }

            try {
                const downloadLink = document.createElement('a');
                downloadLink.href = url;
                downloadLink.download = filename;
                downloadLink.style.display = 'none';
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
                successful++;
                console.log(`[fcdl] ✓ Successfully downloaded: ${filename}`);
            } catch (error) {
                failed++;
                console.error(`[fcdl] ✗ Failed to download: ${filename} - Error: ${error.message}`);
            }
        }

        // Summary log
        setTimeout(() => {
            console.log(`[fcdl] Download Summary: ${successful} successful, ${failed} failed out of ${imageLinks.length} files`);
        }, 1000);
    }

    async function downloadAllImagesAsZip(startFromThisPostId = "") {
        const imageLinks = findMediaLinks(startFromThisPostId);

        if (imageLinks.length === 0) {
            alert('No images found on this page!\n\nMake sure your page has images in div.fileText elements or direct img tags.');
            return;
        }

        const userConfirmed = confirm(`Ready to download ${imageLinks.length} files as a ZIP?`);
        if (!userConfirmed) {
            return;
        }

        const container = document.getElementById("4chan_dl_cont");
        const progressIndicator = createProgressIndicator();
        container.appendChild(progressIndicator);
        progressIndicator.style.display = 'flex';

        console.log(`[fcdl] Found ${imageLinks.length} images to download`);

        const zip = new StoreZip();
        const downloadedFilenames = new Set();
        let completed = 0;
        let successful = 0;
        let zipError = null;

        updateProgress(0, imageLinks.length, 'Initializing', '');

        const downloadImage = async (imageData) => {
            let filename = generateFilename(imageData);

            let counter = 1;
            const originalFilename = filename;
            while (downloadedFilenames.has(filename)) {
                const dotIndex = originalFilename.lastIndexOf('.');
                if (dotIndex > 0) {
                    const name = originalFilename.substring(0, dotIndex);
                    const ext = originalFilename.substring(dotIndex);
                    filename = `${name}_${counter}${ext}`;
                } else {
                    filename = `${originalFilename}_${counter}`;
                }
                counter++;
            }

            downloadedFilenames.add(filename);

            try {
                updateProgress(completed + 1, imageLinks.length, 'Downloading', filename);
                const bytes = await fetchBinary(imageData.url);
                zip.add(filename, bytes);
                successful++;
                console.log(`[fcdl] ✓ Added to ZIP: ${filename}`);
                return { success: true, filename };
            } catch (error) {
                console.error(`[fcdl] ✗ Failed to download ${imageData.url}:`, error);
                // A ZIP-size problem is fatal for the whole archive; anything else is per-file.
                if (/ZIP too large/.test(error.message)) { zipError = error; }
                return { success: false, filename, error: error.message };
            } finally {
                completed++;
                updateProgress(completed, imageLinks.length, 'Downloading', filename);
            }
        };

        const processDownloads = async () => {
            const promises = [];
            for (const imageData of imageLinks) {
                if (zipError) { break; }
                promises.push(downloadImage(imageData));
                if (promises.length >= config.maxConcurrentDownloads) {
                    await Promise.all(promises.splice(0, config.maxConcurrentDownloads));
                }
            }
            if (promises.length > 0) {
                await Promise.all(promises);
            }
        };

        const fallbackToIndividual = async (reason) => {
            console.warn(`[fcdl] ${reason}; falling back to individual downloads.`);
            updateProgress(imageLinks.length, imageLinks.length, 'Fallback download', '');
            await downloadFilesIndividually(imageLinks);
            progressIndicator.remove();
            const statusDiv = document.createElement("div");
            statusDiv.className = "fcdl_progress_status";
            statusDiv.textContent = `${imageLinks.length} files (individual downloads)`;
            container.appendChild(statusDiv);
        };

        try {
            await processDownloads();

            if (zipError) {
                await fallbackToIndividual(zipError.message);
                return;
            }

            if (successful === 0) {
                progressIndicator.remove();
                alert('❌ No files could be downloaded. Check the console for details.');
                return;
            }

            updateProgress(imageLinks.length, imageLinks.length, 'Creating ZIP file', '');

            const zipBlob = zip.finish();

            const now = new Date();
            const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
            const pageTitle = document.title.replace(/[<>:"/\\|?*]/g, '_').slice(0, 50);
            const zipFilename = `${pageTitle || 'images'}_${timestamp}.zip`;

            updateProgress(imageLinks.length, imageLinks.length, 'Downloading ZIP', zipFilename);

            triggerZipDownload(zipBlob, zipFilename);

            const sizeInMB = (zipBlob.size / (1024 * 1024)).toFixed(2);
            setTimeout(() => {
                const message = `✅ ZIP Download Complete!\n\n` +
                    `📁 File: ${zipFilename}\n` +
                    `📊 Total images: ${imageLinks.length}\n` +
                    `✅ Successful: ${successful}\n` +
                    `❌ Failed: ${imageLinks.length - successful}\n` +
                    `💾 ZIP size: ${sizeInMB} MB`;

                progressIndicator.remove();

                document.querySelectorAll(".fcdl_progress_status").forEach((item, index) => { item.remove(); });

                const statusDiv = document.createElement("div");
                statusDiv.className = "fcdl_progress_status";
                statusDiv.textContent = `${successful} / ${imageLinks.length} (${sizeInMB} MB)`;
                container.appendChild(statusDiv);

                console.log(`[fcdl] ${message}`);
            }, 1000);

        } catch (error) {
            console.error('[fcdl] Error creating ZIP:', error);
            progressIndicator.remove();
            alert(`❌ Error creating ZIP file:\n${error.message}`);
        }
    }

    async function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }

        setTimeout(async () => {
            try {
                const containerDiv = document.createElement('div');
                containerDiv.id = "4chan_dl_cont";
                containerDiv.className = "fcdl_main_container";

                const settingsContainer = createSettings();
                const downloadButton = createDownloadButton();

                downloadButton.addEventListener('click', function(e) {
                    e.preventDefault();
                    downloadAllImagesAsZip();
                });

                containerDiv.appendChild(downloadButton);
                containerDiv.appendChild(settingsContainer);

                const threadElement = document.querySelector(".thread");
                threadElement.parentElement.insertBefore(containerDiv, threadElement);

                const mediaLinks = findMediaLinks();
                console.log(`[fcdl] Found ${mediaLinks.length} media files on page:`, mediaLinks);

                document.getElementById("4chan_dl_button").title = `Download All (${mediaLinks.length})`;

                createDownloadButtons();

            } catch (error) {
                console.error('[fcdl] Error initializing userscript:', error);
            }
        }, 500);
    }

    init();

})();

