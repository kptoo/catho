const ChartRenderer = {
    renderChart(data, statistics) {
        const container = document.getElementById('chart-container');
        console.log('ChartRenderer.renderChart called:', { 
            hasContainer: !!container, 
            dataLength: data ? data.length : 0, 
            statisticsLength: statistics ? statistics.length : 0,
            statistics: statistics
        });
        
        if (!container || !data || data.length === 0 || !statistics || statistics.length === 0) {
            console.log('Early return - missing requirements');
            return;
        }
        
        container.innerHTML = '';
        
        // Check if there's only one year of data
        const uniqueYears = [...new Set(data.map(d => d.Year))];
        console.log('Unique years:', uniqueYears);
        
        if (uniqueYears.length === 1) {
            // Show single year data as a bar chart or message
            container.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #95a5a6; font-size: 13px;">
                    <p style="margin-bottom: 15px;">Only ${uniqueYears[0]} data available</p>
                    <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;">
                        ${statistics.map(stat => {
                            const val = data[0][stat];
                            const formatted = DataProcessor.formatValue(val, CONFIG.STATISTICS[stat].format);
                            return `
                                <div style="background: #2c3e50; padding: 8px 12px; border-radius: 4px; border-left: 3px solid #3498db;">
                                    <div style="font-size: 11px; color: #95a5a6; margin-bottom: 3px;">${stat}</div>
                                    <div style="font-size: 14px; font-weight: 600; color: #ecf0f1;">${formatted}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
            return;
        }
        
        // Prepare data for each statistic
        const chartDataSets = statistics.map(stat => {
            const values = data
                .map(d => ({
                    year: parseInt(d.Year),
                    value: parseFloat(d[stat])
                }))
                .filter(d => !isNaN(d.year) && !isNaN(d.value) && d.value !== null);
            
            console.log(`Stat ${stat}:`, values.length, 'valid points');
            
            return {
                statistic: stat,
                data: values
            };
        }).filter(ds => ds.data.length > 0);
        
        console.log('Chart datasets prepared:', chartDataSets.length);
        
        if (chartDataSets.length === 0) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #7f8c8d;">No valid data for selected statistics</div>';
            return;
        }
        
        const width = container.offsetWidth;
        const height = CONFIG.CHART_CONFIG.height;
        const margin = CONFIG.CHART_CONFIG.margin;
        
        console.log('Chart dimensions:', { width, height, margin });
        
        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);
        
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;
        
        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);
        
        // Get all years across all datasets
        const allYears = [...new Set(chartDataSets.flatMap(ds => ds.data.map(d => d.year)))];
        
        const x = d3.scaleLinear()
            .domain(d3.extent(allYears))
            .range([0, chartWidth]);
        
        // Normalize values for each statistic to 0-1 range for better multi-line visualization
        const normalizedDataSets = chartDataSets.map(ds => {
            const values = ds.data.map(d => d.value);
            const min = d3.min(values);
            const max = d3.max(values);
            const range = max - min;
            
            return {
                statistic: ds.statistic,
                data: ds.data.map(d => ({
                    year: d.year,
                    value: d.value,
                    normalized: range > 0 ? (d.value - min) / range : 0.5
                })),
                min: min,
                max: max
            };
        });
        
        const y = d3.scaleLinear()
            .domain([0, 1])
            .range([chartHeight, 0]);
        
        // Color scale for different statistics
        const colorScale = d3.scaleOrdinal()
            .domain(statistics)
            .range(['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b', '#8e44ad']);
        
        const line = d3.line()
            .x(d => x(d.year))
            .y(d => y(d.normalized))
            .curve(d3.curveMonotoneX);
        
        // Draw lines for each statistic
        normalizedDataSets.forEach(ds => {
            g.append('path')
                .datum(ds.data)
                .attr('fill', 'none')
                .attr('stroke', colorScale(ds.statistic))
                .attr('stroke-width', 2)
                .attr('d', line);
            
            // Add points
            g.selectAll(`.point-${ds.statistic.replace(/\s/g, '-')}`)
                .data(ds.data)
                .enter()
                .append('circle')
                .attr('cx', d => x(d.year))
                .attr('cy', d => y(d.normalized))
                .attr('r', 3)
                .attr('fill', colorScale(ds.statistic))
                .append('title')
                .text(d => `${ds.statistic}: ${DataProcessor.formatValue(d.value, CONFIG.STATISTICS[ds.statistic].format)} (${d.year})`);
        });
        
        // X axis
        const xAxis = d3.axisBottom(x)
            .ticks(Math.min(5, allYears.length))
            .tickFormat(d3.format('d'));
        
        g.append('g')
            .attr('transform', `translate(0,${chartHeight})`)
            .call(xAxis)
            .style('font-size', '10px')
            .style('color', '#ecf0f1');
        
        // Y axis (normalized)
        g.append('g')
            .call(d3.axisLeft(y).ticks(5).tickFormat(d => (d * 100).toFixed(0) + '%'))
            .style('font-size', '10px')
            .style('color', '#ecf0f1');
        
        // Legend
        const legend = g.append('g')
            .attr('transform', `translate(${chartWidth - 100}, 10)`);
        
        normalizedDataSets.forEach((ds, i) => {
            const legendRow = legend.append('g')
                .attr('transform', `translate(0, ${i * 18})`);
            
            legendRow.append('line')
                .attr('x1', 0)
                .attr('x2', 15)
                .attr('y1', 5)
                .attr('y2', 5)
                .attr('stroke', colorScale(ds.statistic))
                .attr('stroke-width', 2);
            
            legendRow.append('text')
                .attr('x', 20)
                .attr('y', 9)
                .style('font-size', '9px')
                .style('fill', '#ecf0f1')
                .text(ds.statistic.substring(0, 15) + (ds.statistic.length > 15 ? '...' : ''));
        });
        
        console.log('Chart rendered successfully');
    }
};