const App = {
    dioceseMap: null,
    mostRecentData: null,
    currentStatistic: 'Catholics',
    renderTimeout: null,
    currentContinent: 'All',
    
    async initialize() {
        try {
            MapManager.initialize('map');
            ChartModal.initialize();
            await ArcGISApiLoader.loadCountries();
            const rawData = await DataLoader.loadCSV(CONFIG.CSV_PATH);
            this.processAndRender(rawData);
            
            // Start with global view - no country loaded
            if (CONFIG.PERFORMANCE.START_WITH_GLOBAL_VIEW) {
                console.log('Starting with global view - select a continent or country to begin');
            }
        } catch (error) {
            console.error('APP INITIALIZATION FAILED:', error);
            alert('Error loading data: ' + error.message);
        }
    },
    
    processAndRender(rawData) {
        this.dioceseMap = DataProcessor.processData(rawData);
        this.mostRecentData = DataProcessor.getMostRecentData(this.dioceseMap);
        this.setupEventListeners();
        this.updateLoadedCountriesList();
        SearchManager.initialize(this.mostRecentData);
    },
    
    debounceRender(delay = 1000) {
        if (HeatmapRenderer.isRendering) return;
        clearTimeout(this.renderTimeout);
        this.renderTimeout = setTimeout(() => this.render(), delay);
    },
    
    setupEventListeners() {
        const heatmapSelect = document.getElementById('heatmap-select');
        const continentSelect = document.getElementById('continent-select');
        const countrySearch = document.getElementById('country-search');
        const countryList = document.getElementById('country-list');
        
        if (!heatmapSelect) return;
        
        heatmapSelect.addEventListener('change', (e) => {
            this.currentStatistic = e.target.value;
            this.render();
        });
        
        if (continentSelect) {
            continentSelect.addEventListener('change', async (e) => {
                this.currentContinent = e.target.value;
                
                // If "All" is selected, clear all loaded countries
                if (this.currentContinent === 'All') {
                    ArcGISApiLoader.clearAllCountries();
                    this.updateLoadedCountriesList();
                    this.render();
                    this.filterCountriesByContinent();
                    return;
                }
                
                // Load all countries in the selected continent
                await this.loadContinentData(this.currentContinent);
                this.filterCountriesByContinent();
            });
        }
        
        if (countrySearch && ArcGISApiLoader.allCountries) {
            countrySearch.addEventListener('focus', () => this.filterCountriesByContinent());
            countrySearch.addEventListener('input', (e) => {
                const search = e.target.value.toLowerCase();
                const filtered = this.getFilteredCountries().filter(c => c.toLowerCase().includes(search));
                this.showCountryList(filtered);
            });
            document.addEventListener('click', (e) => {
                if (!countrySearch.contains(e.target) && !countryList.contains(e.target)) {
                    countryList.style.display = 'none';
                }
            });
        }
        
        MapManager.on('moveend', () => {
            if (CONFIG.LOADED_COUNTRIES.size === 0) return;
            this.debounceRender(1500);
        });
        
        MapManager.on('zoomend', () => {
            if (CONFIG.LOADED_COUNTRIES.size === 0) return;
            this.debounceRender(1000);
        });
    },
    
    async loadContinentData(continentName) {
        const continentCountries = CONFIG.CONTINENTS[continentName] || [];
        if (continentCountries.length === 0) return;
        
        // Get countries that have diocese data
        const countriesWithData = this.getCountriesWithData();
        const validCountries = continentCountries.filter(c => countriesWithData.includes(c));
        
        if (validCountries.length === 0) {
            alert(`No diocese data found for countries in ${continentName}`);
            return;
        }
        
        // Load all countries in the continent
        await ArcGISApiLoader.loadMultipleCountries(validCountries, continentName);
        this.updateLoadedCountriesList();
        await this.renderAsync();
        
        // Zoom to continent bounds
        setTimeout(() => {
            this.zoomToContinentBounds();
        }, 500);
    },
    
    getCountriesWithData() {
        const countries = new Set();
        this.mostRecentData.forEach(diocese => {
            if (diocese.Country) {
                countries.add(diocese.Country.trim());
            }
        });
        return Array.from(countries);
    },
    
    getFilteredCountries() {
        if (!ArcGISApiLoader.allCountries) return [];
        if (this.currentContinent === 'All') {
            return ArcGISApiLoader.allCountries;
        }
        const continentCountries = CONFIG.CONTINENTS[this.currentContinent] || [];
        return ArcGISApiLoader.allCountries.filter(c => continentCountries.includes(c));
    },
    
    filterCountriesByContinent() {
        const filtered = this.getFilteredCountries();
        this.showCountryList(filtered);
    },
    
    showCountryList(countries) {
        const countryList = document.getElementById('country-list');
        if (!countryList) return;
        countryList.innerHTML = '';
        countryList.style.display = 'block';
        
        if (countries.length === 0) {
            countryList.innerHTML = '<div style="padding:8px;color:#7f8c8d;">No countries found</div>';
            return;
        }
        
        countries.forEach(country => {
            const item = document.createElement('div');
            item.style.cssText = 'padding:8px;cursor:pointer;border-bottom:1px solid #34495e;color:#ecf0f1;';
            
            const isLoaded = ArcGISApiLoader.isCountryLoaded(country);
            const isCached = ArcGISApiLoader.cache.has(`boundaries_${country}`) || 
                             ArcGISApiLoader.getCachedBoundaries(`boundaries_${country}`) !== null;
            
            if (isLoaded) {
                item.style.backgroundColor = '#1e5631';
                item.innerHTML = country + ' <span style="float:right;color:#2ecc71;">✓ Loaded</span>';
            } else if (isCached) {
                item.innerHTML = country + ' <span style="float:right;color:#3498db;">⚡ Cached</span>';
            } else {
                item.textContent = country;
            }
            
            item.addEventListener('mouseover', () => {
                if (!isLoaded) item.style.backgroundColor = '#34495e';
            });
            item.addEventListener('mouseout', () => {
                if (!isLoaded && !isCached) item.style.backgroundColor = 'transparent';
            });
            item.addEventListener('click', async () => {
                if (isLoaded) {
                    // If already loaded (part of continent), just zoom to it
                    const features = ArcGISApiLoader.getCountryFeatures(country);
                    if (features && features.length > 0) {
                        this.zoomToCountry(features);
                    }
                } else {
                    // Load single country
                    ArcGISApiLoader.clearAllCountries();
                    const features = await ArcGISApiLoader.loadCountryBoundaries(country);
                    this.updateLoadedCountriesList();
                    await this.renderAsync();
                    setTimeout(() => {
                        if (features.length > 0) this.zoomToCountry(features);
                    }, 500);
                }
                countryList.style.display = 'none';
                document.getElementById('country-search').value = '';
            });
            countryList.appendChild(item);
        });
    },
    
    async renderAsync() {
        await new Promise(resolve => setTimeout(resolve, 50));
        await HeatmapRenderer.renderMap(this.mostRecentData, this.dioceseMap, this.currentStatistic);
    },
    
    zoomToCountry(features) {
        if (features.length === 0) return;
        const coords = [];
        features.forEach(feature => {
            if (feature.geometry && feature.geometry.coordinates) {
                const extractCoords = (coordArray) => {
                    if (typeof coordArray[0] === 'number') {
                        coords.push(coordArray);
                    } else {
                        coordArray.forEach(extractCoords);
                    }
                };
                extractCoords(feature.geometry.coordinates);
            }
        });
        if (coords.length > 0) {
            const bounds = coords.reduce((bounds, coord) => {
                return bounds.extend(coord);
            }, new maplibregl.LngLatBounds(coords[0], coords[0]));
            MapManager.map.fitBounds(bounds, {padding: 100, maxZoom: 8, duration: 1000});
        }
    },
    
    zoomToContinentBounds() {
        const allFeatures = ArcGISApiLoader.getAllLoadedFeatures();
        if (allFeatures.length === 0) return;
        
        const coords = [];
        allFeatures.forEach(feature => {
            if (feature.geometry && feature.geometry.coordinates) {
                const extractCoords = (coordArray) => {
                    if (typeof coordArray[0] === 'number') {
                        coords.push(coordArray);
                    } else {
                        coordArray.forEach(extractCoords);
                    }
                };
                extractCoords(feature.geometry.coordinates);
            }
        });
        
        if (coords.length > 0) {
            const bounds = coords.reduce((bounds, coord) => {
                return bounds.extend(coord);
            }, new maplibregl.LngLatBounds(coords[0], coords[0]));
            MapManager.map.fitBounds(bounds, {padding: 50, maxZoom: 6, duration: 1500});
        }
    },
    
    updateLoadedCountriesList() {
        const listDiv = document.getElementById('loaded-countries-list');
        if (!listDiv) return;
        if (CONFIG.LOADED_COUNTRIES.size === 0) {
            listDiv.innerHTML = '<em style="color:#7f8c8d;">No country selected - Global view</em>';
            return;
        }
        listDiv.innerHTML = '';
        
        // Show continent name if multiple countries loaded
        if (CONFIG.LOADED_COUNTRIES.size > 1 && this.currentContinent !== 'All') {
            const continentTag = document.createElement('div');
            continentTag.style.cssText = 'background:#9b59b6;color:white;padding:8px 14px;margin:4px 0;border-radius:6px;font-size:14px;font-weight:600;display:flex;justify-content:space-between;align-items:center;';
            continentTag.innerHTML = `
                <span>${this.currentContinent} (${CONFIG.LOADED_COUNTRIES.size} countries)</span>
                <span style="cursor:pointer;font-size:18px;font-weight:bold;" id="clear-continent">×</span>
            `;
            listDiv.appendChild(continentTag);
            
            document.getElementById('clear-continent').addEventListener('click', () => {
                ArcGISApiLoader.clearAllCountries();
                this.currentContinent = 'All';
                document.getElementById('continent-select').value = 'All';
                this.updateLoadedCountriesList();
                this.render();
                this.filterCountriesByContinent();
            });
        } else {
            // Show individual country tags
            CONFIG.LOADED_COUNTRIES.forEach(country => {
                const tag = document.createElement('span');
                tag.style.cssText = 'display:inline-block;background:#3498db;color:white;padding:6px 12px;margin:2px;border-radius:4px;font-size:13px;cursor:pointer;';
                tag.innerHTML = country + ' <span style="margin-left:8px;font-weight:bold;">×</span>';
                tag.addEventListener('click', () => {
                    ArcGISApiLoader.clearCountry(country);
                    this.updateLoadedCountriesList();
                    this.render();
                });
                listDiv.appendChild(tag);
            });
        }
    },
    
    async render() {
        if (!this.mostRecentData || !this.dioceseMap) return;
        await HeatmapRenderer.renderMap(this.mostRecentData, this.dioceseMap, this.currentStatistic);
    }
};

document.addEventListener('DOMContentLoaded', () => App.initialize());
