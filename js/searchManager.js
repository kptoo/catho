const SearchManager = {
    data: null,
    
    initialize(data) {
        this.data = data;
        const searchInput = document.getElementById('search-input');
        const searchResults = document.getElementById('search-results');
        
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (query.length < 2) {
                searchResults.classList.remove('active');
                searchResults.innerHTML = '';
                return;
            }
            this.performSearch(query);
        });
        
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#search-panel')) {
                searchResults.classList.remove('active');
            }
        });
    },
    
    performSearch(query) {
        const searchResults = document.getElementById('search-results');
        const lowerQuery = query.toLowerCase();
        
        const results = this.data.filter(diocese => {
            const dioceseName = (diocese.Diocese || '').toLowerCase();
            const country = (diocese.Country || '').toLowerCase();
            const name = (diocese.Name || '').toLowerCase();
            return dioceseName.includes(lowerQuery) || country.includes(lowerQuery) || name.includes(lowerQuery);
        }).slice(0, 10);
        
        if (results.length === 0) {
            searchResults.innerHTML = '<div class="no-results">No dioceses found</div>';
            searchResults.classList.add('active');
            return;
        }
        
        searchResults.innerHTML = results.map(diocese => `
            <div class="search-result-item" data-id="${diocese.Diocese || diocese.ID}" data-country="${diocese.Country || ''}">
                <div class="search-result-diocese">${diocese.Diocese || 'Unknown'}</div>
                <div class="search-result-info">${diocese.Country || 'N/A'} • ${diocese.Name || 'N/A'}</div>
            </div>
        `).join('');
        
        searchResults.classList.add('active');
        
        searchResults.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const dioceseId = item.dataset.id;
                const country = item.dataset.country;
                this.focusDiocese(dioceseId, country);
                searchResults.classList.remove('active');
                document.getElementById('search-input').value = '';
            });
        });
    },
    
    async focusDiocese(dioceseId, country) {
        const diocese = this.data.find(d => d.Diocese === dioceseId || d.ID === dioceseId);
        
        if (!diocese || !diocese.Latitude || !diocese.Longitude) return;
        
        const lat = parseFloat(diocese.Latitude);
        const lng = parseFloat(diocese.Longitude);
        
        if (isNaN(lat) || isNaN(lng)) return;
        
        if (country && !ArcGISApiLoader.isCountryLoaded(country)) {
            ArcGISApiLoader.clearCountry();
            await ArcGISApiLoader.loadCountryBoundaries(country);
            App.updateLoadedCountriesList();
            await App.renderAsync();
        }
        
        setTimeout(() => {
            MapManager.flyTo(lng, lat, 12);
        }, country && !ArcGISApiLoader.isCountryLoaded(country) ? 1000 : 100);
    }
};