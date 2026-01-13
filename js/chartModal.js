const ChartModal = {
    modal: null,
    
    initialize() {
        this.modal = document.getElementById('chart-modal');
        const closeBtn = document.getElementById('close-modal-btn');
        
        // Close on X button
        closeBtn.addEventListener('click', () => this.close());
        
        // Close on outside click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });
        
        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('active')) {
                this.close();
            }
        });
    },
    
    open(dioceseInfo) {
        const { title, country, statistic, historicalData } = dioceseInfo;
        
        // Set title and subtitle (removed years of data)
        document.getElementById('modal-diocese-title').textContent = title;
        document.getElementById('modal-diocese-subtitle').textContent = 
            `${country} • ${CONFIG.STATISTICS[statistic].label}`;
        
        // Show modal
        this.modal.classList.add('active');
        
        // Render chart with larger size
        setTimeout(() => {
            this.renderModalChart(historicalData, [statistic]);
        }, 100);
    },
    
    close() {
        this.modal.classList.remove('active');
        document.getElementById('modal-chart-container').innerHTML = '';
    },
    
    renderModalChart(data, statistics) {
        const container = document.getElementById('modal-chart-container');
        if (!container || !data || data.length === 0 || !statistics || statistics.length === 0) return;
        
        container.innerHTML = '';
        
        // Check if there's only one year of data
        const uniqueYears = [...new Set(data.map(d => d.Year))];
        
        if (uniqueYears.length === 1) {
            container.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; flex-direction: column;">
                    <div style="text-align: center; color: #666; font-size: 16px; margin-bottom: 30px;">
                        <p style="margin-bottom: 20px; font-size: 18px; font-weight: 600;">Only ${uniqueYears[0]} data available</p>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; width: 100%; max-width: 800px;">
                        ${statistics.map(stat => {
                            const val = data[0][stat];
                            const formatted = DataProcessor.formatValue(val, CONFIG.STATISTICS[stat].format);
                            return `
                                <div style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); padding: 24px; border-radius: 8px; border-left: 4px solid #3498db; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
                                    <div style="font-size: 14px; color: #95a5a6; margin-bottom: 8px; font-weight: 600;">${stat}</div>
                                    <div style="font-size: 28px; font-weight: 700; color: #ecf0f1;">${formatted}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
            return;
        }
        
        // Use D3 to render chart
        const chartDataSets = statistics.map(stat => {
            const values = data
                .map(d => ({
                    year: parseInt(d.Year),
                    value: parseFloat(d[stat])
                }))
                .filter(d => !isNaN(d.year) && !isNaN(d.value) && d.value !== null);
            
            return {
                statistic: stat,
                data: values
            };
        }).filter(ds => ds.data.length > 0);
        
        if (chartDataSets.length === 0) return;
        
        const width = container.offsetWidth;
        const height = 450;
        const margin = { top: 40, right: 150, bottom: 60, left: 80 };
        
        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);
        
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;
        
        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);
        
        const allYears = [...new Set(chartDataSets.flatMap(ds => ds.data.map(d => d.year)))];
        
        const x = d3.scaleLinear()
            .domain(d3.extent(allYears))
            .range([0, chartWidth]);
        
        // Get actual value ranges for each statistic
        const allValues = chartDataSets.flatMap(ds => ds.data.map(d => d.value));
        const y = d3.scaleLinear()
            .domain([0, d3.max(allValues) * 1.1])
            .range([chartHeight, 0]);
        
        const colorScale = d3.scaleOrdinal()
            .domain(statistics)
            .range(['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c']);
        
        const line = d3.line()
            .x(d => x(d.year))
            .y(d => y(d.value))
            .curve(d3.curveMonotoneX);
        
        // Draw lines for each statistic
        chartDataSets.forEach(ds => {
            g.append('path')
                .datum(ds.data)
                .attr('fill', 'none')
                .attr('stroke', colorScale(ds.statistic))
                .attr('stroke-width', 3)
                .attr('d', line);
            
            // Add points
            g.selectAll(`.point-${ds.statistic.replace(/\s/g, '-')}`)
                .data(ds.data)
                .enter()
                .append('circle')
                .attr('cx', d => x(d.year))
                .attr('cy', d => y(d.value))
                .attr('r', 5)
                .attr('fill', colorScale(ds.statistic))
                .attr('stroke', 'white')
                .attr('stroke-width', 2)
                .style('cursor', 'pointer')
                .append('title')
                .text(d => `${ds.statistic}: ${DataProcessor.formatValue(d.value, CONFIG.STATISTICS[ds.statistic].format)} (${d.year})`);
        });
        
        // X axis
        const xAxis = d3.axisBottom(x)
            .ticks(Math.min(10, allYears.length))
            .tickFormat(d3.format('d'));
        
        g.append('g')
            .attr('transform', `translate(0,${chartHeight})`)
            .call(xAxis)
            .style('font-size', '14px')
            .style('font-weight', '500')
            .style('color', '#ecf0f1');
        
        g.append('text')
            .attr('x', chartWidth / 2)
            .attr('y', chartHeight + 45)
            .attr('text-anchor', 'middle')
            .style('font-size', '14px')
            .style('font-weight', '600')
            .style('fill', '#95a5a6')
            .text('Year');
        
        // Y axis
        const yAxis = d3.axisLeft(y)
            .ticks(8)
            .tickFormat(d => {
                if (d >= 1000000) return (d / 1000000).toFixed(1) + 'M';
                if (d >= 1000) return (d / 1000).toFixed(0) + 'K';
                return d.toFixed(0);
            });
        
        g.append('g')
            .call(yAxis)
            .style('font-size', '14px')
            .style('font-weight', '500')
            .style('color', '#ecf0f1');
        
        g.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -chartHeight / 2)
            .attr('y', -60)
            .attr('text-anchor', 'middle')
            .style('font-size', '14px')
            .style('font-weight', '600')
            .style('fill', '#95a5a6')
            .text(CONFIG.STATISTICS[statistics[0]].label);
        
        // Legend
        const legend = g.append('g')
            .attr('transform', `translate(${chartWidth + 20}, 0)`);
        
        chartDataSets.forEach((ds, i) => {
            const legendRow = legend.append('g')
                .attr('transform', `translate(0, ${i * 30})`);
            
            legendRow.append('line')
                .attr('x1', 0)
                .attr('x2', 30)
                .attr('y1', 10)
                .attr('y2', 10)
                .attr('stroke', colorScale(ds.statistic))
                .attr('stroke-width', 3);
            
            legendRow.append('circle')
                .attr('cx', 15)
                .attr('cy', 10)
                .attr('r', 4)
                .attr('fill', colorScale(ds.statistic));
            
            legendRow.append('text')
                .attr('x', 40)
                .attr('y', 15)
                .style('font-size', '13px')
                .style('font-weight', '500')
                .style('fill', '#ecf0f1')
                .text(ds.statistic);
        });
    }
};