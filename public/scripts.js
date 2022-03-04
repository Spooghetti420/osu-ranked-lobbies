let m;
let user_id = null;


function click_listener(evt) {
  // Intercept clicks that don't lead to an external domain
  if (this.tagName == 'A') {
    if (this.host == location.host) {
      evt.preventDefault();

      console.log('Loading ' + this.href);
      window.history.pushState({}, 'osu! ranked lobbies', this.href);
      document.querySelector('main').innerHTML = '';
      route(this.href);
    }
  }
};

window.addEventListener('popstate', function(event) {
  route(event.target.location.href);
});


async function get(url) {
  const res = await fetch(url, {
    credentials: 'same-origin',
  });

  if (!user_id && res.headers.has('X-Osu-ID')) {
    user_id = res.headers.get('X-Osu-ID');

    const a = document.querySelector('.login_link');
    a.setAttribute('class', 'profile_link');
    a.href = '/u/' + user_id + '/';
    a.innerHTML = `
      <img src="https://s.ppy.sh/a/${user_id}" />
      <span>Profile</span>`;
  }

  return await res.json();
}


function render_pagination(node, page_num, max_pages, url_formatter) {
  const MAX_PAGINATED_PAGES = Math.min(max_pages, 9);
  let pagination_min = page_num;
  let pagination_max = page_num;
  let nb_paginated_pages = 1;
  const pages = [];

  while (nb_paginated_pages < MAX_PAGINATED_PAGES) {
    if (pagination_min > 1) {
      pagination_min--;
      nb_paginated_pages++;
    }
    if (pagination_max < max_pages) {
      pagination_max++;
      nb_paginated_pages++;
    }
  }
  for (let i = pagination_min; i <= pagination_max; i++) {
    pages.push({
      number: i,
      is_current: i == page_num,
    });
  }

  const previous = Math.max(page_num - 1, 1);
  const next = Math.min(page_num + 1, max_pages);
  node.innerHTML = `
    <a href="${url_formatter(previous)}"><span class="left-arrow">‹</span>Previous</a>
    <div class="number-nav"></div>
    <a href="${url_formatter(next)}">Next<span class="right-arrow">›</span></a>`;
  const numbers_div = node.querySelector('.number-nav');
  for (const page of pages) {
    numbers_div.innerHTML += `
      <a ${page.is_current ? 'class="current-page"' : ''}
      href="${url_formatter(page.number)}">${page.number}</a>`;
  }
}


async function render_lobbies() {
  document.title = 'Lobbies - o!RL';
  const json = await get('/api/lobbies/');
  const template = document.querySelector('#lobbies-template').content.cloneNode(true);
  const list = template.querySelector('.lobby-list tbody');

  for (const lobby of json) {
    const lobby_div = document.createElement('div');
    lobby_div.classList.add('lobby');
    list.appendChild(lobby_div);
  }

  document.querySelector('main').appendChild(template);
}


async function render_leaderboard(page_num) {
  document.title = 'Leaderboard - o!RL';
  const json = await get(`/api/leaderboard/${page_num}`);

  const template = document.querySelector('#leaderboard-template').content.cloneNode(true);
  template.querySelector('.nb-ranked').innerText = `${json.nb_ranked_players} ranked players`;

  if (json.the_one) {
    template.querySelector('.leaderboard-focus').innerHTML += `
      <p class="username"><a href="/u/${json.the_one.user_id}/">${json.the_one.username}</a></p>
      <p class="elo-value">${json.the_one.elo}</p>
      <p class="elo">ELO</p>`;
  } else {
    template.querySelector('.leaderboard-focus').remove();
  }

  const lboard = template.querySelector('.leaderboard tbody');
  for (const player of json.players) {
    lboard.innerHTML += `
      <tr>
        <td>${player.ranking}</td>
        <td><a href="/u/${player.user_id}/">${player.username}</a></td>
        <td>${player.elo}</td>
        <td>ELO</td>
      </tr>`;
  }

  const pagi_div = template.querySelector('.pagination');
  render_pagination(pagi_div, json.page, json.max_pages, (num) => `/leaderboard/page-${num}/`);

  document.querySelector('main').appendChild(template);
}


async function render_user(user_id, page_num) {
  const json = await get('/api/user/' + user_id);
  document.title = `${json.username} - o!RL`;

  const template = document.querySelector('#user-template').content.cloneNode(true);
  template.querySelector('.heading-left img').src = `https://s.ppy.sh/a/${json.user_id}`;
  template.querySelector('.heading-right h1').innerText = json.username;
  template.querySelector('.heading-right .subheading').href = `https://osu.ppy.sh/users/${json.user_id}`;

  const blocks = template.querySelectorAll('.user-focus-block');
  blocks[0].innerHTML = `<span>${json.rank.text}</span><span>Rank #${json.rank.rank_nb}</span>`;
  blocks[1].innerHTML = `<span>${json.games_played}</span><span>Games Played</span>`;
  blocks[2].innerHTML = `<span>${json.elo}</span><span>Elo</span>`;
  document.querySelector('main').appendChild(template);

  const matches_json = await get(`/api/user/${user_id}/matches/${page_num}`);
  const tbody = document.querySelector('.match-history tbody');
  for (const match of matches_json.matches) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="map">
        <a href="https://osu.ppy.sh/beatmapsets/${match.map.set_id}#osu/${match.map.id}"></a>
      </td>
      <td>${match.placement}/${match.players_in_match}</td>
      <td ${match.negative ? 'class="red"' : ''} ${match.positive ? 'class="green"' : ''}>
        ${match.positive ? '+' : ''}${match.elo_change}
      </td>
      <td data-tms="${match.tms}">${match.time}</td>`;
    row.querySelector('.map a').innerText = match.map.name;
    tbody.appendChild(row);
  }

  const pagi_div = document.querySelector('.pagination');
  render_pagination(pagi_div, matches_json.page, matches_json.max_pages, (num) => `/u/${user_id}/page-${num}/`);
}


async function route(new_url) {
  if (m = new_url.match(/\/lobbies\//)) {
    document.querySelector('main').innerHTML = '';
    await render_lobbies();
  } else if (m = new_url.match(/\/leaderboard\/(page-(\d+)\/)?/)) {
    const page_num = m[2] || 1;
    document.querySelector('main').innerHTML = '';
    await render_leaderboard(page_num);
  } else if (m = new_url.match(/\/u\/(\d+)\/page-(\d+)\/?/)) {
    const user_id = m[1];
    const page_num = m[2] || 1;
    document.querySelector('main').innerHTML = '';
    await render_user(user_id, page_num);
  } else if (m = new_url.match(/\/u\/(\d+)\/?/)) {
    const user_id = m[1];
    document.querySelector('main').innerHTML = '';
    await render_user(user_id, 1);
  }

  const links = document.querySelectorAll('a');
  for (const link of links) {
    link.removeEventListener('click', click_listener);
  }
  for (const link of links) {
    link.addEventListener('click', click_listener);
  }
}

// Theme switch
let theme = localStorage.getItem('theme') || 'dark';
document.body.setAttribute('class', theme == 'light' ? '' : 'dark-mode');

function toggleTheme() {
  if (theme == 'dark') {
    localStorage.setItem('theme', 'light');
    document.body.setAttribute('class', '');
    theme = 'light';
  } else {
    localStorage.setItem('theme', 'dark');
    document.body.setAttribute('class', 'dark-mode');
    theme = 'dark';
  }
}

const lightThemeSwitcher = document.querySelector('.switcher-sun');
const darkThemeSwitcher = document.querySelector('.switcher-moon');
lightThemeSwitcher.addEventListener('click', toggleTheme);
darkThemeSwitcher.addEventListener('click', toggleTheme);

lightThemeSwitcher.addEventListener('mouseover', (ev) => {
  lightThemeSwitcher.setAttribute('class', lightThemeSwitcher.getAttribute('class').replace('fadeout', '').trim()+' fadeout');
  darkThemeSwitcher.setAttribute('class', darkThemeSwitcher.getAttribute('class').replace('fadein', '').trim()+' fadein');
});

lightThemeSwitcher.addEventListener('mouseout', (ev) => {
  lightThemeSwitcher.setAttribute('class', lightThemeSwitcher.getAttribute('class').replace('fadeout', '').trim());
  darkThemeSwitcher.setAttribute('class', darkThemeSwitcher.getAttribute('class').replace('fadein', '').trim());
});

darkThemeSwitcher.addEventListener('mouseover', (ev) => {
  darkThemeSwitcher.setAttribute('class', darkThemeSwitcher.getAttribute('class').replace('fadeout', '').trim()+' fadeout');
  lightThemeSwitcher.setAttribute('class', lightThemeSwitcher.getAttribute('class').replace('fadein', '').trim()+' fadein');
});

darkThemeSwitcher.addEventListener('mouseout', (ev) => {
  darkThemeSwitcher.setAttribute('class', darkThemeSwitcher.getAttribute('class').replace('fadeout', '').trim());
  lightThemeSwitcher.setAttribute('class', lightThemeSwitcher.getAttribute('class').replace('fadein', '').trim());
});


// User search
const searchResults = document.querySelector('.search-results');
const searchField = document.querySelector('.search-button');
const searchFieldInput = document.querySelector('.search-button input');
const searchFieldBackground = document.querySelector('.search-button + .search-background');
if (searchField) {
  searchField.addEventListener('click', () => searchFieldInput.focus());
  searchFieldInput.addEventListener('focus', (ev) => {
    let classes = searchField.getAttribute('class');
    if (classes.indexOf('active') === -1) {
      classes += ' active';
      searchField.setAttribute('class', classes);
    }
  });

  const searchTimeout = 400;
  const lastSearchRequest = {
    tms: null,
    job: null,
  };

  searchField.addEventListener('input', (ev) => {
    searchResults.innerHTML = '';
    const searchQuery = ev.target.value;
    clearTimeout(lastSearchRequest.job);
    if (searchQuery === '') {
      return;
    };
    lastSearchRequest.job = setTimeout(() => {
      fetch(`/search?query=${searchQuery}`)
          .then((res) => res.json())
          .then((res) => {
            res.forEach((player) => {
              player.username = player.username.length > 20 ? (player.username.substr(0, 20)+'...') : player.username;
              searchResults.innerHTML += `
              <a href="/u/${player.user_id}" class="search-result-item">
                <span>${player.username}</span>
                <span>${Math.trunc(player.elo)}</span>
              </a>
            `;
            });
            if (res.length === 0) {
              searchResults.innerHTML = `
              <div class="search-result-item not-found">
                Nothing found!
              </div>
            `;
            }
          });
    }, searchTimeout);
    lastSearchRequest.tms = Date.now();
  });

  searchFieldBackground.addEventListener('click', () => {
    searchField.setAttribute('class', searchField.getAttribute('class').replace('active', '').trim());
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    const activeItem = document.querySelector('.search-result-item.active');
    if (activeItem) {
      document.location = activeItem.getAttribute('href');
    }
  }
  const changeActiveItem = (isDown) => {
    if (searchFieldInput === document.activeElement) {
      searchFieldInput.blur();
    }
    const items = document.querySelectorAll('.search-result-item');
    if (!document.querySelector('.search-result-item.active')) {
      items[0].setAttribute('class', items[0].getAttribute('class')+' active');
      return;
    }
    for (let i = 0; i < items.length; i++) {
      if (items[i].getAttribute('class').indexOf('active') !== -1) {
        items[i].setAttribute('class', items[i].getAttribute('class').replace('active', '').trim());
        let nextIndex;
        if (isDown) {
          nextIndex = ((i + 1) > (items.length - 1)) ? 0 : (i + 1);
        } else {
          nextIndex = ((i - 1) < 0) ? (items.length - 1) : (i - 1);
        }
        items[nextIndex].setAttribute('class', items[nextIndex].getAttribute('class')+' active');
        return;
      }
    }
  };
  if (event.keyCode === 40) {
    if (document.querySelector('.search-button.active')) {
      event.preventDefault();
    }
    changeActiveItem(true);
  }
  if (event.keyCode === 38) {
    if (document.querySelector('.search-button.active')) {
      event.preventDefault();
    }
    changeActiveItem(false);
  }
  if (event.key === 'Escape') {
    searchField.setAttribute('class', searchField.getAttribute('class').replace('active', '').trim());
    searchFieldInput.blur();
  }
});


// Load pages and hijack browser browsing
route(location.pathname);
