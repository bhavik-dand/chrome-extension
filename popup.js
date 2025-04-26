// Popup script for the StockFlo Analyzer extension

document.addEventListener('DOMContentLoaded', function() {
  console.log("StockFlo Analyzer popup loaded");

  // Get DOM elements
  const fetchTickersBtn = document.getElementById('fetchTickersBtn');
  const openFinvizBtn = document.getElementById('openFinvizBtn');
  const finvizStatusDiv = document.getElementById('finviz-status');

  const manualSymbolInput = document.getElementById('manual-symbol');
  const addSymbolButton = document.getElementById('add-symbol');
  const selectedSymbolsList = document.getElementById('selected-symbols');
  const workflowSelect = document.getElementById('workflow-select');
  const analyzeButton = document.getElementById('analyze-button');
  const statusMessage = document.getElementById('status-message');
  const executionStatus = document.getElementById('execution-status');
  const statusValue = document.getElementById('status-value');
  const startedAt = document.getElementById('started-at');
  const completedAt = document.getElementById('completed-at');
  const progressIndicator = document.getElementById('progress-indicator');
  const viewResultsButton = document.getElementById('view-results');

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

  // Initialize the workflow select with the default workflow
  initializeWorkflowSelect();

  // Load detected symbols from the current page
  loadDetectedSymbols();

  // Check for existing analysis when popup opens
  checkExistingAnalysis();

  // Add event listener for manual symbol input
  addSymbolButton.addEventListener('click', function() {
    addManualSymbol();
  });

  // Add event listener for Enter key in the input field
  manualSymbolInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      addManualSymbol();
    }
  });

  // Add event listener for analyze button
  analyzeButton.addEventListener('click', function() {
    analyzeSymbols();
  });

  // Add event listener for view results button
  viewResultsButton.addEventListener('click', function() {
    viewResults();
  });

  // Listen for execution updates
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.action === "executionUpdate") {
      updateExecutionUI(message.execution);
    }
  });

  // Function to initialize the workflow select
  function initializeWorkflowSelect() {
    // For now, we'll just use the hardcoded workflow ID from the guide
    workflowSelect.innerHTML = '';
    const option = document.createElement('option');
    option.value = '680ca7a6de5db7c5d782e44b';
    option.textContent = 'Default StockFlo Analysis';
    workflowSelect.appendChild(option);

    // In a future version, we could fetch available workflows from the API
    // For now, we'll use the hardcoded workflow ID from the guide

    // Update the analyze button state
    updateAnalyzeButton();
  }

  // Function to load detected symbols from the current page
  function loadDetectedSymbols() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      const currentTab = tabs[0];

      // Check if we're on a supported financial website
      const supportedSites = ['finviz.com', 'finance.yahoo.com', 'marketwatch.com', 'investing.com'];
      const isFinancialSite = supportedSites.some(site => currentTab.url.includes(site));

      if (isFinancialSite) {
        showStatus('Detecting symbols on page...', 'loading');

        // Send a message to the content script to detect symbols
        chrome.tabs.sendMessage(currentTab.id, { action: "detectSymbols" }, function(response) {
          if (chrome.runtime.lastError) {
            console.error("Error communicating with content script:", chrome.runtime.lastError);

            // Try injecting the content script
            chrome.scripting.executeScript({
              target: { tabId: currentTab.id },
              files: ['content.js']
            }).then(() => {
              // Try again after injecting
              setTimeout(() => {
                chrome.tabs.sendMessage(currentTab.id, { action: "detectSymbols" }, function(response) {
                  if (response && response.symbols) {
                    handleDetectedSymbols(response.symbols);
                  } else {
                    showStatus('No symbols detected on this page.', 'warning');
                  }
                });
              }, 500);
            }).catch(err => {
              console.error("Error injecting content script:", err);
              showStatus('Error detecting symbols.', 'error');
            });

            return;
          }

          if (response && response.symbols) {
            handleDetectedSymbols(response.symbols);
          } else {
            showStatus('No symbols detected on this page.', 'warning');
          }
        });
      } else {
        showStatus('Navigate to a financial website to detect symbols.', 'info');
      }
    });
  }

  // Function to handle detected symbols
  function handleDetectedSymbols(symbols) {
    if (symbols.length > 0) {
      showStatus(`Detected ${symbols.length} symbols on the page.`, 'success');

      // Add each symbol to the list
      symbols.forEach(symbol => {
        addSymbolToList(symbol);
      });
    } else {
      showStatus('No symbols detected on this page.', 'warning');
    }
  }

  // Function to add a manual symbol
  function addManualSymbol() {
    const symbol = manualSymbolInput.value.trim().toUpperCase();

    if (symbol) {
      if (/^[A-Z0-9.-]{1,5}$/.test(symbol)) {
        addSymbolToList(symbol);
        manualSymbolInput.value = '';
        showStatus(`Added symbol: ${symbol}`, 'success');
      } else {
        showStatus('Invalid symbol format. Use 1-5 characters (letters, numbers, dots, or hyphens).', 'error');
      }
    }
  }

  // Function to add a symbol to the list
  function addSymbolToList(symbol) {
    // Check if symbol already exists
    const existingSymbols = Array.from(selectedSymbolsList.querySelectorAll('li')).map(li => li.dataset.symbol);
    if (existingSymbols.includes(symbol)) {
      return;
    }

    const li = document.createElement('li');
    li.dataset.symbol = symbol;
    li.innerHTML = `
      <span>${symbol}</span>
      <button class="remove-symbol">✕</button>
    `;

    li.querySelector('.remove-symbol').addEventListener('click', () => {
      li.remove();
      updateAnalyzeButton();
    });

    selectedSymbolsList.appendChild(li);
    updateAnalyzeButton();
  }

  // Function to analyze symbols
  function analyzeSymbols() {
    const workflowId = workflowSelect.value;
    const symbols = Array.from(selectedSymbolsList.querySelectorAll('li')).map(li => li.dataset.symbol);

    if (!workflowId) {
      showStatus('Please select a workflow', 'error');
      return;
    }

    if (symbols.length === 0) {
      showStatus('Please select at least one symbol', 'error');
      return;
    }

    // Disable the button and show loading status
    analyzeButton.disabled = true;
    showStatus('Analyzing symbols...', 'loading');

    chrome.runtime.sendMessage({
      action: "analyzeSymbols",
      workflowId,
      symbols
    }, function(result) {
      if (chrome.runtime.lastError) {
        console.error("Error sending message to background script:", chrome.runtime.lastError);
        showStatus(`Error: ${chrome.runtime.lastError.message}`, 'error');
        analyzeButton.disabled = false;
        return;
      }

      if (result.error) {
        showStatus(`Error: ${result.error}`, 'error');
        analyzeButton.disabled = false;
      } else {
        showStatus(`Analysis started! Execution ID: ${result.execution_id}`, 'success');

        // Start polling for results
        startPolling(result.execution_id);
      }
    });
  }

  // Function to start polling for results
  function startPolling(executionId) {
    chrome.runtime.sendMessage({
      action: "startPolling",
      executionId,
      interval: 2000, // 2 seconds
      maxAttempts: 30 // 1 minute max
    });

    // Show the execution status UI
    executionStatus.style.display = 'block';

    // Update the UI with initial values
    updateExecutionUI({
      status: 'running',
      started_at: new Date().toISOString()
    });
  }

  // Function to update the execution UI
  function updateExecutionUI(execution) {
    // Update status
    statusValue.textContent = execution.status.charAt(0).toUpperCase() + execution.status.slice(1);
    statusValue.className = execution.status;

    // Update timestamps
    if (execution.started_at) {
      startedAt.textContent = new Date(execution.started_at).toLocaleString();
    }

    if (execution.completed_at) {
      completedAt.textContent = new Date(execution.completed_at).toLocaleString();
    } else {
      completedAt.textContent = '-';
    }

    // Update progress indicator
    if (execution.status === 'completed') {
      progressIndicator.style.width = '100%';
      viewResultsButton.disabled = false;
    } else if (execution.status === 'failed') {
      progressIndicator.style.width = '100%';
      progressIndicator.className = 'failed';
    } else {
      // Simulate progress for running status
      const currentWidth = parseInt(progressIndicator.style.width) || 0;
      progressIndicator.style.width = Math.min(currentWidth + 5, 90) + '%';
    }
  }

  // Function to view results
  function viewResults() {
    chrome.storage.local.get(['currentAnalysis'], function(data) {
      if (data.currentAnalysis && data.currentAnalysis.executionId) {
        chrome.tabs.create({
          url: `http://localhost:8000/executions/${data.currentAnalysis.executionId}`
        });
      }
    });
  }

  // Function to check for existing analysis
  function checkExistingAnalysis() {
    chrome.storage.local.get(['currentAnalysis'], function(data) {
      if (data.currentAnalysis) {
        const { executionId, status, startedAt, completedAt } = data.currentAnalysis;

        // Show the execution status UI if there's an ongoing or recent analysis
        if (status === 'running' || (completedAt && new Date(completedAt) > new Date(Date.now() - 3600000))) {
          executionStatus.style.display = 'block';

          updateExecutionUI({
            status,
            started_at: startedAt,
            completed_at: completedAt
          });

          // Resume polling if the analysis is still running
          if (status === 'running') {
            startPolling(executionId);
          }
        }
      }
    });
  }

  // Function to show status messages
  function showStatus(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = `status ${type}`;
  }

  // Function to update the analyze button state
  function updateAnalyzeButton() {
    const hasWorkflow = workflowSelect.value !== '';
    const hasSymbols = selectedSymbolsList.querySelectorAll('li').length > 0;

    analyzeButton.disabled = !(hasWorkflow && hasSymbols);
  }

  // Function to open Finviz and fetch tickers
  function openFinvizAndFetchTickers() {
    finvizStatusDiv.textContent = 'Checking for Finviz...';
    finvizStatusDiv.className = 'status loading';

    // Check if we're already on a Finviz page
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      const currentTab = tabs[0];

      if (currentTab.url && currentTab.url.includes('finviz.com')) {
        // Already on a Finviz page, just execute the content script
        finvizStatusDiv.textContent = 'Already on Finviz. Check console for tickers.';
        finvizStatusDiv.className = 'status success';

        // Send a message to the content script to fetch tickers
        chrome.tabs.sendMessage(currentTab.id, { action: "fetchFinvizTickers" }, function(response) {
          if (chrome.runtime.lastError) {
            console.error("Error communicating with content script:", chrome.runtime.lastError);

            // Try injecting the content script
            chrome.scripting.executeScript({
              target: { tabId: currentTab.id },
              func: () => { window.stockFloAnalyzerRun = false; }
            }).then(() => {
              // Then execute the content script on the current tab
              return chrome.scripting.executeScript({
                target: { tabId: currentTab.id },
                files: ['content.js']
              });
            }).then(() => {
              // Try again after injecting
              setTimeout(() => {
                chrome.tabs.sendMessage(currentTab.id, { action: "fetchFinvizTickers" }, function(response) {
                  if (response && response.symbols) {
                    // Add the symbols to the list for StockFlo analysis
                    handleDetectedSymbols(response.symbols);
                  }
                });
              }, 500);
            }).catch(err => {
              console.error("Error executing content script:", err);
              finvizStatusDiv.textContent = 'Error: ' + err.message;
              finvizStatusDiv.className = 'status error';
            });

            return;
          }

          if (response && response.symbols) {
            // Add the symbols to the list for StockFlo analysis
            handleDetectedSymbols(response.symbols);
          }
        });
      } else {
        // Not on Finviz, open a new tab
        finvizStatusDiv.textContent = 'Opening Finviz...';

        // Open Finviz in a new tab - using the default screener
        chrome.tabs.create({
          url: 'https://finviz.com/screener.ashx',
          active: true // Make the tab active so user can see it
        }, function() {
          finvizStatusDiv.textContent = 'Finviz opened. Check console for tickers.';
          finvizStatusDiv.className = 'status success';
        });
      }
    });
  }
});
