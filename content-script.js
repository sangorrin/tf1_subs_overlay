/**
 * TF1 Subs Overlay - Content Script
 * Detects the shaka-text-container and polls every 1s until it's found
 */

let detectionInterval = null;
let detected = false;

// Log which frame we're running in
const currentURL = window.location.href;
const isIframe = window.self !== window.top;
const isPlayerIframe = currentURL.includes('prod-player.tf1.fr');
const isMainPage = currentURL.includes('www.tf1.fr') && !isPlayerIframe;

console.log('[TF1 Subs] Running in:', currentURL);
console.log('[TF1 Subs] Is iframe:', isIframe);
console.log('[TF1 Subs] Is player iframe:', isPlayerIframe);
console.log('[TF1 Subs] Is main page:', isMainPage);

// ===== MAIN PAGE LOGIC =====
// Listen for messages from iframe and display overlay
if (isMainPage) {
  console.log('[TF1 Subs] 🟢 MAIN PAGE SCRIPT ACTIVE - Setting up message listener');

  let overlay = null;

  function createOverlayInMainPage() {
    if (overlay) {
      console.log('[TF1 Subs] Overlay already exists, reusing it');
      return overlay;
    }

    console.log('[TF1 Subs] Creating new overlay...');
    overlay = document.createElement('div');
    overlay.id = 'tf1-subs-overlay';
    overlay.style.cssText = `
      position: absolute;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      display: inline-block;
      pointer-events: auto;
      z-index: 999999;
      font-family: Tahoma, Geneva, sans-serif;
      font-size: 24px;
      font-weight: 400;
      line-height: 1.4;
      color: white;
      background-color: rgba(0, 0, 0, 0.65);
      border-radius: 6px;
      padding: 12px 20px;
      text-align: center;
      max-width: 85%;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
      cursor: text;
      user-select: text;
    `;

    // Add hover listeners for pause/resume functionality
    // Send messages to iframe since we can't access it directly due to cross-origin
    overlay.addEventListener('mouseenter', () => {
      console.log('[TF1 Subs] Mouse entered overlay - sending pause request to iframe');
      const iframeElement = document.querySelector('iframe[src*="prod-player.tf1.fr"]');
      if (iframeElement && iframeElement.contentWindow) {
        iframeElement.contentWindow.postMessage({
          type: 'TF1_SUBS_PAUSE'
        }, '*');
      }
    });

    overlay.addEventListener('mouseleave', () => {
      console.log('[TF1 Subs] Mouse left overlay - sending resume request to iframe');
      const iframeElement = document.querySelector('iframe[src*="prod-player.tf1.fr"]');
      if (iframeElement && iframeElement.contentWindow) {
        iframeElement.contentWindow.postMessage({
          type: 'TF1_SUBS_RESUME'
        }, '*');
      }
    });

    // Wait for DOM and try to append to #player first, fallback to body
    const tryAppend = () => {
      const playerContainer = document.getElementById('player');
      if (playerContainer) {
        playerContainer.appendChild(overlay);
        console.log('[TF1 Subs] ✓ Overlay appended to #player');
        console.log('[TF1 Subs] Player container:', playerContainer);
      } else {
        document.body.appendChild(overlay);
        console.log('[TF1 Subs] ⚠️ Overlay appended to body (fallback - #player not found)');
      }
    };

    if (document.body) {
      tryAppend();
    } else {
      document.addEventListener('DOMContentLoaded', tryAppend);
    }

    return overlay;
  }

  // Listen for messages from the iframe
  console.log('[TF1 Subs] Adding message event listener...');
  window.addEventListener('message', (event) => {
    //console.log('[TF1 Subs] 📨 Message received from:', event.origin, 'Type:', event.data?.type);

    // Security: verify the message is from the player iframe
    if (!event.origin.includes('prod-player.tf1.fr')) {
      //console.log('[TF1 Subs] ❌ Ignoring message - not from player iframe');
      return;
    }

    if (event.data.type === 'TF1_SUBS_UPDATE') {
      console.log('[TF1 Subs] ✅ Received subtitle update:', event.data.text);

      // Create overlay if it doesn't exist
      const overlayElement = createOverlayInMainPage();

      console.log('[TF1 Subs] Overlay element:', overlayElement);
      console.log('[TF1 Subs] Overlay in DOM:', document.contains(overlayElement));

      // Check if subtitle text is empty or just dots
      const subtitleText = event.data.text.trim();
      if (subtitleText === '' || subtitleText === '...') {
        // Hide overlay when there's no text or just dots
        overlayElement.style.display = 'none';
        console.log('[TF1 Subs] Overlay hidden (empty subtitle or dots)');
      } else {
        // Show overlay and update text
        overlayElement.style.display = 'inline-block';
        overlayElement.textContent = subtitleText;
        console.log('[TF1 Subs] ✓ Overlay text updated and displayed');
      }
    }
  });

  console.log('[TF1 Subs] Message listener installed!');

// ===== IFRAME LOGIC =====
// Detect subtitle container and send updates to parent
} else {
  console.log('[TF1 Subs] Starting detection in player iframe...');

  // Listen for pause/resume messages from parent
  window.addEventListener('message', (event) => {
    // Accept messages from parent window
    if (event.data.type === 'TF1_SUBS_PAUSE') {
      console.log('[TF1 Subs] Received pause request');
      const videoElement = document.getElementById('ntrs-video-media');
      if (videoElement && typeof videoElement.pause === 'function') {
        videoElement.pause();
        console.log('[TF1 Subs] ✓ Video paused');
      }
    } else if (event.data.type === 'TF1_SUBS_RESUME') {
      console.log('[TF1 Subs] Received resume request');
      const videoElement = document.getElementById('ntrs-video-media');
      if (videoElement && typeof videoElement.play === 'function') {
        videoElement.play();
        console.log('[TF1 Subs] ✓ Video resumed');
      }
    }
  });

  function setupMutationObserver(subtitleContainer) {
    let lastContent = subtitleContainer.textContent.trim();
    console.log('[TF1 Subs] Initial subtitle content:', lastContent);

    const observer = new MutationObserver(mutationsList => {
      const currentContent = subtitleContainer.textContent.trim();
      if (currentContent !== lastContent) {
        console.log('[TF1 Subs] Subtitle changed:', currentContent);
        lastContent = currentContent;

        // Send message to parent window
        window.parent.postMessage({
          type: 'TF1_SUBS_UPDATE',
          text: currentContent
        }, '*');

        // Hide the original shaka-text-container
        subtitleContainer.style.display = 'none';
      }
    });

    const config = {
      childList: true,
      subtree: true,
      characterData: true
    };

    observer.observe(subtitleContainer, config);
    console.log('[TF1 Subs] MutationObserver active - sending updates to parent window');

    return observer;
  }

  function pollForSubtitleContainer() {
    const subtitleContainer = document.querySelector('.shaka-text-container');

    if (subtitleContainer && !detected) {
      detected = true;
      console.log('[TF1 Subs] ✓ .shaka-text-container detected!');
      console.log('[TF1 Subs] Container element:', subtitleContainer);

      // Stop polling once detected
      if (detectionInterval) {
        clearInterval(detectionInterval);
        detectionInterval = null;
      }

      // Setup MutationObserver to watch for subtitle changes
      setupMutationObserver(subtitleContainer);

      return;
    }
  }

  // Start polling for the subtitle container
  detectionInterval = setInterval(pollForSubtitleContainer, 1000);

  // Also check immediately in case it's already present
  pollForSubtitleContainer();
}
