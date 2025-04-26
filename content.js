// Content script for detecting stock symbols on financial websites
console.log("StockFlo Analyzer content script loaded");

// Use an immediately invoked function expression (IIFE) to avoid variable name collisions
(function() {
  // Check if we've already run this script to prevent duplicate execution
  if (window.stockFloAnalyzerRun) {
    console.log("StockFlo Analyzer already ran on this page. Skipping duplicate execution.");
    return;
  }

  // Mark that we've run the script
  window.stockFloAnalyzerRun = true;

  // Listen for messages from the popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "detectSymbols") {
      const symbols = detectSymbolsOnPage();
      sendResponse({ symbols });
    } else if (request.action === "fetchFinvizTickers") {
      // Reset the flag to allow re-running the script
      window.finvizTickerScraperRun = false;
      const symbols = fetchFinvizTickers();
      sendResponse({ symbols });
    }
  });

  // Function to detect stock symbols on the page
  function detectSymbolsOnPage() {
    console.log("Detecting symbols on page...");
    const hostname = window.location.hostname;
    let symbols = [];

    // Use a Set to automatically remove duplicates
    const symbolSet = new Set();

    // Different detection strategies based on the website
    if (hostname.includes('finviz.com')) {
      symbols = detectFinvizSymbols(symbolSet);
    } else if (hostname.includes('finance.yahoo.com')) {
      symbols = detectYahooFinanceSymbols(symbolSet);
    } else if (hostname.includes('marketwatch.com')) {
      symbols = detectMarketWatchSymbols(symbolSet);
    } else if (hostname.includes('investing.com')) {
      symbols = detectInvestingSymbols(symbolSet);
    }

    // Convert Set to Array and sort alphabetically
    const sortedSymbols = Array.from(symbolSet).sort();
    console.log("Detected symbols:", sortedSymbols);
    return sortedSymbols;
  }

  // Function to fetch tickers from Finviz and print to console
  function fetchFinvizTickers() {
    // Check if we're on a Finviz page
    if (!window.location.hostname.includes('finviz.com')) {
      console.warn("Not on a Finviz page");
      return [];
    }

    console.log("Scraping tickers from Finviz page...");

    // Use a Set to automatically remove duplicates
    const tickerSet = new Set();

    // Find all ticker elements in the table
    const tickerElements = document.querySelectorAll('a.screener-link-primary');

    if (!tickerElements || tickerElements.length === 0) {
      console.warn("No ticker elements found with primary selector");

      // Try an alternative selector as a fallback
      const alternativeElements = document.querySelectorAll('a[href*="quote.ashx?t="]');
      if (alternativeElements && alternativeElements.length > 0) {
        console.log("Found tickers using alternative selector");

        alternativeElements.forEach(element => {
          // Extract ticker from the href attribute
          const href = element.getAttribute('href');
          const match = href.match(/t=([A-Z]+)/);
          if (match && match[1]) {
            tickerSet.add(match[1]);
          }
        });

        const uniqueTickers = Array.from(tickerSet).sort();
        printTickersToConsole(uniqueTickers);
        return uniqueTickers;
      }

      console.warn("No tickers found on the page");
      return [];
    }

    tickerElements.forEach(element => {
      // Extract ticker from the element and add to Set
      tickerSet.add(element.textContent.trim());
    });

    const uniqueTickers = Array.from(tickerSet).sort();
    printTickersToConsole(uniqueTickers);
    return uniqueTickers;
  }

  // Function to print tickers to console in a formatted way
  function printTickersToConsole(tickers) {
    // Get information about the current page
    const pageInfo = getPageInfo();

    console.log("FINVIZ UNIQUE TICKERS:", tickers);

    // Log the tickers in a more visible format
    if (tickers.length > 0) {
      console.log("%c Finviz Stock Screener Results ", "background: #4CAF50; color: white; font-size: 16px; font-weight: bold; padding: 5px;");
      console.log("%c " + pageInfo + " ", "background: #673AB7; color: white; font-size: 14px; padding: 3px;");

      tickers.forEach((ticker, index) => {
        console.log(`${index + 1}. ${ticker}`);
      });

      console.log(`Total unique tickers found: ${tickers.length}`);
      console.log("%c Note: Duplicates have been removed ", "background: #2196F3; color: white; font-size: 14px; padding: 3px;");
    } else {
      console.log("%c No Finviz Tickers Found ", "background: #F44336; color: white; font-size: 16px; font-weight: bold; padding: 5px;");
      console.log("%c " + pageInfo + " ", "background: #673AB7; color: white; font-size: 14px; padding: 3px;");
      console.log("Make sure you're on a Finviz screener page with stock results.");
    }
  }

  // Function to get information about the current page
  function getPageInfo() {
    // Try to get the screener title or filters
    let pageInfo = "";

    // Try to get the filter information
    const filterElements = document.querySelectorAll('.filters-table td');
    if (filterElements && filterElements.length > 0) {
      const filterTexts = [];
      filterElements.forEach(el => {
        const text = el.textContent.trim();
        if (text && text !== "") {
          filterTexts.push(text);
        }
      });

      if (filterTexts.length > 0) {
        pageInfo = "Filters: " + filterTexts.join(", ");
      }
    }

    // If we couldn't get filter info, just use the URL
    if (!pageInfo) {
      pageInfo = "URL: " + window.location.href;
    }

    return pageInfo;
  }

  // Function to detect symbols on Finviz
  function detectFinvizSymbols(symbolSet) {
    // Find all ticker elements in the table
    // Finviz typically has tickers in <a> tags with class="screener-link-primary"
    const tickerElements = document.querySelectorAll('a.screener-link-primary');

    if (tickerElements && tickerElements.length > 0) {
      tickerElements.forEach(element => {
        const symbol = element.textContent.trim();
        if (symbol && isValidSymbol(symbol)) {
          symbolSet.add(symbol);
        }
      });
    }

    // Try an alternative selector as a fallback
    const alternativeElements = document.querySelectorAll('a[href*="quote.ashx?t="]');
    if (alternativeElements && alternativeElements.length > 0) {
      alternativeElements.forEach(element => {
        // Extract ticker from the href attribute
        const href = element.getAttribute('href');
        const match = href.match(/t=([A-Z]+)/);
        if (match && match[1] && isValidSymbol(match[1])) {
          symbolSet.add(match[1]);
        }
      });
    }

    return Array.from(symbolSet);
  }

  // Function to detect symbols on Yahoo Finance
  function detectYahooFinanceSymbols(symbolSet) {
    // For Yahoo Finance watchlist
    const watchlistItems = document.querySelectorAll('[data-field="symbol"]');
    watchlistItems.forEach(item => {
      const symbol = item.textContent.trim();
      if (symbol && isValidSymbol(symbol)) {
        symbolSet.add(symbol);
      }
    });

    // For Yahoo Finance search results
    const searchResults = document.querySelectorAll('.quote-header-info');
    searchResults.forEach(result => {
      const symbolElement = result.querySelector('h1');
      if (symbolElement) {
        const symbolText = symbolElement.textContent;
        const match = symbolText.match(/\(([A-Z0-9.-]+)\)/);
        if (match && match[1] && isValidSymbol(match[1])) {
          symbolSet.add(match[1]);
        }
      }
    });

    // For Yahoo Finance quote pages
    const quoteSymbol = document.querySelector('[data-symbol]');
    if (quoteSymbol) {
      const symbol = quoteSymbol.getAttribute('data-symbol');
      if (symbol && isValidSymbol(symbol)) {
        symbolSet.add(symbol);
      }
    }

    return Array.from(symbolSet);
  }

  // Function to detect symbols on MarketWatch
  function detectMarketWatchSymbols(symbolSet) {
    // MarketWatch ticker elements
    const tickerElements = document.querySelectorAll('.ticker, .symbol');
    tickerElements.forEach(element => {
      const symbol = element.textContent.trim();
      if (symbol && isValidSymbol(symbol)) {
        symbolSet.add(symbol);
      }
    });

    // MarketWatch quote pages
    const quoteSymbol = document.querySelector('meta[name="ticker"]');
    if (quoteSymbol) {
      const symbol = quoteSymbol.getAttribute('content');
      if (symbol && isValidSymbol(symbol)) {
        symbolSet.add(symbol);
      }
    }

    return Array.from(symbolSet);
  }

  // Function to detect symbols on Investing.com
  function detectInvestingSymbols(symbolSet) {
    // Investing.com ticker elements
    const tickerElements = document.querySelectorAll('[data-symbol], [data-ticker]');
    tickerElements.forEach(element => {
      const symbol = element.getAttribute('data-symbol') || element.getAttribute('data-ticker');
      if (symbol && isValidSymbol(symbol)) {
        symbolSet.add(symbol);
      }
    });

    // Investing.com quote pages
    const instrumentTitle = document.querySelector('.instrumentHeader');
    if (instrumentTitle) {
      const symbolElement = instrumentTitle.querySelector('.symbol');
      if (symbolElement) {
        const symbol = symbolElement.textContent.trim();
        if (symbol && isValidSymbol(symbol)) {
          symbolSet.add(symbol);
        }
      }
    }

    return Array.from(symbolSet);
  }

  // Function to validate a stock symbol
  function isValidSymbol(symbol) {
    // Basic validation: symbols should be 1-5 characters, alphanumeric
    // Some symbols may include dots or hyphens (e.g., BRK.A, BF-B)
    return /^[A-Z0-9.-]{1,5}$/.test(symbol);
  }
})();
