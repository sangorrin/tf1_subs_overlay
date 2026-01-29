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

      // Update overlay text
      overlayElement.textContent = event.data.text;
      console.log('[TF1 Subs] ✓ Overlay text updated');
    }
  });

  console.log('[TF1 Subs] Message listener installed!');

// ===== IFRAME LOGIC =====
// Detect subtitle container and send updates to parent
} else {
  console.log('[TF1 Subs] Starting detection in player iframe...');

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
