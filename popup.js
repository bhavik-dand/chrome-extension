// Popup script for the Stock Market Analysis extension

document.addEventListener('DOMContentLoaded', function() {
  console.log("Popup DOM loaded");

  // Get DOM elements
  const fetchTickersBtn = document.getElementById('fetchTickersBtn');
  const openFinvizBtn = document.getElementById('openFinvizBtn');
  const statusDiv = document.getElementById('status');
  const tickerListDiv = document.getElementById('tickerList');

  // Add event listener for the fetch tickers button
  fetchTickersBtn.addEventListener('click', function() {
    console.log("Fetch tickers button clicked");
    openFinvizAndFetchTickers();
  });

  // Add event listener for the open Finviz button
  openFinvizBtn.addEventListener('click', function() {
    console.log("Open Finviz button clicked");
    chrome.tabs.create({ url: 'https://finviz.com/screener.ashx' });
  });

  // Function to open Finviz and fetch tickers
  function openFinvizAndFetchTickers() {
    statusDiv.textContent = 'Checking for Finviz...';
    statusDiv.className = 'loading';
    tickerListDiv.innerHTML = '';

    // Create a note about checking the console
    const noteElem = document.createElement('div');
    noteElem.innerHTML = '<strong>Important:</strong> Unique tickers will be printed to the console. ' +
                         'Please open the browser console to view them.<br><br>' +
                         'To open the console:<br>' +
                         '1. Right-click anywhere on the page<br>' +
                         '2. Select "Inspect" or "Inspect Element"<br>' +
                         '3. Click on the "Console" tab<br><br>' +
                         '<strong>Note:</strong> Duplicate tickers will be automatically removed, ' +
                         'and the list will be sorted alphabetically for easier reading.';
    noteElem.style.marginTop = '15px';
    noteElem.style.lineHeight = '1.5';
    tickerListDiv.appendChild(noteElem);

    // Check if we're already on a Finviz page
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      const currentTab = tabs[0];

      if (currentTab.url && currentTab.url.includes('finviz.com')) {
        // Already on a Finviz page, just execute the content script
        statusDiv.textContent = 'Already on Finviz. Check console for tickers.';
        statusDiv.className = 'success';

        // First, reset the flag that prevents duplicate execution
        chrome.scripting.executeScript({
          target: { tabId: currentTab.id },
          func: () => { window.finvizTickerScraperRun = false; }
        }).then(() => {
          // Then execute the content script on the current tab
          return chrome.scripting.executeScript({
            target: { tabId: currentTab.id },
            files: ['content.js']
          });
        }).then(() => {
          console.log("Content script executed on current Finviz page");
        }).catch(err => {
          console.error("Error executing content script:", err);
          statusDiv.textContent = 'Error: ' + err.message;
          statusDiv.className = 'error';
        });
      } else {
        // Not on Finviz, open a new tab
        statusDiv.textContent = 'Opening Finviz...';

        // Open Finviz in a new tab - using the default screener
        chrome.tabs.create({
          url: 'https://finviz.com/screener.ashx',
          active: true // Make the tab active so user can see it
        }, function() {
          statusDiv.textContent = 'Finviz opened. Check console for tickers.';
          statusDiv.className = 'success';

          // The content script will automatically run and print tickers to the console
          // No need for additional communication
        });
      }
    });
  }

  // Show initial status
  statusDiv.textContent = 'Ready to fetch tickers';
  statusDiv.className = 'ready';

  // Add initial instructions
  const instructionsElem = document.createElement('div');
  instructionsElem.innerHTML = '<strong>Instructions:</strong><br>' +
                              '1. Navigate to any Finviz screener page with your desired filters<br>' +
                              '2. Click "Fetch Tickers from Current Finviz Page" to extract tickers<br>' +
                              '3. Check the browser console to see the results<br><br>' +
                              'Or click "Open Finviz Screener" to start with a new screener.';
  instructionsElem.style.marginTop = '15px';
  instructionsElem.style.marginBottom = '15px';
  instructionsElem.style.lineHeight = '1.5';
  tickerListDiv.appendChild(instructionsElem);
});
