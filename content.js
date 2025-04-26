// Content script for interacting with Finviz pages
console.log("Content script loaded on Finviz page");

// Use an immediately invoked function expression (IIFE) to avoid variable name collisions
// This prevents the "Identifier has already been declared" error when the script runs multiple times
(function() {
  // Check if we've already run this script to prevent duplicate execution
  if (window.finvizTickerScraperRun) {
    console.log("Ticker scraper already ran on this page. Skipping duplicate execution.");
    return;
  }

  // Mark that we've run the script
  window.finvizTickerScraperRun = true;

  // Function to scrape ticker symbols from the current Finviz page
  function scrapeTickersFromPage() {
    console.log("Scraping tickers from Finviz page...");

    // Use a Set to automatically remove duplicates
    const tickerSet = new Set();

    // Find all ticker elements in the table
    // Finviz typically has tickers in <a> tags with class="screener-link-primary"
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

        const uniqueTickers = Array.from(tickerSet);
        console.log("Unique tickers found:", uniqueTickers);
        return uniqueTickers;
      }

      console.warn("No tickers found on the page");
      return [];
    }

    tickerElements.forEach(element => {
      // Extract ticker from the element and add to Set (which automatically removes duplicates)
      tickerSet.add(element.textContent.trim());
    });

    const uniqueTickers = Array.from(tickerSet);
    console.log("Unique tickers found:", uniqueTickers);
    return uniqueTickers;
  }

  // Get information about the current page
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

  // Execute the scraping immediately when the script runs on a Finviz page
  const tickers = scrapeTickersFromPage();
  const pageInfo = getPageInfo();
  console.log("FINVIZ UNIQUE TICKERS:", tickers);

  // Log the tickers in a more visible format
  if (tickers.length > 0) {
    console.log("%c Finviz Stock Screener Results ", "background: #4CAF50; color: white; font-size: 16px; font-weight: bold; padding: 5px;");
    console.log("%c " + pageInfo + " ", "background: #673AB7; color: white; font-size: 14px; padding: 3px;");

    // Sort the tickers alphabetically for better readability
    const sortedTickers = [...tickers].sort();

    sortedTickers.forEach((ticker, index) => {
      console.log(`${index + 1}. ${ticker}`);
    });

    console.log(`Total unique tickers found: ${tickers.length}`);
    console.log("%c Note: Duplicates have been removed ", "background: #2196F3; color: white; font-size: 14px; padding: 3px;");
  } else {
    console.log("%c No Finviz Tickers Found ", "background: #F44336; color: white; font-size: 16px; font-weight: bold; padding: 5px;");
    console.log("%c " + pageInfo + " ", "background: #673AB7; color: white; font-size: 14px; padding: 3px;");
    console.log("Make sure you're on a Finviz screener page with stock results.");
  }
})();
