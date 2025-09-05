// ==UserScript==
// @name         4chan-dl
// @namespace    0000xFFFF
// @version      1.1
// @description  Download all content from 4chan.
// @author       0000xFFFF
// @match        *://boards.4chan.org/*/thread/*
// @match        *://boards.4channel.org/*/thread/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
// @grant        none
// @icon         data:image/ico;base64,AAABAAEAEBAAAAEAIAC+AAAAFgAAAIlQTkcNChoKAAAADUlIRFIAAAAQAAAAEAgGAAAAH/P/YQAAAIVJREFUeJxjYMAO/uPARIP/aWeMUTAxBqDYhsMAnK7BUIzNAEIuItoA2rmArDBQOWcoikWSGAP+a50ylcAwBF0jLoPgmrG5hGTNMMAsyELQCyzCrDgTFFhhIpJidM2JBFIlXEMilkBLICJZo8Q3sndAzkaWw2UAA5IEmNa7qCcGwtjkqAYAtUIYeAqEFoUAAAAASUVORK5CYII=

// ==/UserScript==
(function() {
    'use strict';

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
        useOriginalNames: loadSetting("useOriginalNames", true),
        usePostIds: loadSetting("usePostIds", false),
        combineNames: loadSetting("combineNames", false),
        maxConcurrentDownloads: loadSetting("maxConcurrentDownloads", 5)
    };

    function createDownloadButton() {
        const button = document.createElement('button');
        button.id = "4chan_dl_button";
        button.innerHTML = '📦 Download All as ZIP';
        button.style.cssText = `
            z-index: 9999;
            padding: 12px 18px;
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
        `;

        // Hover effect
        button.addEventListener('mouseenter', () => {
            button.style.background = '#4a7c21';
            button.style.transform = 'translateY(-2px)';
            button.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
        });

        button.addEventListener('mouseleave', () => {
            button.style.background = '#2d5016';
            button.style.transform = 'translateY(0)';
            button.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
        });

        return button;
    }

    function createSettings(parent) {

        const container = document.createElement('div');
        container.style.cssText = `
            display: flex;
            gap: 10px;
            margin-top: 10px;
            justify-content: flex-end;
            align-items: center;
        `;

        const closeButton = document.createElement('button');
        closeButton.innerHTML = '❌ Close';
        closeButton.style.cssText = `
            z-index: 9999;
            padding: 5px 10px;
            background: #230016;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 10px;
            font-weight: bold;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
            white-space: nowrap;
        `;

        closeButton.addEventListener('mouseenter', () => {
            closeButton.style.background = '#4d0016';
            closeButton.style.transform = 'translateY(-2px)';
            closeButton.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
        });

        closeButton.addEventListener('mouseleave', () => {
            closeButton.style.background = '#230016';
            closeButton.style.transform = 'translateY(0)';
            closeButton.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
        });

        closeButton.addEventListener('click', function() {
            parent.style.display = 'none';
        });

        const originalNamesInput = document.createElement('input');
        originalNamesInput.type = 'radio';
        originalNamesInput.id = 'radioOriginalNames';
        originalNamesInput.name = 'filenameOption';
        originalNamesInput.checked = config.useOriginalNames;
        originalNamesInput.style.cssText = `
            cursor: pointer;
        `;
        originalNamesInput.title = 'Use the original filenames from the posts.';
        originalNamesInput.addEventListener('change', () => {
            if (originalNamesInput.checked) {
                saveSetting("useOriginalNames", true);
                saveSetting("usePostIds", false);
                saveSetting("combineNames", false);
                config.useOriginalNames = true;
                config.usePostIds = false;
                config.combineNames = false;
            }
        });

        const postIdsInput = document.createElement('input');
        postIdsInput.type = 'radio';
        postIdsInput.id = 'radioPostIds';
        postIdsInput.name = 'filenameOption';
        postIdsInput.checked = config.usePostIds;
        postIdsInput.style.cssText = `
            cursor: pointer;
        `;
        postIdsInput.title = 'Use post IDs as filenames.';
        postIdsInput.addEventListener('change', () => {
            if (postIdsInput.checked) {
                saveSetting("useOriginalNames", false);
                saveSetting("usePostIds", true);
                saveSetting("combineNames", false);
                config.useOriginalNames = false;
                config.usePostIds = true;
                config.combineNames = false;
            }
        });

        const combineNamesInput = document.createElement('input');
        combineNamesInput.type = 'radio';
        combineNamesInput.id = 'radioCombineNames';
        combineNamesInput.name = 'filenameOption';
        combineNamesInput.checked = config.combineNames;
        combineNamesInput.style.cssText = `
            cursor: pointer;
        `;
        combineNamesInput.title = 'Combine post IDs and original filenames.';
        combineNamesInput.addEventListener('change', () => {
            if (combineNamesInput.checked) {
                saveSetting("useOriginalNames", false);
                saveSetting("usePostIds", false);
                saveSetting("combineNames", true);
                config.useOriginalNames = false;
                config.usePostIds = false;
                config.combineNames = true;
            }
        });

        container.appendChild(closeButton);
        container.appendChild(originalNamesInput);
        container.appendChild(postIdsInput);
        container.appendChild(combineNamesInput);

        return container;
    }

    function createProgressIndicator() {
        const progressContainer = document.createElement('div');
        progressContainer.style.cssText = `
            position: fixed;
            bottom: 65px;
            right: 10px;
            z-index: 9999;
            background: rgba(0,0,0,0.9);
            color: white;
            padding: 15px;
            border-radius: 8px;
            min-width: 280px;
            display: none;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        `;

        const progressText = document.createElement('div');
        progressText.id = 'zip-progress-text';
        progressText.style.cssText = `
            font-size: 13px;
            margin-bottom: 8px;
            font-weight: 500;
        `;
        progressText.textContent = 'Preparing download...';

        const progressBar = document.createElement('div');
        progressBar.style.cssText = `
            width: 100%;
            height: 8px;
            background: #333;
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 5px;
        `;

        const progressFill = document.createElement('div');
        progressFill.id = 'zip-progress-fill';
        progressFill.style.cssText = `
            height: 100%;
            background: linear-gradient(90deg, #4CAF50, #45a049);
            width: 0%;
            transition: width 0.3s ease;
            border-radius: 4px;
        `;

        const progressPercent = document.createElement('div');
        progressPercent.id = 'zip-progress-percent';
        progressPercent.style.cssText = `
            font-size: 11px;
            text-align: center;
            color: #ccc;
        `;
        progressPercent.textContent = '0%';

        progressBar.appendChild(progressFill);
        progressContainer.appendChild(progressText);
        progressContainer.appendChild(progressBar);
        progressContainer.appendChild(progressPercent);

        return progressContainer;
    }

    function findImageLinks() {
        const imageLinks = [];
        const fileTexts = document.querySelectorAll('div.fileText');

        fileTexts.forEach((fileDiv, index) => {
            const link = fileDiv.querySelector('a');
            if (link && link.href) {
                const url = link.href.startsWith('//') ? 'https:' + link.href : link.href;

                const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg|webm)(\?|$)/i.test(url);
                if (isImage) {
                    const postId = url.split('/').pop().split('?')[0];
                    const originalName = link.title.trim() || link.textContent.trim() || postId;

                    imageLinks.push({
                        url: url,
                        originalName: originalName,
                        postId: postId,
                        index: index + 1
                    });
                }
            }
        });

        if (imageLinks.length === 0) {
            const imgElements = document.querySelectorAll('img[src*="jpg"], img[src*="jpeg"], img[src*="png"], img[src*="gif"], img[src*="webp"], img[src*="bmp"]');
            imgElements.forEach((img, index) => {
                const url = img.src;
                const filename = url.split('/').pop().split('?')[0];
                imageLinks.push({
                    url: url,
                    originalName: filename,
                    postId: filename,
                    index: index + 1
                });
            });
        }

        return imageLinks;
    }

    function generateFilename(imageData) {
        let filename;

        if (config.usePostIds) {
            filename = imageData.postId;
        } else if (config.combineNames) {
            const postIdBase = imageData.postId.split('.')[0];
            filename = `${postIdBase}_${imageData.originalName}`;
        } else {
            filename = imageData.originalName;
        }

        filename = filename.replace(/[<>:"/\\|?*]/g, '_');

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

    async function downloadAllImagesAsZip() {
        const imageLinks = findImageLinks();

        if (imageLinks.length === 0) {
            alert('No images found on this page!\n\nMake sure your page has images in div.fileText elements or direct img tags.');
            return;
        }

        const progressIndicator = createProgressIndicator();
        document.body.appendChild(progressIndicator);
        progressIndicator.style.display = 'block';

        console.log(`Found ${imageLinks.length} images to download`);

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
                const response = await fetch(imageData.url);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status} - ${response.statusText}`);
                }

                const blob = await response.blob();
                zip.file(filename, blob);
                successful++;
                console.log(`✓ Added to ZIP: ${filename}`);
                return { success: true, filename };
            } catch (error) {
                console.error(`✗ Failed to download ${imageData.url}:`, error);
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

            const zipBlob = await zip.generateAsync({
                type: "blob",
                compression: "DEFLATE",
                compressionOptions: {
                    level: 6
                }
            });

            const now = new Date();
            const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
            const pageTitle = document.title.replace(/[<>:"/\\|?*]/g, '_').slice(0, 50);
            const zipFilename = `${pageTitle || 'images'}_${timestamp}.zip`;

            updateProgress(completed, imageLinks.length, 'Downloading ZIP', zipFilename);

            const downloadLink = document.createElement('a');
            downloadLink.href = URL.createObjectURL(zipBlob);
            downloadLink.download = zipFilename;
            downloadLink.style.display = 'none';

            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);

            setTimeout(() => URL.revokeObjectURL(downloadLink.href), 5000);

            setTimeout(() => {
                progressIndicator.style.display = 'none';
                document.body.removeChild(progressIndicator);

                const sizeInMB = (zipBlob.size / (1024 * 1024)).toFixed(2);
                const message = `✅ ZIP Download Complete!\n\n` +
                    `📁 File: ${zipFilename}\n` +
                    `📊 Total images: ${imageLinks.length}\n` +
                    `✅ Successful: ${successful}\n` +
                    `❌ Failed: ${imageLinks.length - successful}\n` +
                    `💾 ZIP size: ${sizeInMB} MB`;

                alert(message);
                console.log(message);
            }, 1000);

        } catch (error) {
            console.error('Error creating ZIP:', error);
            progressIndicator.style.display = 'none';
            document.body.removeChild(progressIndicator);
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
                containerDiv.style.cssText = `
                    background-color: rgba(0, 0, 0, 0.4);
                    position: fixed;
                    bottom: 10px;
                    right: 10px;
                    z-index: 9999;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    padding: 10px;
                    border-radius: 20px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                `;

                const settingsContainer = createSettings(containerDiv);
                const downloadButton = createDownloadButton();

                downloadButton.addEventListener('click', downloadAllImagesAsZip);

                containerDiv.appendChild(downloadButton);
                containerDiv.appendChild(settingsContainer);
                document.body.appendChild(containerDiv);

                const imageLinks = findImageLinks();
                console.log(`Found ${imageLinks.length} images on page:`, imageLinks);

                document.getElementById("4chan_dl_button").innerHTML = `📦 Download All (${imageLinks.length}) as ZIP`;

            } catch (error) {
                console.error('Error initializing userscript:', error);
            }
        }, 500);
    }

    init();

})();
