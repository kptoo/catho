const CONFIG = {
    CSV_PATH: 'Catholic_Hier_All_Data.csv',
    LOADED_COUNTRIES: new Set(),
    
    MAP_CONFIG: {
        center: [12.5, 41.9],
        zoom: 2,
        minZoom: 2,
        maxZoom: 18
    },
    
    STATISTICS: {
        'Catholics': { label: 'Catholics', format: 'number', aggregation: 'sum' },
        'Total Population': { label: 'Total Population', format: 'number', aggregation: 'sum' },
        'Percent Catholic': { label: 'Percent Catholic', format: 'percent', aggregation: 'avg' },
        'Diocesan Priests': { label: 'Diocesan Priests', format: 'number', aggregation: 'sum' },
        'Religious Priests': { label: 'Religious Priests', format: 'number', aggregation: 'sum' },
        'Total Priests': { label: 'Total Priests', format: 'number', aggregation: 'sum' },
        'Catholics Per Priest': { label: 'Catholics Per Priest', format: 'number', aggregation: 'avg' },
        'Permanent Deacons': { label: 'Permanent Deacons', format: 'number', aggregation: 'sum' },
        'Male Religious': { label: 'Male Religious', format: 'number', aggregation: 'sum' },
        'Female Religious': { label: 'Female Religious', format: 'number', aggregation: 'sum' },
        'Parishes': { label: 'Parishes', format: 'number', aggregation: 'sum' }
    },
    
    HEATMAP_COLORS: [
        '#7f1d1d',
        '#991b1b',
        '#dc2626',
        '#ef4444',
        '#f97316',
        '#fb923c',
        '#fbbf24',
        '#facc15',
        '#84cc16',
        '#22c55e',
        '#10b981',
        '#059669'
    ],
    
    CONTINENTS: {
        'All': null,
        'North America': [
            'United States', 'Canada', 'Mexico',
            'Guatemala', 'Honduras', 'El Salvador', 'Nicaragua',
            'Costa Rica', 'Panama',
            'Cuba', 'Dominican Republic', 'Haiti', 'Jamaica',
            'Trinidad and Tobago', 'Bahamas', 'Barbados',
            'Saint Lucia', 'Grenada', 'Saint Vincent and the Grenadines',
            'Antigua and Barbuda', 'Dominica', 'Saint Kitts and Nevis',
            'Belize', 'Bermuda', 'British Virgin Islands', 'Aruba', 'Anguilla'
        ],
        'South America': [
            'Brazil', 'Argentina', 'Colombia', 'Peru', 'Venezuela',
            'Chile', 'Ecuador', 'Bolivia', 'Paraguay', 'Uruguay',
            'Guyana', 'Suriname', 'French Guiana'
        ],
        'Europe': [
            'Italy', 'Spain', 'France', 'Poland', 'Germany',
            'United Kingdom', 'Portugal', 'Netherlands', 'Belgium',
            'Czech Republic', 'Greece', 'Hungary', 'Austria', 'Switzerland',
            'Sweden', 'Romania', 'Ireland', 'Croatia', 'Slovakia',
            'Lithuania', 'Slovenia', 'Latvia', 'Estonia', 'Luxembourg',
            'Malta', 'Cyprus', 'Denmark', 'Finland', 'Norway', 'Iceland',
            'Albania', 'Serbia', 'Bosnia and Herzegovina', 'North Macedonia',
            'Montenegro', 'Moldova', 'Ukraine', 'Belarus', 'Russia', 'Bulgaria',
            'Andorra', 'Liechtenstein', 'Monaco', 'San Marino', 'Kosovo', 'Vatican City'
        ],
        'Asia': [
            'Philippines', 'India', 'China', 'Indonesia', 'Japan', 'South Korea',
            'Vietnam', 'Thailand', 'Myanmar', 'Sri Lanka', 'Pakistan',
            'Bangladesh', 'Malaysia', 'Singapore', 'Cambodia', 'Laos',
            'East Timor', 'Taiwan', 'Hong Kong', 'Macau', 'Mongolia',
            'Kazakhstan', 'Uzbekistan', 'Turkmenistan', 'Kyrgyzstan',
            'Tajikistan', 'Afghanistan', 'Nepal', 'Bhutan', 'Maldives',
            'Bahrain', 'Brunei', 'Cyprus', 'Georgia', 'Iran',
            'Iraq', 'Israel', 'Jordan', 'Kuwait', 'Lebanon', 'North Korea',
            'Oman', 'Qatar', 'Saudi Arabia', 'Syria', 'Turkey',
            'United Arab Emirates', 'Yemen', 'Palestine'
        ],
        'Africa': [
            'Nigeria', 'Congo (DRC)', 'Ethiopia', 'Kenya', 'Tanzania',
            'Uganda', 'South Africa', 'Ghana', 'Madagascar', 'Cameroon',
            'Angola', 'Mozambique', 'Malawi', 'Zambia', 'Zimbabwe',
            'Rwanda', 'Burundi', 'Benin', 'Togo', 'Burkina Faso', 'Mali',
            'Niger', 'Chad', 'Central African Republic', 'Gabon',
            'Equatorial Guinea', 'Republic of the Congo', 'Egypt', 'Morocco',
            'Algeria', 'Tunisia', 'Libya', 'Sudan', 'South Sudan', 'Somalia',
            'Eritrea', 'Djibouti', 'Mauritius', 'Seychelles', 'Cape Verde',
            'Sao Tome and Principe', 'Comoros', 'Lesotho', 'Eswatini',
            'Botswana', 'Namibia', 'Mauritania', 'Senegal', 'Gambia',
            'Guinea-Bissau', 'Guinea', 'Sierra Leone', 'Liberia', 'Ivory Coast',
            'Cabo Verde', 'Western Sahara', 'Mayotte', 'Saint Helena'
        ],
        'Oceania': [
            'Australia', 'New Zealand', 'Papua New Guinea', 'Fiji',
            'Solomon Islands', 'Vanuatu', 'Samoa', 'Kiribati', 'Micronesia',
            'Tonga', 'Palau', 'Marshall Islands', 'Nauru', 'Tuvalu',
            'New Caledonia', 'French Polynesia', 'Guam', 'Northern Mariana Islands'
        ]
    },
    
    CHART_CONFIG: {
        margin: { top: 10, right: 120, bottom: 30, left: 50 },
        height: 200
    },
    
    PERFORMANCE: {
        ENABLE_PRELOAD: false,
        PRELOAD_COUNTRIES: [],
        START_WITH_GLOBAL_VIEW: true,
        CACHE_EXPIRY_HOURS: 1,
        MAX_CHUNK_SIZE: 20
    }
};

console.log('✓ CONFIG loaded successfully');