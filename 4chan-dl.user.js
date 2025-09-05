// ==UserScript==
// @name         4chan-dl
// @namespace    0000xFFFF
// @version      1.0
// @description  Download all images from 4chan
// @author       0000xFFFF
// @match        http://www.4chan.org/*
// @match        http://boards.4chan.org/*
// @match        http://www.4channel.org/*
// @match        http://boards.4channel.org/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
    const config = {
        useOriginalNames: true,
        usePostIds: false,
        combineNames: false,
        skipExisting: true,
        maxConcurrentDownloads: 3
    };

    // Create download button
    function createDownloadButton() {
        const button = document.createElement('button');
        button.innerHTML = '📥 Download All Images';
        button.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 9999;
            padding: 10px 15px;
            background: #0f4c75;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
        `;

        // Hover effect
        button.addEventListener('mouseenter', () => {
            button.style.background = '#1e6ba8';
            button.style.transform = 'translateY(-1px)';
        });

        button.addEventListener('mouseleave', () => {
            button.style.background = '#0f4c75';
            button.style.transform = 'translateY(0)';
        });

        return button;
    }

    // Create progress indicator
    function createProgressIndicator() {
        const progressContainer = document.createElement('div');
        progressContainer.style.cssText = `
            position: fixed;
            top: 60px;
            right: 10px;
            z-index: 9999;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 10px;
            border-radius: 5px;
            min-width: 200px;
            display: none;
        `;

        const progressText = document.createElement('div');
        progressText.id = 'download-progress-text';
        progressText.textContent = 'Preparing download...';

        const progressBar = document.createElement('div');
        progressBar.style.cssText = `
            width: 100%;
            height: 6px;
            background: #333;
            border-radius: 3px;
            margin-top: 5px;
            overflow: hidden;
        `;

        const progressFill = document.createElement('div');
        progressFill.id = 'download-progress-fill';
        progressFill.style.cssText = `
            height: 100%;
            background: #4CAF50;
            width: 0%;
            transition: width 0.3s ease;
        `;

        progressBar.appendChild(progressFill);
        progressContainer.appendChild(progressText);
        progressContainer.appendChild(progressBar);

        return progressContainer;
    }

    // Find all image links (adapt this selector for your site's structure)
    function findImageLinks() {
        const imageLinks = [];
        
        // Look for divs with class 'fileText' (4chan-like structure)
        const fileTexts = document.querySelectorAll('div.fileText');
        
        fileTexts.forEach((fileDiv, index) => {
            const link = fileDiv.querySelector('a');
            if (link && link.href) {
                const url = link.href.startsWith('//') ? 'https:' + link.href : link.href;
                
                // Extract filename information
                const postId = url.split('/').pop();
                const originalName = link.textContent.trim() || link.title || postId;
                
                imageLinks.push({
                    url: url,
                    originalName: originalName,
                    postId: postId,
                    index: index + 1
                });
            }
        });

        // Fallback: look for direct image links
        if (imageLinks.length === 0) {
            const imgElements = document.querySelectorAll('img[src*="jpg"], img[src*="jpeg"], img[src*="png"], img[src*="gif"], img[src*="webp"]');
            imgElements.forEach((img, index) => {
                const url = img.src;
                const filename = url.split('/').pop();
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

    // Generate filename based on configuration
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

        // Sanitize filename
        filename = filename.replace(/[<>:"/\\|?*]/g, '_');
        
        return filename;
    }

    // Download a single file
    async function downloadFile(imageData, filename) {
        try {
            const response = await fetch(imageData.url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const blob = await response.blob();
            
            // Create download link
            const downloadLink = document.createElement('a');
            downloadLink.href = URL.createObjectURL(blob);
            downloadLink.download = filename;
            downloadLink.style.display = 'none';
            
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            
            // Clean up object URL
            setTimeout(() => URL.revokeObjectURL(downloadLink.href), 1000);
            
            return { success: true, filename: filename };
        } catch (error) {
            console.error(`Failed to download ${imageData.url}:`, error);
            return { success: false, filename: filename, error: error.message };
        }
    }

    // Update progress indicator
    function updateProgress(current, total, filename = '') {
        const progressText = document.getElementById('download-progress-text');
        const progressFill = document.getElementById('download-progress-fill');
        
        if (progressText && progressFill) {
            const percentage = Math.round((current / total) * 100);
            progressText.textContent = `Downloading ${current}/${total} - ${filename}`;
            progressFill.style.width = `${percentage}%`;
        }
    }

    // Main download function
    async function downloadAllImages() {
        const imageLinks = findImageLinks();
        
        if (imageLinks.length === 0) {
            alert('No images found on this page!');
            return;
        }

        const progressIndicator = createProgressIndicator();
        document.body.appendChild(progressIndicator);
        progressIndicator.style.display = 'block';

        console.log(`Found ${imageLinks.length} images to download`);
        
        let completed = 0;
        let successful = 0;
        const downloadedFilenames = new Set();

        // Process downloads with concurrency limit
        const downloadQueue = [...imageLinks];
        const activeDownloads = new Set();

        const processNext = async () => {
            if (downloadQueue.length === 0 || activeDownloads.size >= config.maxConcurrentDownloads) {
                return;
            }

            const imageData = downloadQueue.shift();
            let filename = generateFilename(imageData);
            
            // Handle duplicate filenames
            let counter = 1;
            const originalFilename = filename;
            while (downloadedFilenames.has(filename)) {
                const [name, ext] = originalFilename.split('.').length > 1 
                    ? [originalFilename.substring(0, originalFilename.lastIndexOf('.')), originalFilename.substring(originalFilename.lastIndexOf('.'))]
                    : [originalFilename, ''];
                filename = `${name}_${counter}${ext}`;
                counter++;
            }
            
            downloadedFilenames.add(filename);
            activeDownloads.add(imageData);

            updateProgress(completed + 1, imageLinks.length, filename);

            try {
                const result = await downloadFile(imageData, filename);
                if (result.success) {
                    successful++;
                    console.log(`✓ Downloaded: ${result.filename}`);
                } else {
                    console.error(`✗ Failed: ${result.filename} - ${result.error}`);
                }
            } catch (error) {
                console.error(`✗ Error downloading ${filename}:`, error);
            } finally {
                completed++;
                activeDownloads.delete(imageData);
                
                // Start next download
                processNext();
                
                // Check if all downloads are complete
                if (completed === imageLinks.length) {
                    setTimeout(() => {
                        progressIndicator.style.display = 'none';
                        document.body.removeChild(progressIndicator);
                        
                        const message = `Download complete!\n\nTotal: ${imageLinks.length}\nSuccessful: ${successful}\nFailed: ${imageLinks.length - successful}`;
                        alert(message);
                        console.log(message);
                    }, 1000);
                }
            }
        };

        // Start initial downloads
        for (let i = 0; i < config.maxConcurrentDownloads && i < imageLinks.length; i++) {
            processNext();
        }
    }

    // Initialize the userscript
    function init() {
        // Wait for page to load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }

        const downloadButton = createDownloadButton();
        downloadButton.addEventListener('click', downloadAllImages);
        document.body.appendChild(downloadButton);

        console.log('Image Downloader userscript loaded');
    }

    // Start the script
    init();

})();
