const ArcGISApiLoader = {
    baseUrl: 'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/World_Administrative_Divisions/FeatureServer/0/query',
    allCountries: null,
    countryBoundariesMap: new Map(), // Store boundaries per country
    cache: new Map(),
    
    // Safe storage wrapper to handle tracking prevention
    safeStorage: {
        getItem(key, useSession = false) {
            try {
                const storage = useSession ? sessionStorage : localStorage;
                return storage.getItem(key);
            } catch (e) {
                console.warn('Storage blocked:', e.message);
                return null;
            }
        },
        setItem(key, value, useSession = false) {
            try {
                const storage = useSession ? sessionStorage : localStorage;
                storage.setItem(key, value);
                return true;
            } catch (e) {
                console.warn('Storage blocked:', e.message);
                return false;
            }
        },
        removeItem(key, useSession = false) {
            try {
                const storage = useSession ? sessionStorage : localStorage;
                storage.removeItem(key);
            } catch (e) {
                console.warn('Storage blocked:', e.message);
            }
        }
    },
    
    async loadCountries() {
        try {
            const cached = this.safeStorage.getItem('diocese_countries');
            if (cached) {
                this.allCountries = JSON.parse(cached);
                return this.allCountries;
            }
            
            const params = new URLSearchParams({
                where: '1=1',
                outFields: 'COUNTRY',
                returnGeometry: 'false',
                returnDistinctValues: 'true',
                f: 'json'
            });
            const response = await fetch(`${this.baseUrl}?${params}`);
            const data = await response.json();
            if (data.features) {
                const countries = data.features.map(f => f.attributes.COUNTRY).filter(c => c && c.trim()).sort();
                this.allCountries = [...new Set(countries)];
                this.safeStorage.setItem('diocese_countries', JSON.stringify(this.allCountries));
                return this.allCountries;
            }
            return [];
        } catch (error) {
            console.error('Error loading countries:', error);
            return [];
        }
    },
    
    async loadMultipleCountries(countryNames, continentName = '') {
        try {
            this.showLoadingIndicator(continentName || 'Multiple Countries');
            
            const total = countryNames.length;
            let loaded = 0;
            
            // Clear existing data
            this.countryBoundariesMap.clear();
            CONFIG.LOADED_COUNTRIES.clear();
            
            for (const countryName of countryNames) {
                this.updateLoadingStatus(`Loading ${countryName}... (${loaded + 1}/${total})`);
                
                try {
                    const features = await this.loadCountryBoundariesInternal(countryName, false);
                    if (features && features.length > 0) {
                        CONFIG.LOADED_COUNTRIES.add(countryName);
                        loaded++;
                    }
                } catch (error) {
                    console.error(`Failed to load ${countryName}:`, error);
                    // Continue with other countries
                }
                
                // Update progress
                const progress = Math.round(((loaded) / total) * 100);
                this.showProgress(loaded, total, progress);
            }
            
            this.hideLoadingIndicator();
            
            if (loaded === 0) {
                alert(`Failed to load any countries from ${continentName || 'selection'}`);
            } else if (loaded < total) {
                console.warn(`Loaded ${loaded} out of ${total} countries`);
            }
            
            return loaded;
        } catch (error) {
            console.error('Error loading multiple countries:', error);
            this.hideLoadingIndicator();
            throw error;
        }
    },
    
    async loadCountryBoundaries(countryName) {
        return this.loadCountryBoundariesInternal(countryName, true);
    },
    
    async loadCountryBoundariesInternal(countryName, showIndicator = true) {
        try {
            const cacheKey = `boundaries_${countryName}`;
            const cached = this.cache.get(cacheKey) || this.getCachedBoundaries(cacheKey);
            
            if (cached) {
                this.countryBoundariesMap.set(countryName, cached);
                if (showIndicator) {
                    CONFIG.LOADED_COUNTRIES.clear();
                    CONFIG.LOADED_COUNTRIES.add(countryName);
                }
                return cached.features;
            }
            
            if (showIndicator) {
                this.showLoadingIndicator(countryName);
                this.updateLoadingStatus('Checking boundary count...');
            }
            
            const countParams = new URLSearchParams({
                where: `COUNTRY = '${countryName}'`,
                returnCountOnly: 'true',
                f: 'json'
            });
            const countResponse = await fetch(`${this.baseUrl}?${countParams}`);
            const countData = await countResponse.json();
            const totalCount = countData.count || 0;
            
            let whereClause = `COUNTRY = '${countryName}'`;
            let geometryPrecision = 5;
            let maxAllowableOffset = 0;
            let resultRecordCount = null;
            
            if (totalCount > 2000) {
                whereClause = `COUNTRY = '${countryName}' AND ADMINTYPE IN ('State', 'Province', 'Region')`;
                geometryPrecision = 2;
                maxAllowableOffset = 0.02;
                resultRecordCount = 150;
                if (showIndicator) {
                    this.updateLoadingStatus(`Large country (${totalCount} boundaries). Loading major divisions only...`);
                }
            } else if (totalCount > 1000) {
                whereClause = `COUNTRY = '${countryName}' AND ADMINTYPE IN ('State', 'Province')`;
                geometryPrecision = 2;
                maxAllowableOffset = 0.01;
                resultRecordCount = 200;
                if (showIndicator) {
                    this.updateLoadingStatus(`Large country detected. Loading simplified view...`);
                }
            } else if (totalCount > 500) {
                geometryPrecision = 3;
                maxAllowableOffset = 0.005;
                resultRecordCount = 300;
                if (showIndicator) {
                    this.updateLoadingStatus(`Fetching ${totalCount} boundaries (simplified)...`);
                }
            } else {
                geometryPrecision = 4;
                if (showIndicator) {
                    this.updateLoadingStatus(`Fetching ${totalCount} boundaries...`);
                }
            }
            
            const params = new URLSearchParams({
                where: whereClause,
                outFields: 'NAME,COUNTRY',
                returnGeometry: 'true',
                geometryPrecision: geometryPrecision.toString(),
                f: 'geojson'
            });
            
            if (maxAllowableOffset > 0) {
                params.append('maxAllowableOffset', maxAllowableOffset.toString());
            }
            if (resultRecordCount) {
                params.append('resultRecordCount', resultRecordCount.toString());
            }
            
            const response = await fetch(`${this.baseUrl}?${params}`);
            let geojson = await response.json();
            
            if (geojson.features.length === 0 && totalCount > 0) {
                const fallbackParams = new URLSearchParams({
                    where: `COUNTRY = '${countryName}'`,
                    outFields: 'NAME,COUNTRY',
                    returnGeometry: 'true',
                    resultRecordCount: 100,
                    geometryPrecision: '2',
                    maxAllowableOffset: '0.02',
                    f: 'geojson'
                });
                const fallbackResponse = await fetch(`${this.baseUrl}?${fallbackParams}`);
                geojson = await fallbackResponse.json();
            }
            
            const simplified = this.simplifyGeometry(geojson);
            this.countryBoundariesMap.set(countryName, simplified);
            this.cache.set(cacheKey, simplified);
            this.cacheBoundaries(cacheKey, simplified);
            
            if (showIndicator) {
                CONFIG.LOADED_COUNTRIES.clear();
                CONFIG.LOADED_COUNTRIES.add(countryName);
                await new Promise(resolve => setTimeout(resolve, 200));
                this.hideLoadingIndicator();
            }
            
            return simplified.features;
        } catch (error) {
            console.error('Error loading boundaries:', error);
            if (showIndicator) {
                this.hideLoadingIndicator();
                alert('Failed to load boundaries for ' + countryName);
            }
            return [];
        }
    },
    
    simplifyGeometry(geojson) {
        if (!turf || !turf.simplify) return geojson;
        const simplified = {
            type: geojson.type,
            features: geojson.features.map(feature => {
                try {
                    return turf.simplify(feature, {tolerance: 0.001, highQuality: false});
                } catch (e) {
                    return feature;
                }
            })
        };
        return simplified;
    },
    
    getCachedBoundaries(key) {
        try {
            const cached = this.safeStorage.getItem(key, true);
            if (cached) {
                const parsed = JSON.parse(cached);
                const age = Date.now() - parsed.timestamp;
                if (age < 3600000) {
                    return parsed.data;
                }
                this.safeStorage.removeItem(key, true);
            }
        } catch (e) {
            console.error('Cache read error:', e);
        }
        return null;
    },
    
    cacheBoundaries(key, data) {
        try {
            const cacheData = {
                timestamp: Date.now(),
                data: data
            };
            const serialized = JSON.stringify(cacheData);
            if (serialized.length < 5000000) {
                this.safeStorage.setItem(key, serialized, true);
            }
        } catch (e) {
            console.warn('Cache write failed:', e);
        }
    },
    
    getAllBoundaries() {
        const allFeatures = [];
        this.countryBoundariesMap.forEach((boundaries) => {
            if (boundaries && boundaries.features) {
                allFeatures.push(...boundaries.features);
            }
        });
        return allFeatures;
    },
    
    getAllLoadedFeatures() {
        return this.getAllBoundaries();
    },
    
    getCountryFeatures(countryName) {
        const boundaries = this.countryBoundariesMap.get(countryName);
        return boundaries ? boundaries.features : [];
    },
    
    clearCountry(countryName) {
        if (countryName) {
            this.countryBoundariesMap.delete(countryName);
            CONFIG.LOADED_COUNTRIES.delete(countryName);
        } else {
            this.countryBoundariesMap.clear();
            CONFIG.LOADED_COUNTRIES.clear();
        }
    },
    
    clearAllCountries() {
        this.countryBoundariesMap.clear();
        CONFIG.LOADED_COUNTRIES.clear();
    },
    
    isCountryLoaded(countryName) {
        return CONFIG.LOADED_COUNTRIES.has(countryName);
    },
    
    matchDiocesesToBoundaries(data) {
        const matches = new Map();
        const allBoundaries = this.getAllBoundaries();
        
        if (allBoundaries.length === 0) {
            console.warn('matchDiocesesToBoundaries: No boundaries to match');
            return matches;
        }
        
        console.log('=== MATCHING DIOCESES TO BOUNDARIES ===');
        console.log('Total boundaries:', allBoundaries.length);
        console.log('Total dioceses in data:', data.length);
        
        const loadedCountries = Array.from(CONFIG.LOADED_COUNTRIES);
        console.log('Loaded countries:', loadedCountries);
        
        // Get unique boundary countries for debugging
        const boundaryCountries = new Set();
        allBoundaries.forEach(b => {
            const country = b.properties.COUNTRY || b.properties.country;
            if (country) boundaryCountries.add(country);
        });
        console.log('Boundary countries:', Array.from(boundaryCountries));
        
        // Get unique diocese countries for debugging
        const dioceseCountries = new Set();
        data.forEach(d => {
            if (d.Country) dioceseCountries.add(d.Country.trim());
        });
        console.log('Diocese countries in CSV:', Array.from(dioceseCountries));
        
        const countryDioceses = data.filter(d => {
            const dioceseCountry = (d.Country || '').trim();
            return loadedCountries.some(lc => {
                // Case-insensitive comparison
                return dioceseCountry.toLowerCase() === lc.toLowerCase();
            });
        });
        
        console.log('Filtered dioceses for loaded countries:', countryDioceses.length);
        
        if (countryDioceses.length === 0) {
            console.error('❌ No dioceses found for loaded countries!');
            console.log('Check if country names in CSV match ArcGIS country names');
            return matches;
        }
        
        // Log sample dioceses with coordinates
        console.log('Sample filtered dioceses:', countryDioceses.slice(0, 3).map(d => ({
            diocese: d.Diocese,
            country: d.Country,
            lat: d.Latitude,
            lng: d.Longitude
        })));
        
        let matchedCount = 0;
        let processedBoundaries = 0;
        
        allBoundaries.forEach(boundary => {
            processedBoundaries++;
            const boundaryId = this.getBoundaryId(boundary);
            const matchedDioceses = countryDioceses.filter(diocese => this.isDioceseInBoundary(diocese, boundary));
            
            if (matchedDioceses.length > 0) {
                matchedDioceses.forEach(d => {
                    d._boundaryName = this.getBoundaryName(boundary);
                });
                matches.set(boundaryId, {boundary: boundary, dioceses: matchedDioceses});
                matchedCount += matchedDioceses.length;
            }
            
            // Log progress every 100 boundaries
            if (processedBoundaries % 100 === 0) {
                console.log(`Processed ${processedBoundaries}/${allBoundaries.length} boundaries, ${matchedCount} dioceses matched`);
            }
        });
        
        console.log('✓ Matched', matchedCount, 'dioceses to', matches.size, 'boundaries');
        console.log('=== MATCHING COMPLETE ===');
        
        return matches;
    },
    
    isDioceseInBoundary(diocese, boundary) {
        const lat = parseFloat(diocese.Latitude);
        const lng = parseFloat(diocese.Longitude);
        if (isNaN(lat) || isNaN(lng) || !boundary.geometry) return false;
        return this.pointInPolygon([lng, lat], boundary.geometry);
    },
    
    pointInPolygon(point, geometry) {
        if (geometry.type === 'Polygon') {
            return this.pointInPolygonRing(point, geometry.coordinates[0]);
        } else if (geometry.type === 'MultiPolygon') {
            return geometry.coordinates.some(polygon => this.pointInPolygonRing(point, polygon[0]));
        }
        return false;
    },
    
    pointInPolygonRing(point, ring) {
        let inside = false;
        const [x, y] = point;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const [xi, yi] = ring[i];
            const [xj, yj] = ring[j];
            const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    },
    
    getBoundaryId(boundary) {
        const props = boundary.properties;
        const name = props.NAME || props.name || 'unknown';
        const country = props.COUNTRY || props.country || 'unknown';
        return `${country}_${name}`.replace(/\s+/g, '_').toLowerCase();
    },
    
    getBoundaryName(boundary) {
        const props = boundary.properties;
        return props.NAME || props.name || 'Unknown';
    },
    
    aggregateDiocesesInBoundary(dioceses, statistic) {
        const config = CONFIG.STATISTICS[statistic];
        if (!config) return 0;
        
        const values = dioceses.map(d => {
            let val = parseFloat(String(d[statistic]).replace(/,/g, ''));
            
            // Cap Percent Catholic at 100%
            if (statistic === 'Percent Catholic' && !isNaN(val) && val > 100) {
                val = 100;
            }
            
            return val;
        }).filter(v => !isNaN(v));
        
        if (values.length === 0) return 0;
        
        if (config.aggregation === 'avg') {
            const avg = values.reduce((a, b) => a + b, 0) / values.length;
            // Cap average percent at 100%
            if (statistic === 'Percent Catholic' && avg > 100) {
                return 100;
            }
            return avg;
        } else {
            return values.reduce((a, b) => a + b, 0);
        }
    },
    
    showLoadingIndicator(countryName) {
        this.hideLoadingIndicator();
        const indicator = document.createElement('div');
        indicator.id = 'arcgis-loading-indicator';
        indicator.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#2c3e50;color:#ecf0f1;padding:30px 40px;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.5);z-index:10000;text-align:center;min-width:320px;';
        indicator.innerHTML = `<div style="font-size:18px;font-weight:bold;margin-bottom:15px;">Loading ${countryName}</div><div style="width:300px;height:6px;background:#1a2332;border-radius:3px;overflow:hidden;margin-bottom:10px;"><div id="arcgis-progress-bar" style="width:0%;height:100%;background:#3498db;transition:width 0.3s;"></div></div><div id="arcgis-loading-status" style="font-size:14px;color:#95a5a6;margin-top:10px;">Connecting to ArcGIS API...</div>`;
        document.body.appendChild(indicator);
    },
    
    showProgress(current, total, percent) {
        const progressBar = document.getElementById('arcgis-progress-bar');
        if (progressBar) {
            progressBar.style.width = percent + '%';
        }
    },
    
    updateLoadingStatus(message) {
        const statusEl = document.getElementById('arcgis-loading-status');
        if (statusEl) statusEl.textContent = message;
    },
    
    hideLoadingIndicator() {
        const indicator = document.getElementById('arcgis-loading-indicator');
        if (indicator) indicator.remove();
    }
};
