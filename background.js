// Background script for the Stock Market Analysis extension

// This is a minimal background script that just keeps the service worker alive
console.log("Background script loaded");

// Keep a simple listener to ensure the service worker stays active
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  console.log("Background script received message:", request);

  if (request.action === "ping") {
    sendResponse({ status: "alive" });
  }

  return true;
});
