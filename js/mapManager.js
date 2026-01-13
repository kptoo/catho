const MapManager = {
    map: null,
    popups: new Map(),
    polygonLayers: [],
    popupCallbacks: new Map(),
    eventHandlers: [],
    
    initialize(containerId) {
        if (typeof CONFIG === 'undefined') {
            console.error('CONFIG is undefined! config.js failed to load.');
            alert('Configuration error: config.js failed to load. Check browser console for details.');
            throw new Error('CONFIG is undefined');
        }
        
        if (!CONFIG.MAP_CONFIG || !CONFIG.MAP_CONFIG.center) {
            console.error('CONFIG.MAP_CONFIG is invalid:', CONFIG);
            alert('Configuration error: MAP_CONFIG is missing or invalid.');
            throw new Error('Invalid CONFIG.MAP_CONFIG');
        }
        
        console.log('CONFIG loaded successfully:', CONFIG.MAP_CONFIG);
        
        this.map = new maplibregl.Map({
            container: containerId,
            style: {
                version: 8,
                sources: {
                    carto_dark: {
                        type: 'raster',
                        tiles: [
                            'https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
                            'https://cartodb-basemaps-b.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
                            'https://cartodb-basemaps-c.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png'
                        ],
                        tileSize: 256,
                        attribution: '© CARTO © OpenStreetMap contributors',
                        minzoom: 0,
                        maxzoom: 18
                    }
                },
                layers: [
                    { id: 'base-tiles', type: 'raster', source: 'carto_dark' }
                ],
                glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf"
            },
            center: CONFIG.MAP_CONFIG.center,
            zoom: CONFIG.MAP_CONFIG.zoom,
            minZoom: CONFIG.MAP_CONFIG.minZoom,
            maxZoom: CONFIG.MAP_CONFIG.maxZoom,
            worldCopyJump: true
        });
        
        this.map.addControl(new maplibregl.NavigationControl(), 'top-left');
        
        console.log('✓ Map initialized with MapLibre GL JS and CartoDB Dark basemap');
        
        return this.map;
    },
    
    clearMarkers() {
        this.popups.forEach(popup => popup.remove());
        this.popups.clear();
    },
    
    clearPolygons() {
        this.eventHandlers.forEach(handler => {
            if (handler.type && handler.layer) {
                this.map.off(handler.type, handler.layer, handler.fn);
            }
        });
        this.eventHandlers = [];
        
        this.polygonLayers.forEach(layerId => {
            if (this.map.getLayer(layerId)) {
                this.map.removeLayer(layerId);
            }
            if (this.map.getLayer(layerId + '-outline')) {
                this.map.removeLayer(layerId + '-outline');
            }
            if (this.map.getSource(layerId)) {
                this.map.removeSource(layerId);
            }
        });
        this.polygonLayers = [];
        this.popupCallbacks.clear();
    },
    
    addMarker(lat, lng, popupContent, color) {
        const el = document.createElement('div');
        el.className = 'custom-marker';
        el.style.backgroundColor = color;
        el.style.width = '16px';
        el.style.height = '16px';
        el.style.borderRadius = '50%';
        el.style.border = '2px solid white';
        el.style.cursor = 'pointer';
        
        const popup = new maplibregl.Popup({ 
            offset: 25,
            maxWidth: '350px',
            className: 'custom-popup'
        }).setHTML(popupContent);
        
        const marker = new maplibregl.Marker(el)
            .setLngLat([lng, lat])
            .setPopup(popup)
            .addTo(this.map);
        
        this.popups.set(`${lat},${lng}`, marker);
        
        return marker;
    },
    
    addPolygon(geojson, color, popupContent, setupCallback) {
        const layerId = 'polygon-' + Math.random().toString(36).substr(2, 9);
        this.polygonLayers.push(layerId);
        
        if (setupCallback) {
            this.popupCallbacks.set(layerId, setupCallback);
        }
        
        this.map.addSource(layerId, {
            type: 'geojson',
            data: geojson
        });
        
        this.map.addLayer({
            id: layerId,
            type: 'fill',
            source: layerId,
            paint: {
                'fill-color': color,
                'fill-opacity': 0.7
            }
        });
        
        this.map.addLayer({
            id: layerId + '-outline',
            type: 'line',
            source: layerId,
            paint: {
                'line-color': '#ffffff',
                'line-width': 1.5,
                'line-opacity': 0.9
            }
        });
        
        const popup = new maplibregl.Popup({
            closeButton: true,
            closeOnClick: false,
            maxWidth: '350px',
            className: 'custom-popup'
        });
        
        const clickHandler = (e) => {
            const coordinates = e.lngLat;
            popup.setLngLat(coordinates)
                .setHTML(popupContent)
                .addTo(this.map);
            
            const callback = this.popupCallbacks.get(layerId);
            if (callback) {
                setTimeout(() => {
                    const popupElement = popup.getElement();
                    if (popupElement) {
                        callback(popupElement);
                    }
                }, 50);
            }
        };
        
        const mouseenterHandler = () => {
            this.map.getCanvas().style.cursor = 'pointer';
            this.map.setPaintProperty(layerId, 'fill-opacity', 0.9);
            this.map.setPaintProperty(layerId + '-outline', 'line-width', 2.5);
        };
        
        const mouseleaveHandler = () => {
            this.map.getCanvas().style.cursor = '';
            this.map.setPaintProperty(layerId, 'fill-opacity', 0.7);
            this.map.setPaintProperty(layerId + '-outline', 'line-width', 1.5);
        };
        
        this.map.on('click', layerId, clickHandler);
        this.map.on('mouseenter', layerId, mouseenterHandler);
        this.map.on('mouseleave', layerId, mouseleaveHandler);
        
        this.eventHandlers.push(
            { type: 'click', layer: layerId, fn: clickHandler },
            { type: 'mouseenter', layer: layerId, fn: mouseenterHandler },
            { type: 'mouseleave', layer: layerId, fn: mouseleaveHandler }
        );
        
        return { layerId, popup };
    },
    
    fitBounds(data) {
        const validCoords = data
            .filter(d => d.Latitude && d.Longitude)
            .map(d => [parseFloat(d.Longitude), parseFloat(d.Latitude)]);
        
        if (validCoords.length > 0) {
            const bounds = validCoords.reduce((bounds, coord) => {
                return bounds.extend(coord);
            }, new maplibregl.LngLatBounds(validCoords[0], validCoords[0]));
            
            this.map.fitBounds(bounds, { 
                padding: 50,
                duration: 1000
            });
        }
    },
    
    flyTo(lng, lat, zoom = 10) {
        this.map.flyTo({
            center: [lng, lat],
            zoom: zoom,
            duration: 1000
        });
    },
    
    on(event, handler) {
        this.map.on(event, handler);
    }
};