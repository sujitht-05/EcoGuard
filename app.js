/**
 * EcoGuard Main Controller & Application Logic
 * Integrates state management, UI events, tab switching, and simulator interactivity.
 */

document.addEventListener('DOMContentLoaded', function() {
    EcoGuardApp.init();
});

const EcoGuardApp = {
    currentStationId: 'downtown',
    currentTab: 'overview',
    currentTheme: 'dark',
    spikeFilter: 'all',
    alertFilter: 'all',

    init: function() {
        this.bindEvents();
        this.populateStationDropdown();
        this.loadStation(this.currentStationId);
        this.initExposureCalculator();
        this.renderSpikeTable();
        this.renderAlertsList();
        this.renderStationComparison();

        // Initialize Simulator Baseline
        const activeStation = EcoGuardData.stations.find(s => s.id === this.currentStationId);
        EcoGuardSimulator.init(activeStation);
        this.runSimulator();
    },

    bindEvents: function() {
        // Tab Navigation
        const navLinks = document.querySelectorAll('.nav-link-item');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetTab = link.getAttribute('data-tab');
                this.switchTab(targetTab);

                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            });
        });

        // Header Bell Alert Button shortcut to Alerts Tab
        const headerAlertsBtn = document.getElementById('header-alerts-btn');
        if (headerAlertsBtn) {
            headerAlertsBtn.addEventListener('click', () => {
                this.switchTab('alerts');
                navLinks.forEach(l => {
                    if (l.getAttribute('data-tab') === 'alerts') l.classList.add('active');
                    else l.classList.remove('active');
                });
            });
        }

        // Station Selector Dropdown
        const stationSelect = document.getElementById('station-select');
        if (stationSelect) {
            stationSelect.addEventListener('change', (e) => {
                this.loadStation(e.target.value);
            });
        }

        // Theme Toggle Switch
        const themeBtn = document.getElementById('theme-toggle-btn');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                this.toggleTheme();
            });
        }

        // Mobile Sidebar Toggle
        const mobileToggleBtn = document.getElementById('mobile-sidebar-toggle');
        const sidebar = document.getElementById('sidebar');
        if (mobileToggleBtn && sidebar) {
            mobileToggleBtn.addEventListener('click', () => {
                sidebar.classList.toggle('show');
            });
        }

        // Environmental Impact Simulator Sliders
        const simSliders = document.querySelectorAll('.sim-slider');
        simSliders.forEach(slider => {
            slider.addEventListener('input', () => {
                const valDisplay = document.getElementById(slider.id + '-val');
                if (valDisplay) {
                    let suffix = '%';
                    if (slider.id.includes('wind')) suffix = ' km/h';
                    if (slider.id.includes('rain')) suffix = ' mm/h';
                    valDisplay.textContent = (slider.value > 0 && !slider.id.includes('wind') && !slider.id.includes('rain') ? '+' : '') + slider.value + suffix;
                }
                this.runSimulator();
            });
        });

        // Simulator Presets
        const presetBtns = document.querySelectorAll('.preset-pill');
        presetBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                presetBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const presetKey = btn.getAttribute('data-preset');
                this.applySimulatorPreset(presetKey);
            });
        });

        // Personal Exposure Form
        const exposureForm = document.getElementById('exposure-form');
        if (exposureForm) {
            exposureForm.addEventListener('input', () => {
                this.calculatePersonalExposure();
            });
        }

        // Anomaly Spike Filters
        const spikeFilterBtns = document.querySelectorAll('.spike-filter-btn');
        spikeFilterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                spikeFilterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.spikeFilter = btn.getAttribute('data-severity');
                this.renderSpikeTable();
            });
        });

        // Smart Alert Filters
        const alertFilterBtns = document.querySelectorAll('.alert-filter-btn');
        alertFilterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                alertFilterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.alertFilter = btn.getAttribute('data-severity');
                this.renderAlertsList();
            });
        });

        // Station Comparison Table Search Input
        const compSearch = document.getElementById('comparison-search-input');
        if (compSearch) {
            compSearch.addEventListener('input', () => {
                this.renderStationComparison();
            });
        }

        // Trigger Test Alert Button
        const testAlertBtn = document.getElementById('trigger-test-alert-btn');
        if (testAlertBtn) {
            testAlertBtn.addEventListener('click', () => {
                this.triggerTestAlert();
            });
        }

        // Auto Chart Resize on Window Resize
        window.addEventListener('resize', () => {
            this.renderTabCharts(this.currentTab);
            if (this.currentTab === 'map' || this.currentTab === 'overview') {
                EcoGuardMap.resize();
            }
        });
    },

    populateStationDropdown: function() {
        const select = document.getElementById('station-select');
        if (!select) return;

        select.innerHTML = '';
        EcoGuardData.stations.forEach(st => {
            const opt = document.createElement('option');
            opt.value = st.id;
            opt.textContent = `${st.name} (${st.zoneType})`;
            if (st.id === this.currentStationId) opt.selected = true;
            select.appendChild(opt);
        });
    },

    switchTab: function(tabId) {
        this.currentTab = tabId;
        const views = document.querySelectorAll('.page-view');
        views.forEach(view => {
            view.classList.remove('active');
        });

        const targetView = document.getElementById(`view-${tabId}`);
        if (targetView) {
            targetView.classList.add('active');
        }

        setTimeout(() => {
            this.renderTabCharts(tabId);
            if (tabId === 'map' || tabId === 'overview') {
                EcoGuardMap.resize();
            }
        }, 50);
    },

    loadStation: function(stationId) {
        this.currentStationId = stationId;
        const station = EcoGuardData.stations.find(s => s.id === stationId) || EcoGuardData.stations[0];

        // 1. Update KPI Cards & Header Text
        const stName = document.getElementById('current-station-name');
        if (stName) stName.textContent = station.name;
        
        const stZone = document.getElementById('current-station-zone');
        if (stZone) stZone.textContent = station.zoneType;
        
        document.getElementById('kpi-aqi-val').textContent = station.aqi;
        document.getElementById('kpi-aqi-status').textContent = station.aqiStatus;
        document.getElementById('kpi-aqi-status').style.color = station.aqiColor;

        document.getElementById('kpi-noise-val').textContent = station.noiseDb + ' dB';
        document.getElementById('kpi-noise-status').textContent = station.noiseStatus;

        document.getElementById('kpi-weather-val').textContent = `${station.temp}°C`;
        document.getElementById('kpi-weather-sub').textContent = `Humidity: ${station.humidity}% | Wind: ${station.windSpeed} km/h ${station.windDir}`;

        document.getElementById('kpi-risk-val').textContent = `${station.riskScore}/100`;
        document.getElementById('kpi-risk-status').textContent = station.riskStatus;

        // 2. Update Inner Gauge Text & SVG Circles
        document.getElementById('aqi-gauge-score').textContent = station.aqi;
        document.getElementById('risk-gauge-score').textContent = station.riskScore;
        this.updateSvgGauge('aqi-gauge-circle', station.aqi, 300, station.aqiColor);
        this.updateSvgGauge('risk-gauge-circle', station.riskScore, 100, station.riskScore > 60 ? '#ef4444' : (station.riskScore > 35 ? '#f59e0b' : '#10b981'));

        // 3. Update Noise Tab Live Elements
        const liveNoise = document.getElementById('live-noise-val');
        if (liveNoise) liveNoise.innerHTML = `${station.noiseDb} <span class="fs-5">dB</span>`;
        const liveNoiseStatus = document.getElementById('live-noise-status');
        if (liveNoiseStatus) liveNoiseStatus.textContent = station.noiseStatus;

        // 4. Update Detailed Pollutant Cards
        document.getElementById('val-pm25').textContent = `${station.pm25} µg/m³`;
        document.getElementById('val-pm10').textContent = `${station.pm10} µg/m³`;
        document.getElementById('val-co').textContent = `${station.co} ppm`;
        document.getElementById('val-no2').textContent = `${station.no2} ppb`;
        document.getElementById('val-so2').textContent = `${station.so2} ppb`;
        document.getElementById('val-o3').textContent = `${station.o3} ppb`;

        // 5. Persistence Forecast Box
        document.getElementById('persistence-hours').textContent = `${station.persistenceHours} Hours`;
        document.getElementById('persistence-note').textContent = station.persistenceNote;

        // 6. Update Leaflet Map
        if (typeof L !== 'undefined') {
            if (!EcoGuardMap.map) {
                EcoGuardMap.init('leaflet-map', EcoGuardData.stations, (selectedId) => {
                    const sel = document.getElementById('station-select');
                    if (sel) sel.value = selectedId;
                    this.loadStation(selectedId);
                });
            }
            EcoGuardMap.focusStation(station);
        }

        // 7. Update Simulator Baseline & Render Tab Functions
        EcoGuardSimulator.setBaseline(station);
        this.runSimulator();
        this.calculatePersonalExposure();
        this.render7DayForecast(stationId);
        this.renderStationComparison();

        // 8. Render active tab charts
        this.renderTabCharts(this.currentTab);
    },

    renderTabCharts: function(tabId) {
        const station = EcoGuardData.stations.find(s => s.id === this.currentStationId) || EcoGuardData.stations[0];
        const timelineData = EcoGuardData.get24HourTimeline(this.currentStationId);

        if (tabId === 'overview') {
            EcoGuardCharts.initAqiTrendChart('aqiTrendChartCanvas', timelineData);
            EcoGuardCharts.initFactorsChart('factorsChartCanvas', station.factors);
        } else if (tabId === 'air') {
            EcoGuardCharts.initPollutantsChart('pollutantsChartCanvas', station);
        } else if (tabId === 'noise') {
            EcoGuardCharts.initNoiseTimelineChart('noiseChartCanvas', timelineData);
        } else if (tabId === 'weather') {
            EcoGuardCharts.initCorrelationChart('correlationChartCanvas', timelineData);
        } else if (tabId === 'ai') {
            const forecastList = EcoGuardData.get7DayForecast(this.currentStationId);
            EcoGuardCharts.init7DayAiChart('ai7DayChartCanvas', forecastList);
        } else if (tabId === 'map') {
            EcoGuardCharts.initStationComparisonChart('comparisonChartCanvas', EcoGuardData.stations);
        } else if (tabId === 'simulator') {
            this.runSimulator();
        }
    },

    updateSvgGauge: function(circleId, score, maxVal, color) {
        const circle = document.getElementById(circleId);
        if (!circle) return;

        const radius = 70;
        const circumference = 2 * Math.PI * radius;
        const normalizedScore = Math.min(maxVal, Math.max(0, score));
        const offset = circumference - (normalizedScore / maxVal) * circumference;

        circle.style.strokeDasharray = `${circumference} ${circumference}`;
        circle.style.strokeDashoffset = offset;
        circle.style.stroke = color;
    },

    runSimulator: function() {
        const trafficChange = parseFloat(document.getElementById('sim-traffic').value);
        const industryChange = parseFloat(document.getElementById('sim-industry').value);
        const windSpeed = parseFloat(document.getElementById('sim-wind').value);
        const rainfall = parseFloat(document.getElementById('sim-rain').value);
        const greenCanopy = parseFloat(document.getElementById('sim-canopy').value);

        const simResult = EcoGuardSimulator.calculate({
            trafficChange, industryChange, windSpeed, rainfall, greenCanopy
        });

        // Render Simulator Output UI
        document.getElementById('sim-aqi-val').textContent = simResult.aqi;
        document.getElementById('sim-aqi-status').textContent = simResult.aqiStatus;
        document.getElementById('sim-aqi-status').style.color = simResult.aqiColor;

        document.getElementById('sim-noise-val').textContent = simResult.noiseDb + ' dB';
        document.getElementById('sim-risk-val').textContent = simResult.riskScore + '/100';
        document.getElementById('sim-risk-status').textContent = simResult.riskStatus;

        document.getElementById('sim-pm25-val').textContent = simResult.pm25 + ' µg/m³';
        document.getElementById('sim-persistence-val').textContent = simResult.persistenceHours + ' hrs to clear';

        // Delta indicators
        const aqiDeltaElem = document.getElementById('sim-aqi-delta');
        if (aqiDeltaElem) {
            const d = simResult.deltas.aqi;
            aqiDeltaElem.textContent = (d > 0 ? '+' : '') + d + ' AQI';
            aqiDeltaElem.className = 'badge ' + (d > 0 ? 'bg-danger' : (d < 0 ? 'bg-success' : 'bg-secondary'));
        }

        // Update Simulator Comparison Chart
        EcoGuardCharts.initSimulatorChart('simulatorChartCanvas', simResult.baseline, simResult);
    },

    applySimulatorPreset: function(presetKey) {
        const preset = EcoGuardSimulator.presets[presetKey];
        if (!preset) return;

        document.getElementById('sim-traffic').value = preset.trafficChange;
        document.getElementById('sim-traffic-val').textContent = (preset.trafficChange > 0 ? '+' : '') + preset.trafficChange + '%';

        document.getElementById('sim-industry').value = preset.industryChange;
        document.getElementById('sim-industry-val').textContent = (preset.industryChange > 0 ? '+' : '') + preset.industryChange + '%';

        document.getElementById('sim-wind').value = preset.windSpeed;
        document.getElementById('sim-wind-val').textContent = preset.windSpeed + ' km/h';

        document.getElementById('sim-rain').value = preset.rainfall;
        document.getElementById('sim-rain-val').textContent = preset.rainfall + ' mm/h';

        document.getElementById('sim-canopy').value = preset.greenCanopy;
        document.getElementById('sim-canopy-val').textContent = '+' + preset.greenCanopy + '%';

        this.runSimulator();
    },

    initExposureCalculator: function() {
        this.calculatePersonalExposure();
    },

    calculatePersonalExposure: function() {
        const activitySelect = document.getElementById('exp-activity');
        const durationSelect = document.getElementById('exp-duration');
        const groupSelect = document.getElementById('exp-group');

        if (!activitySelect || !durationSelect || !groupSelect) return;

        const activityMult = parseFloat(activitySelect.value);
        const durationHours = parseFloat(durationSelect.value);
        const groupMult = parseFloat(groupSelect.value);

        const station = EcoGuardData.stations.find(s => s.id === this.currentStationId) || EcoGuardData.stations[0];

        const rawExposure = (station.pm25 * activityMult * durationHours * groupMult) / 8.0;
        const exposureScore = Math.min(100, Math.round(rawExposure));

        let expStatus = 'Safe Outdoor Exposure';
        let expColor = '#10b981';
        let expRec = 'Safe for normal outdoor exercise and activities. No mask required.';

        if (exposureScore > 65) {
            expStatus = 'Severe Exposure Risk';
            expColor = '#ef4444';
            expRec = 'Avoid outdoor exertion. High particulate intake risk. N95 respirator recommended.';
        } else if (exposureScore > 35) {
            expStatus = 'Moderate Exposure Risk';
            expColor = '#f59e0b';
            expRec = 'Limit outdoor intense workouts. Sensitive individuals should stay indoors.';
        }

        document.getElementById('exp-score-val').textContent = `${exposureScore} / 100`;
        document.getElementById('exp-score-status').textContent = expStatus;
        document.getElementById('exp-score-status').style.color = expColor;
        document.getElementById('exp-recommendation').textContent = expRec;
    },

    render7DayForecast: function(stationId) {
        const container = document.getElementById('7day-forecast-container');
        if (!container) return;

        const forecastList = EcoGuardData.get7DayForecast(stationId);
        container.innerHTML = '';

        forecastList.forEach(item => {
            const card = document.createElement('div');
            card.className = 'glass-card p-3 text-center flex-fill m-1';
            card.innerHTML = `
                <div class="fw-bold text-muted mb-1">${item.day}</div>
                <div class="display-6 fw-bold my-1" style="color: ${item.color}">${item.aqi}</div>
                <span class="badge mb-2" style="background-color: ${item.color}">${item.status}</span>
                <div class="small text-muted border-top border-secondary opacity-75 pt-2 mt-1">
                    <div><strong>PM2.5:</strong> ${item.pm25} µg/m³</div>
                    <div><strong>PM10:</strong> ${item.pm10} µg/m³</div>
                    <div><strong>Noise:</strong> ${item.noise} dB</div>
                </div>
                <div class="small text-info mt-2"><i class="bi bi-cpu me-1"></i>AI ${item.confidence}</div>
            `;
            container.appendChild(card);
        });

        EcoGuardCharts.init7DayAiChart('ai7DayChartCanvas', forecastList);
    },

    renderSpikeTable: function() {
        const tbody = document.getElementById('spike-table-body');
        if (!tbody) return;

        let spikes = EcoGuardData.getSpikeEvents();
        if (this.spikeFilter !== 'all') {
            spikes = spikes.filter(s => s.severity.toLowerCase() === this.spikeFilter.toLowerCase());
        }

        tbody.innerHTML = '';

        spikes.forEach(spk => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${spk.time}</strong></td>
                <td><span class="badge bg-dark">${spk.location}</span></td>
                <td><span class="text-warning font-weight-bold">${spk.metric}</span></td>
                <td><span class="text-danger font-weight-bold">${spk.spikeValue}</span></td>
                <td><span class="badge ${spk.severity === 'Critical' ? 'bg-danger' : (spk.severity === 'High' ? 'bg-warning text-dark' : 'bg-info')}">${spk.severity}</span></td>
                <td class="small">${spk.cause} <div class="text-muted text-xs"><i class="bi bi-cpu me-1"></i>${spk.confidence}</div></td>
                <td><button class="btn btn-sm btn-outline-info" onclick="alert('Action Directive Dispatched for ${spk.location}:\\n\\n${spk.recommendedAction}')"><i class="bi bi-shield-check me-1"></i>Act</button></td>
            `;
            tbody.appendChild(tr);
        });
    },

    renderAlertsList: function() {
        const container = document.getElementById('alerts-feed-container');
        if (!container) return;

        let alerts = EcoGuardData.getAlerts();
        if (this.alertFilter !== 'all') {
            alerts = alerts.filter(a => a.severity.toLowerCase() === this.alertFilter.toLowerCase());
        }

        container.innerHTML = '';

        if (alerts.length === 0) {
            container.innerHTML = `<div class="p-4 text-center text-muted">No active alerts matching filter "${this.alertFilter}".</div>`;
            return;
        }

        alerts.forEach(alt => {
            const div = document.createElement('div');
            div.className = `alert alert-${alt.type} glass-card mb-3 p-3`;
            div.innerHTML = `
                <div class="d-flex align-items-start gap-3">
                    <i class="bi ${alt.icon} fs-3 text-${alt.type}"></i>
                    <div class="flex-grow-1">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <h6 class="alert-heading m-0 fw-bold">${alt.title}</h6>
                            <span class="badge bg-dark">${alt.timestamp}</span>
                        </div>
                        <div class="small mb-2">
                            <span class="badge bg-secondary me-2"><i class="bi bi-geo-alt me-1"></i>${alt.location}</span>
                            <span class="badge bg-outline-secondary me-2">Metric: ${alt.parameter}</span>
                            <span class="badge ${alt.severity === 'Critical' ? 'bg-danger' : (alt.severity === 'High' ? 'bg-warning text-dark' : 'bg-success')}">${alt.severity}</span>
                        </div>
                        <p class="m-0 small text-light">${alt.message}</p>
                        <div class="mt-2 pt-2 border-top border-secondary opacity-50 d-flex justify-content-between align-items-center small">
                            <div><strong class="text-warning"><i class="bi bi-lightbulb me-1"></i>Action:</strong> ${alt.recommendedAction}</div>
                            <button class="btn btn-xs btn-outline-light ms-2" onclick="this.textContent='Acknowledged ✓'; this.disabled=true;">Acknowledge</button>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(div);
        });
    },

    triggerTestAlert: function() {
        const now = new Date();
        const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0') + ' just now';
        
        const newAlert = {
            id: 'alt-' + Date.now(),
            type: 'warning',
            title: 'Simulated PM10 Construction Dust Alert',
            message: 'PM10 concentration surged to 118 µg/m³ near Central Downtown Hub due to excavators.',
            timestamp: timeStr,
            location: 'Central Downtown Hub',
            parameter: 'PM10 (118 µg/m³)',
            severity: 'High',
            recommendedAction: 'Mandate dust suppression water sprays on Construction Zone 2.',
            icon: 'bi-exclamation-triangle-fill'
        };

        EcoGuardData.getAlerts().unshift(newAlert);
        this.renderAlertsList();
    },

    renderStationComparison: function() {
        const cardContainer = document.getElementById('comparison-matrix-container');
        const tableBody = document.getElementById('comparison-table-body');
        const searchInput = document.getElementById('comparison-search-input');
        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

        let stations = EcoGuardData.stations;
        if (query) {
            stations = stations.filter(s => s.name.toLowerCase().includes(query) || s.zoneType.toLowerCase().includes(query));
        }
        
        if (cardContainer) {
            cardContainer.innerHTML = '';
            stations.forEach(st => {
                const isActive = st.id === this.currentStationId;
                const col = document.createElement('div');
                col.className = 'col-md-4 col-sm-6 mb-3';
                col.innerHTML = `
                    <div class="glass-card h-100 ${isActive ? 'border-primary shadow' : ''}">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h6 class="m-0 fw-bold">${st.name}</h6>
                            <span class="badge" style="background-color: ${st.aqiColor}">AQI ${st.aqi}</span>
                        </div>
                        <p class="small text-muted mb-3"><i class="bi bi-geo-alt me-1"></i>${st.zoneType}</p>
                        <div class="d-flex justify-content-between border-bottom border-secondary pb-1 mb-2 small">
                            <span>PM2.5:</span> <strong>${st.pm25} µg/m³</strong>
                        </div>
                        <div class="d-flex justify-content-between border-bottom border-secondary pb-1 mb-2 small">
                            <span>PM10:</span> <strong>${st.pm10} µg/m³</strong>
                        </div>
                        <div class="d-flex justify-content-between border-bottom border-secondary pb-1 mb-2 small">
                            <span>Noise Level:</span> <strong>${st.noiseDb} dB</strong>
                        </div>
                        <div class="d-flex justify-content-between border-bottom border-secondary pb-1 mb-2 small">
                            <span>Temp / Wind:</span> <strong>${st.temp}°C / ${st.windSpeed} km/h</strong>
                        </div>
                        <div class="d-flex justify-content-between pt-1 small">
                            <span>Env. Risk Score:</span> <strong style="color: ${st.riskScore > 60 ? '#ef4444' : '#10b981'}">${st.riskScore}/100</strong>
                        </div>
                        <button class="btn btn-xs ${isActive ? 'btn-success' : 'btn-primary'} w-100 mt-3" onclick="EcoGuardApp.loadStation('${st.id}')">
                            <i class="bi bi-crosshair me-1"></i>${isActive ? 'Active Station' : 'Focus Station'}
                        </button>
                    </div>
                `;
                cardContainer.appendChild(col);
            });
        }

        if (tableBody) {
            tableBody.innerHTML = '';
            stations.forEach(st => {
                const isActive = st.id === this.currentStationId;
                const tr = document.createElement('tr');
                if (isActive) tr.className = 'table-active';

                tr.innerHTML = `
                    <td><strong>${st.name}</strong> ${isActive ? '<span class="badge bg-primary ms-1">Active</span>' : ''}</td>
                    <td><span class="badge bg-dark">${st.zoneType}</span></td>
                    <td><span class="badge" style="background-color: ${st.aqiColor}; color: #fff;">AQI ${st.aqi}</span> <span class="small d-block text-muted">${st.aqiStatus}</span></td>
                    <td><strong>${st.pm25}</strong> µg/m³</td>
                    <td><strong>${st.pm10}</strong> µg/m³</td>
                    <td><strong>${st.noiseDb}</strong> dB</td>
                    <td>${st.temp}°C / ${st.windSpeed} km/h</td>
                    <td><strong style="color: ${st.riskScore > 60 ? '#ef4444' : '#10b981'}">${st.riskScore} / 100</strong></td>
                    <td>
                        <button class="btn btn-sm ${isActive ? 'btn-success' : 'btn-outline-primary'}" onclick="EcoGuardApp.loadStation('${st.id}')">${isActive ? 'Active' : 'Focus'}</button>
                    </td>
                `;
                tableBody.appendChild(tr);
            });
        }

        EcoGuardCharts.initStationComparisonChart('comparisonChartCanvas', EcoGuardData.stations);
    },

    toggleTheme: function() {
        this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', this.currentTheme);
        const icon = document.querySelector('#theme-toggle-btn i');
        if (icon) {
            icon.className = this.currentTheme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
        }
    }
};

window.EcoGuardApp = EcoGuardApp;
