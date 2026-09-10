const autoGeoBtn = document.querySelector('.auto-geo-btn');
const nameCity = document.getElementById('name-city');
const countryName = document.getElementById('country');
const searchBtn = document.querySelector('.search-city-btn');
const searchModal = document.getElementById('search-modal');
const closeBtn = document.querySelector('.close');
const inputCity = document.getElementById('input-name-city');
const cityList = document.getElementById('city-list');

autoGeoBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
        alert('Геолокация не поддерживается вашим браузером');
        return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        try {
            // Обратное геокодирование через Photon (работает в РФ без VPN)
            const response = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&lang=ru`);
            const data = await response.json();

            if (data && data.features && data.features.length > 0) {
                const props = data.features[0].properties;
                const cityName = props.name || props.city || props.town || 'Мое местоположение';
                const country = props.country || '';

                document.getElementById('name-city').textContent = cityName;
                document.getElementById('country').textContent = country;
            } else {
                document.getElementById('name-city').textContent = 'Текущие координаты';
                document.getElementById('country').textContent = '';
            }

            // Загружаем погоду по координатам
            getWeatherByCoords(lat, lon);

        } catch (error) {
            console.error('Ошибка при определении местоположения:', error);
            // Даже если не удастся узнать название города по коорд., погода всё равно загрузится!
            getWeatherByCoords(lat, lon);
            document.getElementById('name-city').textContent = 'Мои координаты';
            document.getElementById('country').textContent = '';
        }
    }, (error) => {
        console.error('Ошибка геолокации:', error);
        alert('Не удалось получить доступ к вашему местоположению. Проверьте разрешения браузера.');
    });
});
searchBtn.addEventListener('click', () => {
    searchModal.style.display = 'flex';
});

closeBtn.addEventListener('click', () => {
    searchModal.style.display = 'none';
});

let debounceTimer;

inputCity.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const query = inputCity.value.trim();

    if (query.length < 2) {
        cityList.innerHTML = '';
        return;
    }

    debounceTimer = setTimeout(async () => {
        try {
            const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lang=ru`);
            const data = await response.json();

            cityList.innerHTML = '';

            if (data && data.features) {
                data.features.forEach(item => {
                    const props = item.properties;
                    const coords = item.geometry.coordinates; // [lon, lat]

                    const cityName = props.name || props.city || '';
                    const region = props.state || props.county || '';
                    const country = props.country || '';

                    if (!cityName) return;

                    const parts = [];
                    if (region && region !== cityName) parts.push(region);
                    if (country) parts.push(country);
                    const subtitleText = parts.join(', ');

                    const li = document.createElement('li');
                    li.innerHTML = `
                        <button class="city-item-btn">
                            <div class="city-text-box">
                                <span class="city-name">${cityName}</span>
                                <span class="country-name">${subtitleText}</span>
                            </div>
                            <span class="arrow-icon">&gt;</span>
                        </button>
                    `;

                    li.querySelector('.city-item-btn').addEventListener('click', () => {
                        nameCity.textContent = cityName;
                        countryEl.textContent = country;

                        getWeatherByCoords(coords[1], coords[0]);

                        searchModal.style.display = 'none';
                        inputCity.value = '';
                        cityList.innerHTML = '';
                    });

                    cityList.appendChild(li);
                });
            }
        } catch (error) {
            console.error('Ошибка при поиске города:', error);
        }
    }, 400);
});

async function getWeatherByCoords(lat, lon) {
    try {
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,windspeed_10m_max&timezone=auto`);
        const data = await response.json();

        if (data && data.current) {
            const temp = Math.round(data.current.temperature_2m);
            const apparentTemp = Math.round(data.current.apparent_temperature);
            const weatherCode = data.current.weather_code;

            document.getElementById('degree').textContent = temp;
            document.getElementById('temperature-feels').textContent = `Ощущается: ${apparentTemp}°`;
            document.getElementById('weather-name').textContent = getWeatherDescription(weatherCode);

            const weatherImg = document.querySelector('.weather-img');
            if (weatherImg) {
                weatherImg.src = getWeatherIcon(weatherCode);
            }
            updateBackgroundTheme(weatherCode);
        }

        if (data && data.daily) {
            const sevenDaysContainer = document.getElementById('weather-seven-days');
            sevenDaysContainer.innerHTML = '';

            const dailyData = data.daily;

            for (let i = 0; i < 7; i++) {
                const dateStr = dailyData.time[i];
                const maxTemp = Math.round(dailyData.temperature_2m_max[i]);
                const minTemp = Math.round(dailyData.temperature_2m_min[i]);
                const windSpeed = Math.round(dailyData.windspeed_10m_max[i]); // Теперь данные успешно считываются
                const code = dailyData.weather_code[i];

                const formattedDate = formatDayLabel(dateStr, i);

                const dayDiv = document.createElement('div');
                dayDiv.id = 'weather-day';
                dayDiv.innerHTML = `
                    <div id="day-week">
                        <span class="day">${formattedDate.dayName}</span>
                        <span class="number-day">${formattedDate.dateNum}</span>
                    </div>
                    <img class="icon-weather" src="${getWeatherIcon(code)}" alt="weather">
                    <span class="wind">${windSpeed} км/ч</span>
                    <div id="day-degree">
                        <span class="days-degree">${maxTemp}°</span>
                        <span class="night-degree">${minTemp}°</span>
                    </div>
                `;

                sevenDaysContainer.appendChild(dayDiv);
            }
        }
    } catch (error) {
        console.error('Ошибка при загрузке погоды:', error);
    }
}

function formatDayLabel(dateString, index) {
    const date = new Date(dateString);
    
    if (index === 0) {
        return {
            dayName: 'Сегодня',
            dateNum: date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
        };
    } else if (index === 1) {
        return {
            dayName: 'Завтра',
            dateNum: date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
        };
    } else {
        return {
            dayName: date.toLocaleDateString('ru-RU', { weekday: 'long' }),
            dateNum: date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
        };
    }
}

function getWeatherDescription(code) {
    const descriptions = {
        0: "Ясно",
        1: "Малооблачно",
        2: "Переменная облачность",
        3: "Пасмурно",
        45: "Туман",
        51: "Слабая морось",
        61: "Небольшой дождь",
        63: "Дождь",
        65: "Сильный дождь",
        71: "Небольшой снег",
        95: "Гроза"
    };
    return descriptions[code] || "Облачно";
}

function getWeatherIcon(code) {
    switch (code) {
        case 0:
            return './img/sun.svg';
        case 1:
        case 2:
        case 3:
            return './img/cloud.svg'; 
        case 51:
        case 61:
        case 63:
        case 65:
            return './img/rain.svg'; 
        case 71:
        case 73:
            return './img/snow.svg'; 
        case 95:
            return './img/storm.svg';
        default:
            return './img/sun.svg';
    }
}

function updateBackgroundTheme(code) {
    const body = document.body;
    
    body.className = '';

    if (code === 0) {
        body.classList.add('sunny');
    } else if (code >= 1 && code <= 3) {
        body.classList.add('cloudy');
    } else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
        body.classList.add('rainy');
    } else if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
        body.classList.add('snowy');
    } else if (code >= 95) {
        body.classList.add('stormy');
    } else {
        body.classList.add('cloudy'); 
    }
}

async function getWeatherByCoords(lat, lon) {
    try {
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,windspeed_10m_max&timezone=auto`);
        const data = await response.json();

        if (data && data.current) {
            const temp = Math.round(data.current.temperature_2m);
            const apparentTemp = Math.round(data.current.apparent_temperature);
            const weatherCode = data.current.weather_code;

            document.getElementById('degree').textContent = temp;
            document.getElementById('temperature-feels').textContent = `Ощущается: ${apparentTemp}°`;
            document.getElementById('weather-name').textContent = getWeatherDescription(weatherCode);

            const weatherImg = document.querySelector('.weather-img');
            if (weatherImg) {
                weatherImg.src = getWeatherIcon(weatherCode);
            }

            updateBackgroundTheme(weatherCode);
        }

        if (data && data.hourly) {
            const hourlyContainer = document.getElementById('weather-hourly');
            hourlyContainer.innerHTML = '';

            const hourlyData = data.hourly;
            
            const currentHourIndex = new Date().getHours();

            for (let i = currentHourIndex; i < currentHourIndex + 24 && i < hourlyData.time.length; i++) {
                const timeStr = new Date(hourlyData.time[i]).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                const temp = Math.round(hourlyData.temperature_2m[i]);
                const code = hourlyData.weather_code[i];

                const card = document.createElement('div');
                card.className = 'hourly-card';
                card.innerHTML = `
                    <span class="hourly-time">${timeStr}</span>
                    <img class="hourly-icon" src="${getWeatherIcon(code)}" alt="weather">
                    <span class="hourly-temp">${temp}°</span>
                `;

                hourlyContainer.appendChild(card);
            }
        }

        if (data && data.daily) {
            const sevenDaysContainer = document.getElementById('weather-seven-days');
            sevenDaysContainer.innerHTML = '';

            const dailyData = data.daily;

            for (let i = 0; i < 7; i++) {
                const dateStr = dailyData.time[i];
                const maxTemp = Math.round(dailyData.temperature_2m_max[i]);
                const minTemp = Math.round(dailyData.temperature_2m_min[i]);
                const windSpeed = Math.round(dailyData.windspeed_10m_max[i]);
                const code = dailyData.weather_code[i];

                const formattedDate = formatDayLabel(dateStr, i);

                const dayDiv = document.createElement('div');
                dayDiv.id = 'weather-day';
                dayDiv.innerHTML = `
                    <div id="day-week">
                        <span class="day">${formattedDate.dayName}</span>
                        <span class="number-day">${formattedDate.dateNum}</span>
                    </div>
                    <img class="icon-weather" src="${getWeatherIcon(code)}" alt="weather">
                    <span class="wind">${windSpeed} км/ч</span>
                    <div id="day-degree">
                        <span class="days-degree">${maxTemp}°</span>
                        <span class="night-degree">${minTemp}°</span>
                    </div>
                `;

                sevenDaysContainer.appendChild(dayDiv);
            }
        }
    } catch (error) {
        console.error('Ошибка при загрузке погоды:', error);
    }
}
