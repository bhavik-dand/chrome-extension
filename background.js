// Background script for the StockFlo Analyzer extension
console.log("StockFlo Analyzer background script loaded");

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background script received message:", request);

  if (request.action === "analyzeSymbols") {
    analyzeSymbols(request.workflowId, request.symbols)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true; // Required for async sendResponse
  } else if (request.action === "startPolling") {
    const { executionId, interval = 2000, maxAttempts = 30 } = request;
    startPolling(executionId, interval, maxAttempts);
    sendResponse({ success: true });
    return true;
  } else if (request.action === "ping") {
    sendResponse({ status: "alive" });
    return true;
  }
});

// Function to send symbols to the API for analysis
async function analyzeSymbols(workflowId, symbols) {
  try {
    console.log(`Analyzing symbols with workflow ${workflowId}:`, symbols);

    // Get the current tab URL for context
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const sourceUrl = tab.url;

    // Prepare the request payload
    const payload = {
      workflow_id: workflowId,
      symbols: symbols,
      additional_context: {
        source: "chrome_extension",
        source_url: sourceUrl
      }
    };

    console.log("Sending request to StockFlo API:", payload);

    // Send the request to the API
    const response = await fetch('http://localhost:8000/api/v1/chrome-extension/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    // Parse the response
    const result = await response.json();

    console.log("API response:", result);

    // Check for errors
    if (!response.ok) {
      throw new Error(result.error || result.details || 'Failed to analyze symbols');
    }

    // Store the execution ID for polling
    chrome.storage.local.set({
      currentAnalysis: {
        executionId: result.execution_id,
        status: result.status,
        symbols: symbols,
        workflowId: workflowId,
        startedAt: new Date().toISOString()
      }
    });

    return result;
  } catch (error) {
    console.error('Error analyzing symbols:', error);
    throw error;
  }
}

// Function to start polling for execution results
function startPolling(executionId, interval, maxAttempts) {
  console.log(`Starting polling for execution ${executionId}`);

  let attempts = 0;

  const poll = async () => {
    try {
      const execution = await pollExecutionResults(executionId);

      attempts++;

      // Stop polling if execution is complete or failed
      if (execution.status === 'completed' || execution.status === 'failed' || attempts >= maxAttempts) {
        console.log(`Polling complete for execution ${executionId}. Status: ${execution.status}`);
        return;
      }

      // Continue polling
      setTimeout(poll, interval);
    } catch (error) {
      console.error('Polling error:', error);
    }
  };

  // Start the polling process
  poll();
}

// Function to poll for execution results
async function pollExecutionResults(executionId) {
  try {
    console.log(`Polling execution results for ${executionId}`);

    const response = await fetch(`http://localhost:8000/api/workflows/executions/${executionId}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch execution results: ${response.status}`);
    }

    const execution = await response.json();
    console.log(`Execution status: ${execution.status}`);

    // Update the stored analysis with the latest status
    chrome.storage.local.get(['currentAnalysis'], (data) => {
      if (data.currentAnalysis && data.currentAnalysis.executionId === executionId) {
        chrome.storage.local.set({
          currentAnalysis: {
            ...data.currentAnalysis,
            status: execution.status,
            completedAt: execution.completed_at,
            results: execution.results
          }
        });

        // Send a message to the popup to update the UI
        chrome.runtime.sendMessage({
          action: "executionUpdate",
          execution
        });

        // Show a notification when completed
        if (execution.status === 'completed' && data.currentAnalysis.status !== 'completed') {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'images/icon128.png',
            title: 'StockFlo Analysis Complete',
            message: `Analysis of ${data.currentAnalysis.symbols.length} symbols is complete!`,
            buttons: [{ title: 'View Results' }]
          });
        }
      }
    });

    return execution;
  } catch (error) {
    console.error('Error polling execution results:', error);
    throw error;
  }
}

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex === 0) { // "View Results" button
    chrome.storage.local.get(['currentAnalysis'], (data) => {
      if (data.currentAnalysis && data.currentAnalysis.executionId) {
        chrome.tabs.create({
          url: `http://localhost:8000/executions/${data.currentAnalysis.executionId}`
        });
      }
    });
  }
});
