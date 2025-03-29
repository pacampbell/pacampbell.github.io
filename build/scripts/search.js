
const options = {
    keys: ['title', 'content', 'content_id'], // Fields to search in
    threshold: 0.3,            // Adjusts fuzzy matching sensitivity (0 = exact, 1 = loose)
    includeScore: true,        // Optional: Include match score
    minMatchCharLength: 2      // Minimum characters before searching
};

const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');

fetch('search_data.json')
  .then(response => response.json())
  .then(data => {
    const fuse = new Fuse(data, options);

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value;
        if (query.length < 2) {
            searchResults.innerHTML = ''; // Clear results if query is too short
            return;
        }
    
        // Perform the search
        const results = fuse.search(query);
    
        // Display results
        searchResults.innerHTML = results.length ? 
        results.map(result => {
            const content = result.item.content || '';
            const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;
            return `
                <div class="result-card">
                    <a href="${result.item.url}">[${result.item.type}] ${result.item.title}</a>
                    <p>${preview}</p>
                </div>
                `;
        }).join('') :'<p class="no-results">No results found.</p>';
    });
});