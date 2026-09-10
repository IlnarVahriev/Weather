const autoGeoBtn = document.querySelector('.auto-geo-btn');
const nameCity = document.getElementById('name-city');
const countryName = document.getElementById('country');
const searchBtn = document.querySelector('.search-city-btn');
const searchModal = document.getElementById('search-modal');
const closeBtn = document.querySelector('.close');
const inputCity = document.getElementById('input-name-city');
const cityList = document.getElementById('city-list');

searchBtn.addEventListener('click', function() {
    searchModal.style.display = 'flex';
});

closeBtn.addEventListener('click', function() {
    searchModal.style.display = 'none';
});

autoGeoBtn.addEventListener('click', function() {
    if (!navigator.geolocation) {
        alert('Геолокация не поддерживается');
        return;
    }

    navigator.geolocation.getCurrentPosition(function(pos) {
        let lat = pos.coords.latitude;
        let lon = pos.coords.longitude;

        nameCity.textContent = 'Мое местоположение';
        countryName.textContent = '';

        getWeather(lat, lon);
    }, function(err) {
        console.log(err);
        alert('Не удалось определить координаты');
    });
});

let timer;

inputCity.addEventListener('input', function() {
    clearTimeout(timer);
    let text = inputCity.value.trim();

    if (text.length < 2) {
        cityList.innerHTML = '';
        return;
    }

    timer = setTimeout(async function() {
        try {
            let res = await fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(text) + '&count=15&language=ru&format=json');
            let data = await res.json();

            cityList.innerHTML = '';

            if (data.results) {
                for (let i = 0; i < data.results.length; i++) {
                    let item = data.results[i];
                    let cityName = item.name;
                    let country = item.country || '';
                    let region = item.admin1 || '';

                    let extraText = '';
                    if (region != '' && region != cityName) {
                        extraText = region;
                    }
                    if (country != '') {
                        if (extraText != '') {
                            extraText = extraText + ', ' + country;
                        } else {
                            extraText = country;
                        }
                    }

                    let li = document.createElement('li');
                    li.innerHTML = `
                        <button class="city-item-btn">
                            <div class="city-text-box">
                                <span class="city-name">${cityName}</span>
                                <span class="country-name">${extraText}</span>
                            </div>
                            <span class="arrow-icon">&gt;</span>
                        </button>
                    `;

                    li.querySelector('button').addEventListener('click', function() {
                        nameCity.textContent = cityName;
                        countryName.textContent = extraText;

                        getWeather(item.latitude, item.longitude);

                        searchModal.style.display = 'none';
                        inputCity.value = '';
                        cityList.innerHTML = '';
                    });

                    cityList.appendChild(li);
                }
            }
        } catch (err) {
            console.log(err);
        }
    }, 400);
});

async function getWeather(lat, lon) {
    try {
        let res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&current=temperature_2m,apparent_temperature,weather_code&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max&timezone=auto');
        let data = await res.json();

        if (data.current) {
            let temp = Math.round(data.current.temperature_2m);
            let feels = Math.round(data.current.apparent_temperature);
            let code = data.current.weather_code;

            document.getElementById('degree').textContent = temp;
            document.getElementById('temperature-feels').textContent = 'Ощущается: ' + feels + '°';
            document.getElementById('weather-name').textContent = getWeatherDescription(code);

            let icon = document.querySelector('.weather-img');
            if (icon) {
                icon.src = getWeatherIcon(code);
            }

            updateTheme(code);
        }

        let hourlyBox = document.getElementById('weather-hourly');
        if (hourlyBox && data.hourly) {
            hourlyBox.innerHTML = '';
            let currentHour = new Date().getHours();

            for (let i = currentHour; i < currentHour + 24; i++) {
                if (i >= data.hourly.time.length) {
                    break;
                }

                let d = new Date(data.hourly.time[i]);
                let timeStr = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                let hTemp = Math.round(data.hourly.temperature_2m[i]);
                let hCode = data.hourly.weather_code[i];

                let card = document.createElement('div');
                card.className = 'hourly-card';
                card.innerHTML = `
                    <span class="hourly-time">${timeStr}</span>
                    <img class="hourly-icon" src="${getWeatherIcon(hCode)}" alt="weather">
                    <span class="hourly-temp">${hTemp}°</span>
                `;
                hourlyBox.appendChild(card);
            }
        }

        let dailyBox = document.getElementById('weather-seven-days');
        if (dailyBox && data.daily) {
            dailyBox.innerHTML = '';

            for (let i = 0; i < 7; i++) {
                let dateStr = data.daily.time[i];
                let max = Math.round(data.daily.temperature_2m_max[i]);
                let min = Math.round(data.daily.temperature_2m_min[i]);
                let wind = Math.round(data.daily.wind_speed_10m_max[i]);
                let dCode = data.daily.weather_code[i];

                let dateObj = new Date(dateStr);
                let dayTitle = '';

                if (i == 0) {
                    dayTitle = 'Сегодня';
                } else if (i == 1) {
                    dayTitle = 'Завтра';
                } else {
                    dayTitle = dateObj.toLocaleDateString('ru-RU', { weekday: 'long' });
                }

                let numDate = dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

                let itemDiv = document.createElement('div');
                itemDiv.className = 'weather-day-item';
                itemDiv.innerHTML = `
                    <div class="day-week-box">
                        <span class="day">${dayTitle}</span>
                        <span class="number-day">${numDate}</span>
                    </div>
                    <img class="icon-weather" src="${getWeatherIcon(dCode)}" alt="weather">
                    <span class="wind">${wind} км/ч</span>
                    <div class="day-degree-box">
                        <span class="days-degree">${max}°</span>
                        <span class="night-degree">${min}°</span>
                    </div>
                `;
                dailyBox.appendChild(itemDiv);
            }
        }

    } catch (e) {
        console.log(e);
        alert('Ошибка при загрузке погоды');
    }
}

function getWeatherDescription(code) {
    if (code == 0) return 'Ясно';
    if (code == 1) return 'Малооблачно';
    if (code == 2) return 'Переменная облачность';
    if (code == 3) return 'Пасмурно';
    if (code == 45) return 'Туман';
    if (code == 51) return 'Слабая морось';
    if (code == 61) return 'Небольшой дождь';
    if (code == 63) return 'Дождь';
    if (code == 65) return 'Сильный дождь';
    if (code == 71) return 'Небольшой снег';
    if (code == 95) return 'Гроза';
    return 'Облачно';
}

function getWeatherIcon(code) {
    if (code == 0) {
        return './img/sun.svg';
    } else if (code >= 1 && code <= 3) {
        return './img/cloud.svg';
    } else if (code >= 51 && code <= 67) {
        return './img/rain.svg';
    } else if (code >= 71 && code <= 77) {
        return './img/snow.svg';
    } else if (code >= 95) {
        return './img/storm.svg';
    } else {
        return './img/sun.svg';
    }
}

function updateTheme(code) {
    document.body.className = '';

    if (code == 0) {
        document.body.classList.add('sunny');
    } else if (code >= 1 && code <= 3) {
        document.body.classList.add('cloudy');
    } else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
        document.body.classList.add('rainy');
    } else if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
        document.body.classList.add('snowy');
    } else if (code >= 95) {
        document.body.classList.add('stormy');
    } else {
        document.body.classList.add('cloudy');
    }
}
