const HeatmapRenderer = {
    currentStatistic: 'Catholics',
    colorScale: null,
    isRendering: false,
    
    setStatistic(statistic) {
        this.currentStatistic = statistic;
    },
    
    createColorScale(min, max) {
        this.colorScale = d3.scaleQuantile()
            .domain([min, max])
            .range(CONFIG.HEATMAP_COLORS);
        return this.colorScale;
    },
    
    getColor(value) {
        if (!this.colorScale || value === null || value === undefined || value === '' || value === 'NA') {
            return '#404040';
        }
        const num = parseFloat(value);
        if (isNaN(num)) return '#404040';
        return this.colorScale(num);
    },
    
    renderLegend(min, max, statistic) {
        const legendDiv = document.getElementById('legend');
        legendDiv.innerHTML = '';
        
        const title = document.createElement('div');
        title.className = 'legend-title';
        title.textContent = CONFIG.STATISTICS[statistic].label;
        legendDiv.appendChild(title);
        
        const scaleDiv = document.createElement('div');
        scaleDiv.className = 'legend-scale';
        CONFIG.HEATMAP_COLORS.forEach(color => {
            const colorBox = document.createElement('div');
            colorBox.style.backgroundColor = color;
            colorBox.style.flex = '1';
            scaleDiv.appendChild(colorBox);
        });
        legendDiv.appendChild(scaleDiv);
        
        const labelsDiv = document.createElement('div');
        labelsDiv.className = 'legend-labels';
        const format = CONFIG.STATISTICS[statistic].format;
        const minLabel = document.createElement('span');
        minLabel.textContent = DataProcessor.formatValue(min, format);
        const maxLabel = document.createElement('span');
        maxLabel.textContent = DataProcessor.formatValue(max, format);
        labelsDiv.appendChild(minLabel);
        labelsDiv.appendChild(maxLabel);
        legendDiv.appendChild(labelsDiv);
    },
    
    async renderMap(data, dioceseMap, statistic) {
        if (this.isRendering) {
            console.log('Already rendering, skipping...');
            return;
        }
        this.setStatistic(statistic);
        if (!MapManager.map.loaded()) {
            await new Promise(resolve => MapManager.map.once('load', resolve));
        }
        if (CONFIG.LOADED_COUNTRIES.size > 0 && ArcGISApiLoader.currentCountryBoundaries) {
            await this.renderMixedMap(data, dioceseMap, statistic);
        } else {
            MapManager.clearMarkers();
            MapManager.clearPolygons();
        }
    },
    
    showProgress(current, total) {
        let progressDiv = document.getElementById('render-progress');
        if (!progressDiv) {
            progressDiv = document.createElement('div');
            progressDiv.id = 'render-progress';
            progressDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#2c3e50;color:#ecf0f1;padding:20px 30px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.5);z-index:10000;min-width:300px;text-align:center;';
            document.body.appendChild(progressDiv);
        }
        const percent = Math.round((current / total) * 100);
        progressDiv.innerHTML = `<div style="font-size:16px;margin-bottom:10px;">Rendering boundaries...</div><div style="background:#1a2332;height:8px;border-radius:4px;overflow:hidden;"><div style="background:#3498db;height:100%;width:${percent}%;transition:width 0.3s;"></div></div><div style="margin-top:8px;font-size:14px;color:#95a5a6;">${current} / ${total} (${percent}%)</div>`;
    },
    
    hideProgress() {
        const progressDiv = document.getElementById('render-progress');
        if (progressDiv) progressDiv.remove();
    },
    
    async renderMixedMap(data, dioceseMap, statistic) {
        if (this.isRendering) return;
        this.isRendering = true;
        
        MapManager.clearMarkers();
        MapManager.clearPolygons();
        
        const matches = ArcGISApiLoader.matchDiocesesToBoundaries(data);
        const loadedBoundaries = ArcGISApiLoader.getAllBoundaries();
        
        console.log('Boundaries:', loadedBoundaries.length, 'Matches:', matches.size);
        
        const boundaryValues = [];
        matches.forEach((match) => {
            const { dioceses } = match;
            const aggregatedValue = ArcGISApiLoader.aggregateDiocesesInBoundary(dioceses, statistic);
            if (!isNaN(aggregatedValue) && aggregatedValue !== 0) {
                boundaryValues.push(aggregatedValue);
            }
        });
        
        if (boundaryValues.length === 0) {
            console.warn('⚠ No valid boundary values for color scale');
            this.isRendering = false;
            return;
        }
        
        const min = Math.min(...boundaryValues);
        const max = Math.max(...boundaryValues);
        console.log('Dynamic range for', statistic, ':', min, 'to', max);
        
        this.createColorScale(min, max);
        this.renderLegend(min, max, statistic);
        
        const matchedBoundaryIds = new Set();
        matches.forEach((match, boundaryId) => matchedBoundaryIds.add(boundaryId));
        
        let boundaryCount = 0;
        let coloredCount = 0;
        const total = loadedBoundaries.length;
        let chunkSize = total > 1000 ? 10 : (total > 500 ? 15 : 20);
        
        this.showProgress(0, total);
        
        for (let i = 0; i < total; i += chunkSize) {
            await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
            const chunk = loadedBoundaries.slice(i, Math.min(i + chunkSize, total));
            
            chunk.forEach(boundary => {
                try {
                    const boundaryId = ArcGISApiLoader.getBoundaryId(boundary);
                    const boundaryName = ArcGISApiLoader.getBoundaryName(boundary);
                    
                    if (matchedBoundaryIds.has(boundaryId)) {
                        const match = matches.get(boundaryId);
                        const { dioceses } = match;
                        const aggregatedValue = ArcGISApiLoader.aggregateDiocesesInBoundary(dioceses, statistic);
                        const color = this.getColor(aggregatedValue);
                        const primaryDiocese = dioceses[0];
                        const dioceseKey = primaryDiocese.Diocese || primaryDiocese.ID;
                        const historicalData = dioceseMap.get(dioceseKey);
                        
                        let popupContent;
                        if (dioceses.length === 1) {
                            popupContent = this.createPopupContent(primaryDiocese, statistic, historicalData);
                        } else {
                            popupContent = this.createMultiDiocesePopup(dioceses, statistic, dioceseMap, aggregatedValue);
                        }
                        
                        const dioceseInfo = {
                            title: dioceses.length === 1 ? primaryDiocese.Diocese : `${dioceses.length} Dioceses`,
                            country: primaryDiocese.Country || 'N/A',
                            statistic: statistic,
                            historicalData: historicalData
                        };
                        
                        MapManager.addPolygon(boundary, color, popupContent, (popupElement) => {
                            this.setupModalButton(popupElement, dioceseInfo, dioceses, dioceseMap, statistic);
                        });
                        coloredCount++;
                        boundaryCount++;
                    } else {
                        const popupContent = this.createEmptyBoundaryPopup(boundaryName, boundary.properties);
                        MapManager.addPolygon(boundary, '#2c2c2c', popupContent);
                        boundaryCount++;
                    }
                } catch (error) {
                    console.error('Error rendering boundary:', error);
                }
            });
            this.showProgress(Math.min(i + chunkSize, total), total);
        }
        
        this.hideProgress();
        this.isRendering = false;
        console.log('✓ Rendered', boundaryCount, 'boundaries,', coloredCount, 'with data');
        
        if (coloredCount === 0) {
            console.warn('⚠ No dioceses matched to boundaries. Check diocese coordinates.');
        }
    },
    
    createEmptyBoundaryPopup(boundaryName, properties) {
        const country = properties.COUNTRY || properties.country || 'Unknown Country';
        const state = properties.NAME || properties.name || boundaryName || 'Unknown Region';
        
        const title = state;
        const subtitle = `${country}`;
        
        return `
            <div class="popup-header" style="color:#ecf0f1;background:#2c3e50;padding:10px;margin:-15px -15px 10px -15px;border-radius:8px 8px 0 0;">
                ${title}
            </div>
            <div class="popup-stat">
                <span class="popup-stat-label">Country:</span>
                <span class="popup-stat-value">${country}</span>
            </div>
            <div style="margin-top:10px;padding:10px;background:#34495e;border-radius:4px;text-align:center;color:#95a5a6;">
                <em>No diocese data for this region</em>
            </div>
        `;
    },
    
    createMultiDiocesePopup(dioceses, statistic, dioceseMap, aggregatedValue) {
        const config = CONFIG.STATISTICS[statistic];
        const format = config.format;
        const aggregationType = config.aggregation === 'avg' ? 'Average' : 'Total';
        const formattedValue = DataProcessor.formatValue(aggregatedValue, format);
        const boundaryName = dioceses[0]._boundaryName || 'Region';
        const country = dioceses[0].Country || 'N/A';
        const diocesesList = dioceses.map((d, index) => `<li style="cursor:pointer;padding:4px 0;color:#3498db;text-decoration:underline;" data-diocese-index="${index}" class="diocese-link">${d.Diocese}</li>`).join('');
        return `<div class="popup-header" style="color:#ecf0f1;background:#2c3e50;padding:10px;margin:-15px -15px 10px -15px;border-radius:8px 8px 0 0;">${boundaryName}</div><div class="popup-stat"><span class="popup-stat-label">Country:</span><span class="popup-stat-value">${country}</span></div><div class="popup-stat"><span class="popup-stat-label">Dioceses in region:</span><span class="popup-stat-value">${dioceses.length}</span></div><div class="popup-stat"><span class="popup-stat-label">${aggregationType} ${config.label}:</span><span class="popup-stat-value">${formattedValue}</span></div><div style="margin-top:10px;max-height:150px;overflow-y:auto;"><strong>Dioceses (click to view trends):</strong><ul style="margin:5px 0;padding-left:20px;font-size:12px;list-style:none;">${diocesesList}</ul></div><div style="display:none;" id="multi-diocese-data">${JSON.stringify(dioceses.map((d, i) => ({index: i, diocese: d, historicalData: dioceseMap.get(d.Diocese || d.ID)})))}</div>`;
    },
    
    setupModalButton(popupElement, dioceseInfo, dioceses, dioceseMap, statistic) {
        const modalBtn = popupElement.querySelector('#open-chart-modal-btn');
        if (modalBtn) {
            modalBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                ChartModal.open(dioceseInfo);
            });
        }
        
        const dioceseLinks = popupElement.querySelectorAll('.diocese-link');
        if (dioceseLinks.length > 0) {
            const dataElement = popupElement.querySelector('#multi-diocese-data');
            if (dataElement) {
                const diocesesData = JSON.parse(dataElement.textContent);
                dioceseLinks.forEach(link => {
                    link.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        const index = parseInt(this.getAttribute('data-diocese-index'));
                        const data = diocesesData[index];
                        if (data && data.historicalData && data.historicalData.length > 1) {
                            ChartModal.open({
                                title: data.diocese.Diocese,
                                country: data.diocese.Country || 'N/A',
                                statistic: statistic,
                                historicalData: data.historicalData
                            });
                        } else {
                            alert('No historical data available for ' + data.diocese.Diocese);
                        }
                    });
                });
            }
        }
    },
    
    createPopupContent(diocese, statistic, historicalData) {
        const format = CONFIG.STATISTICS[statistic].format;
        const value = DataProcessor.formatValue(diocese[statistic], format);
        const dioceseTitle = diocese.Diocese || 'Unknown Diocese';
        const dioceseName = diocese.Name || 'N/A';
        const country = diocese.Country || 'N/A';
        const hasHistoricalData = historicalData && historicalData.length > 1;
        return `<div class="popup-header" style="color:#ecf0f1;background:#2c3e50;padding:10px;margin:-15px -15px 10px -15px;border-radius:8px 8px 0 0;">${dioceseTitle}</div><div class="popup-stat"><span class="popup-stat-label">Country:</span><span class="popup-stat-value">${country}</span></div><div class="popup-stat"><span class="popup-stat-label">Name:</span><span class="popup-stat-value">${dioceseName}</span></div><div class="popup-stat"><span class="popup-stat-label">${CONFIG.STATISTICS[statistic].label}:</span><span class="popup-stat-value">${value}</span></div><div class="popup-stat"><span class="popup-stat-label">Year:</span><span class="popup-stat-value">${diocese.Year}</span></div><div class="popup-stat"><span class="popup-stat-label">Type:</span><span class="popup-stat-value">${diocese.Type_of_Jurisdiction || 'N/A'}</span></div>${hasHistoricalData ? '<div style="margin-top:15px;padding-top:15px;border-top:1px solid #34495e;"><button id="open-chart-modal-btn" class="chart-toggle-btn">📊 View Historical Trends</button></div>' : ''}`;
    }
};