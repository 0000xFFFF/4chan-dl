// ==UserScript==
// @name         4chan-dl
// @namespace    0000xFFFF
// @version      3.0.0
// @description  Download media files from 4chan.org with their posted filenames.
// @author       0000xFFFF
// @license      MIT
// @match        *://boards.4chan.org/*/thread/*
// @match        *://boards.4channel.org/*/thread/*
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @connect      *
// @icon         data:image/ico;base64,AAABAAEAEBAAAAEAIAC+AAAAFgAAAIlQTkcNChoKAAAADUlIRFIAAAAQAAAAEAgGAAAAH/P/YQAAAIVJREFUeJxjYMAO/uPARIP/aWeMUTAxBqDYhsMAnK7BUIzNAEIuItoA2rmArDBQOWcoikWSGAP+a50ylcAwBF0jLoPgmrG5hGTNMMAsyELQCyzCrDgTFFhhIpJidM2JBFIlXEMilkBLICJZo8Q3sndAzkaWw2UAA5IEmNa7qCcGwtjkqAYAtUIYeAqEFoUAAAAASUVORK5CYII=
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

    function createDownloadButtons() {
        const postContainers = document.querySelectorAll(".postContainer");

        postContainers.forEach((postContainer, index) => {

            const postInfos = postContainer.querySelectorAll(".postInfo");
            postInfos.forEach((postInfo, index) => {
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

    async function fetchBinary(url) {
        if (typeof GM_xmlhttpRequest === 'function') {
            return await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    responseType: 'arraybuffer',
                    timeout: 30000,
                    onload: (response) => {
                        if (response.status >= 200 && response.status < 300) {
                            resolve(response.response);
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

        return await response.arrayBuffer();
    }

    function triggerZipDownload(zipBlob, zipFilename) {
        const zipUrl = URL.createObjectURL(zipBlob);

        if (typeof GM_download === 'function') {
            GM_download({
                url: zipUrl,
                name: zipFilename,
                saveAs: true,
                onerror: () => {
                    console.error('[fcdl] GM_download failed for ZIP file');
                },
                onload: () => {
                    setTimeout(() => URL.revokeObjectURL(zipUrl), 5000);
                }
            });
            return;
        }

        const downloadLink = document.createElement('a');
        downloadLink.href = zipUrl;
        downloadLink.download = zipFilename;
        downloadLink.style.display = 'none';

        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        setTimeout(() => URL.revokeObjectURL(zipUrl), 5000);
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

        // Extract thread ID from URL
        const threadId = window.location.pathname.split('/').pop() || 'thread';
        const suggestedPath = `~/Downloads/${threadId}`;

        // Combined dialog: Instructions + confirmation
        const userConfirmed = confirm(
            `Please set the download directory to:\n${suggestedPath}\n` +
            `IMPORTANT: Uncheck "Ask where to save file" in your download settings.\n` +
            `Firefox: about:preferences#downloads\n` +
            `Brave: brave://settings/downloads\n` +
            `Ready to start downloading?`
        );

        if (!userConfirmed) {
            return;
        }
        
        // ZIP creation disabled - using individual downloads instead
        await downloadFilesIndividually(imageLinks);
        return;

        /* ZIP CREATION CODE DISABLED - NOT WORKING
        const container = document.getElementById("4chan_dl_cont");
        const progressIndicator = createProgressIndicator();
        container.appendChild(progressIndicator);
        progressIndicator.style.display = 'flex';

        console.log(`[fcdl] Found ${imageLinks.length} images to download`);

        const zip = new JSZip();
        const downloadedFilenames = new Set();
        let completed = 0;
        let successful = 0;

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
                const arrayBuffer = await fetchBinary(imageData.url);
                zip.file(filename, arrayBuffer);
                successful++;
                console.log(`[fcdl] ✓ Added to ZIP: ${filename}`);
                return { success: true, filename };
            } catch (error) {
                console.error(`[fcdl] ✗ Failed to download ${imageData.url}:`, error);
                return { success: false, filename, error: error.message };
            } finally {
                completed++;
                updateProgress(completed, imageLinks.length, 'Downloading', filename);
            }
        };

        const processDownloads = async () => {
            const promises = [];
            for (const imageData of imageLinks) {
                promises.push(downloadImage(imageData));
                if (promises.length >= config.maxConcurrentDownloads) {
                    await Promise.all(promises.splice(0, config.maxConcurrentDownloads));
                }
            }
            if (promises.length > 0) {
                await Promise.all(promises);
            }
        };

        try {
            await processDownloads();
            completed = imageLinks.length;
            updateProgress(completed, imageLinks.length, 'Creating ZIP file', '');

            let zipBlob;
            try {
                zipBlob = await Promise.race([
                    zip.generateAsync({
                        type: "blob",
                        compression: "STORE"
                    }),
                    new Promise((_, reject) => {
                        setTimeout(() => {
                            reject(new Error('ZIP creation timed out after 25 seconds; falling back to individual downloads.'));
                        }, 25000);
                    })
                ]);
            } catch (zipError) {
                console.warn('[fcdl] ZIP creation stalled, falling back to individual downloads:', zipError);
                updateProgress(completed, imageLinks.length, 'Fallback download', '');
                await downloadFilesIndividually(imageLinks);

                if (progressIndicator) {
                    progressIndicator.remove();
                }

                const statusDiv = document.createElement("div");
                statusDiv.className = "fcdl_progress_status";
                statusDiv.innerHTML = `${successful} / ${imageLinks.length} (individual files)`;
                container.appendChild(statusDiv);
                return;
            }

            const now = new Date();
            const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
            const pageTitle = document.title.replace(/[<>:"/\\|?*]/g, '_').slice(0, 50);
            const zipFilename = `${pageTitle || 'images'}_${timestamp}.zip`;

            updateProgress(completed, imageLinks.length, 'Downloading ZIP', zipFilename);

            triggerZipDownload(zipBlob, zipFilename);

            const sizeInMB = (zipBlob.size / (1024 * 1024)).toFixed(2);
            setTimeout(() => {
                const message = `✅ ZIP Download Complete!\n\n` +
                    `📁 File: ${zipFilename}\n` +
                    `📊 Total images: ${imageLinks.length}\n` +
                    `✅ Successful: ${successful}\n` +
                    `❌ Failed: ${imageLinks.length - successful}\n` +
                    `💾 ZIP size: ${sizeInMB} MB`;

                if (progressIndicator) {
                    progressIndicator.remove();
                }

                document.querySelectorAll(".fcdl_progress_status").forEach((item, index) => { item.remove(); });

                const statusDiv = document.createElement("div");
                statusDiv.className = "fcdl_progress_status";
                statusDiv.innerHTML = `${successful} / ${imageLinks.length} (${sizeInMB} MB)`;
                container.appendChild(statusDiv);

                console.log(`[fcdl] ${message}`);
            }, 1000);

        } catch (error) {
            console.error('[fcdl] Error creating ZIP:', error);
            document.body.removeChild(progressIndicator);
            alert(`❌ Error creating ZIP file:\n${error.message}`);
        }
        */
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
