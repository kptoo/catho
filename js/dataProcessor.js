const DataProcessor = {
    processData(rawData) {
        const dioceseMap = new Map();
        rawData.forEach(row => {
            const dioceseId = row.Diocese || row.ID;
            if (!dioceseId) return;
            
            // Cap Percent Catholic at 100%
            if (row['Percent Catholic']) {
                const percent = parseFloat(String(row['Percent Catholic']).replace(/,/g, ''));
                if (!isNaN(percent) && percent > 100) {
                    row['Percent Catholic'] = '100';
                }
            }
            
            if (!dioceseMap.has(dioceseId)) {
                dioceseMap.set(dioceseId, []);
            }
            dioceseMap.get(dioceseId).push(row);
        });
        
        dioceseMap.forEach((records, dioceseId) => {
            records.sort((a, b) => {
                const yearA = parseInt(a.Year) || 0;
                const yearB = parseInt(b.Year) || 0;
                return yearA - yearB;
            });
        });
        
        console.log('Processed dioceses by name:', dioceseMap.size);
        const sample = dioceseMap.entries().next().value;
        if (sample) {
            console.log('Sample diocese:', sample[0], 'Years:', sample[1].length);
        }
        
        return dioceseMap;
    },
    
    getMostRecentData(dioceseMap) {
        const mostRecent = [];
        dioceseMap.forEach((records, dioceseId) => {
            if (records.length > 0) {
                const latest = records[records.length - 1];
                mostRecent.push(latest);
            }
        });
        return mostRecent;
    },
    
    getStatisticRange(data, statistic) {
        const values = data
            .map(d => {
                let val = parseFloat(String(d[statistic]).replace(/,/g, ''));
                
                // Cap percent values at 100
                if (statistic === 'Percent Catholic' && !isNaN(val) && val > 100) {
                    val = 100;
                }
                
                return val;
            })
            .filter(v => !isNaN(v) && v !== null && v !== undefined);
        
        if (values.length === 0) return [0, 100];
        
        const min = Math.min(...values);
        const max = Math.max(...values);
        
        return [min, max];
    },
    
    formatValue(value, format) {
        if (value === null || value === undefined || value === '' || value === 'NA') {
            return 'N/A';
        }
        
        let num = parseFloat(String(value).replace(/,/g, ''));
        
        if (isNaN(num)) return 'N/A';
        
        // Cap percent values at 100
        if (format === 'percent' && num > 100) {
            num = 100;
        }
        
        if (format === 'percent') {
            return num.toFixed(1) + '%';
        } else {
            return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
        }
    }
};