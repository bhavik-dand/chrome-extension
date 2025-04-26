// Script to fetch ticker symbols from Finviz screener

// Function to fetch and parse the Finviz page
async function fetchTickers() {
  try {
    // Using a CORS proxy to bypass CORS restrictions
    const corsProxy = 'https://cors-anywhere.herokuapp.com/';
    const url = 'https://finviz.com/screener.ashx?v=111&f=cap_mega%2Cidx_ndx';
    
    console.log('Fetching tickers from Finviz...');
    
    const response = await fetch(corsProxy + url, {
      headers: {
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const html = await response.text();
    console.log('Received HTML response, parsing...');
    
    // Create a DOM parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Find all ticker symbols in the table
    // Finviz typically has tickers in <a> tags with class="screener-link-primary"
    const tickerElements = doc.querySelectorAll('a.screener-link-primary');
    
    const tickers = [];
    tickerElements.forEach(element => {
      tickers.push(element.textContent.trim());
    });
    
    console.log('Found tickers:', tickers);
    console.log(`Total tickers found: ${tickers.length}`);
    
    // Check if there are more pages
    const paginationLinks = doc.querySelectorAll('.screener-pages a');
    if (paginationLinks.length > 0) {
      console.log('Note: There may be more pages of results not shown here.');
    }
    
    return tickers;
  } catch (error) {
    console.error('Error fetching tickers:', error);
    return [];
  }
}

// Execute the function
fetchTickers();
